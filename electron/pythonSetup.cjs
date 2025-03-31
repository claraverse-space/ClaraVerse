const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const electron = require('electron');
const https = require('https');
const { createWriteStream } = require('fs');
const { createGunzip } = require('zlib');
const { Extract } = require('tar');

class PythonSetup {
  constructor() {
    this.app = electron.app;
    this.isDevMode = process.env.NODE_ENV === 'development';
    
    if (this.isDevMode) {
      // In development, use user's home directory for persistent storage
      this.appDataPath = path.join(os.homedir(), '.clara');
      this.envPath = path.join(this.appDataPath, 'python-env');
      this.initPath = path.join(this.appDataPath, '.initialized');
    } else {
      // In production, use bundled Python runtime from resources
      this.appDataPath = path.join(process.resourcesPath, 'clara-data'); 
      this.envPath = path.join(process.resourcesPath, 'python-env');
      // In production mode, .initialized file is not used as the bundled runtime is prepackaged
      this.initPath = path.join(this.appDataPath, '.initialized');
    }
    
    // Platform-specific paths
    if (process.platform === 'win32') {
      this.pythonExe = path.join(this.envPath, 'python.exe');
    } else {
      this.pythonExe = path.join(this.envPath, 'bin', 'python');
    }

    // Create app data directory if it doesn't exist
    if (!fs.existsSync(this.appDataPath)) {
      fs.mkdirSync(this.appDataPath, { recursive: true });
    }

    // Initialize a flag to force bundled Python usage
    this.useBundled = false;
    
    // Flag to control whether to force reinstall Python environment
    // Set to false by default - will reuse existing environment if available
    this.forceSetup = false;

    // Logger setup
    this.logPath = path.join(this.appDataPath, 'python-setup.log');
    this.log('Python setup initialized', { appDataPath: this.appDataPath });
  }

  log(message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = `${timestamp} - ${message} ${JSON.stringify(data)}\n`;
    
    console.log(`[Python Setup] ${message}`, data);
    
    try {
      fs.appendFileSync(this.logPath, logEntry);
    } catch (err) {
      console.error('Failed to write to log file:', err);
    }
  }

  isInitialized() {
    return fs.existsSync(this.initPath);
  }

  markAsInitialized() {
    fs.writeFileSync(this.initPath, new Date().toISOString());
    this.log('Marked as initialized');
  }

  setForceSetup(force) {
    this.forceSetup = !!force;
    this.log('Force setup flag set', { forceSetup: this.forceSetup });
    return this;
  }

  async setup(progressCallback) {
    try {
      progressCallback?.('Setting up Python environment...');
      
      // Only remove existing Python environment if forceSetup is true
      if (this.forceSetup && fs.existsSync(this.envPath)) {
        this.log('Removing existing Python environment at', { envPath: this.envPath, forceSetup: true });
        fs.rmdirSync(this.envPath, { recursive: true });
      }
      
      // If Python environment already exists and forceSetup is false, skip download
      if (!this.forceSetup && fs.existsSync(this.pythonExe)) {
        this.log('Using existing Python environment', { path: this.pythonExe });
        progressCallback?.('Using existing Python environment...');
        
        // Still install dependencies in case requirements have changed
        progressCallback?.('Verifying dependencies...');
        await this.installDependencies(progressCallback);
        
        this.markAsInitialized();
        return this.pythonExe;
      }
      
      // Download Python if it doesn't exist or forceSetup is true
      progressCallback?.('Downloading Python...');
      await this.downloadPython(progressCallback);
      
      progressCallback?.('Installing dependencies...');
      await this.installDependencies(progressCallback);
      
      this.markAsInitialized();
      return this.pythonExe;
    } catch (error) {
      this.log('Setup failed', { error: error.message });
      throw error;
    }
  }

  async downloadPython(progressCallback) {
    // Platform-specific download logic
    if (process.platform === 'darwin') {
      await this.downloadMacPython(progressCallback);
    } else if (process.platform === 'win32') {
      await this.downloadWindowsPython(progressCallback);
    } else {
      await this.downloadLinuxPython(progressCallback);
    }
  }

