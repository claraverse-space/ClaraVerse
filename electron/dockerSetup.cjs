const { execSync, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { EventEmitter } = require('events');
const { app } = require('electron');
const https = require('https');
const http = require('http');

class DockerSetup extends EventEmitter {
  constructor() {
    super();
    this.isDevMode = process.env.NODE_ENV === 'development';
    this.appDataPath = this.isDevMode 
      ? path.join(os.homedir(), '.clara')
      : path.join(process.resourcesPath, 'clara-data');
    
    // Ensure app data directory exists
    if (!fs.existsSync(this.appDataPath)) {
      fs.mkdirSync(this.appDataPath, { recursive: true });
    }

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
      python: 5000,
      n8n: 5678,
      ollama: 11434
    };

    // Maximum retry attempts for service health checks
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds

    // Clara container names
    this.containerNames = ['clara_python', 'clara_n8n', 'clara_ollama'];
  }

  async execAsync(command, timeout = 60000) {
    return new Promise((resolve, reject) => {
      exec(command, { timeout }, (error, stdout, stderr) => {
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

  async isPythonRunning() {
    try {
      if (!this.ports.python) {
        return false;
      }

      const response = await new Promise((resolve, reject) => {
        http.get(`http://localhost:${this.ports.python}/`, (res) => {
          if (res.statusCode === 200) {
            resolve(true);
          } else {
            reject(new Error(`Python health check failed with status ${res.statusCode}`));
          }
        }).on('error', () => resolve(false));
      });
      return response;
    } catch (error) {
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

  async startN8N() {
    try {
      await this.execAsync('docker start clara_n8n');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async stopN8N() {
    try {
      await this.execAsync('docker stop clara_n8n');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async isDockerInstalled() {
    try {
      await this.execAsync('docker --version');
      return true;
    } catch (error) {
      return false;
    }
  }

  async isDockerRunning() {
    try {
      await this.execAsync('docker info');
      return true;
    } catch (error) {
      return false;
    }
  }

  async installDocker(statusCallback) {
    if (process.platform === 'darwin') {
      // Download Docker Desktop for Mac
      statusCallback('Downloading Docker Desktop for Mac...');
      const dockerDmgUrl = 'https://desktop.docker.com/mac/main/amd64/Docker.dmg';
      const dmgPath = path.join(this.appDataPath, 'Docker.dmg');
      
      await new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dmgPath);
        https.get(dockerDmgUrl, (response) => {
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        }).on('error', reject);
      });

      // Mount DMG and install Docker
      statusCallback('Installing Docker Desktop...');
      try {
        await this.execAsync(`hdiutil attach "${dmgPath}"`);
        await this.execAsync('cp -R "/Volumes/Docker/Docker.app" /Applications/');
        await this.execAsync('hdiutil detach "/Volumes/Docker"');
      } finally {
        // Cleanup
        if (fs.existsSync(dmgPath)) {
          fs.unlinkSync(dmgPath);
        }
      }

      statusCallback('Docker Desktop installed. Please start Docker Desktop and try again.');
      throw new Error('Please start Docker Desktop and restart the application.');
    } else {
      throw new Error('Automatic Docker installation is only supported on macOS. Please install Docker Desktop manually.');
    }
  }

  async generateDockerCompose() {
    // Get available ports
    const pythonPort = await this.findAvailablePort(5000);
    const n8nPort = await this.findAvailablePort(5678);
    const ollamaPort = await this.findAvailablePort(11434);

    // Store the ports
    this.ports = {
      python: pythonPort,
      n8n: n8nPort,
      ollama: ollamaPort
    };

    // Check if host Ollama is running
    const hostOllamaRunning = await this.isOllamaRunning();

    // Base compose configuration
    const composeConfig = {
      version: '3.8',
      services: {
        python: {
          build: {
            context: path.join(this.appRoot, 'py_backend'),
            dockerfile: 'Dockerfile'
          },
          volumes: [
            `${this.appDataPath}:/root/.clara`,
            `${path.join(this.appRoot, 'py_backend')}:/app`
          ],
          ports: [`${pythonPort}:5000`],
          environment: [
            'PYTHONUNBUFFERED=1',
            // If host Ollama is running, set OLLAMA_HOST to host.docker.internal
            ...(hostOllamaRunning ? ['OLLAMA_HOST=host.docker.internal'] : ['DOCKER_OLLAMA=true'])
          ],
          extra_hosts: [
            'host.docker.internal:host-gateway'
          ]
        },
      n8n: {
          image: 'n8nio/n8n',
          ports: [`${n8nPort}:5678`],
          volumes: [
            `${path.join(this.appDataPath, 'n8n')}:/home/node/.n8n`
          ],
          extra_hosts: [
            'host.docker.internal:host-gateway'
          ],
          environment: [
            'OLLAMA_HOST=host.docker.internal',
            'N8N_HOST=0.0.0.0',
            'N8N_PROTOCOL=http',
            'NODE_ENV=production',
            'N8N_EDITOR_BASE_URL=localhost',
            'N8N_METRICS=true',
            'N8N_PORT=5678'
          ]
        }
      },
      networks: {
        clara_network: {
          driver: 'bridge'
        }
      }
    };

    // Add network configuration to services
    Object.values(composeConfig.services).forEach(service => {
      service.networks = ['clara_network'];
    });

    // Add Ollama service only if host Ollama is not running
    if (!hostOllamaRunning) {
      composeConfig.services.ollama = {
        image: 'ollama/ollama',
        ports: [`${ollamaPort}:11434`],
        volumes: [
          `${path.join(this.appDataPath, 'ollama')}:/root/.ollama`
        ],
        networks: ['clara_network']
      };

      // Add Ollama network dependency to Python service
      composeConfig.services.python.depends_on = ['ollama'];
    }

    // Write the compose file
    fs.writeFileSync(
      this.composeFilePath,
      require('yaml').stringify(composeConfig)
    );

    return this.ports;
  }

  // Add automatic retry mechanism for commands
  async execWithRetry(command, retries = this.maxRetries) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this.execAsync(command);
      } catch (error) {
        if (attempt === retries) throw error;
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      }
    }
  }

  // Add automatic network check and repair
  async ensureNetwork() {
    try {
      // Check if network exists
      const networks = await this.execAsync('docker network ls --format "{{.Name}}"');
      if (!networks.includes('clara_network')) {
        await this.execAsync('docker network create clara_network');
      }

      // Ensure all containers are connected to the network
      const containers = ['clara_python', 'clara_n8n'];
      for (const container of containers) {
        try {
          await this.execAsync(`docker network connect clara_network ${container}`);
        } catch (error) {
          // Ignore "already connected" errors
          if (!error.message.includes('already exists')) {
            throw error;
          }
        }
      }
    } catch (error) {
      console.error('Network setup error:', error);
      // Try to recreate network
      await this.execAsync('docker network rm clara_network').catch(() => {});
      await this.execAsync('docker network create clara_network');
    }
  }

  // Add automatic service recovery
  async ensureServiceHealth(statusCallback) {
    const services = {
      n8n: this.checkN8NHealth.bind(this),
      python: this.isPythonRunning.bind(this),
      ollama: this.isOllamaRunning.bind(this)
    };

    for (const [service, healthCheck] of Object.entries(services)) {
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          const isHealthy = await healthCheck();
          if (!isHealthy) {
            statusCallback(`${service} is unhealthy, attempting recovery (attempt ${attempt}/${this.maxRetries})...`);
            await this.recoverService(service);
          }
          break;
        } catch (error) {
          if (attempt === this.maxRetries) {
            throw new Error(`Failed to ensure ${service} health after ${this.maxRetries} attempts`);
          }
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        }
      }
    }
  }

  // Add service recovery logic
  async recoverService(service) {
    const containerName = `clara_${service}`;
    try {
      // Check container status
      const status = await this.execAsync(`docker inspect -f {{.State.Status}} ${containerName}`);
      
      if (status !== 'running') {
        // Try to restart the container
        await this.execAsync(`docker restart ${containerName}`);
        // Wait for container to be ready
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Ensure network connectivity
      await this.ensureNetwork();
      
      // Additional service-specific recovery steps
      switch (service) {
        case 'n8n':
          // Ensure n8n configuration is correct
          await this.execAsync(`docker exec ${containerName} sh -c 'echo "N8N_HOST=0.0.0.0" >> /home/node/.n8n/.env'`);
          break;
        case 'python':
          // Ensure Python service has correct environment
          await this.execAsync(`docker exec ${containerName} sh -c 'python -c "import os; assert os.environ.get('PYTHONUNBUFFERED')"'`);
          break;
      }
    } catch (error) {
      console.error(`Recovery failed for ${service}:`, error);
      // If recovery fails, try to recreate the container
      await this.recreateContainer(service);
    }
  }

  // Add container recreation logic
  async recreateContainer(service) {
    const containerName = `clara_${service}`;
    try {
      // Stop and remove the container
      await this.execAsync(`docker stop ${containerName}`).catch(() => {});
      await this.execAsync(`docker rm ${containerName}`).catch(() => {});
      
      // Rebuild and restart the service
      await this.execAsync(`docker-compose -f "${this.composeFilePath}" up -d --no-deps --build ${service}`);
      
      // Wait for container to be ready
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Ensure network connectivity
      await this.ensureNetwork();
    } catch (error) {
      throw new Error(`Failed to recreate ${service}: ${error.message}`);
    }
  }

  // Add method to clean up existing containers
  async cleanupExistingContainers(statusCallback) {
    statusCallback('Cleaning up existing Clara containers...');
    
    try {
      // Get list of all containers (running and stopped)
      const allContainers = await this.execAsync('docker ps -a --format "{{.Names}}"');
      const containerList = allContainers.split('\n').filter(Boolean);

      // Stop and remove Clara containers if they exist
      for (const containerName of this.containerNames) {
        if (containerList.includes(containerName)) {
          statusCallback(`Stopping container: ${containerName}`);
          await this.execAsync(`docker stop ${containerName}`).catch(() => {});
          
          statusCallback(`Removing container: ${containerName}`);
          await this.execAsync(`docker rm ${containerName}`).catch(() => {});
        }
      }

      // Remove the network if it exists
      statusCallback('Cleaning up Clara network...');
      await this.execAsync('docker network rm clara_network').catch(() => {});

      // Remove any dangling containers and networks, but preserve volumes
      statusCallback('Cleaning up dangling resources...');
      await this.execAsync('docker container prune -f').catch(() => {});
      await this.execAsync('docker network prune -f').catch(() => {});

      statusCallback('Cleanup completed successfully');
    } catch (error) {
      console.error('Cleanup error:', error);
      statusCallback(`Cleanup encountered an error: ${error.message}`);
      // Continue with setup even if cleanup has issues
    }
  }

  // Update setup method to include cleanup
  async setup(statusCallback) {
    try {
      // Check Docker installation and running status
      if (!await this.isDockerInstalled()) {
        statusCallback('Docker not found. Installing Docker Desktop...');
        await this.installDocker(statusCallback);
        return false;
      }

      if (!await this.isDockerRunning()) {
        statusCallback('Docker is not running. Please start Docker Desktop and try again.');
        return false;
      }

      // Clean up existing containers before starting
      await this.cleanupExistingContainers(statusCallback);

      // Generate fresh Docker Compose configuration
      statusCallback('Generating Docker configuration...');
      const ports = await this.generateDockerCompose();

      // Start services with automatic recovery
      statusCallback('Starting Clara services...');
      try {
        // Pull images with retry
        if (!await this.isOllamaRunning()) {
          await this.execWithRetry('docker pull ollama/ollama:latest');
        }
        await this.execWithRetry('docker pull n8nio/n8n:latest');
        
        // Start services
        await this.execWithRetry(`docker-compose -f "${this.composeFilePath}" up -d --build --remove-orphans`);
        
        // Ensure network is properly set up
        await this.ensureNetwork();
        
        // Check and ensure service health
        await this.ensureServiceHealth(statusCallback);
        
      } catch (error) {
        throw new Error(`Failed to start services: ${error.message}`);
      }

      statusCallback(`Services started successfully on ports: Python=${ports.python}, n8n=${ports.n8n}, Ollama=${ports.ollama}`);
      return true;
    } catch (error) {
      statusCallback(`Setup failed: ${error.message}`, 'error');
      throw error;
    }
  }

  // Update stop method to be more thorough
  async stop() {
    if (fs.existsSync(this.composeFilePath)) {
      try {
        // Stop all services using docker-compose
        await this.execWithRetry(`docker-compose -f "${this.composeFilePath}" down --remove-orphans`);
        
        // Additional cleanup for any remaining containers
        for (const containerName of this.containerNames) {
          await this.execAsync(`docker stop ${containerName}`).catch(() => {});
          await this.execAsync(`docker rm ${containerName}`).catch(() => {});
        }
        
        // Clean up network
        await this.execAsync('docker network rm clara_network').catch(() => {});
        
        // Remove any dangling containers and networks, but preserve volumes
        await this.execAsync('docker container prune -f').catch(() => {});
        await this.execAsync('docker network prune -f').catch(() => {});
      } catch (error) {
        console.error('Error stopping services:', error);
        throw error;
      }
    }
  }
}

module.exports = DockerSetup; 