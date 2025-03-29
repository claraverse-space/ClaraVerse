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
      
      // Get the Python executable
      const pythonExe = await this.pythonSetup.getPythonPath();
      
      // Get the path to the Python backend
      const isDev = process.env.NODE_ENV === 'development';
      const isWin = process.platform === 'win32';
      const isMac = process.platform === 'darwin';
      
      const backendPath = isDev 
        ? path.join(__dirname, '..', 'py_backend')
        : isWin || isMac
          ? path.join(process.resourcesPath, 'py_backend')
          : path.join(process.resourcesPath, 'app.asar.unpacked', 'py_backend');
      
      const mainPyPath = path.join(backendPath, 'main.py');
      
      if (!fs.existsSync(mainPyPath)) {
        throw new Error(`Python backend script not found: ${mainPyPath}`);
      }
      
      this.logger.info(`Starting Python backend from: ${mainPyPath}`);
      
      // Set environment variables
      const env = {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHONIOENCODING: 'utf-8',
        CLARA_PORT: this.port.toString()
      };
      
      // Start the process
      this.process = spawn(pythonExe, [mainPyPath], {
        cwd: backendPath,
        env,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      // Set up stdout handler
      this.process.stdout.on('data', (data) => {
        const output = data.toString().trim();
        this.logger.info(`Python stdout: ${output}`);
        
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
      
      // Set up stderr handler
      this.process.stderr.on('data', (data) => {
        const output = data.toString().trim();
        
        // Only log real errors, filter out normal uvicorn startup info
        if (!output.startsWith('INFO:') && !output.includes('Uvicorn running')) {
          this.logger.error(`Python stderr: ${output}`);
        } else {
          this.logger.debug(`Python stderr: ${output}`);
        }
        
        // Check for startup complete message in stderr (uvicorn logs to stderr)
        if (output.includes('Application startup complete')) {
          this.status = 'running';
          this.isReady = true;
          this.retryCount = 0;
          this.startHealthCheck();
          this.emit('ready', { port: this.port });
          this.emit('status-change', { status: 'running', port: this.port });
        }
      });
      
      // Handle process exit
      this.process.on('exit', (code, signal) => {
        this.logger.info(`Python process exited with code ${code} and signal ${signal}`);
        
        this.stopHealthCheck();
        this.process = null;
        this.isReady = false;
        
        if (this.status !== 'stopping') {
          this.status = 'crashed';
          this.emit('status-change', { status: 'crashed', code, signal });
          
          // Auto-restart on crash (with limits)
          if (this.retryCount < this.maxRetries) {
            this.retryCount++;
            this.logger.info(`Attempting to restart Python backend (${this.retryCount}/${this.maxRetries})`);
            setTimeout(() => this.start(), 2000);
          } else {
            this.status = 'failed';
            this.emit('status-change', { status: 'failed', message: 'Maximum retry attempts reached' });
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
