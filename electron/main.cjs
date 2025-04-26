const { app, BrowserWindow, ipcMain, dialog, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const DockerSetup = require('./dockerSetup.cjs');
const { setupAutoUpdater } = require('./updateService.cjs');
const SplashScreen = require('./splash.cjs');

// Configure the main process logger
log.transports.file.level = 'info';
log.info('Application starting...');

// Global variables
let mainWindow;
let splash;
let dockerSetup;

async function initializeApp() {
  try {
    // Show splash screen
    splash = new SplashScreen();
    splash.setStatus('Starting Clara...', 'info');
    
    // Initialize Docker setup
    dockerSetup = new DockerSetup();
    
    // Setup Docker environment
    splash.setStatus('Setting up Docker environment...', 'info');
    const success = await dockerSetup.setup((status, type = 'info') => {
      splash.setStatus(status, type);
      
      if (type === 'error') {
        dialog.showErrorBox('Setup Error', status);
      }
    });

    if (!success) {
      splash.setStatus('Docker setup incomplete. Please start Docker Desktop and restart the application.', 'error');
      dialog.showMessageBox(null, {
        type: 'info',
        title: 'Docker Setup',
        message: 'Please start Docker Desktop and restart the application.',
        buttons: ['OK']
      });
      app.quit();
      return;
    }

    // Docker setup successful, create the main window immediately
    log.info('Docker setup successful. Creating main window...');
    splash.setStatus('Starting main application...', 'success');
    createMainWindow();

    // Close splash screen after a short delay (allowing main window to start loading)
    setTimeout(() => {
      splash?.close();
      splash = null; // Release reference
    }, 2000); // Adjust delay if needed
    
  } catch (error) {
    log.error(`Initialization error: ${error.message}`, error);
    splash?.setStatus(`Error: ${error.message}`, 'error');
    
    if (error.message.includes('Docker is not running')) {
      const downloadLink = error.message.split('\n')[1];
      let options;
      if (process.platform === 'linux') {
        options = {
          type: 'info',
          title: 'Docker Required',
          message: 'Docker Engine is required but not installed.',
          detail: 'Please install Docker Engine by following the instructions at the provided link, then restart Clara.',
          buttons: ['Open Docker Docs', 'Close'],
          defaultId: 0,
          cancelId: 1
        };
      } else {
        options = {
          type: 'info',
          title: 'Docker Required',
          message: 'Docker Desktop is required but not installed.',
          detail: 'Please download and install Docker Desktop, then restart Clara.',
          buttons: ['Download Docker Desktop', 'Close'],
          defaultId: 0,
          cancelId: 1
        };
      }
      dialog.showMessageBox(null, options).then(({ response }) => {
        if (response === 0) {
          require('electron').shell.openExternal(downloadLink);
        }
        splash?.close();
        app.quit();
      });
    } else {
      dialog.showErrorBox('Setup Error', error.message);
      // Keep splash open on error for a bit before quitting
      setTimeout(() => {
        splash?.close();
        app.quit();
      }, 4000);
    }
  }
}

function createMainWindow() {
  if (mainWindow) return;
  
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      sandbox: false
    },
    show: false,
    backgroundColor: '#f5f5f5'
  });

  // Set security policies for webview, using the dynamic n8n port
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const url = webContents.getURL();
    const n8nPort = dockerSetup?.ports?.n8n; // Get the determined n8n port
    
    // Allow if the n8n port is determined and the URL matches
    if (n8nPort && url.startsWith(`http://localhost:${n8nPort}`)) { 
      callback(true);
    } else {
      log.warn(`Blocked permission request for URL: ${url} (n8n port: ${n8nPort})`);
      callback(false);
    }
  });

  // Development mode with hot reload
  if (process.env.NODE_ENV === 'development') {
    if (process.env.ELECTRON_HOT_RELOAD === 'true') {
      // Hot reload mode
      const devServerUrl = process.env.ELECTRON_START_URL || 'http://localhost:5173';
      
      log.info('Loading development server with hot reload:', devServerUrl);
      mainWindow.loadURL(devServerUrl).catch(err => {
        log.error('Failed to load dev server:', err);
        // Fallback to local file if dev server fails
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
      });

      // Enable hot reload by watching the renderer process
      mainWindow.webContents.on('did-fail-load', () => {
        log.warn('Page failed to load, retrying...');
        setTimeout(() => {
          mainWindow?.webContents.reload();
        }, 1000);
      });
    } else {
      // Development mode without hot reload - use built files
      log.info('Loading development build from dist directory');
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Open DevTools in both development modes
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode - load built files
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Initialize auto-updater when window is ready
    if (process.env.NODE_ENV !== 'development') {
      setupAutoUpdater(mainWindow);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Initialize app when ready
app.whenReady().then(initializeApp);

// Quit when all windows are closed
app.on('window-all-closed', async () => {
  // Stop Docker containers
  if (dockerSetup) {
    await dockerSetup.stop();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// Handle IPC messages
ipcMain.handle('get-app-path', () => app.getPath('userData'));

// Handle microphone permission request
ipcMain.handle('request-microphone-permission', async () => {
  if (process.platform === 'darwin') {
    const status = await systemPreferences.getMediaAccessStatus('microphone');
    if (status === 'not-determined') {
      return await systemPreferences.askForMediaAccess('microphone');
    }
    return status === 'granted';
  }
  return true;
});

// IPC handler to get service ports
ipcMain.handle('get-service-ports', () => {
  if (dockerSetup && dockerSetup.ports) {
    return dockerSetup.ports;
  }
  return null; // Or throw an error if setup isn't complete
});

// IPC handler to get Python port specifically
ipcMain.handle('get-python-port', () => {
  if (dockerSetup && dockerSetup.ports && dockerSetup.ports.python) {
    return dockerSetup.ports.python;
  }
  return null;
});

// IPC handler to check Python backend status
ipcMain.handle('check-python-backend', async () => {
  try {
    if (!dockerSetup || !dockerSetup.ports || !dockerSetup.ports.python) {
      return { status: 'error', message: 'Python backend not configured' };
    }

    // Check if Python container is running
    const isRunning = await dockerSetup.isPythonRunning();
    if (!isRunning) {
      return { status: 'error', message: 'Python backend container not running' };
    }

    return {
      status: 'running',
      port: dockerSetup.ports.python
    };
  } catch (error) {
    log.error('Error checking Python backend:', error);
    return { status: 'error', message: error.message };
  }
});

// Handle backend status updates
ipcMain.on('backend-status', (event, status) => {
  if (mainWindow) {
    mainWindow.webContents.send('backend-status', status);
  }
});

// Handle Python status updates
ipcMain.on('python-status', (event, status) => {
  if (mainWindow) {
    mainWindow.webContents.send('python-status', status);
  }
});