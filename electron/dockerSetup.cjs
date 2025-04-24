const { EventEmitter } = require('events');
const Docker = require('dockerode');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { app } = require('electron');
const tar = require('tar-fs');
const http = require('http');

class DockerSetup extends EventEmitter {
  constructor() {
    super();
    this.isDevMode = process.env.NODE_ENV === 'development';
    this.appDataPath = path.join(os.homedir(), '.clara');
    
    // Docker binary paths - using Docker CLI path for both docker and compose commands
    this.dockerPath = '/usr/local/bin/docker';
    
    // Initialize Docker client
    this.docker = new Docker({
      socketPath: process.platform === 'win32' 
        ? '//./pipe/docker_engine'
        : '/var/run/docker.sock'
    });

    // Path for storing pull timestamps
    this.pullTimestampsPath = path.join(this.appDataPath, 'pull_timestamps.json');

    // Container configuration
    this.containers = {
      python: {
        name: 'clara_python',
        image: 'clara17verse/clara-backend:latest',
        port: 5001,
        internalPort: 5000,
        healthCheck: this.isPythonRunning.bind(this),
        volumes: [
          `${this.appDataPath}:/root/.clara`
        ]
      },
      n8n: {
        name: 'clara_n8n',
        image: 'n8nio/n8n',
        port: 5678,
        internalPort: 5678,
        healthCheck: this.checkN8NHealth.bind(this),
        volumes: [
          `${path.join(this.appDataPath, 'n8n')}:/home/node/.n8n`
        ]
      },
      ollama: {
        name: 'clara_ollama',
        image: 'ollama/ollama',
        port: 11434,
        internalPort: 11434,
        healthCheck: this.isOllamaRunning.bind(this),
        volumes: [
          `${path.join(this.appDataPath, 'ollama')}:/root/.ollama`
        ]
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
      ollama: 11434
    };

    // Maximum retry attempts for service health checks
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds

    // Clara container names
    this.containerNames = ['clara_python', 'clara_n8n', 'clara_ollama'];

    // Create subdirectories for each service
    Object.keys(this.containers).forEach(service => {
      const servicePath = path.join(this.appDataPath, service);
      if (!fs.existsSync(servicePath)) {
        fs.mkdirSync(servicePath, { recursive: true });
      }
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

  async isDockerRunning() {
    try {
      await this.docker.ping();
      return true;
    } catch (error) {
      return false;
    }
  }

  async createNetwork() {
    try {
      const networks = await this.docker.listNetworks();
      const exists = networks.some(n => n.Name === 'clara_network');
      
      if (!exists) {
        await this.docker.createNetwork({
          Name: 'clara_network',
          Driver: 'bridge'
        });
      }
    } catch (error) {
      console.error('Network creation error:', error);
      throw error;
    }
  }

  async pullImage(imageName, statusCallback) {
    return new Promise((resolve, reject) => {
      this.docker.pull(imageName, (err, stream) => {
        if (err) {
          reject(err);
          return;
        }

        stream.on('data', (data) => {
          const lines = data.toString().split('\n').filter(Boolean);
          lines.forEach(line => {
            try {
              const parsed = JSON.parse(line);
              if (parsed.status) {
                statusCallback(`Pulling ${imageName}: ${parsed.status}`);
              }
            } catch (e) {
              // Ignore parse errors
            }
          });
        });

        stream.on('end', resolve);
        stream.on('error', reject);
      });
    });
  }

  async startContainer(config) {
    try {
      // Check if container exists
      let existingContainer;
      try {
        existingContainer = await this.docker.getContainer(config.name);
        await existingContainer.remove({ force: true });
      } catch (error) {
        console.log(`No existing container ${config.name} to remove`);
      }

      console.log(`Creating container ${config.name} with port mapping ${config.internalPort} -> ${config.port}`);
      
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
          NetworkMode: 'clara_network'
        },
        Env: [
          'PYTHONUNBUFFERED=1',
          'OLLAMA_BASE_URL=http://clara_ollama:11434'
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
        throw new Error(`Container ${config.name} failed health check after 5 attempts`);
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

  shouldPullImage(imageName) {
    try {
      const timestamps = this.getPullTimestamps();
      const lastPull = timestamps[imageName] || 0;
      const daysSinceLastPull = (Date.now() - lastPull) / (1000 * 60 * 60 * 24);
      return daysSinceLastPull >= 10;
    } catch (error) {
      console.error('Error checking pull timestamp:', error);
      return true; // Pull if there's an error reading timestamps
    }
  }

  async setup(statusCallback) {
    try {
      if (!await this.isDockerRunning()) {
        throw new Error('Docker is not running. Please start Docker Desktop and try again.');
      }

      statusCallback('Creating Docker network...');
      await this.createNetwork();

      // Check and pull images if needed
      for (const [name, config] of Object.entries(this.containers)) {
        if (this.shouldPullImage(config.image)) {
          statusCallback(`Pulling ${name} image...`);
          await this.pullImage(config.image, statusCallback);
          this.updatePullTimestamp(config.image);
        } else {
          statusCallback(`Using cached ${name} image...`);
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
      throw error;
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

  async isOllamaRunning() {
    try {
      const response = await new Promise((resolve, reject) => {
        http.get('http://localhost:11434/api/tags', (res) => {
          if (res.statusCode === 200) {
            resolve(true);
          } else {
            reject(new Error(`HTTP status ${res.statusCode}`));
          }
        }).on('error', () => resolve(false));
      });
      return response;
    } catch (error) {
      return false;
    }
  }
}

module.exports = DockerSetup; 