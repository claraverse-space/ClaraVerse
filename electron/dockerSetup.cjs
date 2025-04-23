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

  async createDockerCompose() {
    // Get absolute path to py_backend directory
    const pyBackendPath = path.join(this.appRoot, 'py_backend');
    
    // Check if Ollama is already running
    const ollamaRunning = await this.isOllamaRunning();
    
    // Create services object
    const services = {
      n8n: {
        image: 'n8nio/n8n:latest',
        container_name: 'clara_n8n',
        ports: [`${this.ports.n8n}:5678`],
        volumes: ['n8n_data:/home/node/.n8n'],
        restart: 'unless-stopped',
        environment: {
          N8N_HOST: 'localhost',
          N8N_PORT: '5678',
          N8N_PROTOCOL: 'http',
          NODE_ENV: 'production'
        }
      },
      python_backend: {
        build: {
          context: pyBackendPath,
          dockerfile: 'Dockerfile'
        },
        container_name: 'clara_python',
        ports: [`${this.ports.python}:5000`],
        volumes: ['python_data:/app/data'],
        restart: 'unless-stopped',
        depends_on: ollamaRunning ? [] : ['ollama'],
        environment: {
          PORT: '5000',
          HOST: '0.0.0.0',
          PYTHONUNBUFFERED: '1'
        }
      }
    };

    // Only add Ollama service if it's not already running
    if (!ollamaRunning) {
      services.ollama = {
        image: 'ollama/ollama:latest',
        container_name: 'clara_ollama',
        ports: [`${this.ports.ollama}:11434`],
        volumes: ['ollama_data:/root/.ollama'],
        restart: 'unless-stopped'
      };
    }

    const composeContent = `
version: '3.8'
services:
${Object.entries(services).map(([name, config]) => `  ${name}:
${JSON.stringify(config, null, 4).split('\n').map(line => `    ${line}`).join('\n')}`).join('\n')}

volumes:
  n8n_data:
  python_data:${ollamaRunning ? '' : '\n  ollama_data:'}
`;
    fs.writeFileSync(this.composeFilePath, composeContent);

    // Return the ports being used
    return {
      python: this.ports.python,
      n8n: this.ports.n8n,
      ollama: ollamaRunning ? 11434 : this.ports.ollama
    };
  }

  async setup(statusCallback) {
    try {
      // Check if Docker is installed
      if (!await this.isDockerInstalled()) {
        statusCallback('Docker not found. Installing Docker Desktop...');
        await this.installDocker(statusCallback);
        return false;
      }

      // Check if Docker is running
      if (!await this.isDockerRunning()) {
        statusCallback('Docker is not running. Please start Docker Desktop and try again.');
        return false;
      }

      // Check if default ports are in use and find alternatives if needed
      statusCallback('Checking port availability...');
      if (await this.isPortInUse(this.ports.python)) {
        statusCallback('Default Python port 5000 is in use, finding alternative port...');
        this.ports.python = await this.findAvailablePort(5001);
        statusCallback(`Will use port ${this.ports.python} for Python backend`);
      }

      if (await this.isPortInUse(this.ports.n8n)) {
        statusCallback('Default n8n port 5678 is in use, finding alternative port...');
        this.ports.n8n = await this.findAvailablePort(5679);
        statusCallback(`Will use port ${this.ports.n8n} for n8n`);
      }

      // Check if Ollama is already running
      const ollamaRunning = await this.isOllamaRunning();
      if (ollamaRunning) {
        statusCallback('Found existing Ollama instance, will use it instead of creating a new container');
      } else if (await this.isPortInUse(this.ports.ollama)) {
        statusCallback('Default Ollama port 11434 is in use, finding alternative port...');
        this.ports.ollama = await this.findAvailablePort(11435);
        statusCallback(`Will use port ${this.ports.ollama} for Ollama`);
      }

      // Create Python backend Dockerfile if it doesn't exist
      const pyBackendPath = path.join(this.appRoot, 'py_backend');
      const dockerfilePath = path.join(pyBackendPath, 'Dockerfile');

      // Ensure py_backend directory exists
      if (!fs.existsSync(pyBackendPath)) {
        throw new Error('Python backend directory not found. Please ensure the py_backend directory exists.');
      }

      if (!fs.existsSync(dockerfilePath)) {
        const dockerfileContent = `FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    build-essential \\
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first to leverage Docker cache
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 5000

# Run the application with environment variables
CMD ["sh", "-c", "python main.py --port $PORT --host $HOST"]`;

        try {
          fs.writeFileSync(dockerfilePath, dockerfileContent);
        } catch (error) {
          throw new Error(`Failed to create Dockerfile: ${error.message}. Please ensure you have write permissions to ${pyBackendPath}`);
        }
      }

      // Create Docker Compose file
      statusCallback('Setting up Docker environment...');
      const ports = await this.createDockerCompose();

      // Pull and start containers
      statusCallback('Starting Clara services...');
      try {
        // First pull the images that need pulling
        if (!ollamaRunning) {
          await this.execAsync('docker pull ollama/ollama:latest');
        }
        await this.execAsync('docker pull n8nio/n8n:latest');
        
        // Then start the services
        await this.execAsync(`docker-compose -f "${this.composeFilePath}" up -d --build --remove-orphans`);
      } catch (error) {
        throw new Error(`Failed to start Docker containers: ${error.message}`);
      }

      statusCallback(`Docker setup completed successfully! Services running on ports: Python=${ports.python}, n8n=${ports.n8n}, Ollama=${ports.ollama}`);
      return true;
    } catch (error) {
      statusCallback(`Setup failed: ${error.message}`, 'error');
      throw error;
    }
  }

  async stop() {
    if (fs.existsSync(this.composeFilePath)) {
      try {
        await this.execAsync(`docker-compose -f "${this.composeFilePath}" down --remove-orphans`);
      } catch (error) {
        console.error('Error stopping Docker containers:', error);
      }
    }
  }
}

module.exports = DockerSetup; 