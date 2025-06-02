const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const os = require('os');
const log = require('electron-log');
const { app } = require('electron');
const PlatformManager = require('./platformManager.cjs');

class LlamaSwapService {
  constructor() {
    this.process = null;
    this.isRunning = false;
    this.port = 8091;
    
    // Handle different base directory paths for development vs production
    this.baseDir = this.getBaseBinaryDirectory();
    this.modelsDir = path.join(os.homedir(), '.clara', 'llama-models');
    this.configPath = path.join(this.baseDir, 'config.yaml');
    this.logPath = path.join(this.baseDir, 'llama-swap.log');
    
    log.info(`Base binary directory: ${this.baseDir}`);
    log.info(`Models directory: ${this.modelsDir}`);
    
    // Initialize platform manager
    this.platformManager = new PlatformManager(this.baseDir);
    this.platformInfo = this.platformManager.platformInfo;
    this.platformBinDir = this.platformManager.getPlatformLibraryDirectory();
    
    // Get platform-specific binary paths with fallback support
    this.binaryPaths = this.getBinaryPathsWithFallback();
    
    log.info(`Platform detected: ${this.platformInfo.platform}-${this.platformInfo.arch}`);
    log.info(`Using platform directory: ${this.platformInfo.platformDir}`);
    log.info(`Binary paths:`, this.binaryPaths);
    
    // Initialize GPU info cache
    this.gpuInfo = null;
    this.systemMemoryGB = Math.round(os.totalmem() / (1024 * 1024 * 1024));
    
    // Ensure models directory exists
    this.ensureDirectories();
  }

