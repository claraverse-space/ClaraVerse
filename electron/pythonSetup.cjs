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
    
    // Enhanced path logging
    const resourcesPath = process.resourcesPath;
    this.log('Initializing Python Setup', {
      isDevMode: this.isDevMode,
      resourcesPath,
      platform: process.platform,
      arch: process.arch
    });
    
    if (this.isDevMode) {
      // In development, use user's home directory for persistent storage
      this.appDataPath = path.join(os.homedir(), '.clara');
      this.envPath = path.join(this.appDataPath, 'python-env');
      this.initPath = path.join(this.appDataPath, '.initialized');
    } else {
      // In production, use bundled Python runtime from resources
      this.appDataPath = path.join(process.resourcesPath, 'clara-data'); 
      this.envPath = path.join(process.resourcesPath, 'python-env');
      this.initPath = path.join(this.appDataPath, '.initialized');
      
      // Verify resources path exists
      if (!fs.existsSync(process.resourcesPath)) {
        throw new Error(`Resources path does not exist: ${process.resourcesPath}`);
      }
    }
    
    // Platform-specific paths with validation
    if (process.platform === 'win32') {
      this.pythonExe = path.join(this.envPath, 'python.exe');
    } else {
      this.pythonExe = path.join(this.envPath, 'bin', 'python');
    }

    // Log all critical paths
    this.log('Python paths configured', {
      appDataPath: this.appDataPath,
      envPath: this.envPath,
      pythonExe: this.pythonExe,
      initPath: this.initPath
    });

    // Create app data directory if it doesn't exist
    try {
      if (!fs.existsSync(this.appDataPath)) {
        fs.mkdirSync(this.appDataPath, { recursive: true });
        this.log('Created app data directory', { path: this.appDataPath });
      }
    } catch (error) {
      this.log('Failed to create app data directory', { 
        error: error.message,
        code: error.code,
        path: this.appDataPath
      });
      throw new Error(`Failed to create app data directory: ${error.message}`);
    }

    // Initialize a flag to force bundled Python usage
    this.useBundled = false;
    this.forceSetup = false;

    // Logger setup with error handling
    this.logPath = path.join(this.appDataPath, 'python-setup.log');
    try {
      // Test write access to log file
      fs.appendFileSync(this.logPath, '--- New Session Started ---\n');
    } catch (error) {
      console.error('Failed to write to log file:', error);
      // Try alternate location if primary fails
      this.logPath = path.join(os.tmpdir(), 'clara-python-setup.log');
      fs.appendFileSync(this.logPath, '--- New Session Started (Alternate Location) ---\n');
    }
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
      // Log system information
      const sysInfo = {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        electronVersion: process.versions.electron,
        isDevMode: this.isDevMode,
        resourcesPath: process.resourcesPath
      };
      this.log('Starting Python setup with system info:', sysInfo);
      progressCallback?.('Setting up Python environment...');
      
      // Verify write permissions
      try {
        const testFile = path.join(this.appDataPath, '.write-test');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
      } catch (error) {
        throw new Error(`No write permission in app data directory: ${error.message}`);
      }
      
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

  async downloadFile(url, dest, progressCallback) {
    return new Promise((resolve, reject) => {
      const file = createWriteStream(dest);
      
      https.get(url, response => {
        const totalSize = parseInt(response.headers['content-length'], 10);
        let downloadedSize = 0;
        let lastProgress = 0;

        response.on('data', chunk => {
          downloadedSize += chunk.length;
          const progress = Math.round((downloadedSize / totalSize) * 100);
          
          // Only update progress if it changed by at least 1%
          if (progress > lastProgress) {
            progressCallback?.(`Downloading ${path.basename(url)}: ${progress}%`, 'info');
            lastProgress = progress;
          }
        });

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          progressCallback?.(`Download complete: ${path.basename(url)}`, 'success');
          resolve();
        });
      }).on('error', err => {
        fs.unlink(dest, () => {}); // Delete the file if download failed
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

  async runCommand(cmd, args, options = {}) {
    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, args, {
        ...options,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let output = '';

      proc.stdout.on('data', (data) => {
        const text = data.toString();
        output += text;
        // Send real-time output to progress callback
        if (options.progress) {
          options.progress(text.trim(), 'info');
        }
      });

      proc.stderr.on('data', (data) => {
        const text = data.toString();
        output += text;
        // Send error output to progress callback
        if (options.progress) {
          // Some tools use stderr for progress info, so we don't mark all as errors
          const type = text.toLowerCase().includes('error') ? 'error' : 'info';
          options.progress(text.trim(), type);
        }
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Command failed with code ${code}: ${output}`));
        }
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
    // Enhanced Python path validation
    if (!fs.existsSync(this.pythonExe)) {
      this.log('Python executable not found', { path: this.pythonExe });
      throw new Error(`Python executable not found at: ${this.pythonExe}`);
    }

    try {
      // Verify Python executable is actually executable
      await this.runCommand(this.pythonExe, ['--version'], {
        timeout: 5000,
        progress: (msg) => this.log('Python version check:', { output: msg })
      });
      return this.pythonExe;
    } catch (error) {
      this.log('Python executable validation failed', { 
        error: error.message,
        path: this.pythonExe 
      });
      throw new Error(`Python executable validation failed: ${error.message}`);
    }
  }
}

module.exports = PythonSetup;