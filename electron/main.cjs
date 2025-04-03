const { app, BrowserWindow, ipcMain, dialog, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const PythonSetup = require('./pythonSetup.cjs');
const PythonBackendService = require('./pythonBackend.cjs');
const { setupAutoUpdater } = require('./updateService.cjs');
const SplashScreen = require('./splash.cjs');

// Configure the main process logger
log.transports.file.level = 'info';
log.info('Application starting...');

// Global variables
let pythonBackend;
let mainWindow;
let splash;

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
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false,
    backgroundColor: '#f5f5f5'
  });
  
  // Development mode with hot reload
  if (process.env.NODE_ENV === 'development') {
    const devServerUrl = process.env.ELECTRON_START_URL || 'http://localhost:5173';
    
    log.info('Loading development server:', devServerUrl);
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

    // Open DevTools automatically in development
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
    
    // Send complete backend status to renderer
    if (pythonBackend) {
      const status = pythonBackend.getStatus();
      log.info(`Sending initial backend status to renderer: ${JSON.stringify(status)}`);
      mainWindow.webContents.send('backend-status', status);
    }
  });
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Log window events
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    log.error(`Window failed to load: ${errorCode} - ${errorDescription}`);
  });
  
  mainWindow.webContents.on('crashed', () => {
    log.error('Window crashed');
  });
}

// Add development mode watcher
if (process.env.NODE_ENV === 'development') {
  const { watch } = require('fs');
  
  // Watch for changes in the renderer process
  watch(path.join(__dirname, '../dist'), (event, filename) => {
    if (mainWindow && mainWindow.webContents) {
      log.info('Detected renderer change:', filename);
      mainWindow.webContents.reload();
    }
  });

  // Watch for changes in the main process
  watch(__dirname, (event, filename) => {
    if (filename && !filename.includes('node_modules')) {
      log.info('Detected main process change:', filename);
      app.relaunch();
      app.quit();
    }
  });
}

// IPC handlers
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

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

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

// Error handling for the main process
process.on('uncaughtException', (error) => {
  log.error(`Uncaught exception: ${error.message}`, error);
});

process.on('unhandledRejection', (reason) => {
  log.error(`Unhandled promise rejection: ${reason}`);
});