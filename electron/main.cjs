const { app, BrowserWindow, ipcMain, shell, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const PythonSetup = require('./pythonSetup.cjs');
const PythonBackendService = require('./pythonBackend.cjs');
const { setupAutoUpdater, checkForUpdates } = require('./updateService.cjs');
const SplashScreen = require('./splash.cjs');

// Configure the main process logger
log.transports.file.level = 'info';
log.info('Application starting...');

// Load environment variables from .env file if it exists
try {
  const dotenvPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(dotenvPath)) {
    require('dotenv').config({ path: dotenvPath });
  }
} catch (error) {
  console.error('Error loading .env file:', error);
}

// Global variables
let pythonBackend;
let mainWindow;
let splash;
const isDevelopment = process.env.NODE_ENV === 'development';

// Initialize Python setup
const pythonSetup = new PythonSetup();

async function initializeApp() {
  try {
    // Show splash screen
    splash = new SplashScreen();
    splash.setStatus('Starting Clara...', 'info');
    
    // Always setup Python environment on first run
    splash.setStatus('Setting up Python environment...', 'info');
    await pythonSetup.setup((status) => {
      splash.setStatus(status, 'info');
    });
    
    // Initialize Python backend service
    pythonBackend = new PythonBackendService(pythonSetup);
    
    // Set up event listeners for the backend service
    pythonBackend.on('status-change', (status) => {
      log.info(`Backend status changed: ${JSON.stringify(status)}`);
      
      if (status.status === 'running') {
        splash?.setStatus('Backend services started', 'success');
        if (!mainWindow) {
          createMainWindow();
        }
      } else if (status.status === 'failed' || status.status === 'crashed') {
        splash?.setStatus(`Backend error: ${status.message || status.status}`, 'error');
      }
      
      // Forward status to the renderer
      mainWindow?.webContents.send('backend-status', status);
    });
    
    pythonBackend.on('ready', (data) => {
      log.info(`Backend ready on port ${data.port}`);
      if (splash && !mainWindow) {
        splash.setStatus('Starting main application...', 'success');
        createMainWindow();
        setTimeout(() => {
          splash.close();
        }, 1000);
      }
    });
    
    pythonBackend.on('error', (error) => {
      log.error(`Backend error: ${error.message}`);
      splash?.setStatus(`Backend error: ${error.message}`, 'error');
    });
    
    pythonBackend.on('port-detected', (port) => {
      log.info(`Backend running on port: ${port}`);
    });
    
    // Start the Python backend
    splash.setStatus('Starting backend services...', 'info');
    await pythonBackend.start();
    
    // Set a timeout in case backend doesn't report ready
    setTimeout(() => {
      if (splash && !mainWindow) {
        splash.setStatus('Backend is taking longer than expected...', 'warning');
        createMainWindow();
        setTimeout(() => {
          splash.close();
        }, 2000);
      }
    }, 20000);
    
  } catch (error) {
    log.error(`Initialization error: ${error.message}`, error);
    splash?.setStatus(`Error: ${error.message}`, 'error');
    
    // Show error but continue to the main window anyway
    setTimeout(() => {
      if (!mainWindow) {
        createMainWindow();
      }
      setTimeout(() => {
        splash?.close();
      }, 3000);
    }, 5000);
  }
}