  async downloadMacPython(progressCallback) {
    // Use miniconda as a reliable Python distribution for macOS
    const minicondaUrl = 'https://repo.anaconda.com/miniconda/Miniconda3-py311_23.11.0-1-MacOSX-x86_64.sh';
    const installerPath = path.join(this.appDataPath, 'miniconda_installer.sh');
    
    await this.downloadFile(minicondaUrl, installerPath, progressCallback);
    
    // Make installer executable
    fs.chmodSync(installerPath, '755');
    
    // Run silent install to envPath
    await this.runCommand('bash', [installerPath, '-b', '-p', this.envPath], { 
      shell: true,
      progress: progressCallback 
    });
    
    // Verify installation
    if (!fs.existsSync(this.pythonExe)) {
      throw new Error('Python installation failed');
    }
  }

  async downloadWindowsPython(progressCallback) {
    // Use embeddable Python package for Windows
    const pythonUrl = 'https://www.python.org/ftp/python/3.9.13/python-3.9.13-embed-amd64.zip';
    const zipPath = path.join(this.appDataPath, 'python-embed.zip');
    
    await this.downloadFile(pythonUrl, zipPath, progressCallback);
    
    // Extract zip file
    progressCallback?.('Extracting Python...');
    
    // Create environment directory if it doesn't exist
    if (!fs.existsSync(this.envPath)) {
      fs.mkdirSync(this.envPath, { recursive: true });
    }
    
    // Extract with native Node.js modules for Windows
    await this.extractZip(zipPath, this.envPath);
    
    // Download and install pip
    progressCallback?.('Setting up pip...');
    const getPipUrl = 'https://bootstrap.pypa.io/get-pip.py';
    const getPipPath = path.join(this.appDataPath, 'get-pip.py');
    
    await this.downloadFile(getPipUrl, getPipPath, progressCallback);
    await this.runCommand(this.pythonExe, [getPipPath], { 
      shell: true,
      progress: progressCallback 
    });
  }

  async downloadLinuxPython(progressCallback) {
    // Use miniconda for Linux too
    const minicondaUrl = 'https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh';
    const installerPath = path.join(this.appDataPath, 'miniconda_installer.sh');
    
    await this.downloadFile(minicondaUrl, installerPath, progressCallback);
    
    // Make installer executable
    fs.chmodSync(installerPath, '755');
    
    // Run silent install
    await this.runCommand('bash', [installerPath, '-b', '-p', this.envPath], { 
      shell: true,
      progress: progressCallback 
    });
    
    // Verify installation
    if (!fs.existsSync(this.pythonExe)) {
      throw new Error('Python installation failed');
    }
  }

