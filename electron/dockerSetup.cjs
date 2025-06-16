const { EventEmitter } = require('events');
const Docker = require('dockerode');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { app, dialog } = require('electron');
const tar = require('tar-fs');
const http = require('http');
const { spawn, exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class DockerSetup extends EventEmitter {
  constructor() {
    super();
    this.isDevMode = process.env.NODE_ENV === 'development';
    this.appDataPath = path.join(os.homedir(), '.clara');
    
    // Docker binary paths - using Docker CLI path for both docker and compose commands
    this.dockerPath = '/usr/local/bin/docker';
    
    // Initialize Docker client with the first working socket
    this.docker = this.initializeDockerClient();

    // Path for storing pull timestamps
    this.pullTimestampsPath = path.join(this.appDataPath, 'pull_timestamps.json');

    // Get system architecture
    this.systemArch = this.getSystemArchitecture();
    console.log(`Detected system architecture: ${this.systemArch}`);

    // Container configuration - Removed Ollama container
    this.containers = {
      python: {
        name: 'clara_python',
        image: this.getArchSpecificImage('clara17verse/clara-backend', 'latest'),
        port: 5001,
        internalPort: 5000,
        healthCheck: this.isPythonRunning.bind(this),
        volumes: [
          `${this.appDataPath}:/root/.clara`
        ]
      },
      n8n: {
        name: 'clara_n8n',
        image: this.getArchSpecificImage('n8nio/n8n', 'latest'),
        port: 5678,
        internalPort: 5678,
        healthCheck: this.checkN8NHealth.bind(this),
        volumes: [
          `${path.join(this.appDataPath, 'n8n')}:/home/node/.n8n`
        ]
      },
      comfyui: {
        name: 'clara_comfyui',
        image: this.getArchSpecificImage('clara17verse/clara-comfyui', 'latest'),
        port: 8188,
        internalPort: 8188,
        healthCheck: this.isComfyUIRunning.bind(this),
        volumes: this.getComfyUIVolumes(),
        environment: [
          'NVIDIA_VISIBLE_DEVICES=all',
          'CUDA_VISIBLE_DEVICES=0',
          // AGGRESSIVE Performance optimizations for 4090
          'PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:2048,garbage_collection_threshold:0.8,expandable_segments:True',
          'CUDA_LAUNCH_BLOCKING=0',
          'TORCH_CUDNN_V8_API_ENABLED=1',
          'TORCH_CUDNN_BENCHMARK=1',
          'TORCH_BACKENDS_CUDNN_BENCHMARK=1',
          // Memory optimizations for 24GB VRAM
          'PYTORCH_CUDA_MEMORY_FRACTION=0.95',
          'CUDA_CACHE_DISABLE=0',
          'CUDA_CACHE_MAXSIZE=2147483648', // 2GB cache
          // ComfyUI aggressive optimizations
          'COMFYUI_FORCE_FP16=1',
          'COMFYUI_DISABLE_XFORMERS_WARNING=1',
          'COMFYUI_ENABLE_PYTORCH_ATTENTION=1',
          'COMFYUI_DISABLE_SMART_MEMORY=0',
          'COMFYUI_VRAM_MANAGEMENT=gpu-only',
          'COMFYUI_FORCE_UPCAST_ATTENTION=0',
          'COMFYUI_DONT_UPCAST_ATTENTION=1',
          // Disable unnecessary features for speed
          'XFORMERS_MORE_DETAILS=0',
          'TRANSFORMERS_VERBOSITY=error',
          'TOKENIZERS_PARALLELISM=true',
          // Python optimizations
          'PYTHONUNBUFFERED=1',
          'PYTHONDONTWRITEBYTECODE=1',
          'OMP_NUM_THREADS=16', // Match your i9 cores
          'MKL_NUM_THREADS=16'
        ],
        runtime: 'nvidia', // Enable GPU support if available
        restartPolicy: 'unless-stopped',
        // Add memory and CPU limits for optimal performance
        memoryLimit: '32g', // Use plenty of RAM
        cpuLimit: '16', // Use all CPU cores
        shmSize: '8g' // Large shared memory for faster data transfer
      }
    };

    // Ensure app data directory exists
    if (!fs.existsSync(this.appDataPath)) {
      fs.mkdirSync(this.appDataPath, { recursive: true });
    }

    // Initialize pull timestamps if not exists
    this.initializePullTimestamps();

    // Docker Compose file path
    this.composeFilePath = path.join(this.appDataPath, 'docker-compose.yml');
    
    // Docker Desktop app paths
    this.dockerAppPaths = {
      darwin: '/Applications/Docker.app'
    };

    // Get the app root directory
    this.appRoot = path.resolve(__dirname, '..');

    // Default ports with fallbacks
    this.ports = {
      python: 5001,
      n8n: 5678,
      ollama: 11434,
      comfyui: 8188
    };

    // Maximum retry attempts for service health checks
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds

    // Clara container names
    this.containerNames = ['clara_python', 'clara_n8n', 'clara_comfyui'];

    // Create subdirectories for each service
    Object.keys(this.containers).forEach(service => {
      const servicePath = path.join(this.appDataPath, service);
      if (!fs.existsSync(servicePath)) {
        fs.mkdirSync(servicePath, { recursive: true });
      }
    });

    // Create ComfyUI specific directories
    const comfyuiDirs = [
      'comfyui_models',
      'comfyui_output', 
      'comfyui_input',
      'comfyui_custom_nodes',
      'comfyui_temp'
    ];
    
    comfyuiDirs.forEach(dir => {
      const dirPath = path.join(this.appDataPath, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });
  }

  /**
   * Detect if NVIDIA GPU and Docker runtime are available
   */
  async detectNvidiaGPU() {
    try {
      // Check if nvidia-smi is available
      const { stdout } = await execAsync('nvidia-smi --query-gpu=name --format=csv,noheader,nounits');
      const gpus = stdout.trim().split('\n').filter(line => line.trim());
      
      if (gpus.length > 0) {
        console.log(`🎮 Detected NVIDIA GPU(s): ${gpus.join(', ')}`);
        
        // Check if nvidia-container-runtime is available in Docker
        try {
          const { stdout: dockerInfo } = await execAsync('docker info');
          if (dockerInfo.includes('nvidia') || dockerInfo.includes('Nvidia')) {
            console.log('✅ NVIDIA Container Runtime detected in Docker');
            return true;
                     } else {
             console.log('⚠️  NVIDIA GPU detected but nvidia-container-runtime not available in Docker');
             this.getGPUSetupInstructions();
             return false;
           }
        } catch (runtimeError) {
          console.log('⚠️  Could not check Docker runtime support');
          // Try to test GPU access directly
          return await this.testNvidiaDockerAccess();
        }
      }
      
      return false;
    } catch (error) {
      console.log('ℹ️  No NVIDIA GPU detected or nvidia-smi not available');
      return false;
    }
  }

  /**
   * Test NVIDIA Docker access by running a simple GPU container
   */
  async testNvidiaDockerAccess() {
    try {
      console.log('🧪 Testing NVIDIA Docker access...');
      const { stdout } = await execAsync('docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi', { timeout: 30000 });
      if (stdout.includes('NVIDIA-SMI')) {
        console.log('✅ NVIDIA Docker access confirmed');
        return true;
      }
      return false;
    } catch (error) {
      console.log('❌ NVIDIA Docker access test failed:', error.message);
      return false;
    }
  }

  /**
   * Provide GPU setup instructions for the user
   */
  getGPUSetupInstructions() {
    const platform = process.platform;
    
    console.log('\n🔧 GPU Setup Instructions:');
    console.log('==========================================');
    
    if (platform === 'linux') {
      console.log('For Linux (Ubuntu/Debian):');
      console.log('1. Install NVIDIA Container Toolkit:');
      console.log('   curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg');
      console.log('   curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | sed \'s#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g\' | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list');
      console.log('   sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit');
      console.log('2. Configure Docker:');
      console.log('   sudo nvidia-ctk runtime configure --runtime=docker');
      console.log('   sudo systemctl restart docker');
    } else if (platform === 'win32') {
      console.log('For Windows with Docker Desktop:');
      console.log('1. Ensure you have NVIDIA drivers installed');
      console.log('2. Enable WSL2 integration in Docker Desktop');
      console.log('3. Install nvidia-container-toolkit in WSL2:');
      console.log('   Follow Linux instructions above in your WSL2 distribution');
    } else if (platform === 'darwin') {
      console.log('For macOS:');
      console.log('NVIDIA GPU support is not available on macOS with Docker Desktop');
      console.log('Consider using Metal Performance Shaders for GPU acceleration');
    }
    
    console.log('\n📖 Full documentation:');
    console.log('https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html');
    console.log('==========================================\n');
  }

  /**
   * Check if ComfyUI optimizations have already been run
   */
  async checkComfyUIOptimizationStatus() {
    try {
      const optimizationFlagPath = path.join(this.appDataPath, 'comfyui_optimized.flag');
      return fs.existsSync(optimizationFlagPath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Mark ComfyUI as optimized
   */
  async markComfyUIOptimized() {
    try {
      const optimizationFlagPath = path.join(this.appDataPath, 'comfyui_optimized.flag');
      fs.writeFileSync(optimizationFlagPath, new Date().toISOString());
    } catch (error) {
      console.error('Error marking ComfyUI as optimized:', error);
    }
  }

  /**
   * Optimize ComfyUI container for maximum GPU performance on high-end hardware
   */
  async optimizeComfyUIContainer() {
    try {
      // Check if already optimized
      if (await this.checkComfyUIOptimizationStatus()) {
        console.log('✅ ComfyUI already optimized, skipping...');
        return;
      }

      console.log('🚀 Optimizing ComfyUI container for maximum GPU performance...');
      
      const container = this.docker.getContainer('clara_comfyui');
      
      // Check if container is running
      const containerInfo = await container.inspect();
      if (containerInfo.State.Status !== 'running') {
        console.log('⚠️  ComfyUI container is not running, skipping optimization');
        return;
      }

      // Aggressive optimization commands for high-end hardware
      const optimizationCommands = [
        // Update PyTorch to latest for best 4090 support
        'pip install --upgrade torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121',
        // Install latest xFormers for maximum speed
        'pip install --force-reinstall xformers --index-url https://download.pytorch.org/whl/cu121',
        // Install optimized ONNX runtime for ControlNet
        'pip install onnxruntime-gpu --force-reinstall',
        // Install TensorRT for maximum inference speed
        'pip install nvidia-tensorrt',
        // Install optimized attention mechanisms
        'pip install flash-attn --no-build-isolation',
        // Compile PyTorch for this specific GPU
        'python -c "import torch; torch.backends.cudnn.benchmark = True; torch.backends.cuda.matmul.allow_tf32 = True; torch.backends.cudnn.allow_tf32 = True"',
        // Pre-compile CUDA kernels
        'python -c "import torch; torch.cuda.empty_cache(); torch.cuda.synchronize()"',
        // Set optimal GPU clocks (if supported)
        'nvidia-smi -pm 1 || true', // Enable persistence mode
        'nvidia-smi -ac 9501,2100 || true' // Set memory and GPU clocks to max (adjust for your 4090)
      ];

      for (const command of optimizationCommands) {
        try {
          console.log(`Running: ${command}`);
          const exec = await container.exec({
            Cmd: ['bash', '-c', command],
            AttachStdout: true,
            AttachStderr: true
          });
          
          const stream = await exec.start({ hijack: true, stdin: false });
          
          // Wait for command to complete
          await new Promise((resolve, reject) => {
            let output = '';
            stream.on('data', (data) => {
              output += data.toString();
            });
            stream.on('end', () => {
              console.log(`✅ Command completed: ${command.substring(0, 50)}...`);
              resolve(output);
            });
            stream.on('error', reject);
            
            // Timeout after 10 minutes for compilation tasks
            setTimeout(() => reject(new Error('Command timeout')), 600000);
          });
        } catch (error) {
          console.log(`⚠️  Optimization command failed: ${command} - ${error.message}`);
        }
      }

      // Create a performance test script
      const performanceTestScript = `
import torch
import time

print("🚀 Testing GPU performance...")
print(f"GPU: {torch.cuda.get_device_name()}")
print(f"CUDA Version: {torch.version.cuda}")
print(f"PyTorch Version: {torch.__version__}")
print(f"VRAM Available: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")

# Test tensor operations speed
device = torch.device('cuda')
x = torch.randn(4096, 4096, device=device, dtype=torch.float16)
y = torch.randn(4096, 4096, device=device, dtype=torch.float16)

start_time = time.time()
for _ in range(100):
    z = torch.matmul(x, y)
    torch.cuda.synchronize()
end_time = time.time()

print(f"Matrix multiplication speed: {100 / (end_time - start_time):.1f} ops/sec")
print("✅ GPU optimization test completed")
`;

      try {
        console.log('Running GPU performance test...');
        const exec = await container.exec({
          Cmd: ['python', '-c', performanceTestScript],
          AttachStdout: true,
          AttachStderr: true
        });
        
        const stream = await exec.start({ hijack: true, stdin: false });
        
        await new Promise((resolve, reject) => {
          let output = '';
          stream.on('data', (data) => {
            const text = data.toString();
            output += text;
            console.log(text.trim());
          });
          stream.on('end', () => {
            resolve(output);
          });
          stream.on('error', reject);
          
          setTimeout(() => reject(new Error('Performance test timeout')), 60000);
        });
      } catch (error) {
        console.log(`⚠️  Performance test failed: ${error.message}`);
      }

      console.log('✅ ComfyUI aggressive optimization completed');
      await this.markComfyUIOptimized();
    } catch (error) {
      console.error('❌ Error optimizing ComfyUI container:', error.message);
    }
  }

  /**
   * Get ComfyUI volumes - optimized for high-performance systems
   */
  getComfyUIVolumes() {
    const os = require('os');
    
    // For high-performance systems, prefer Docker volumes over bind mounts
    // Docker volumes are faster than bind mounts, especially on Windows
    if (os.platform() === 'win32') {
      console.log('🚀 Using Docker volumes for maximum I/O performance on Windows');
      
      // Use Docker named volumes for best performance
      return [
        'clara_comfyui_models:/app/ComfyUI/models',
        'clara_comfyui_output:/app/ComfyUI/output',
        'clara_comfyui_input:/app/ComfyUI/input',
        'clara_comfyui_custom_nodes:/app/ComfyUI/custom_nodes',
        'clara_comfyui_temp:/app/ComfyUI/temp'
      ];
    }
    
    // For Linux/macOS, try WSL2 paths first, then fall back to bind mounts
    if (os.platform() === 'win32') {
      try {
        const { execSync } = require('child_process');
        
        // Try to detect WSL2 distributions and current user
        const wslList = execSync('wsl -l -v', { encoding: 'utf8' });
        const distributions = wslList.split('\n')
          .filter(line => line.includes('Running'))
          .map(line => line.trim().split(/\s+/)[0])
          .filter(dist => dist && dist !== 'NAME');
        
        if (distributions.length > 0) {
          // Use the first running distribution
          const distro = distributions[0];
          
          // Try to get the current user in WSL2
          let wslUser = 'root';
          try {
            wslUser = execSync(`wsl -d ${distro} whoami`, { encoding: 'utf8' }).trim();
          } catch (error) {
            console.warn('Could not detect WSL2 user, using root');
          }
          
          console.log(`🚀 Using WSL2 paths for ComfyUI (${distro}, user: ${wslUser})`);
          
          // Return WSL2 paths for much faster I/O
          return [
            `\\\\wsl.localhost\\${distro}\\home\\${wslUser}\\comfyui_models:/app/ComfyUI/models`,
            `\\\\wsl.localhost\\${distro}\\home\\${wslUser}\\comfyui_output:/app/ComfyUI/output`,
            `\\\\wsl.localhost\\${distro}\\home\\${wslUser}\\comfyui_input:/app/ComfyUI/input`,
            `\\\\wsl.localhost\\${distro}\\home\\${wslUser}\\comfyui_custom_nodes:/app/ComfyUI/custom_nodes`,
            `\\\\wsl.localhost\\${distro}\\home\\${wslUser}\\comfyui_temp:/app/ComfyUI/temp`
          ];
        }
      } catch (error) {
        console.warn('WSL2 not available or not running, using Docker volumes:', error.message);
      }
    }
    
    // Fallback to bind mounts for Linux/macOS
    console.log('📁 Using bind mounts for ComfyUI volumes');
    return [
      `${path.join(this.appDataPath, 'comfyui_models')}:/app/ComfyUI/models`,
      `${path.join(this.appDataPath, 'comfyui_output')}:/app/ComfyUI/output`,
      `${path.join(this.appDataPath, 'comfyui_input')}:/app/ComfyUI/input`,
      `${path.join(this.appDataPath, 'comfyui_custom_nodes')}:/app/ComfyUI/custom_nodes`,
      `${path.join(this.appDataPath, 'comfyui_temp')}:/app/ComfyUI/temp`
    ];
  }

  /**
   * Parse memory limit string to bytes
   */
  parseMemoryLimit(memoryStr) {
    if (!memoryStr) return undefined;
    
    const units = {
      'b': 1,
      'k': 1024,
      'm': 1024 * 1024,
      'g': 1024 * 1024 * 1024
    };
    
    const match = memoryStr.toLowerCase().match(/^(\d+)([bkmg]?)$/);
    if (!match) return undefined;
    
    const value = parseInt(match[1]);
    const unit = match[2] || 'b';
    
    return value * (units[unit] || 1);
  }

  /**
   * Enhanced Docker detection with comprehensive support for all Docker variants
   */
  async detectDockerInstallations() {
    const detectedInstallations = [];
    
    console.log('🔍 Starting comprehensive Docker detection...');
    
    // 1. Socket-based detection (existing + enhanced)
    const socketResults = await this.detectSocketBasedDocker();
    detectedInstallations.push(...socketResults);
    
    // 2. TCP/HTTP Docker detection
    const tcpResults = await this.detectTcpDocker();
    detectedInstallations.push(...tcpResults);
    
    // 3. Docker Context detection
    const contextResults = await this.detectDockerContexts();
    detectedInstallations.push(...contextResults);
    
    // 4. Docker Machine detection
    const machineResults = await this.detectDockerMachine();
    detectedInstallations.push(...machineResults);
    
    // 5. Alternative container runtimes (Podman, etc.)
    const alternativeResults = await this.detectAlternativeRuntimes();
    detectedInstallations.push(...alternativeResults);
    
    // 6. Process-based detection (fallback)
    const processResults = await this.detectDockerProcesses();
    detectedInstallations.push(...processResults);
    
    // Remove duplicates and sort by priority
    const uniqueInstallations = this.deduplicateAndPrioritize(detectedInstallations);
    
    console.log(`✅ Docker detection complete. Found ${uniqueInstallations.length} installation(s):`, 
                uniqueInstallations.map(i => `${i.type} (${i.method})`));
    
    return uniqueInstallations;
  }

  /**
   * Enhanced socket-based Docker detection
   */
  async detectSocketBasedDocker() {
    const results = [];
    
    // Comprehensive list of socket locations
    const socketLocations = [
      // Docker Desktop locations
      { path: path.join(os.homedir(), '.docker', 'desktop', 'docker.sock'), type: 'Docker Desktop', priority: 1 },
      { path: path.join(os.homedir(), '.docker', 'docker.sock'), type: 'Docker Desktop', priority: 2 },
      
      // Traditional Linux socket locations
      { path: '/var/run/docker.sock', type: 'Docker Engine', priority: 3 },
      { path: '/run/docker.sock', type: 'Docker Engine', priority: 4 },
      
      // WSL2 and Windows locations
      { path: '/mnt/wsl/docker-desktop/docker.sock', type: 'Docker Desktop (WSL2)', priority: 5 },
      { path: '/mnt/wsl/shared-docker/docker.sock', type: 'Docker (WSL2 Shared)', priority: 6 },
      { path: '/mnt/c/Users/Public/.docker/docker.sock', type: 'Docker (Windows Shared)', priority: 7 },
      
      // Alternative Docker implementations
      { path: path.join(os.homedir(), '.colima', 'docker.sock'), type: 'Colima', priority: 8 },
      { path: path.join(os.homedir(), '.colima', 'default', 'docker.sock'), type: 'Colima (Default)', priority: 9 },
      { path: path.join(os.homedir(), '.rd', 'docker.sock'), type: 'Rancher Desktop', priority: 10 },
      { path: path.join(os.homedir(), '.lima', 'docker', 'sock', 'docker.sock'), type: 'Lima Docker', priority: 11 },
      { path: path.join(os.homedir(), '.lima', 'default', 'sock', 'docker.sock'), type: 'Lima Docker (Default)', priority: 12 },
      
      // OrbStack (macOS Docker alternative)
      { path: path.join(os.homedir(), '.orbstack', 'run', 'docker.sock'), type: 'OrbStack', priority: 13 },
      
      // Snap Docker (Linux)
      { path: '/var/snap/docker/common/var-lib-docker.sock', type: 'Docker (Snap)', priority: 14 },
      { path: '/run/snap.docker.dockerd.socket', type: 'Docker (Snap)', priority: 15 },
      
      // Flatpak Docker (Linux)
      { path: path.join(os.homedir(), '.var', 'app', 'io.docker.Docker', 'docker.sock'), type: 'Docker (Flatpak)', priority: 16 },
      
      // Rootless Docker locations
      { path: path.join(os.homedir(), '.docker', 'run', 'docker.sock'), type: 'Docker (Rootless)', priority: 17 },
      { path: `/run/user/${process.getuid ? process.getuid() : '1000'}/docker.sock`, type: 'Docker (Rootless User)', priority: 18 },
      
      // Podman socket locations
      { path: path.join(os.homedir(), '.local', 'share', 'containers', 'podman', 'machine', 'podman.sock'), type: 'Podman', priority: 19 },
      { path: `/run/user/${process.getuid ? process.getuid() : '1000'}/podman/podman.sock`, type: 'Podman (User)', priority: 20 },
      { path: '/run/podman/podman.sock', type: 'Podman (System)', priority: 21 }
    ];

    // Windows named pipe
    if (process.platform === 'win32') {
      socketLocations.unshift({ 
        path: '//./pipe/docker_engine', 
        type: 'Docker Desktop (Windows)', 
        priority: 0,
        isNamedPipe: true 
      });
      
      // Additional Windows pipes
      socketLocations.push(
        { path: '//./pipe/podman-machine-default', type: 'Podman (Windows)', priority: 22, isNamedPipe: true },
        { path: '//./pipe/docker_wsl', type: 'Docker (WSL)', priority: 23, isNamedPipe: true }
      );
    }

    // Test each socket location
    for (const location of socketLocations) {
      try {
        let canConnect = false;
        
        if (location.isNamedPipe) {
          // For Windows named pipes, just try to create the client
          const testClient = new Docker({ socketPath: location.path });
          await testClient.ping();
          canConnect = true;
        } else {
          // For Unix sockets, check file existence first
          if (fs.existsSync(location.path)) {
            const testClient = new Docker({ socketPath: location.path });
            await testClient.ping();
            canConnect = true;
          }
        }
        
        if (canConnect) {
          results.push({
            type: location.type,
            method: 'socket',
            path: location.path,
            priority: location.priority,
            client: new Docker({ socketPath: location.path }),
            isNamedPipe: location.isNamedPipe || false
          });
          
          console.log(`✅ Found working ${location.type} at: ${location.path}`);
        }
      } catch (error) {
        // Silent fail for socket detection
        continue;
      }
    }

    return results;
  }

  /**
   * Detect TCP/HTTP Docker connections
   */
  async detectTcpDocker() {
    const results = [];
    const tcpHosts = [
      { host: 'localhost', port: 2375, tls: false, type: 'Docker (TCP)' },
      { host: 'localhost', port: 2376, tls: true, type: 'Docker (TLS)' },
      { host: '127.0.0.1', port: 2375, tls: false, type: 'Docker (TCP)' },
      { host: '127.0.0.1', port: 2376, tls: true, type: 'Docker (TLS)' }
    ];

    // Check environment variables for custom TCP hosts
    if (process.env.DOCKER_HOST && process.env.DOCKER_HOST.startsWith('tcp://')) {
      const url = new URL(process.env.DOCKER_HOST);
      tcpHosts.unshift({
        host: url.hostname,
        port: parseInt(url.port) || 2376,
        tls: process.env.DOCKER_TLS_VERIFY === '1',
        type: 'Docker (TCP from DOCKER_HOST)'
      });
    }

    for (const tcpHost of tcpHosts) {
      try {
        const dockerOptions = {
          host: tcpHost.host,
          port: tcpHost.port
        };

        if (tcpHost.tls) {
          dockerOptions.protocol = 'https';
          if (process.env.DOCKER_CERT_PATH) {
            dockerOptions.ca = fs.readFileSync(path.join(process.env.DOCKER_CERT_PATH, 'ca.pem'));
            dockerOptions.cert = fs.readFileSync(path.join(process.env.DOCKER_CERT_PATH, 'cert.pem'));
            dockerOptions.key = fs.readFileSync(path.join(process.env.DOCKER_CERT_PATH, 'key.pem'));
          }
        }

        const testClient = new Docker(dockerOptions);
        await testClient.ping();
        
        results.push({
          type: tcpHost.type,
          method: 'tcp',
          host: tcpHost.host,
          port: tcpHost.port,
          tls: tcpHost.tls,
          priority: 50,
          client: testClient
        });
        
        console.log(`✅ Found working ${tcpHost.type} at: ${tcpHost.host}:${tcpHost.port}`);
      } catch (error) {
        // Silent fail for TCP detection
        continue;
      }
    }

    return results;
  }

  /**
   * Detect Docker contexts
   */
  async detectDockerContexts() {
    const results = [];
    
    try {
      const { stdout } = await execAsync('docker context ls --format json', { timeout: 5000 });
      const contexts = stdout.trim().split('\n').map(line => JSON.parse(line));
      
      for (const context of contexts) {
        if (context.Current) {
          // This is the current context, try to use it
          try {
            const testClient = new Docker(); // Uses current context
            await testClient.ping();
            
            results.push({
              type: `Docker Context (${context.Name})`,
              method: 'context',
              contextName: context.Name,
              endpoint: context.DockerEndpoint,
              priority: 25,
              client: testClient
            });
            
            console.log(`✅ Found working Docker context: ${context.Name} (${context.DockerEndpoint})`);
          } catch (error) {
            continue;
          }
        }
      }
    } catch (error) {
      // Docker CLI not available or contexts not supported
    }

    return results;
  }

  /**
   * Detect Docker Machine installations
   */
  async detectDockerMachine() {
    const results = [];
    
    try {
      const { stdout } = await execAsync('docker-machine ls --format "{{.Name}},{{.State}},{{.URL}}"', { timeout: 5000 });
      const machines = stdout.trim().split('\n').filter(Boolean);
      
      for (const machineInfo of machines) {
        const [name, state, url] = machineInfo.split(',');
        
        if (state === 'Running' && url) {
          try {
            const machineUrl = new URL(url);
            const dockerOptions = {
              host: machineUrl.hostname,
              port: parseInt(machineUrl.port) || 2376,
              protocol: 'https'
            };

            // Try to get machine environment
            const { stdout: envOutput } = await execAsync(`docker-machine env ${name}`, { timeout: 3000 });
            const certPath = envOutput.match(/DOCKER_CERT_PATH="([^"]+)"/)?.[1];
            
            if (certPath && fs.existsSync(certPath)) {
              dockerOptions.ca = fs.readFileSync(path.join(certPath, 'ca.pem'));
              dockerOptions.cert = fs.readFileSync(path.join(certPath, 'cert.pem'));
              dockerOptions.key = fs.readFileSync(path.join(certPath, 'key.pem'));
            }

            const testClient = new Docker(dockerOptions);
            await testClient.ping();
            
            results.push({
              type: `Docker Machine (${name})`,
              method: 'machine',
              machineName: name,
              url: url,
              priority: 30,
              client: testClient
            });
            
            console.log(`✅ Found working Docker Machine: ${name} (${url})`);
          } catch (error) {
            continue;
          }
        }
      }
    } catch (error) {
      // Docker Machine not available
    }

    return results;
  }

  /**
   * Detect alternative container runtimes
   */
  async detectAlternativeRuntimes() {
    const results = [];
    
    // Test Podman compatibility
    try {
      const { stdout } = await execAsync('podman version --format json', { timeout: 3000 });
      const podmanInfo = JSON.parse(stdout);
      
      // Podman can be used as Docker replacement
      const podmanSockets = [
        path.join(os.homedir(), '.local', 'share', 'containers', 'podman', 'machine', 'podman.sock'),
        `/run/user/${process.getuid ? process.getuid() : '1000'}/podman/podman.sock`,
        '/run/podman/podman.sock'
      ];

      for (const socketPath of podmanSockets) {
        if (fs.existsSync(socketPath)) {
          try {
            const testClient = new Docker({ socketPath });
            await testClient.ping();
            
            results.push({
              type: `Podman v${podmanInfo.Client.Version}`,
              method: 'podman',
              path: socketPath,
              priority: 40,
              client: testClient,
              isPodman: true
            });
            
            console.log(`✅ Found working Podman at: ${socketPath}`);
            break; // Only add one Podman instance
          } catch (error) {
            continue;
          }
        }
      }
    } catch (error) {
      // Podman not available
    }

    return results;
  }

  /**
   * Process-based Docker detection (fallback method)
   */
  async detectDockerProcesses() {
    const results = [];
    
    try {
      let psCommand;
      if (process.platform === 'win32') {
        psCommand = 'wmic process where "name=\'dockerd.exe\' or name=\'docker.exe\'" get ProcessId,CommandLine /format:csv';
      } else {
        psCommand = 'ps aux | grep -E "(dockerd|docker|podman)" | grep -v grep';
      }
      
      const { stdout } = await execAsync(psCommand, { timeout: 5000 });
      
      if (stdout.trim()) {
        // Found Docker processes, try default connection
        try {
          const testClient = new Docker();
          await testClient.ping();
          
          results.push({
            type: 'Docker (Process Detection)',
            method: 'process',
            priority: 60,
            client: testClient
          });
          
          console.log('✅ Found Docker via process detection');
        } catch (error) {
          // Process exists but can't connect
        }
      }
    } catch (error) {
      // Process detection failed
    }

    return results;
  }

  /**
   * Remove duplicates and prioritize Docker installations
   */
  deduplicateAndPrioritize(installations) {
    // Remove duplicates based on connection details
    const unique = installations.filter((installation, index, self) => {
      return index === self.findIndex(i => 
        i.path === installation.path && 
        i.host === installation.host && 
        i.port === installation.port
      );
    });

    // Sort by priority (lower number = higher priority)
    return unique.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get the best Docker client from detected installations
   */
  async getBestDockerClient() {
    const installations = await this.detectDockerInstallations();
    
    if (installations.length === 0) {
      throw new Error('No Docker installations found');
    }

    // Return the highest priority (first) installation
    const best = installations[0];
    console.log(`🎯 Using ${best.type} via ${best.method}`);
    
    return {
      client: best.client,
      info: best
    };
  }

  /**
   * Get detailed Docker detection report for debugging
   */
  async getDockerDetectionReport() {
    try {
      const installations = await this.detectDockerInstallations();
      
      const report = {
        timestamp: new Date().toISOString(),
        platform: process.platform,
        architecture: os.arch(),
        systemArch: this.systemArch,
        totalFound: installations.length,
        installations: installations.map(install => ({
          type: install.type,
          method: install.method,
          priority: install.priority,
          path: install.path,
          host: install.host,
          port: install.port,
          contextName: install.contextName,
          machineName: install.machineName,
          isPodman: install.isPodman || false,
          isNamedPipe: install.isNamedPipe || false
        })),
        environment: {
          DOCKER_HOST: process.env.DOCKER_HOST || 'not set',
          DOCKER_TLS_VERIFY: process.env.DOCKER_TLS_VERIFY || 'not set',
          DOCKER_CERT_PATH: process.env.DOCKER_CERT_PATH || 'not set',
          DOCKER_MACHINE_NAME: process.env.DOCKER_MACHINE_NAME || 'not set'
        }
      };

      console.log('📊 Docker Detection Report:', JSON.stringify(report, null, 2));
      return report;
    } catch (error) {
      console.error('Failed to generate Docker detection report:', error);
      return {
        error: error.message,
        timestamp: new Date().toISOString(),
        platform: process.platform,
        architecture: os.arch()
      };
    }
  }

  /**
   * Test all detected Docker installations
   */
  async testAllDockerInstallations() {
    const installations = await this.detectDockerInstallations();
    const results = [];

    console.log(`🧪 Testing ${installations.length} Docker installation(s)...`);

    for (const installation of installations) {
      const testResult = {
        type: installation.type,
        method: installation.method,
        working: false,
        error: null,
        responseTime: null
      };

      try {
        const startTime = Date.now();
        await installation.client.ping();
        testResult.working = true;
        testResult.responseTime = Date.now() - startTime;
        console.log(`✅ ${installation.type} (${installation.method}): Working (${testResult.responseTime}ms)`);
      } catch (error) {
        testResult.error = error.message;
        console.log(`❌ ${installation.type} (${installation.method}): Failed - ${error.message}`);
      }

      results.push(testResult);
    }

    return results;
  }

  /**
   * Get system architecture and map to Docker platform
   */
  getSystemArchitecture() {
    const arch = os.arch();
    const platform = os.platform();
    
    console.log(`System info - Platform: ${platform}, Arch: ${arch}`);
    
    // Map Node.js arch to Docker platform
    const archMap = {
      'x64': 'amd64',
      'arm64': 'arm64',
      'arm': 'arm/v7',
      'ia32': '386'
    };
    
    const dockerArch = archMap[arch] || arch;
    return `${platform}/${dockerArch}`;
  }

  /**
   * Get architecture-specific image name
   */
  getArchSpecificImage(baseImage, tag) {
    // Special handling for clara-backend images which have architecture-specific tags
    if (baseImage === 'clara17verse/clara-backend') {
      const arch = os.arch();
      const platform = os.platform();
      
      console.log(`Getting clara-backend image for platform: ${platform}, arch: ${arch}`);
      
      // For Mac (ARM64), use the default tag without suffix
      if (platform === 'darwin' && arch === 'arm64') {
        console.log(`Using ARM64 image: ${baseImage}:${tag}`);
        return `${baseImage}:${tag}`;
      }
      
      // For non-Mac systems (typically AMD64), use the -amd64 suffix
      if (arch === 'x64' || (platform !== 'darwin')) {
        console.log(`Using AMD64 image: ${baseImage}:${tag}-amd64`);
        return `${baseImage}:${tag}-amd64`;
      }
      
      // Fallback to original tag
      console.log(`Using fallback image: ${baseImage}:${tag}`);
      return `${baseImage}:${tag}`;
    }
    
    // For other images, use the original approach (multi-arch images)
    return `${baseImage}:${tag}`;
  }

  /**
   * Check if container image has updates available
   */
  async checkForImageUpdates(imageName, statusCallback) {
    try {
      statusCallback(`Checking for updates to ${imageName}...`);
      
      // Get local image info
      let localImage = null;
      try {
        localImage = await this.docker.getImage(imageName).inspect();
      } catch (error) {
        if (error.statusCode === 404) {
          statusCallback(`${imageName} not found locally, will download...`);
          return { hasUpdate: true, reason: 'Image not found locally' };
        }
        throw error;
      }

      // Pull latest image info without downloading
      return new Promise((resolve, reject) => {
        this.docker.pull(imageName, { platform: this.systemArch }, (err, stream) => {
          if (err) {
            console.error('Error checking for updates:', err);
            resolve({ hasUpdate: false, reason: 'Failed to check for updates', error: err.message });
            return;
          }

          let hasUpdate = false;
          let updateReason = '';
          let downloadingDetected = false;

          stream.on('data', (data) => {
            const lines = data.toString().split('\n').filter(Boolean);
            lines.forEach(line => {
              try {
                const parsed = JSON.parse(line);
                
                // Check for various update indicators
                if (parsed.status) {
                  if (parsed.status.includes('Image is up to date')) {
                    hasUpdate = false;
                    updateReason = 'Image is up to date';
                  } else if (parsed.status.includes('Downloading') || 
                           parsed.status.includes('Extracting') ||
                           parsed.status.includes('Pulling fs layer')) {
                    hasUpdate = true;
                    downloadingDetected = true;
                    updateReason = 'New version available';
                  } else if (parsed.status.includes('Pull complete')) {
                    if (downloadingDetected) {
                      hasUpdate = true;
                      updateReason = 'Update downloaded';
                    }
                  }
                }
              } catch (e) {
                // Ignore parse errors
              }
            });
          });

          stream.on('end', () => {
            statusCallback(`Update check complete for ${imageName}`);
            resolve({ 
              hasUpdate, 
              reason: updateReason || 'No updates available',
              imageName 
            });
          });

          stream.on('error', (error) => {
            console.error('Stream error during update check:', error);
            resolve({ 
              hasUpdate: false, 
              reason: 'Error checking for updates', 
              error: error.message 
            });
          });
        });
      });
    } catch (error) {
      console.error('Error checking for image updates:', error);
      return { 
        hasUpdate: false, 
        reason: 'Error checking for updates', 
        error: error.message 
      };
    }
  }

  /**
   * Automatically update containers without user prompts
   */
  async autoUpdateContainers(statusCallback) {
    try {
      // Check if we've already checked for updates recently (within the last hour)
      const lastUpdateCheckFile = path.join(this.appDataPath, 'last_update_check.json');
      const now = Date.now();
      const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
      
      let shouldCheckForUpdates = true;
      try {
        if (fs.existsSync(lastUpdateCheckFile)) {
          const lastCheck = JSON.parse(fs.readFileSync(lastUpdateCheckFile, 'utf8'));
          if (now - lastCheck.timestamp < oneHour) {
            statusCallback('Skipping update check (checked recently)');
            shouldCheckForUpdates = false;
          }
        }
      } catch (error) {
        console.log('Error reading last update check file:', error.message);
        // Continue with update check if we can't read the file
      }
      
      if (!shouldCheckForUpdates) {
        return true;
      }
      
      statusCallback(`Checking for container updates (${this.systemArch})...`);
      
      // Check for updates for all containers in parallel
      const updateChecks = [];
      for (const [name, config] of Object.entries(this.containers)) {
        updateChecks.push(
          this.checkForImageUpdates(config.image, statusCallback)
            .then(result => ({ ...result, containerName: name }))
            .catch(error => ({
              hasUpdate: false,
              error: error.message,
              containerName: name,
              imageName: config.image
            }))
        );
      }

      const updateResults = await Promise.all(updateChecks);
      const updatesAvailable = updateResults.filter(result => result.hasUpdate);

      // Save the timestamp of this update check
      try {
        fs.writeFileSync(lastUpdateCheckFile, JSON.stringify({ timestamp: now }));
      } catch (error) {
        console.log('Error saving last update check timestamp:', error.message);
      }

      if (updatesAvailable.length > 0) {
        statusCallback(`Found ${updatesAvailable.length} container update(s) available - updating automatically...`);
        
        // Update containers in parallel for faster startup
        const updatePromises = updatesAvailable.map(async (update) => {
          try {
            await this.pullImageWithProgress(update.imageName, statusCallback);
            return { success: true, imageName: update.imageName };
          } catch (error) {
            statusCallback(`Failed to update ${update.imageName}: ${error.message}`, 'warning');
            console.error('Update error:', error);
            return { success: false, imageName: update.imageName, error: error.message };
          }
        });

        const updateResults = await Promise.all(updatePromises);
        const successCount = updateResults.filter(r => r.success).length;
        const failCount = updateResults.filter(r => !r.success).length;
        
        if (successCount > 0) {
          statusCallback(`✓ Updated ${successCount} container(s) successfully`);
        }
        if (failCount > 0) {
          statusCallback(`⚠️ ${failCount} container(s) failed to update`, 'warning');
        }
      } else {
        statusCallback('All containers are up to date');
      }

      return true;
    } catch (error) {
      statusCallback(`Update check failed: ${error.message}`, 'warning');
      console.error('Auto update error:', error);
      return false;
    }
  }

  /**
   * Show update dialog and handle user choice
   */
  async showUpdateDialog(updateInfo, parentWindow = null) {
    const updatesAvailable = updateInfo.filter(info => info.hasUpdate);
    
    if (updatesAvailable.length === 0) {
      return { updateAll: false, updates: [] };
    }

    const updateList = updatesAvailable.map(info => 
      `• ${info.imageName}: ${info.reason}`
    ).join('\n');

    const dialogOptions = {
      type: 'question',
      buttons: ['Update Now', 'Skip Updates', 'Cancel'],
      defaultId: 0,
      title: 'Container Updates Available',
      message: `Updates are available for the following containers:\n\n${updateList}\n\nWould you like to update them now?`,
      detail: `Architecture: ${this.systemArch}\n\nUpdating will ensure you have the latest features and security fixes.`,
      alwaysOnTop: true,
      modal: true
    };

    // If a parent window is provided, show dialog relative to it, otherwise show as standalone dialog
    const response = parentWindow 
      ? await dialog.showMessageBox(parentWindow, dialogOptions)
      : await dialog.showMessageBox(dialogOptions);

    return {
      updateAll: response.response === 0,
      skip: response.response === 1,
      cancel: response.response === 2,
      updates: updatesAvailable
    };
  }

  /**
   * Pull image with progress tracking and architecture specification
   */
  async pullImageWithProgress(imageName, statusCallback) {
    return new Promise((resolve, reject) => {
      statusCallback(`Pulling ${imageName} for ${this.systemArch}...`);
      
      this.docker.pull(imageName, { platform: this.systemArch }, (err, stream) => {
        if (err) {
          console.error('Error pulling image:', err);
          reject(err);
          return;
        }

        let lastStatus = '';
        let progress = {};

        stream.on('data', (data) => {
          const lines = data.toString().split('\n').filter(Boolean);
          lines.forEach(line => {
            try {
              const parsed = JSON.parse(line);
              
              if (parsed.error) {
                console.error('Pull error:', parsed.error);
                reject(new Error(parsed.error));
                return;
              }

              if (parsed.status && parsed.status !== lastStatus) {
                lastStatus = parsed.status;
                
                // Track progress for different layers
                if (parsed.id && parsed.progressDetail) {
                  progress[parsed.id] = parsed.progressDetail;
                  
                  // Calculate overall progress
                  const layers = Object.values(progress);
                  const totalCurrent = layers.reduce((sum, layer) => sum + (layer.current || 0), 0);
                  const totalTotal = layers.reduce((sum, layer) => sum + (layer.total || 0), 0);
                  
                  if (totalTotal > 0) {
                    const percentage = Math.round((totalCurrent / totalTotal) * 100);
                    statusCallback(`Pulling ${imageName}: ${parsed.status} (${percentage}%)`);
                  } else {
                    statusCallback(`Pulling ${imageName}: ${parsed.status}`);
                  }
                } else {
                  statusCallback(`Pulling ${imageName}: ${parsed.status}`);
                }
              }
            } catch (e) {
              // Ignore parse errors
            }
          });
        });

        stream.on('end', () => {
          statusCallback(`✓ Successfully pulled ${imageName}`);
          this.updatePullTimestamp(imageName);
          resolve();
        });

        stream.on('error', (error) => {
          console.error('Stream error:', error);
          reject(error);
        });
      });
    });
  }

  async execAsync(command, timeout = 60000) {
    // Replace docker-compose with docker compose
    command = command
      .replace(/^docker-compose\s/, `"${this.dockerPath}" compose `)
      .replace(/^docker\s/, `"${this.dockerPath}" `);

    return new Promise((resolve, reject) => {
      exec(command, { 
        timeout, 
        env: { 
          ...process.env,
          PATH: '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin'
        }
      }, (error, stdout, stderr) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }

  async findAvailablePort(startPort, endPort = startPort + 100) {
    for (let port = startPort; port <= endPort; port++) {
      try {
        await this.execAsync(`lsof -i :${port}`);
      } catch (error) {
        // If lsof fails, it means the port is available
        return port;
      }
    }
    throw new Error(`No available ports found between ${startPort} and ${endPort}`);
  }

  async isPortInUse(port) {
    try {
      await this.execAsync(`lsof -i :${port}`);
      return true;
    } catch (error) {
      return false;
    }
  }

  async findWorkingDockerSocket() {
    try {
      const { client, info } = await this.getBestDockerClient();
      
      // Return the socket path or connection info
      if (info.path) {
        return info.path;
      } else if (info.host && info.port) {
        return `tcp://${info.host}:${info.port}`;
      } else {
        // Fallback to default socket
        return process.platform === 'win32' ? '//./pipe/docker_engine' : '/var/run/docker.sock';
      }
    } catch (error) {
      console.error('Enhanced Docker detection failed:', error.message);
      
      // Fallback to original simple detection
      const possibleSockets = [
        // Docker Desktop locations
        path.join(os.homedir(), '.docker', 'desktop', 'docker.sock'),
        path.join(os.homedir(), '.docker', 'docker.sock'),
        // Traditional Linux socket locations
        '/var/run/docker.sock',
        '/run/docker.sock',
        // WSL2 socket location
        '/mnt/wsl/docker-desktop/docker.sock',
        // Colima socket location (for macOS/Linux)
        path.join(os.homedir(), '.colima', 'docker.sock'),
        // Rancher Desktop socket location
        path.join(os.homedir(), '.rd', 'docker.sock')
      ];

      // Windows pipe
      if (process.platform === 'win32') {
        return '//./pipe/docker_engine';
      }

      // Check environment variable first
      if (process.env.DOCKER_HOST) {
        const match = process.env.DOCKER_HOST.match(/unix:\/\/(.*)/);
        if (match && match[1]) {
          try {
            const docker = new Docker({ socketPath: match[1] });
            await docker.ping();
            console.log('Using Docker socket from DOCKER_HOST:', match[1]);
            return match[1];
          } catch (error) {
            console.log('DOCKER_HOST socket not working:', error.message);
          }
        }
      }

      // Try each socket location
      for (const socketPath of possibleSockets) {
        try {
          if (fs.existsSync(socketPath)) {
            const docker = new Docker({ socketPath });
            await docker.ping();
            console.log('Found working Docker socket at:', socketPath);
            return socketPath;
          }
        } catch (error) {
          console.log('Socket not working at:', socketPath, error.message);
          continue;
        }
      }

      throw new Error('No working Docker socket found');
    }
  }

  initializeDockerClient() {
    try {
      // Try enhanced detection first (but don't await since this is sync)
      // We'll use the enhanced detection in isDockerRunning() instead
      
      // For Windows, always use the named pipe as default
      if (process.platform === 'win32') {
        return new Docker({ socketPath: '//./pipe/docker_engine' });
      }

      // For other platforms, try to find a working socket synchronously
      const socketPaths = [
        process.env.DOCKER_HOST ? process.env.DOCKER_HOST.replace('unix://', '') : null,
        path.join(os.homedir(), '.docker', 'desktop', 'docker.sock'),
        path.join(os.homedir(), '.docker', 'docker.sock'),
        '/var/run/docker.sock',
        '/run/docker.sock',
        '/mnt/wsl/docker-desktop/docker.sock',
        path.join(os.homedir(), '.colima', 'docker.sock'),
        path.join(os.homedir(), '.rd', 'docker.sock'),
        // Additional enhanced locations
        path.join(os.homedir(), '.colima', 'default', 'docker.sock'),
        path.join(os.homedir(), '.lima', 'docker', 'sock', 'docker.sock'),
        path.join(os.homedir(), '.lima', 'default', 'sock', 'docker.sock'),
        path.join(os.homedir(), '.orbstack', 'run', 'docker.sock'),
        path.join(os.homedir(), '.docker', 'run', 'docker.sock')
      ].filter(Boolean);

      for (const socketPath of socketPaths) {
        if (fs.existsSync(socketPath)) {
          try {
            return new Docker({ socketPath });
          } catch (error) {
            console.log(`Failed to initialize Docker with socket ${socketPath}:`, error.message);
          }
        }
      }

      // If no socket works, fall back to default
      return new Docker({ socketPath: '/var/run/docker.sock' });
    } catch (error) {
      console.error('Error initializing Docker client:', error);
      // Return a default client - the isDockerRunning check will handle the error case
      return new Docker({ socketPath: '/var/run/docker.sock' });
    }
  }

  async isDockerRunning() {
    try {
      // If current client isn't working, try to find a working socket
      try {
        await this.docker.ping();
        return true;
      } catch (error) {
        console.log('Current Docker client not working, trying enhanced detection...');
        
        // Use enhanced detection to find the best Docker client
        try {
          const { client, info } = await this.getBestDockerClient();
          this.docker = client;
          await this.docker.ping();
          console.log(`✅ Successfully connected to ${info.type} via ${info.method}`);
          return true;
        } catch (enhancedError) {
          console.log('Enhanced detection failed, trying fallback method...');
          
          // Fallback to original socket detection
          const workingSocket = await this.findWorkingDockerSocket();
          this.docker = new Docker({ socketPath: workingSocket });
          await this.docker.ping();
          return true;
        }
      }
    } catch (error) {
      console.error('Docker is not running or not accessible:', error.message);
      return false;
    }
  }

  async createNetwork() {
    try {
      // First check if the network already exists
      const networks = await this.docker.listNetworks();
      const networkExists = networks.some(network => network.Name === 'clara_network');
      
      if (networkExists) {
        console.log('Network clara_network already exists, skipping creation');
        return;
      }
      
      // Create the network if it doesn't exist
      try {
        await this.docker.createNetwork({
          Name: 'clara_network',
          Driver: 'bridge'
        });
        console.log('Successfully created clara_network');
      } catch (error) {
        // Special handling for conflict error (network created between our check and creation)
        if (error.statusCode === 409) {
          console.log('Network already exists (409 error), continuing...');
          return;
        }
        
        // Log details for other errors to help troubleshooting
        console.error('Error creating network:', error.message);
        console.error('Error details:', error);
        
        // For Mac-specific issues, provide more guidance
        if (process.platform === 'darwin') {
          console.log('On macOS, make sure Docker Desktop is running and properly configured');
          console.log('Try restarting Docker Desktop if issues persist');
        }
        
        throw new Error(`Failed to create network: ${error.message}`);
      }
    } catch (error) {
      console.error('Error in createNetwork:', error.message);
      // Don't throw here to allow the application to continue even if network creation fails
      // We'll let containers attempt to connect, which might work if the network exists but we failed to detect it
    }
  }

  async pullImage(imageName, statusCallback) {
    // Use the new architecture-aware pull method
    return this.pullImageWithProgress(imageName, statusCallback);
  }

  async startContainer(config) {
    try {
      // Check if container exists and is running
      try {
        const existingContainer = await this.docker.getContainer(config.name);
        const containerInfo = await existingContainer.inspect();
        
        if (containerInfo.State.Running) {
          console.log(`Container ${config.name} is already running, checking health...`);
          
          // Check if the running container is healthy
          const isHealthy = await config.healthCheck();
          if (isHealthy) {
            console.log(`Container ${config.name} is running and healthy, skipping recreation`);
            return;
          }
          
          console.log(`Container ${config.name} is running but not healthy, will recreate`);
          await existingContainer.stop();
          await existingContainer.remove({ force: true });
        } else {
          console.log(`Container ${config.name} exists but is not running, will recreate`);
          await existingContainer.remove({ force: true });
        }
      } catch (error) {
        if (error.statusCode !== 404) {
          console.error(`Error checking container ${config.name}:`, error);
        } else {
          console.log(`No existing container ${config.name}, will create new one`);
        }
      }

      // First ensure we have the image
      try {
        await this.docker.getImage(config.image).inspect();
      } catch (error) {
        if (error.statusCode === 404) {
          console.log(`Image ${config.image} not found locally, pulling for ${this.systemArch}...`);
          await this.pullImageWithProgress(config.image, (status) => console.log(status));
        } else {
          throw error;
        }
      }

      console.log(`Creating container ${config.name} with port mapping ${config.internalPort} -> ${config.port}`);
      
      // Check for GPU availability if this container requests GPU runtime
      let useGPURuntime = false;
      if (config.runtime === 'nvidia') {
        useGPURuntime = await this.detectNvidiaGPU();
        if (useGPURuntime) {
          console.log(`🚀 GPU support enabled for ${config.name}`);
        } else {
          console.log(`⚠️  GPU requested but not available for ${config.name}, falling back to CPU`);
        }
      }
      
      // Create and start container
      const containerConfig = {
        Image: config.image,
        name: config.name,
        ExposedPorts: {
          [`${config.internalPort}/tcp`]: {}
        },
        HostConfig: {
          PortBindings: {
            [`${config.internalPort}/tcp`]: [{ HostPort: config.port.toString() }]
          },
          Binds: config.volumes,
          NetworkMode: 'clara_network',
          // Add GPU runtime support if available
          ...(useGPURuntime && { Runtime: 'nvidia' }),
          // Add restart policy if specified
          ...(config.restartPolicy && { RestartPolicy: { Name: config.restartPolicy } }),
          // Add GPU device access for NVIDIA runtime
          ...(useGPURuntime && {
            DeviceRequests: [{
              Driver: 'nvidia',
              Count: -1, // All GPUs
              Capabilities: [['gpu']]
            }]
          }),
          // Add memory and CPU limits for optimal performance
          Memory: config.memoryLimit ? this.parseMemoryLimit(config.memoryLimit) : undefined,
          CpuCount: config.cpuLimit ? parseInt(config.cpuLimit) : undefined,
          ShmSize: config.shmSize ? this.parseMemoryLimit(config.shmSize) : undefined
        },
        Env: [
          'PYTHONUNBUFFERED=1',
          'OLLAMA_BASE_URL=http://clara_ollama:11434',
          // Add any environment variables from the container config
          ...(config.environment || []),
          // Add GPU-specific environment variables if GPU is available
          ...(useGPURuntime ? [
            'NVIDIA_VISIBLE_DEVICES=all',
            'NVIDIA_DRIVER_CAPABILITIES=compute,utility'
          ] : [])
        ]
      };

      const newContainer = await this.docker.createContainer(containerConfig);
      console.log(`Container ${config.name} created, starting...`);
      await newContainer.start();
      console.log(`Container ${config.name} started, waiting for health check...`);

      // Initial delay to give the container time to fully start
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Wait for health check
      let healthy = false;
      for (let i = 0; i < 5; i++) {
        console.log(`Health check attempt ${i + 1} for ${config.name}...`);
        try {
          healthy = await config.healthCheck();
          console.log(`Health check result for ${config.name}: ${healthy}`);
          if (healthy) break;
        } catch (error) {
          console.error(`Health check error for ${config.name}:`, error);
        }
        // Increased delay between attempts to 5 seconds
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      if (!healthy) {
        // Get container logs to help diagnose the issue
        const container = await this.docker.getContainer(config.name);
        const logs = await container.logs({
          stdout: true,
          stderr: true,
          tail: 50
        });
        console.error(`Container logs for ${config.name}:`, logs.toString());
        throw new Error(`Container ${config.name} failed health check after 5 attempts`);
      }

      // Run optimization for ComfyUI container after it's healthy
      if (config.name === 'clara_comfyui' && useGPURuntime) {
        console.log('🚀 Running GPU optimizations for ComfyUI...');
        // Run optimization in background to not block startup
        setTimeout(() => {
          this.optimizeComfyUIContainer().catch(error => {
            console.error('Optimization failed:', error.message);
          });
        }, 10000); // Wait 10 seconds after health check
      }
    } catch (error) {
      console.error(`Error starting ${config.name}:`, error);
      throw error;
    }
  }

  async initializePullTimestamps() {
    try {
      if (!fs.existsSync(this.pullTimestampsPath)) {
        const initialTimestamps = {};
        Object.keys(this.containers).forEach(key => {
          initialTimestamps[this.containers[key].image] = 0;
        });
        fs.writeFileSync(this.pullTimestampsPath, JSON.stringify(initialTimestamps, null, 2));
      }
    } catch (error) {
      console.error('Error initializing pull timestamps:', error);
    }
  }

  getPullTimestamps() {
    try {
      if (fs.existsSync(this.pullTimestampsPath)) {
        return JSON.parse(fs.readFileSync(this.pullTimestampsPath, 'utf8'));
      }
    } catch (error) {
      console.error('Error reading pull timestamps:', error);
    }
    return {};
  }

  updatePullTimestamp(imageName) {
    try {
      const timestamps = this.getPullTimestamps();
      timestamps[imageName] = Date.now();
      fs.writeFileSync(this.pullTimestampsPath, JSON.stringify(timestamps, null, 2));
    } catch (error) {
      console.error('Error updating pull timestamp:', error);
    }
  }

  async checkImageUpdate(imageName) {
    try {
      // First try to inspect the local image
      try {
        await this.docker.getImage(imageName).inspect();
      } catch (error) {
        // If image doesn't exist locally, we need to pull it
        if (error.statusCode === 404) {
          return true;
        }
      }

      // Try to pull the image to check for updates
      return new Promise((resolve, reject) => {
        this.docker.pull(imageName, (err, stream) => {
          if (err) {
            // If we can't pull, but have local image, use local
            if (err.statusCode === 404) {
              resolve(false);
              return;
            }
            reject(err);
            return;
          }

          let needsUpdate = false;
          
          stream.on('data', (data) => {
            const lines = data.toString().split('\n').filter(Boolean);
            lines.forEach(line => {
              try {
                const parsed = JSON.parse(line);
                // Check for "up to date" message
                if (parsed.status && parsed.status.includes('up to date')) {
                  needsUpdate = false;
                }
                // Check for "downloading" or "extracting" which indicates an update
                if (parsed.status && (parsed.status.includes('Downloading') || parsed.status.includes('Extracting'))) {
                  needsUpdate = true;
                }
              } catch (e) {
                // Ignore parse errors
              }
            });
          });

          stream.on('end', () => {
            resolve(needsUpdate);
          });

          stream.on('error', (error) => {
            console.error('Stream error during pull:', error);
            resolve(true); // If we can't determine, assume update needed
          });
        });
      });
    } catch (error) {
      console.error('Error checking image update:', error);
      return true; // If we can't determine, assume update needed
    }
  }

  shouldPullImage(imageName, forceCheck = false) {
    try {
      if (forceCheck) {
        return this.checkImageUpdate(imageName);
      }

      const timestamps = this.getPullTimestamps();
      const lastPull = timestamps[imageName] || 0;
      const daysSinceLastPull = (Date.now() - lastPull) / (1000 * 60 * 60 * 24);
      return daysSinceLastPull >= 10;
    } catch (error) {
      console.error('Error checking pull timestamp:', error);
      return true; // Pull if there's an error reading timestamps
    }
  }

  async setup(statusCallback, forceUpdateCheck = false, loadingScreen = null) {
    try {
      if (!await this.isDockerRunning()) {
        let dockerDownloadLink;
        let installMessage;
        switch (process.platform) {
          case 'darwin':
            dockerDownloadLink = 'https://desktop.docker.com/mac/main/arm64/Docker.dmg';
            installMessage = 'download Docker Desktop';
            break;
          case 'win32':
            dockerDownloadLink = 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe';
            installMessage = 'download Docker Desktop';
            break;
          case 'linux':
          default:
            dockerDownloadLink = 'https://docs.docker.com/engine/install/';
            installMessage = 'install Docker Engine';
            break;
        }
        const errorMessage = `Docker is not running. Please ${installMessage} for better experience with workflows and automation.\n\nDownload from: ${dockerDownloadLink}`;
        statusCallback(errorMessage, 'warning');
        
        // Return false but don't throw error - let the app continue without Docker
        return false;
      }

      statusCallback('Creating Docker network...');
      await this.createNetwork();

      // Check if Ollama is running on the system (no container management)
      const ollamaRunning = await this.checkOllamaAvailability();
      if (ollamaRunning) {
        statusCallback('✓ Ollama detected and available at http://localhost:11434', 'success');
      } else {
        statusCallback('⚠️ Ollama not detected. Please install Ollama manually if you want local AI models. Visit: https://ollama.com', 'warning');
      }

      // Automatically check for and install container updates
      await this.autoUpdateContainers(statusCallback);

      // Ensure all images are available locally
      for (const [name, config] of Object.entries(this.containers)) {
        try {
          await this.docker.getImage(config.image).inspect();
          statusCallback(`✓ ${name} image ready`);
        } catch (error) {
          if (error.statusCode === 404) {
            statusCallback(`Downloading ${name} image...`);
            await this.pullImageWithProgress(config.image, statusCallback);
          } else {
            throw error;
          }
        }
      }

      // Start containers in sequence
      for (const [name, config] of Object.entries(this.containers)) {
        statusCallback(`Starting ${name} service...`);
        await this.startContainer(config);
      }

      statusCallback('All services started successfully');
      return true;
    } catch (error) {
      statusCallback(`Setup failed: ${error.message}`, 'error');
      // Return false instead of throwing to allow app to continue
      return false;
    }
  }

  async stop() {
    try {
      for (const [name, config] of Object.entries(this.containers)) {
        try {
          const container = await this.docker.getContainer(config.name);
          await container.stop();
          await container.remove();
        } catch (error) {
          // Ignore errors if container doesn't exist
        }
      }

      // Clean up network
      try {
        const network = await this.docker.getNetwork('clara_network');
        await network.remove();
      } catch (error) {
        // Ignore network removal errors
      }
    } catch (error) {
      console.error('Error stopping services:', error);
      throw error;
    }
  }

  async isPythonRunning() {
    try {
      if (!this.ports.python) {
        console.log('Python port not set');
        return false;
      }

      console.log(`Checking Python health at http://localhost:${this.ports.python}/health`);
      
      const response = await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${this.ports.python}/health`, (res) => {
          console.log(`Python health check status code: ${res.statusCode}`);
          
          if (res.statusCode === 200) {
            let data = '';
            res.on('data', chunk => {
              data += chunk;
            });
            res.on('end', () => {
              console.log('Python health check response:', data);
              try {
                const jsonResponse = JSON.parse(data);
                const isHealthy = jsonResponse.status === 'healthy' || jsonResponse.status === 'ok';
                console.log(`Python health parsed result: ${isHealthy}`);
                resolve(isHealthy);
              } catch (e) {
                console.error('Failed to parse health check JSON:', e);
                resolve(false);
              }
            });
          } else {
            reject(new Error(`Python health check failed with status ${res.statusCode}`));
          }
        });

        req.on('error', (error) => {
          console.error('Python health check request error:', error);
          resolve(false);
        });

        req.setTimeout(5000, () => {
          console.error('Python health check timeout');
          req.destroy();
          resolve(false);
        });
      });

      return response;
    } catch (error) {
      console.error('Python health check error:', error);
      return false;
    }
  }

  async checkN8NHealth() {
    try {
      const response = await new Promise((resolve, reject) => {
        http.get(`http://localhost:${this.ports.n8n}/healthz`, (res) => {
          if (res.statusCode === 200) {
            resolve({ success: true });
          } else {
            reject(new Error(`N8N health check failed with status ${res.statusCode}`));
          }
        }).on('error', (error) => reject(error));
      });
      return response;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async checkOllamaAvailability() {
    try {
      const response = await new Promise((resolve, reject) => {
        const req = http.get('http://localhost:11434/api/tags', (res) => {
          if (res.statusCode === 200) {
            resolve(true);
          } else {
            resolve(false);
          }
        });
        
        req.on('error', () => resolve(false));
        
        // Add timeout to avoid hanging
        req.setTimeout(3000, () => {
          req.destroy();
          resolve(false);
        });
      });
      
      return response;
    } catch (error) {
      return false;
    }
  }

  /**
   * Manual update check that can be called from the main process
   */
  async checkForUpdates(statusCallback) {
    try {
      if (!await this.isDockerRunning()) {
        throw new Error('Docker is not running');
      }

      statusCallback(`Checking for container updates (${this.systemArch})...`);
      const updateChecks = [];
      
      for (const [name, config] of Object.entries(this.containers)) {
        updateChecks.push(
          this.checkForImageUpdates(config.image, statusCallback)
            .then(result => ({ ...result, containerName: name }))
        );
      }

      const updateResults = await Promise.all(updateChecks);
      const updatesAvailable = updateResults.filter(result => result.hasUpdate);

      return {
        updatesAvailable: updatesAvailable.length > 0,
        updates: updateResults,
        architecture: this.systemArch
      };
    } catch (error) {
      console.error('Error checking for updates:', error);
      throw error;
    }
  }

  /**
   * Update specific containers
   */
  async updateContainers(containerNames, statusCallback) {
    try {
      if (!await this.isDockerRunning()) {
        throw new Error('Docker is not running');
      }

      const containersToUpdate = containerNames || Object.keys(this.containers);
      const results = [];

      for (const containerName of containersToUpdate) {
        const config = this.containers[containerName];
        if (!config) {
          results.push({
            container: containerName,
            success: false,
            error: 'Container not found'
          });
          continue;
        }

        try {
          statusCallback(`Updating ${containerName}...`);
          
          // Stop and remove existing container
          try {
            const existingContainer = await this.docker.getContainer(config.name);
            const containerInfo = await existingContainer.inspect();
            
            if (containerInfo.State.Running) {
              await existingContainer.stop();
            }
            await existingContainer.remove({ force: true });
            statusCallback(`Stopped and removed old ${containerName} container`);
          } catch (error) {
            // Container might not exist, which is fine
            if (error.statusCode !== 404) {
              console.warn(`Warning removing old container ${config.name}:`, error.message);
            }
          }

          // Pull latest image
          await this.pullImageWithProgress(config.image, statusCallback);
          
          // Start new container
          await this.startContainer(config);
          
          results.push({
            container: containerName,
            success: true,
            message: `Successfully updated ${containerName}`
          });
          
          statusCallback(`✓ ${containerName} updated successfully`);
        } catch (error) {
          results.push({
            container: containerName,
            success: false,
            error: error.message
          });
          statusCallback(`✗ Failed to update ${containerName}: ${error.message}`, 'error');
        }
      }

      return results;
    } catch (error) {
      console.error('Error updating containers:', error);
      throw error;
    }
  }

  async isComfyUIRunning() {
    try {
      if (!this.ports.comfyui) {
        console.log('ComfyUI port not set');
        return false;
      }

      console.log(`Checking ComfyUI health at http://localhost:${this.ports.comfyui}/`);
      
      const response = await new Promise((resolve, reject) => {
        const req = http.get(`http://localhost:${this.ports.comfyui}/`, (res) => {
          console.log(`ComfyUI health check status code: ${res.statusCode}`);
          
          // ComfyUI returns 200 for the main page when running
          if (res.statusCode === 200) {
            resolve(true);
          } else {
            resolve(false);
          }
        });

        req.on('error', (error) => {
          console.error('ComfyUI health check request error:', error);
          resolve(false);
        });

        req.setTimeout(5000, () => {
          console.error('ComfyUI health check timeout');
          req.destroy();
          resolve(false);
        });
      });

      return response;
    } catch (error) {
      console.error('ComfyUI health check error:', error);
      return false;
    }
  }
}

module.exports = DockerSetup; 