  /**
   * Get the correct base directory for binaries in both development and production
   */
  getBaseBinaryDirectory() {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      // Development mode - use electron directory
      return path.join(__dirname, 'llamacpp-binaries');
    } else {
      // Production mode - check multiple possible locations
      const possiblePaths = [
        // Standard Electron app structure
        path.join(process.resourcesPath, 'electron', 'llamacpp-binaries'),
        // Alternative app structure
        path.join(app.getAppPath(), 'electron', 'llamacpp-binaries'),
        // Fallback to current directory structure
        path.join(__dirname, 'llamacpp-binaries')
      ];
      
      for (const possiblePath of possiblePaths) {
        log.info(`Checking binary path: ${possiblePath}`);
        if (fsSync.existsSync(possiblePath)) {
          log.info(`Found binaries at: ${possiblePath}`);
          return possiblePath;
        }
      }
      
      // If none found, create in app data directory and log error
      const fallbackPath = path.join(app.getPath('userData'), 'llamacpp-binaries');
      log.error(`No binary directory found! Checked paths:`, possiblePaths);
      log.error(`Using fallback path: ${fallbackPath}`);
      return fallbackPath;
    }
  }

  /**
   * Get binary paths with fallback to legacy locations for backward compatibility
   */
  getBinaryPathsWithFallback() {
    try {
      // Try to get platform-specific paths first
      if (this.platformManager.isCurrentPlatformSupported()) {
        return this.platformManager.getBinaryPaths();
      }
    } catch (error) {
      log.warn('Failed to get platform-specific binary paths, falling back to legacy detection:', error.message);
    }

    // Fallback to legacy behavior
    return this.getLegacyBinaryPaths();
  }

  /**
   * Legacy binary path detection for backward compatibility
   */
  getLegacyBinaryPaths() {
    const platform = os.platform();
    const arch = os.arch();
    
    let platformDir;
    let binaryNames;
    
    switch (platform) {
      case 'darwin':
        platformDir = arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64';
        binaryNames = {
          llamaSwap: 'llama-swap-darwin',
          llamaServer: 'llama-server'
        };
        break;
      case 'linux':
        platformDir = 'linux-x64';
        binaryNames = {
          llamaSwap: 'llama-swap-linux',
          llamaServer: 'llama-server'
        };
        break;
      case 'win32':
        platformDir = 'win32-x64';
        binaryNames = {
          llamaSwap: 'llama-swap-win32-x64.exe',
          llamaServer: 'llama-server.exe'
        };
        break;
      default:
        throw new Error(`Unsupported platform: ${platform}-${arch}`);
    }
    
    const platformPath = path.join(this.baseDir, platformDir);
    
    return {
      llamaSwap: path.join(platformPath, binaryNames.llamaSwap),
      llamaServer: path.join(platformPath, binaryNames.llamaServer)
    };
  }

  async validateBinaries() {
    log.info('Starting binary validation...');
    
    try {
      // Use platform manager validation if available
      if (this.platformManager.isCurrentPlatformSupported()) {
        log.info('Using platform manager validation');
        await this.platformManager.validatePlatformBinaries();
        return true;
      }
    } catch (error) {
      log.warn('Platform manager validation failed, using legacy validation:', error.message);
    }

    // Fallback to legacy validation
    log.info('Using legacy binary validation');
    const { llamaSwap, llamaServer } = this.binaryPaths;
    
    const issues = [];
    
    log.info(`Checking llama-swap binary: ${llamaSwap}`);
    if (!this.binaryExists(llamaSwap)) {
      const error = `llama-swap binary not found at: ${llamaSwap}`;
      log.error(error);
      issues.push(error);
    } else {
      log.info('✅ llama-swap binary found');
    }
    
    log.info(`Checking llama-server binary: ${llamaServer}`);
    if (!this.binaryExists(llamaServer)) {
      const error = `llama-server binary not found at: ${llamaServer}`;
      log.error(error);
      issues.push(error);
    } else {
      log.info('✅ llama-server binary found');
    }
    
    if (issues.length > 0) {
      // Additional diagnostic information
      log.error('=== BINARY VALIDATION FAILED ===');
      log.error('Base directory:', this.baseDir);
      log.error('Platform directory:', this.platformBinDir);
      log.error('Platform info:', this.platformInfo);
      
      // List what's actually in the directories
      try {
        const baseContents = fsSync.readdirSync(this.baseDir);
        log.error('Base directory contents:', baseContents);
        
        if (fsSync.existsSync(this.platformBinDir)) {
          const platformContents = fsSync.readdirSync(this.platformBinDir);
          log.error('Platform directory contents:', platformContents);
        } else {
          log.error('Platform directory does not exist:', this.platformBinDir);
        }
      } catch (dirError) {
        log.error('Error reading directory contents:', dirError.message);
      }
      
      const error = new Error(`Binary validation failed:\n${issues.join('\n')}`);
      error.issues = issues;
      error.diagnostics = {
        baseDir: this.baseDir,
        platformBinDir: this.platformBinDir,
        platformInfo: this.platformInfo,
        binaryPaths: this.binaryPaths
      };
      throw error;
    }
    
    // Check if binaries are executable
    try {
      await fs.access(llamaSwap, fs.constants.F_OK | fs.constants.X_OK);
      await fs.access(llamaServer, fs.constants.F_OK | fs.constants.X_OK);
      log.info('✅ Binaries are executable');
    } catch (error) {
      const execError = new Error(`Binaries exist but are not executable: ${error.message}`);
      log.error(execError.message);
      throw execError;
    }
    
    log.info('✅ Legacy binary validation successful');
    return true;
  }

  binaryExists(binaryPath) {
    try {
      return fsSync.existsSync(binaryPath) && fsSync.statSync(binaryPath).isFile();
    } catch (error) {
      return false;
    }
  }

  // Legacy method for backward compatibility
  getBinaryPath() {
    return this.binaryPaths.llamaSwap;
  }

  getPlatformInfo() {
    return this.platformManager.getPlatformInfo();
  }

  async ensureDirectories() {
    try {
      await fs.mkdir(path.join(os.homedir(), '.clara'), { recursive: true });
      await fs.mkdir(this.modelsDir, { recursive: true });
      log.info(`Models directory ensured at: ${this.modelsDir}`);
    } catch (error) {
      log.error('Error creating directories:', error);
    }
  }

  async scanModels() {
    const models = [];
    const sources = [
      { path: this.modelsDir, source: 'user' },
      { path: path.join(this.baseDir, 'models'), source: 'bundled' }
    ];

    for (const { path: modelPath, source } of sources) {
      try {
        if (await fs.access(modelPath).then(() => true).catch(() => false)) {
          const files = await fs.readdir(modelPath);
          const ggufFiles = files.filter(file => file.endsWith('.gguf'));
          
          for (const file of ggufFiles) {
            const fullPath = path.join(modelPath, file);
            try {
              const stats = await fs.stat(fullPath);
              const modelName = this.generateModelName(file);
              
              models.push({
                name: modelName,
                file: file,
                path: fullPath,
                size: stats.size,
                source: source,
                lastModified: stats.mtime
              });
            } catch (error) {
              log.warn(`Error reading stats for ${file}:`, error);
            }
          }
        }
      } catch (error) {
        log.warn(`Error scanning models in ${modelPath}:`, error);
      }
    }

    return models;
  }

  generateModelName(filename) {
    // Convert filename to a readable model name
    // Example: "gemma-3-1b-it.Q4_K_M.gguf" -> "gemma3:1b"
    // Example: "Llama-3.2-1B-Instruct-Q4_K_M.gguf" -> "llama3.2:1b"
    
    let name = filename
      .replace('.gguf', '')
      .toLowerCase();
    
    // Extract base model name
    let baseName = name;
    
    // Handle common model families
    if (name.includes('llama')) {
      baseName = name.match(/llama[.-]?(\d+(?:\.\d+)?)/)?.[0]?.replace(/[.-]/g, '') || 'llama';
    } else if (name.includes('gemma')) {
      baseName = name.match(/gemma[.-]?(\d+(?:\.\d+)?)/)?.[0]?.replace(/[.-]/g, '') || 'gemma';
    } else if (name.includes('qwen')) {
      baseName = name.match(/qwen[.-]?(\d+(?:\.\d+)?)/)?.[0]?.replace(/[.-]/g, '') || 'qwen';
    } else if (name.includes('mxbai')) {
      baseName = 'mxbai-embed-large';
    } else if (name.includes('moondream')) {
      baseName = 'moondream';
    } else {
      // For other models, take the first part before any numbers or separators
      baseName = name.split(/[-._]/)[0];
    }
    
    // Extract size information
    const sizeMatch = name.match(/(\d+(?:\.\d+)?)\s*b(?:illion)?/i);
    let size = sizeMatch ? `${sizeMatch[1]}b` : null;
    
    // If no size found, check for common patterns
    if (!size) {
      if (name.includes('large') || name.includes('7b') || name.includes('8b')) {
        if (name.includes('7b')) size = '7b';
        else if (name.includes('8b')) size = '8b';
        else size = 'large';
      } else if (name.includes('small') || name.includes('1b')) {
        size = '1b';
      } else if (name.includes('medium') || name.includes('3b') || name.includes('4b')) {
        if (name.includes('3b')) size = '3b';
        else if (name.includes('4b')) size = '4b';
        else size = 'medium';
      } else {
        size = 'latest';
      }
    }
    
    return `${baseName}:${size}`;
  }

  async generateConfig() {
    const models = await this.scanModels();
    
    // Separate main models from mmproj files
    const mainModels = models.filter(model => !this.isMmprojModel(model.file));
    const mmprojModels = models.filter(model => this.isMmprojModel(model.file));
    
    // Generate names and handle conflicts
    const modelNames = new Map();
    const nameConflicts = new Map();
    
    // First pass: generate base names and detect conflicts
    mainModels.forEach((model) => {
      const baseName = this.generateModelName(model.file);
      if (modelNames.has(baseName)) {
        // Mark both as having conflicts
        nameConflicts.set(baseName, [modelNames.get(baseName), model]);
      } else {
        modelNames.set(baseName, model);
      }
    });
    
    // Second pass: resolve conflicts by adding differentiators
    nameConflicts.forEach((conflictedModels, baseName) => {
      conflictedModels.forEach((model, index) => {
        const quantization = this.extractQuantization(model.file);
        let newName = baseName;
        
        if (quantization) {
          newName = `${baseName.split(':')[0]}:${baseName.split(':')[1]}-${quantization}`;
        } else {
          newName = `${baseName}-v${index + 1}`;
        }
        
        // Update the model name
        model.name = newName;
        modelNames.delete(baseName);
        modelNames.set(newName, model);
      });
    });
    
    // Assign final names to models that didn't have conflicts
    modelNames.forEach((model, name) => {
      if (!model.name) {
        model.name = name;
      }
    });
    
    let configYaml = `# Auto-generated llama-swap configuration
# Models directory: ${this.modelsDir}
healthCheckTimeout: 30
logLevel: info

models:
`;

    const groupMembers = [];

    // Generate model configurations with dynamic GPU layer calculation
    for (const model of mainModels) {
      // Use platform-specific llama-server path
      const llamaServerPath = this.binaryPaths.llamaServer;
      
      // Calculate optimal GPU layers for this specific model
      const optimalGpuLayers = await this.calculateOptimalGPULayers(model.path, model.size);
      
      // Find matching mmproj model for this main model
      const matchingMmproj = this.findMatchingMmproj(model, mmprojModels);
      
      let cmdLine = `      "${llamaServerPath}"
      -m "${model.path}"
      --port 9999`;

      // Add --jinja parameter for all models
      cmdLine += ` --jinja`;
      
      // Add dynamic GPU layers based on calculation
      if (optimalGpuLayers > 0) {
        cmdLine += ` --n-gpu-layers ${optimalGpuLayers}`;
        log.info(`Model ${model.name}: Using ${optimalGpuLayers} GPU layers`);
      } else {
        log.info(`Model ${model.name}: Using CPU only (0 GPU layers)`);
      }
      
      // Add mmproj parameter if a matching mmproj model is found
      if (matchingMmproj) {
        cmdLine += `
      --mmproj "${matchingMmproj.path}"`;
      }
      
      configYaml += `  "${model.name}":
    proxy: "http://127.0.0.1:9999"
    cmd: |
${cmdLine}
    ttl: 300

`;
      
      groupMembers.push(model.name);
    }

    // Add groups configuration
    configYaml += `groups:
  "default_group":
    swap: true
    exclusive: true
    members:
`;
    
    groupMembers.forEach(member => {
      configYaml += `      - "${member}"\n`;
    });

    await fs.writeFile(this.configPath, configYaml);
    log.info('Dynamic config generated with', mainModels.length, 'models with optimized GPU layer allocation');
    
    return { models: mainModels.length };
  }

  // Helper method to check if a file is an mmproj model
  isMmprojModel(filename) {
    return filename.toLowerCase().includes('mmproj') || 
           filename.toLowerCase().includes('mm-proj') ||
           filename.toLowerCase().includes('projection');
  }

  // Helper method to find matching mmproj model for a main model
  findMatchingMmproj(mainModel, mmprojModels) {
    const mainModelName = mainModel.name.toLowerCase();
    const mainModelFile = mainModel.file.toLowerCase();
    
    // Special handling for gemma3 models - always use the bundled mmproj model
    if (mainModelName.includes('gemma3') || mainModelFile.includes('gemma')) {
      const bundledMmprojPath = path.join(this.baseDir, 'models', 'mmproj-model-f16.gguf');
      
      // Check if the bundled mmproj file exists
      if (fsSync.existsSync(bundledMmprojPath)) {
        return {
          name: 'mmproj-model-f16',
          file: 'mmproj-model-f16.gguf',
          path: bundledMmprojPath,
          source: 'bundled'
        };
      }
    }
    
    // For other models, try to find mmproj model with similar name pattern
    const mainModelBaseName = this.getModelBaseName(mainModel.file);
    
    for (const mmprojModel of mmprojModels) {
      const mmprojBaseName = this.getModelBaseName(mmprojModel.file);
      
      // Check if they share a common base name (e.g., "Qwen2.5-VL-7B")
      if (this.modelsMatch(mainModelBaseName, mmprojBaseName)) {
        return mmprojModel;
      }
    }
    
    // For vision/multimodal models that don't have a specific mmproj match,
    // check if this appears to be a vision model and use bundled mmproj as fallback
    if (this.isVisionModel(mainModel.file)) {
      const bundledMmprojPath = path.join(this.baseDir, 'models', 'mmproj-model-f16.gguf');
      
      if (fsSync.existsSync(bundledMmprojPath)) {
        log.info(`Using bundled mmproj for vision model: ${mainModel.name}`);
        return {
          name: 'mmproj-model-f16',
          file: 'mmproj-model-f16.gguf',
          path: bundledMmprojPath,
          source: 'bundled'
        };
      }
    }
    
    return null;
  }

  // Helper method to detect vision/multimodal models
  isVisionModel(filename) {
    const visionKeywords = ['vl', 'vision', 'multimodal', 'mm', 'clip', 'siglip'];
    const lowerFilename = filename.toLowerCase();
    
    return visionKeywords.some(keyword => lowerFilename.includes(keyword));
  }

  // Helper method to extract base model name from filename
  getModelBaseName(filename) {
    return filename
      .replace('.gguf', '')
      .replace(/-(mmproj|mm-proj|projection).*$/i, '')
      .replace(/-(q4_k_m|q4_k_s|q8_0|f16|instruct).*$/i, '')
      .toLowerCase();
  }

  // Helper method to check if two model names match
  modelsMatch(baseName1, baseName2) {
    // Remove common suffixes and compare
    const normalized1 = baseName1.replace(/-(instruct|chat|it)$/i, '');
    const normalized2 = baseName2.replace(/-(instruct|chat|it)$/i, '');
    
    return normalized1 === normalized2 || 
           normalized1.includes(normalized2) || 
           normalized2.includes(normalized1);
  }

  async start() {
    if (this.isRunning) {
      log.info('Llama-swap service is already running');
      return { success: true, message: 'Service already running' };
    }

    try {
      // Validate binaries before attempting to start
      log.info('Validating binaries before startup...');
      await this.validateBinaries();
      
      // Ensure models directory and config exist
      await this.ensureDirectories();
      await this.generateConfig();

      log.info('Starting llama-swap service...');
      log.info(`Platform: ${this.platformInfo.platformDir}`);
      log.info(`Binary path: ${this.binaryPaths.llamaSwap}`);
      log.info(`Config path: ${this.configPath}`);
      log.info(`Port: ${this.port}`);

      // Fixed command line arguments according to the binary's help output
      const args = [
        '-config', this.configPath,
        '-listen', `:${this.port}`
      ];

      log.info(`Starting with args: ${args.join(' ')}`);

      this.process = spawn(this.binaryPaths.llamaSwap, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: this.platformManager.getPlatformEnvironment(),
        detached: false
      });

      this.isRunning = true;

      // Handle process output
      this.process.stdout.on('data', (data) => {
        const output = data.toString();
        log.info(`llama-swap stdout: ${output.trim()}`);
        
        // Check for successful startup - look for different possible success messages
        if (output.includes(`listening on`) || 
            output.includes(`server started`) ||
            output.includes(`:${this.port}`)) {
          log.info(`llama-swap service started successfully on port ${this.port}`);
        }
      });

      this.process.stderr.on('data', (data) => {
        const error = data.toString();
        log.error(`llama-swap stderr: ${error.trim()}`);
        
        // Check for common errors
        if (error.includes('bind: address already in use')) {
          log.error(`Port ${this.port} is already in use. Please stop any existing llama-swap processes.`);
        }
        if (error.includes('no such file or directory')) {
          log.error('Binary or config file not found');
        }
        if (error.includes('permission denied')) {
          log.error('Permission denied - check binary execute permissions');
        }
      });

      this.process.on('close', (code) => {
        log.info(`llama-swap process exited with code ${code}`);
        this.isRunning = false;
        this.process = null;
        
        if (code !== 0 && code !== null) {
          log.error(`llama-swap service failed with exit code ${code}`);
        }
      });

      this.process.on('error', (error) => {
        log.error('Failed to start llama-swap service:', error);
        this.isRunning = false;
        this.process = null;
      });

      // Wait a bit to see if the process starts successfully
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Check if process is still running (didn't exit immediately due to error)
      if (this.process && !this.process.killed) {
        log.info('llama-swap process is running, checking if service is responding...');
        
        // Try to check if the service is actually responding
        try {
          await this.waitForService(10); // Wait up to 10 seconds
          log.info('llama-swap service is responding to requests');
          return { success: true, message: 'Service started successfully' };
        } catch (serviceError) {
          log.warn('llama-swap process started but service is not responding:', serviceError.message);
          return { success: true, message: 'Service started but not responding yet', warning: serviceError.message };
        }
      } else {
        this.isRunning = false;
        const errorMsg = 'llama-swap process failed to start or exited immediately';
        log.error(errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (error) {
      log.error('Error starting llama-swap service:', error);
      this.isRunning = false;
      this.process = null;
      
      return { 
        success: false, 
        error: error.message,
        diagnostics: error.diagnostics || null
      };
    }
  }

  async waitForService(maxAttempts = 30) {
    let fetch;
    try {
      fetch = global.fetch || (await import('node-fetch')).default;
    } catch (importError) {
      // Fallback for older Node versions or import issues
      const nodeFetch = require('node-fetch');
      fetch = nodeFetch.default || nodeFetch;
    }

    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`http://localhost:${this.port}/v1/models`);
        if (response.ok) {
          return true;
        }
      } catch (error) {
        // Service not ready yet
        log.debug(`Service check attempt ${i + 1}/${maxAttempts} failed:`, error.message);
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('llama-swap service failed to start within timeout period');
  }

  async stop() {
    if (!this.isRunning || !this.process) {
      log.info('Llama-swap service is not running');
      return true;
    }

    return new Promise((resolve) => {
      log.info('Stopping llama-swap service...');
      
      const timeout = setTimeout(() => {
        if (this.process) {
          log.warn('Force killing llama-swap process');
          this.process.kill('SIGKILL');
        }
        resolve(true);
      }, 5000);

      this.process.once('close', () => {
        clearTimeout(timeout);
        this.isRunning = false;
        this.process = null;
        log.info('llama-swap service stopped');
        resolve(true);
      });

      this.process.kill('SIGTERM');
    });
  }

  async restart() {
    await this.stop();
    await new Promise(resolve => setTimeout(resolve, 2000));
    return await this.start();
  }

  getStatus() {
    // First check if we have a process reference
    const hasProcess = this.process && !this.process.killed;
    
    return {
      isRunning: this.isRunning && hasProcess,
      port: this.port,
      pid: this.process?.pid,
      apiUrl: `http://localhost:${this.port}`,
      processExists: hasProcess,
      flagStatus: this.isRunning
    };
  }

  // Add a new method to check if service is actually responding
  async getStatusWithHealthCheck() {
    const basicStatus = this.getStatus();
    
    // If we think it's not running, return early
    if (!basicStatus.isRunning) {
      return basicStatus;
    }
    
    // Try to make a quick health check
    try {
      let fetch;
      try {
        fetch = global.fetch || (await import('node-fetch')).default;
      } catch (importError) {
        const nodeFetch = require('node-fetch');
        fetch = nodeFetch.default || nodeFetch;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout
      
      const response = await fetch(`http://localhost:${this.port}/v1/models`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      return {
        ...basicStatus,
        isResponding: response.ok,
        healthCheck: 'passed'
      };
    } catch (error) {
      return {
        ...basicStatus,
        isResponding: false,
        healthCheck: 'failed',
        healthError: error.message
      };
    }
  }

  async getModels() {
    if (!this.isRunning) {
      return [];
    }

    try {
      let fetch;
      try {
        fetch = global.fetch || (await import('node-fetch')).default;
      } catch (importError) {
        const nodeFetch = require('node-fetch');
        fetch = nodeFetch.default || nodeFetch;
      }

      const response = await fetch(`http://localhost:${this.port}/v1/models`);
      if (response.ok) {
        const data = await response.json();
        return data.data || [];
      }
    } catch (error) {
      log.error('Error fetching models from llama-swap:', error);
    }
    
    return [];
  }

  async downloadModel(modelUrl, modelName) {
    // This would be implemented to download models from Hugging Face or other sources
    // For now, this is a placeholder
    log.info(`Download model functionality to be implemented: ${modelName} from ${modelUrl}`);
    throw new Error('Model download functionality not yet implemented');
  }

  getApiUrl() {
    return `http://localhost:${this.port}`;
  }

  // Helper method to extract quantization info
  extractQuantization(filename) {
    const quantMatch = filename.toLowerCase().match(/(q4_k_m|q4_k_s|q8_0|f16|q4_0|q5_k_m)/i);
    return quantMatch ? quantMatch[1].toLowerCase() : null;
  }

  /**
   * Detect GPU capabilities and memory
   */
  async detectGPUInfo() {
    if (this.gpuInfo) {
      return this.gpuInfo;
    }

    const platform = os.platform();
    let gpuMemoryMB = 0;
    let hasGPU = false;
    let gpuType = 'unknown';

    try {
      if (platform === 'darwin') {
        // For macOS, try to detect Metal/Apple Silicon info
        const systemInfo = await this.getMacOSGPUInfo();
        gpuMemoryMB = systemInfo.gpuMemoryMB;
        hasGPU = systemInfo.hasGPU;
        gpuType = systemInfo.gpuType;
      } else if (platform === 'win32') {
        // For Windows, try to detect NVIDIA/AMD/Intel GPU
        const systemInfo = await this.getWindowsGPUInfo();
        gpuMemoryMB = systemInfo.gpuMemoryMB;
        hasGPU = systemInfo.hasGPU;
        gpuType = systemInfo.gpuType;
      } else {
        // For Linux, try to detect GPU via nvidia-smi or other methods
        const systemInfo = await this.getLinuxGPUInfo();
        gpuMemoryMB = systemInfo.gpuMemoryMB;
        hasGPU = systemInfo.hasGPU;
        gpuType = systemInfo.gpuType;
      }
    } catch (error) {
      log.warn('Failed to detect GPU info:', error.message);
    }

    // Fallback estimation based on system memory and platform
    if (!hasGPU || gpuMemoryMB === 0) {
      const estimatedInfo = this.estimateGPUCapabilities();
      gpuMemoryMB = estimatedInfo.gpuMemoryMB;
      hasGPU = estimatedInfo.hasGPU;
      gpuType = estimatedInfo.gpuType;
    }

    this.gpuInfo = {
      hasGPU,
      gpuMemoryMB,
      gpuMemoryGB: Math.round(gpuMemoryMB / 1024 * 10) / 10,
      gpuType,
      systemMemoryGB: this.systemMemoryGB,
      platform
    };

    log.info('GPU Detection Results:', this.gpuInfo);
    return this.gpuInfo;
  }

  /**
   * Get macOS GPU information using system_profiler
   */
  async getMacOSGPUInfo() {
    return new Promise((resolve) => {
      const { spawn } = require('child_process');
      
      // Try to get GPU info from system_profiler
      const process = spawn('system_profiler', ['SPDisplaysDataType', '-json'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.on('close', (code) => {
        try {
          if (code === 0 && stdout) {
            const displayData = JSON.parse(stdout);
            const displays = displayData.SPDisplaysDataType || [];
            
            let maxMemoryMB = 0;
            let gpuType = 'integrated';
            
            displays.forEach(display => {
              // Check for VRAM information
              if (display.sppci_model && display.sppci_model.includes('Apple')) {
                gpuType = 'apple_silicon';
                // For Apple Silicon, estimate based on unified memory
                // Apple Silicon shares memory, so use a portion of system memory
                const systemMemoryGB = Math.round(os.totalmem() / (1024 * 1024 * 1024));
                if (systemMemoryGB >= 32) {
                  maxMemoryMB = 16384; // 16GB for high-end systems
                } else if (systemMemoryGB >= 16) {
                  maxMemoryMB = 8192; // 8GB for mid-range
                } else {
                  maxMemoryMB = 4096; // 4GB for entry-level
                }
              } else if (display.sppci_vram) {
                // Dedicated GPU with VRAM
                const vramStr = display.sppci_vram;
                const vramMatch = vramStr.match(/(\d+)/);
                if (vramMatch) {
                  const vramMB = parseInt(vramMatch[1]);
                  if (vramMB > maxMemoryMB) {
                    maxMemoryMB = vramMB;
                    gpuType = 'dedicated';
                  }
                }
              }
            });

            resolve({
              hasGPU: maxMemoryMB > 0,
              gpuMemoryMB: maxMemoryMB,
              gpuType
            });
          } else {
            throw new Error('Failed to get system profiler data');
          }
        } catch (error) {
          log.warn('Error parsing macOS GPU info:', error.message);
          resolve(this.estimateGPUCapabilities());
        }
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        process.kill();
        resolve(this.estimateGPUCapabilities());
      }, 5000);
    });
  }

  /**
   * Get Windows GPU information using wmic
   */
  async getWindowsGPUInfo() {
    return new Promise((resolve) => {
      const { spawn } = require('child_process');
      
      // Try to get GPU info from wmic
      const process = spawn('wmic', ['path', 'win32_VideoController', 'get', 'name,AdapterRAM', '/format:csv'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.on('close', (code) => {
        try {
          if (code === 0 && stdout) {
            const lines = stdout.split('\n').filter(line => line.trim());
            let maxMemoryMB = 0;
            let gpuType = 'integrated';
            
            lines.forEach(line => {
              const parts = line.split(',');
              if (parts.length >= 3) {
                const ramStr = parts[1];
                const nameStr = parts[2];
                
                if (ramStr && nameStr && !isNaN(parseInt(ramStr))) {
                  const ramBytes = parseInt(ramStr);
                  const ramMB = Math.round(ramBytes / (1024 * 1024));
                  
                  if (ramMB > maxMemoryMB) {
                    maxMemoryMB = ramMB;
                    
                    // Determine GPU type based on name
                    const lowerName = nameStr.toLowerCase();
                    if (lowerName.includes('nvidia') || lowerName.includes('geforce') || lowerName.includes('rtx') || lowerName.includes('gtx')) {
                      gpuType = 'nvidia';
                    } else if (lowerName.includes('amd') || lowerName.includes('radeon')) {
                      gpuType = 'amd';
                    } else if (lowerName.includes('intel')) {
                      gpuType = 'intel';
                    } else {
                      gpuType = 'dedicated';
                    }
                  }
                }
              }
            });

            resolve({
              hasGPU: maxMemoryMB > 0,
              gpuMemoryMB: maxMemoryMB,
              gpuType
            });
          } else {
            throw new Error('Failed to get Windows GPU info');
          }
        } catch (error) {
          log.warn('Error parsing Windows GPU info:', error.message);
          resolve(this.estimateGPUCapabilities());
        }
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        process.kill();
        resolve(this.estimateGPUCapabilities());
      }, 5000);
    });
  }

  /**
   * Get Linux GPU information using nvidia-smi or other methods
   */
  async getLinuxGPUInfo() {
    return new Promise((resolve) => {
      const { spawn } = require('child_process');
      
      // Try nvidia-smi first
      const process = spawn('nvidia-smi', ['--query-gpu=memory.total', '--format=csv,noheader,nounits'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.on('close', (code) => {
        try {
          if (code === 0 && stdout.trim()) {
            const memoryMB = parseInt(stdout.trim());
            if (!isNaN(memoryMB) && memoryMB > 0) {
              resolve({
                hasGPU: true,
                gpuMemoryMB: memoryMB,
                gpuType: 'nvidia'
              });
              return;
            }
          }
          
          // Fallback to estimation
          resolve(this.estimateGPUCapabilities());
        } catch (error) {
          log.warn('Error parsing Linux GPU info:', error.message);
          resolve(this.estimateGPUCapabilities());
        }
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        process.kill();
        resolve(this.estimateGPUCapabilities());
      }, 5000);
    });
  }

  /**
   * Estimate GPU capabilities based on system specs
   */
  estimateGPUCapabilities() {
    const platform = os.platform();
    const arch = os.arch();
    const systemMemoryGB = this.systemMemoryGB;

    let hasGPU = true;
    let gpuMemoryMB = 2048; // Default 2GB
    let gpuType = 'integrated';

    if (platform === 'darwin') {
      if (arch === 'arm64') {
        // Apple Silicon - unified memory architecture
        gpuType = 'apple_silicon';
        if (systemMemoryGB >= 32) {
          gpuMemoryMB = 16384; // 16GB for high-end
        } else if (systemMemoryGB >= 16) {
          gpuMemoryMB = 8192; // 8GB for mid-range
        } else {
          gpuMemoryMB = 4096; // 4GB minimum
        }
      } else {
        // Intel Mac
        gpuType = 'integrated';
        gpuMemoryMB = Math.min(4096, systemMemoryGB * 256); // Up to 4GB or system memory/4
      }
    } else {
      // Windows/Linux - conservative estimate
      if (systemMemoryGB >= 16) {
        gpuMemoryMB = 4096; // Assume 4GB for systems with 16GB+ RAM
        gpuType = 'dedicated';
      } else if (systemMemoryGB >= 8) {
        gpuMemoryMB = 2048; // 2GB for 8GB systems
      } else {
        gpuMemoryMB = 1024; // 1GB for lower-end systems
        hasGPU = false; // Disable GPU for very low-end systems
      }
    }

    return { hasGPU, gpuMemoryMB, gpuType };
  }

  /**
   * Calculate optimal GPU layers for a model
   */
  async calculateOptimalGPULayers(modelPath, modelFileSize = null) {
    const gpuInfo = await this.detectGPUInfo();
    
    if (!gpuInfo.hasGPU || gpuInfo.gpuMemoryMB < 1024) {
      log.info('GPU not available or insufficient memory, using CPU only');
      return 0;
    }

    try {
      // Get model file size if not provided
      if (!modelFileSize) {
        const stats = await fs.stat(modelPath);
        modelFileSize = stats.size;
      }

      const modelSizeGB = modelFileSize / (1024 * 1024 * 1024);
      const availableGpuMemoryGB = gpuInfo.gpuMemoryGB;

      // Estimate model parameters and layers based on file size
      const modelInfo = this.estimateModelInfo(modelPath, modelSizeGB);
      
      log.info(`Model analysis for ${path.basename(modelPath)}:`, {
        sizeGB: modelSizeGB,
        estimatedParams: modelInfo.estimatedParams,
        estimatedLayers: modelInfo.estimatedLayers,
        availableGpuMemoryGB,
        gpuType: gpuInfo.gpuType
      });

      // Calculate how many layers can fit in GPU memory
      const layersToOffload = this.calculateLayerOffloading(modelInfo, gpuInfo, modelSizeGB);
      
      log.info(`Calculated optimal GPU layers: ${layersToOffload} / ${modelInfo.estimatedLayers}`);
      
      return layersToOffload;
    } catch (error) {
      log.warn('Error calculating optimal GPU layers:', error.message);
      // Fallback to conservative estimate
      return this.getConservativeGPULayers(gpuInfo);
    }
  }

  /**
   * Estimate model information from filename and size
   */
  estimateModelInfo(modelPath, modelSizeGB) {
    const fileName = path.basename(modelPath).toLowerCase();
    
    // Try to extract parameter count from filename
    let estimatedParams = '7b'; // default
    let estimatedLayers = 32; // default for 7B models
    
    // Extract parameter info from filename
    const paramMatch = fileName.match(/(\d+(?:\.\d+)?)\s*b/i);
    if (paramMatch) {
      const paramCount = parseFloat(paramMatch[1]);
      estimatedParams = `${paramCount}b`;
      
      // Estimate layers based on parameter count
      if (paramCount <= 1) {
        estimatedLayers = 22; // 1B models
      } else if (paramCount <= 3) {
        estimatedLayers = 26; // 3B models
      } else if (paramCount <= 7) {
        estimatedLayers = 32; // 7B models
      } else if (paramCount <= 13) {
        estimatedLayers = 40; // 13B models
      } else if (paramCount <= 30) {
        estimatedLayers = 60; // 30B models
      } else if (paramCount <= 70) {
        estimatedLayers = 80; // 70B models
      } else {
        estimatedLayers = 100; // Larger models
      }
    }

    // Adjust based on model size (more accurate than filename sometimes)
    if (modelSizeGB < 1) {
      estimatedLayers = Math.min(estimatedLayers, 22);
    } else if (modelSizeGB < 4) {
      estimatedLayers = Math.min(estimatedLayers, 32);
    } else if (modelSizeGB < 8) {
      estimatedLayers = Math.min(estimatedLayers, 40);
    } else if (modelSizeGB < 15) {
      estimatedLayers = Math.min(estimatedLayers, 60);
    }

    return {
      estimatedParams,
      estimatedLayers,
      modelSizeGB
    };
  }

  /**
   * Calculate how many layers to offload based on available memory
   */
  calculateLayerOffloading(modelInfo, gpuInfo, modelSizeGB) {
    const availableGpuMemoryGB = gpuInfo.gpuMemoryGB;
    const totalLayers = modelInfo.estimatedLayers;
    
    // Reserve memory for context and other overhead
    let reservedMemoryGB = 1; // Default 1GB reserved
    
    if (gpuInfo.gpuType === 'apple_silicon') {
      // Apple Silicon shares memory, so be more conservative
      reservedMemoryGB = Math.max(2, availableGpuMemoryGB * 0.3);
    } else if (gpuInfo.gpuType === 'integrated') {
      // Integrated graphics share system memory
      reservedMemoryGB = Math.max(1.5, availableGpuMemoryGB * 0.4);
    } else {
      // Dedicated GPU
      reservedMemoryGB = Math.max(1, availableGpuMemoryGB * 0.2);
    }

    const usableGpuMemoryGB = Math.max(0, availableGpuMemoryGB - reservedMemoryGB);
    
    // Estimate memory per layer (rough approximation)
    const memoryPerLayerGB = modelSizeGB / totalLayers;
    
    // Calculate how many layers can fit
    let maxLayers = Math.floor(usableGpuMemoryGB / memoryPerLayerGB);
    
    // Apply safety limits and platform-specific optimizations
    if (gpuInfo.gpuType === 'apple_silicon') {
      // Apple Silicon handles memory differently, can be more aggressive
      maxLayers = Math.min(maxLayers, totalLayers);
    } else if (gpuInfo.gpuType === 'nvidia' && gpuInfo.gpuMemoryMB >= 8192) {
      // High-end NVIDIA cards can handle full offloading better
      maxLayers = Math.min(maxLayers, totalLayers);
    } else {
      // Conservative approach for other GPUs
      maxLayers = Math.min(maxLayers, Math.floor(totalLayers * 0.8));
    }

    // Ensure we don't exceed total layers or go negative
    maxLayers = Math.max(0, Math.min(maxLayers, totalLayers));
    
    // Round down to avoid edge cases
    return Math.floor(maxLayers);
  }

  /**
   * Get conservative GPU layer estimate as fallback
   */
  getConservativeGPULayers(gpuInfo) {
    if (!gpuInfo.hasGPU) return 0;
    
    if (gpuInfo.gpuMemoryGB >= 16) {
      return 35; // High-end GPU
    } else if (gpuInfo.gpuMemoryGB >= 8) {
      return 25; // Mid-range GPU
    } else if (gpuInfo.gpuMemoryGB >= 4) {
      return 15; // Entry-level dedicated GPU
    } else {
      return 5; // Integrated graphics
    }
  }

  /**
   * Get GPU diagnostics information for the frontend
   */
  async getGPUDiagnostics() {
    try {
      // Get GPU information
      const gpuInfo = await this.detectGPUInfo();
      
      // Get model information with GPU allocation details
      const models = await this.scanModels();
      const mainModels = models.filter(model => !this.isMmprojModel(model.file));
      
      const modelInfo = [];
      
      for (const model of mainModels) {
        try {
          const modelSizeGB = model.size / (1024 * 1024 * 1024);
          const modelEstimation = this.estimateModelInfo(model.path, modelSizeGB);
          const allocatedLayers = await this.calculateOptimalGPULayers(model.path, model.size);
          
          modelInfo.push({
            name: this.generateModelName(model.file),
            path: model.path,
            sizeGB: modelSizeGB,
            estimatedLayers: modelEstimation.estimatedLayers,
            allocatedLayers: allocatedLayers,
            estimatedParams: modelEstimation.estimatedParams
          });
        } catch (error) {
          log.warn(`Error getting GPU info for model ${model.file}:`, error.message);
          // Include model with fallback data
          modelInfo.push({
            name: this.generateModelName(model.file),
            path: model.path,
            sizeGB: model.size / (1024 * 1024 * 1024),
            estimatedLayers: 32, // fallback
            allocatedLayers: 0, // fallback to CPU
            estimatedParams: 'unknown'
          });
        }
      }
      
      return {
        gpuInfo,
        modelInfo
      };
    } catch (error) {
      log.error('Error getting GPU diagnostics:', error);
      throw error;
    }
  }
}

module.exports = LlamaSwapService;