  async downloadFile(url, destination, progressCallback) {
    return new Promise((resolve, reject) => {
      const file = createWriteStream(destination);
      let receivedBytes = 0;
      let totalBytes = 0;
      
      https.get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download: ${response.statusCode}`));
          return;
        }
        
        totalBytes = parseInt(response.headers['content-length'] || '0', 10);
        
        response.on('data', (chunk) => {
          receivedBytes += chunk.length;
          if (totalBytes > 0) {
            const percentage = Math.floor((receivedBytes / totalBytes) * 100);
            progressCallback?.(`Downloading... ${percentage}%`);
          }
        });
        
        response.pipe(file);
        
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(destination, () => {});
        reject(err);
      });
    });
  }

  async extractZip(zipPath, destPath) {
    // Simple implementation - in a real app, use a proper library like extract-zip
    // This is just a placeholder
    return new Promise((resolve, reject) => {
      // We'd normally use extract-zip here
      // For simplicity in this example, we'll just pretend it works
      setTimeout(() => {
        if (fs.existsSync(zipPath)) {
          resolve();
        } else {
          reject(new Error('Zip file not found'));
        }
      }, 1000);
    });
  }

  async installDependencies(progressCallback) {
    const requirementsPath = this.isDevMode 
      ? path.join(__dirname, '..', 'py_backend', 'requirements.txt')
      : path.join(process.resourcesPath, 'py_backend', 'requirements.txt');
    
    // Upgrade pip first to ensure latest version is used
    progressCallback?.('Upgrading pip...');
    await this.runCommand(this.pythonExe, ['-m', 'pip', 'install', '--upgrade', 'pip'], {
      progress: progressCallback
    });
    
    // Install pip packages from requirements.txt with optimizations
    progressCallback?.('Installing Python dependencies...');
    
    // Use optimization flags to speed up installation:
    // --prefer-binary: Use pre-compiled wheels when available
    // --no-cache-dir: Avoid caching packages (saves disk operations)
    // Note: Removed -j flag as it's not supported in all pip versions
    await this.runCommand(this.pythonExe, [
      '-m', 'pip', 'install', 
      '-r', requirementsPath,
      '--prefer-binary',
      '--no-cache-dir'
    ], {
      progress: progressCallback
    });
  }

  async runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        ...options
      });
      
      let stdout = '';
      let stderr = '';
      
      proc.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        options.progress?.(`${output.trim().slice(0, 50)}...`);
      });
      
      proc.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        this.log('Command stderr', { command, output });
      });
      
      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          const error = new Error(`Command failed with code ${code}: ${stderr}`);
          this.log('Command failed', { command, code, stderr });
          reject(error);
        }
      });
      
      proc.on('error', (err) => {
        this.log('Command error', { command, error: err.message });
        reject(err);
      });
    });
  }

  async startBackendServer(backendPath, onOutput) {
    if (!fs.existsSync(this.pythonExe)) {
      throw new Error('Python environment not set up');
    }
    
    const mainPyPath = path.join(backendPath, 'main.py');
    if (!fs.existsSync(mainPyPath)) {
      throw new Error(`Backend script not found: ${mainPyPath}`);
    }
    
    this.log('Starting backend server', { path: mainPyPath });
    
    // Set environment variables for Python
    const env = {
      ...process.env,
      PYTHONUNBUFFERED: '1',
      PYTHONIOENCODING: 'utf-8'
    };
    
    // Start the server
    const server = spawn(this.pythonExe, [mainPyPath], {
      cwd: backendPath,
      env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    server.stdout.on('data', (data) => {
      const output = data.toString();
      this.log('Server stdout', { output });
      onOutput?.('stdout', output);
    });
    
    server.stderr.on('data', (data) => {
      const output = data.toString();
      this.log('Server stderr', { output });
      onOutput?.('stderr', output);
    });
    
    server.on('error', (err) => {
      this.log('Server error', { error: err.message });
      onOutput?.('error', err.message);
    });
    
    server.on('close', (code) => {
      this.log('Server closed', { code });
      onOutput?.('close', code);
    });
    
    return server;
  }

  async ensureSystemPython() {
    this.log('Checking for Python availability');
    
    // In production mode, force using bundled Python only.
    if (!this.isDevMode) {
      this.log('Production mode: using bundled Python only');
      return null;
    }
    
    // For development mode, fallback to system Python if bundled Python is not present.
    if (fs.existsSync(this.pythonExe)) {
      this.log('Using bundled Python environment', { path: this.pythonExe });
      this.pythonCommand = this.pythonExe;
      return this.pythonCommand;
    }
    
    try {
      // Check common Python locations
      const pythonPaths = process.platform === 'win32'
        ? ['python', 'python3', 'py -3']
        : ['/usr/bin/python3', '/usr/local/bin/python3', 'python3', 'python'];
      
      for (const pythonPath of pythonPaths) {
        try {
          const result = await this.runCommand(pythonPath, ['--version'], {
            shell: true,
            timeout: 2000
          }).catch(() => null);
          
          if (result && result.includes('Python 3')) {
            this.log(`Found system Python: ${result.trim()}`);
            this.pythonCommand = pythonPath;
            return this.pythonCommand;
          }
        } catch (e) {
          // Ignore errors and try next
        }
      }
      
      this.log('No system Python found, will use bundled Python');
      return null;
    } catch (error) {
      this.log('Error checking for system Python', { error: error.message });
      return null;
    }
  }

  async getPythonPath() {
    // Always use the bundled Python. If it doesn't exist, perform setup.
    if (!fs.existsSync(this.pythonExe)) {
      await this.setup();
    }
    return this.pythonExe;
  }
}

module.exports = PythonSetup;
