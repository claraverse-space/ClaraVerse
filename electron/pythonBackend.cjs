const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');
const EventEmitter = require('events');
const log = require('electron-log');

/**
 * Industry-standard Python backend service manager
 * Handles process lifecycle, port management, and health monitoring
 */
class PythonBackendService extends EventEmitter {
  constructor(pythonSetup) {
    super();
    this.pythonSetup = pythonSetup;
    this.process = null;
    this.port = null;
    this.isReady = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.healthCheckInterval = null;
    this.status = 'stopped';
    
    // Configure logger properly
    this.logger = {
      info: (message, data) => {
        console.log(`[Python Backend] ${message}`, data || '');
        log.info(`[Python Backend] ${message}`, data || '');
      },
      warn: (message, data) => {
        console.warn(`[Python Backend] ${message}`, data || '');
        log.warn(`[Python Backend] ${message}`, data || '');
      },
      error: (message, data) => {
        console.error(`[Python Backend] ${message}`, data || '');
        log.error(`[Python Backend] ${message}`, data || '');
      },
      debug: (message, data) => {
        console.debug(`[Python Backend] ${message}`, data || '');
        log.debug(`[Python Backend] ${message}`, data || '');
      }
    };
    
    this.logger.info('Python backend service initialized');
  }

  /**
   * Start the Python backend service
   */
  async start(options = {}) {
    if (this.process) {
      this.logger.info('Python process already running');
      return;
    }

    try {
      this.status = 'starting';
      this.emit('status-change', { status: 'starting' });
      
      // Get available port
      this.port = options.port || await this.findAvailablePort(8090, 8199);
      this.logger.info(`Selected port ${this.port} for Python backend`);
      
      // Enhanced environment validation
      const pythonExe = await this.pythonSetup.getPythonPath().catch(error => {
        this.logger.error('Failed to get Python path', { error: error.message });
        throw new Error(`Python environment not ready: ${error.message}`);
      });
      
      // Get the path to the Python backend with enhanced validation
      const isDev = process.env.NODE_ENV === 'development';
      const isWin = process.platform === 'win32';
      const isMac = process.platform === 'darwin';
      
      // Log all relevant paths for debugging
      this.logger.info('Environment paths', {
        isDev,
        isWin,
        isMac,
        resourcesPath: process.resourcesPath,
        __dirname
      });
      
      const backendPath = isDev 
        ? path.join(__dirname, '..', 'py_backend')
        : isWin || isMac
          ? path.join(process.resourcesPath, 'py_backend')
          : path.join(process.resourcesPath, 'app.asar.unpacked', 'py_backend');
      
      const mainPyPath = path.join(backendPath, 'main.py');
      
      // Enhanced path validation
      if (!fs.existsSync(backendPath)) {
        throw new Error(`Python backend directory not found: ${backendPath}`);
      }
      
      if (!fs.existsSync(mainPyPath)) {
        throw new Error(`Python backend script not found: ${mainPyPath}`);
      }
      
      // Verify Python environment
      try {
        const pythonVersion = await this.pythonSetup.runCommand(pythonExe, ['--version'], {
          timeout: 5000,
          progress: (msg) => this.logger.info('Python version check:', { output: msg })
        });
        this.logger.info('Python version:', { version: pythonVersion.trim() });
      } catch (error) {
        throw new Error(`Failed to verify Python installation: ${error.message}`);
      }
      
      // Set environment variables with enhanced logging
      const env = {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHONIOENCODING: 'utf-8',
        CLARA_PORT: this.port.toString(),
        CLARA_DEBUG: '1', // Enable debug logging
        CLARA_LOG_PATH: path.join(this.pythonSetup.appDataPath, 'python-backend.log')
      };
      
      this.logger.info('Starting Python backend with config:', {
        pythonExe,
        mainPyPath,
        backendPath,
        port: this.port
      });
      
      // Start the process with enhanced error handling
      this.process = spawn(pythonExe, [mainPyPath], {
        cwd: backendPath,
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      let startupOutput = '';
      
      // Enhanced stdout handler with startup logging
      this.process.stdout.on('data', (data) => {
        const output = data.toString().trim();
        startupOutput += output + '\n';
        this.logger.info(`Python stdout: ${output}`);
        
        if (output.includes('ERROR') || output.includes('Exception')) {
          this.logger.error('Python error detected:', { output });
          this.emit('error', new Error(output));
        }
        
        // Check for port announcement in output
        const portMatch = output.match(/CLARA_PORT:(\d+)/);
        if (portMatch && portMatch[1]) {
          this.port = parseInt(portMatch[1], 10);
          this.logger.info(`Python service running on port: ${this.port}`);
          this.emit('port-detected', this.port);
        }
        
        // Check for ready signal
        if (output.includes('Application startup complete')) {
          this.status = 'running';
          this.isReady = true;
          this.retryCount = 0;
          this.startHealthCheck();
          this.emit('ready', { port: this.port });
          this.emit('status-change', { status: 'running', port: this.port });
        }
      });
      
      // Enhanced stderr handler
      this.process.stderr.on('data', (data) => {
        const output = data.toString().trim();
        startupOutput += output + '\n';
        
        if (output.includes('ERROR') || output.includes('Exception')) {
          this.logger.error('Python error:', { output });
          this.emit('error', new Error(output));
        } else if (!output.startsWith('INFO:') && !output.includes('Uvicorn running')) {
          this.logger.warn('Python stderr:', { output });
        } else {
          this.logger.debug('Python stderr:', { output });
        }
        
        // Check for startup complete in stderr
        if (output.includes('Application startup complete')) {
          this.status = 'running';
          this.isReady = true;
          this.retryCount = 0;
          this.startHealthCheck();
          this.emit('ready', { port: this.port });
          this.emit('status-change', { status: 'running', port: this.port });
        }
      });
      
      // Enhanced process exit handler
      this.process.on('exit', (code, signal) => {
        this.logger.info('Python process exited', { 
          code, 
          signal,
          startupOutput: startupOutput.split('\n').slice(-20).join('\n') // Last 20 lines
        });
        
        this.stopHealthCheck();
        this.process = null;
        this.isReady = false;
        
        if (this.status !== 'stopping') {
          this.status = 'crashed';
          this.emit('status-change', { 
            status: 'crashed', 
            code, 
            signal,
            lastOutput: startupOutput 
          });
          
          if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            this.logger.info(`Attempting restart (${this.retryCount}/${this.maxRetries})`);
            setTimeout(() => this.start(), 2000);
          } else {
            this.status = 'failed';
            this.emit('status-change', { 
              status: 'failed',
              message: 'Maximum retry attempts reached',
              lastOutput: startupOutput
            });
          }
        } else {
          this.status = 'stopped';
          this.emit('status-change', { status: 'stopped' });
        }
      });
      
      // Handle process error
      this.process.on('error', (error) => {
        this.logger.error(`Python process error: ${error.message}`);
        this.emit('error', error);
      });
      
      // Set up timeout for startup
      setTimeout(() => {
        if (this.status === 'starting') {
          this.logger.warn('Python backend startup timeout');
          this.status = 'timeout';
          this.emit('status-change', { status: 'timeout' });
          // Continue running - don't kill the process, it might still start up
        }
      }, 30000);
      
      return { port: this.port };
      
    } catch (error) {
      this.logger.error(`Failed to start Python backend: ${error.message}`);
      this.status = 'failed';
      this.emit('status-change', { status: 'failed', error: error.message });
      throw error;
    }
  }

  /**
   * Stop the Python backend service
   */
  async stop() {
    if (!this.process) {
      this.logger.info('No Python process to stop');
      return;
    }
    
    this.logger.info('Stopping Python backend');
    this.status = 'stopping';
    this.emit('status-change', { status: 'stopping' });
    this.stopHealthCheck();
    
    // Graceful shutdown with timeout
    return new Promise((resolve) => {
      // Set a timeout for force kill
      const killTimeout = setTimeout(() => {
        this.logger.warn('Force killing Python process after timeout');
        if (this.process) {
          this.process.kill('SIGKILL');
        }
      }, 5000);
      
      // Try graceful exit first
      if (this.process) {
        // Listen for exit
        this.process.once('exit', () => {
          clearTimeout(killTimeout);
          this.process = null;
          this.isReady = false;
          this.status = 'stopped';
          this.emit('status-change', { status: 'stopped' });
          resolve();
        });
        
        // Send SIGTERM for graceful shutdown
        this.process.kill('SIGTERM');
      } else {
        clearTimeout(killTimeout);
        resolve();
      }
    });
  }

  /**
   * Find an available port in the specified range
   */
  async findAvailablePort(startPort, endPort) {
    for (let port = startPort; port <= endPort; port++) {
      try {
        await new Promise((resolve, reject) => {
          const server = net.createServer();
          server.unref();
          
          server.on('error', reject);
          
          server.listen(port, '127.0.0.1', () => {
            server.close(() => resolve(port));
          });
        });
        
        return port;
      } catch (err) {
        // Port in use, try next one
      }
    }
    
    throw new Error(`No available ports found between ${startPort} and ${endPort}`);
  }

  /**
   * Start periodic health check
   */
  startHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(async () => {
      if (!this.isReady || !this.port) return;
      
      try {
        // Use Node's built-in http module instead of fetch
        const http = require('http');
        
        await new Promise((resolve, reject) => {
          const req = http.get(`http://localhost:${this.port}/health`, {
            timeout: 3000,
            headers: { 'Accept': 'application/json' }
          }, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
              data += chunk;
            });
            
            res.on('end', () => {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                this.retryCount = 0;
                this.logger.debug('Health check passed');
                this.emit('health-check', { status: 'ok' });
                resolve(data);
              } else {
                this.logger.warn(`Health check failed with status: ${res.statusCode}`);
                this.emit('health-check', { status: 'failed', code: res.statusCode });
                reject(new Error(`HTTP status ${res.statusCode}`));
              }
            });
          });
          
          req.on('error', (error) => {
            reject(error);
          });
          
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
          });
        });
      } catch (error) {
        this.logger.warn(`Health check error: ${error.message}`);
        this.emit('health-check', { status: 'error', message: error.message });
        
        // Check if process is still running but not responding
        if (this.process && this.isReady && this.retryCount >= 3) {
          this.logger.error('Backend not responding after multiple health checks');
          this.emit('status-change', { status: 'unresponsive', port: this.port });
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop the health check interval
   */
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Get the current port
   */
  getPort() {
    return this.port;
  }

  /**
   * Get the current status
   */
  getStatus() {
    return {
      status: this.status,
      port: this.port,
      isReady: this.isReady,
      retryCount: this.retryCount,
      pid: this.process ? this.process.pid : null
    };
  }
}

module.exports = PythonBackendService;