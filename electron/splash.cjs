const { BrowserWindow, app, screen, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const SetupConfigService = require('./setupConfigService.cjs');

class SplashScreen {
  constructor() {
    this.window = null;
    this.setupService = new SetupConfigService();
    this.isSetupMode = false;
    this.setupIpcHandlersRegistered = false;
    
    const isDev = process.env.NODE_ENV === 'development';
    
    // Check fullscreen startup preference
    let shouldStartFullscreen = false;
    try {
      const userDataPath = app.getPath('userData');
      const settingsPath = path.join(userDataPath, 'settings.json');
      
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        shouldStartFullscreen = settings.startup?.startFullscreen ?? settings.fullscreen_startup ?? false;
      }
    } catch (error) {
      console.error('Error reading fullscreen startup preference:', error);
    }
    
    this.window = new BrowserWindow({
      fullscreen: shouldStartFullscreen,
      frame: false,
      transparent: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      skipTaskbar: true,
      resizable: false,
      alwaysOnTop: true,
      show: false
    });

    // Show window when ready to prevent flash
    this.window.once('ready-to-show', () => {
      this.window.show();
      this.checkFirstTimeSetup();
    });

    // Handle window events
    this.window.on('closed', () => {
      this.window = null;
    });

    // Log any errors
    this.window.webContents.on('crashed', (e) => {
      console.error('Splash screen crashed:', e);
    });

    this.window.webContents.on('did-fail-load', (event, code, description) => {
      console.error('Failed to load splash:', code, description);
    });

    const htmlPath = isDev 
      ? path.join(__dirname, 'splash.html')
      : path.join(app.getAppPath(), 'electron', 'splash.html');

    console.log('Loading splash from:', htmlPath);
    this.window.loadFile(htmlPath);

    // Setup IPC handlers for first-time setup
    this.setupIpcHandlers();
  }

  async checkFirstTimeSetup() {
    try {
      const isFirstTime = await this.setupService.isFirstTimeSetup();
      
      if (isFirstTime) {
        this.isSetupMode = true;
        // Check Docker availability
        const dockerAvailable = await this.checkDockerAvailability();
        
        // Show setup UI
        this.window.webContents.send('show-setup', {
          dockerAvailable: dockerAvailable
        });
      }
    } catch (error) {
      console.error('Error checking first-time setup:', error);
      // Continue with normal startup if there's an error
    }
  }

  async checkDockerAvailability() {
    try {
      // Import DockerSetup dynamically to avoid circular dependencies
      const DockerSetup = require('./dockerSetup.cjs');
      const dockerSetup = new DockerSetup();
      return await dockerSetup.isDockerRunning();
    } catch (error) {
      console.error('Error checking Docker availability:', error);
      return false;
    }
  }

  setupIpcHandlers() {
    // Prevent duplicate handler registration
    if (this.setupIpcHandlersRegistered) return;
    this.setupIpcHandlersRegistered = true;

    // Handle setup skip
    ipcMain.on('setup-skip', async () => {
      try {
        await this.setupService.markSetupCompleted();
        this.isSetupMode = false;
        if (this.window && !this.window.isDestroyed()) {
          this.window.webContents.send('setup-complete');
        }
      } catch (error) {
        console.error('Error skipping setup:', error);
      }
    });

    // Handle setup continue
    ipcMain.on('setup-continue', async (event, selectedServices) => {
      try {
        // Update service configurations
        for (const [service, enabled] of Object.entries(selectedServices)) {
          if (enabled) {
            await this.setupService.updateServiceConfig(service, { enabled: true, autoStart: true });
            
            // Start downloading/setting up the service
            this.setupDockerService(service);
          }
        }

        // Mark setup as completed
        await this.setupService.markSetupCompleted();
        this.isSetupMode = false;
        
        // Notify completion after all services are processed
        setTimeout(() => {
          if (this.window && !this.window.isDestroyed()) {
            this.window.webContents.send('setup-complete');
          }
        }, 2000);
        
      } catch (error) {
        console.error('Error continuing setup:', error);
        if (this.window && !this.window.isDestroyed()) {
          this.window.webContents.send('setup-progress', {
            service: 'general',
            status: 'error',
            message: 'Setup failed'
          });
        }
      }
    });
  }

  async setupDockerService(service) {
    try {
      // Send progress update
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('setup-progress', {
          service: service,
          status: 'downloading',
          message: 'Preparing...'
        });
      }

      // Import DockerSetup dynamically
      const DockerSetup = require('./dockerSetup.cjs');
      const dockerSetup = new DockerSetup();

      // Setup progress callback
      const progressCallback = (progress) => {
        if (this.window && !this.window.isDestroyed()) {
          this.window.webContents.send('setup-progress', {
            service: service,
            status: 'downloading',
            message: `${progress.message || progress || 'Downloading...'}`
          });
        }
      };

      // Map service names to container configurations
      const serviceContainerMap = {
        'comfyui': 'comfyui',
        'n8n': 'n8n',
        'tts': 'python' // TTS is part of the python container
      };

      const containerKey = serviceContainerMap[service];
      if (!containerKey) {
        throw new Error(`Unknown service: ${service}`);
      }

      // Get the container configuration
      const containerConfig = dockerSetup.containers[containerKey];
      if (!containerConfig) {
        throw new Error(`Container configuration not found for: ${containerKey}`);
      }

      // Create network first
      progressCallback('Creating Docker network...');
      await dockerSetup.createNetwork();

      // Check if image exists, if not pull it
      try {
        await dockerSetup.docker.getImage(containerConfig.image).inspect();
        progressCallback(`Image ${containerConfig.image} ready`);
      } catch (error) {
        if (error.statusCode === 404) {
          progressCallback(`Downloading ${containerConfig.image}...`);
          await dockerSetup.pullImageWithProgress(containerConfig.image, progressCallback);
        } else {
          throw error;
        }
      }

      // Start the container
      progressCallback(`Starting ${service} service...`);
      await dockerSetup.startContainer(containerConfig);

      // Send completion status
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('setup-progress', {
          service: service,
          status: 'complete',
          message: 'Ready'
        });
      }

    } catch (error) {
      console.error(`Error setting up ${service}:`, error);
      if (this.window && !this.window.isDestroyed()) {
        this.window.webContents.send('setup-progress', {
          service: service,
          status: 'error',
          message: error.message || 'Setup failed'
        });
      }
    }
  }

  setStatus(message, type = 'info') {
    if (this.window && !this.window.isDestroyed()) {
      // Don't send status updates during setup mode
      if (!this.isSetupMode) {
        const data = {
          message: message,
          type: type,
          timestamp: new Date().toISOString()
        };
        
        console.log(`[Splash] Setting status:`, data);
        this.window.webContents.send('status', data);
      }
    }
  }

  setAlwaysOnTop(alwaysOnTop) {
    if (this.window && !this.window.isDestroyed()) {
      this.window.setAlwaysOnTop(alwaysOnTop);
    }
  }

  hide() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('hide');
      setTimeout(() => {
        if (this.window && !this.window.isDestroyed()) {
          this.window.hide();
        }
      }, 500);
    }
  }

  show() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.show();
      this.window.webContents.send('show');
    }
  }

  close() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.close();
      this.window = null;
    }
  }

  isVisible() {
    return this.window && !this.window.isDestroyed() && this.window.isVisible();
  }
}

module.exports = SplashScreen;