function createMainWindow() {
  if (mainWindow) return;

  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      nodeIntegration: false, // For security reasons
      contextIsolation: true, // Protect against prototype pollution
      preload: path.join(__dirname, 'preload.cjs'), // Use a preload script
      devTools: isDevelopment,
      spellcheck: true,
      // Security enhancements
      sandbox: true,
      webSecurity: true,
    },
    // Production enhancements
    show: false, // Don't show until ready-to-show
    backgroundColor: '#ffffff',
    autoHideMenuBar: !isDevelopment, // Hide menu bar in production
    icon: process.resourcesPath ? path.join(process.resourcesPath, 'assets/icons/png/256x256.png') : path.join(__dirname, '../assets/icons/png/256x256.png')
  });

  // Create application menu
  createApplicationMenu();

  // Set up auto-updater
  if (!isDevelopment) {
    setupAutoUpdater(mainWindow);
  }

  // Determine the URL to load
  if (app.isPackaged) {
    // In production, use path relative to the executable
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    log.info('Loading file:', path.join(__dirname, '../dist/index.html'));
  } else {
    // In development, use the development server URL
    const devUrl = process.env.ELECTRON_START_URL || 'http://localhost:5173';
    mainWindow.loadURL(devUrl);
    log.info('Loading URL:', devUrl);
  }
  
  log.info('Environment:', process.env.NODE_ENV);
  
  // Open DevTools in development mode
  if (isDevelopment) {
    mainWindow.webContents.openDevTools();
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Send complete backend status to renderer
    if (pythonBackend) {
      const status = pythonBackend.getStatus();
      log.info(`Sending initial backend status to renderer: ${JSON.stringify(status)}`);
      mainWindow.webContents.send('backend-status', status);
    }
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create window when Electron has finished initialization
app.whenReady().then(() => {
  // Set app user model id for windows
  if (process.platform === 'win32') {
    app.setAppUserModelId(app.name);
  }
  
  initializeApp();
});

// Define application menu
function createApplicationMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'delete' },
          { role: 'selectAll' },
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' }
        ])
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(isDevelopment ? [{ role: 'toggleDevTools' }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates',
          click: async () => {
            try {
              await checkForUpdates();
            } catch (error) {
              dialog.showErrorBox('Update Check Failed', 'Failed to check for updates. Please try again later.');
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Learn More',
          click: async () => {
            await shell.openExternal('https://github.com/badboysm890/clara-ollama');
          }
        },
        {
          label: 'Report Issue',
          click: async () => {
            await shell.openExternal('https://github.com/badboysm890/clara-ollama/issues');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS, recreate the window when the dock icon is clicked and no other windows are open
  if (mainWindow === null) {
    createMainWindow();
  }
});

// Handle any IPC messages from the renderer process here
ipcMain.on('message-from-renderer', (event, arg) => {
  log.info('Message from renderer:', arg);
  // You can send a response back
  event.reply('message-from-main', 'Hello from the main process!');
});

// IPC handlers for Python backend
ipcMain.handle('get-python-port', () => {
  const port = pythonBackend ? pythonBackend.getPort() : null;
  log.info(`Renderer requested Python port: ${port}`);
  return port;
});

// Add a new handler for health check
ipcMain.handle('check-python-backend', async () => {
  if (!pythonBackend) {
    return { status: 'not_initialized' };
  }
  
  try {
    const status = pythonBackend.getStatus();
    
    // Test connection directly using Node's http instead of fetch
    if (status.port) {
      try {
        const http = require('http');
        const result = await new Promise((resolve, reject) => {
          const req = http.get(`http://localhost:${status.port}/`, {
            timeout: 2000,
            headers: { 'Accept': 'application/json' }
          }, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
              data += chunk;
            });
            
            res.on('end', () => {
              try {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                  resolve({ success: true, data: JSON.parse(data) });
                } else {
                  reject(new Error(`HTTP status ${res.statusCode}`));
                }
              } catch (e) {
                reject(e);
              }
            });
          });
          
          req.on('error', reject);
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request timeout'));
          });
        });
        
        if (result && result.success) {
          return { 
            status: 'running', 
            port: status.port,
            available: true,
            serverInfo: result.data
          };
        }
      } catch (error) {
        log.warn(`Backend connection test failed: ${error.message}`);
      }
    }
    
    return {
      ...status,
      available: false
    };
  } catch (error) {
    log.error(`Error checking Python backend: ${error.message}`);
    return { status: 'error', error: error.message };
  }
});

// Handle protocol associations (deep linking)
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (mainWindow) {
    mainWindow.webContents.send('deep-link', url);
  }
});

// App lifecycle events
app.whenReady().then(() => {
  initializeApp();
});

// App lifecycle events
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
  dialog.showMessageBox({
    type: 'error',
    title: 'Application Error',
    message: 'An error occurred',
    detail: error.toString(),
  });
});

// Clean up before quitting
app.on('before-quit', async (event) => {
  if (pythonBackend) {
    event.preventDefault();
    try {
      await pythonBackend.stop();
    } catch (error) {
      log.error(`Error stopping Python backend: ${error.message}`);
    }
    app.exit(0);
  }
});
