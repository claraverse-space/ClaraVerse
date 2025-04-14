const { app, BrowserWindow, ipcMain, dialog, systemPreferences } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');
const PythonSetup = require('./pythonSetup.cjs');
const PythonBackendService = require('./pythonBackend.cjs');
const NodeSetup = require('./nodeSetup.cjs');
const { setupAutoUpdater } = require('./updateService.cjs');
const SplashScreen = require('./splash.cjs');

// Configure the main process logger
log.transports.file.level = 'info';
log.info('Application starting...');

// Global variables
let pythonBackend;
let mainWindow;
let splash;
let nodeSetup;

// N8N Process Management
let n8nProcess = null;
const N8N_PORT = 5678;

// Initialize setup instances
const pythonSetup = new PythonSetup();
nodeSetup = new NodeSetup();

// Get the path to N8N binary
const getN8NPath = () => {
  if (process.platform === 'darwin') {
    return nodeSetup.getN8nPath();
  } else {
    // Fallback to bundled N8N for other platforms
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      return path.join(__dirname, '..', 'node_modules', 'n8n', 'bin', 'n8n');
    } else {
      return path.join(process.resourcesPath, 'node_modules', 'n8n', 'bin', 'n8n');
    }
  }
};

async function initializeApp() {
  try {
    // Show splash screen
    splash = new SplashScreen();
    splash.setStatus('Starting Clara...', 'info');
    
    // Setup Python environment
    splash.setStatus('Setting up Python environment...', 'info');
    await pythonSetup.setup((status) => {
      splash.setStatus(status, 'info');
    });

    // Setup Node.js and N8N (Mac only)
    if (process.platform === 'darwin') {
      splash.setStatus('Setting up Node.js and N8N...', 'info');
      await nodeSetup.setup((status) => {
        splash.setStatus(status, 'info');
      });
    }
    
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
      nodeIntegration: false,
      webviewTag: true,
      sandbox: false
    },
    show: false,
    backgroundColor: '#f5f5f5'
  });
  
  // Set security policies for webview
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const url = webContents.getURL();
    if (url.startsWith('http://localhost:5678')) {
      callback(true);
    } else {
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
if (process.env.NODE_ENV === 'development' && process.env.ELECTRON_HOT_RELOAD === 'true') {
  const { watch } = require('fs');
  
  // Watch for changes in the renderer process
  watch(path.join(__dirname, '../dist'), (event, filename) => {
    if (mainWindow && mainWindow.webContents) {
      log.info('Detected renderer change:', filename);
      mainWindow.webContents.reload();
    }
  });
}

// IPC handlers
ipcMain.handle('get-python-port', () => {
  const port = pythonBackend ? pythonBackend.getPort() : null;
  log.info(`Renderer requested Python port: ${port}`);
  return port;
});

// Helper function to find process by port
async function findProcessByPort(port) {
  try {
    const { execSync } = require('child_process');
    if (process.platform === 'win32') {
      const result = execSync(`netstat -ano | findstr :${port}`).toString();
      const match = result.match(/\s+(\d+)\s*$/);
      return match ? { pid: match[1] } : null;
    } else {
      const result = execSync(`lsof -i :${port} -t`).toString().trim();
      return result ? { pid: result } : null;
    }
  } catch (error) {
    return null;
  }
}

// Helper function to kill N8N process
async function killN8NProcess() {
  try {
    const { execSync } = require('child_process');
    const processInfo = await findProcessByPort(N8N_PORT);
    if (processInfo) {
      try {
        execSync(`kill ${processInfo.pid}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        const stillRunning = await findProcessByPort(N8N_PORT);
        if (stillRunning) {
          execSync(`kill -9 ${processInfo.pid}`);
        }
      } catch (error) {
        if (!error.message.includes('No such process')) {
          throw error;
        }
      }
      return true;
    }
    return false;
  } catch (error) {
    log.warn(`Error killing N8N process: ${error.message}`);
    return false;
  }
}

// Check N8N health
ipcMain.handle('check-n8n-health', async () => {
  try {
    const http = require('http');
    const result = await new Promise((resolve, reject) => {
      const req = http.get(`http://localhost:${N8N_PORT}/healthz`, {
        timeout: 2000,
        headers: { 'Accept': 'application/json' }
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({ success: true, data });
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
    return { success: true, data: result.data };
  } catch (error) {
    log.warn(`N8N health check failed: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// Start N8N process
ipcMain.handle('start-n8n', async () => {
  try {
    // Check if port is already in use
    const existingProcess = await findProcessByPort(N8N_PORT);
    if (existingProcess) {
      return { 
        success: false, 
        error: `Port ${N8N_PORT} is already in use. Please stop any existing N8N process first.` 
      };
    }

    // Get the path to N8N
    const n8nPath = getN8NPath();
    
    // For Mac, we need to use the NVM-installed Node
    let nodePath = 'node';
    if (process.platform === 'darwin') {
      nodePath = nodeSetup.getNodePath();
    }
    
    // Verify the N8N binary exists
    if (!fs.existsSync(n8nPath)) {
      return { 
        success: false, 
        error: `N8N binary not found at ${n8nPath}. Please ensure N8N is properly installed.` 
      };
    }

    // Start N8N in a separate process
    n8nProcess = require('child_process').spawn(nodePath, [n8nPath, 'start'], {
      env: {
        ...process.env,
        NODE_PATH: process.platform === 'darwin' 
          ? path.dirname(nodePath)
          : path.join(__dirname, '..', 'node_modules'),
        N8N_PORT: N8N_PORT.toString()
      },
      detached: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Handle process output
    n8nProcess.stdout.on('data', (data) => {
      log.info(`N8N stdout: ${data}`);
      if (mainWindow) {
        mainWindow.webContents.send('n8n-output', { type: 'stdout', data: data.toString() });
      }
    });

    n8nProcess.stderr.on('data', (data) => {
      log.error(`N8N stderr: ${data}`);
      if (mainWindow) {
        mainWindow.webContents.send('n8n-output', { type: 'stderr', data: data.toString() });
      }
    });

    n8nProcess.on('error', (error) => {
      log.error(`N8N process error: ${error.message}`);
      if (mainWindow) {
        mainWindow.webContents.send('n8n-error', error.message);
      }
    });

    // Wait for process to start and verify it's running
    return new Promise((resolve) => {
      setTimeout(async () => {
        const processInfo = await findProcessByPort(N8N_PORT);
        if (processInfo) {
          resolve({ success: true, pid: parseInt(processInfo.pid) });
        } else {
          resolve({ success: false, error: 'Failed to start N8N process' });
        }
      }, 2000);
    });
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Stop N8N process
ipcMain.handle('stop-n8n', async () => {
  try {
    const processInfo = await findProcessByPort(N8N_PORT);
    if (!processInfo) {
      n8nProcess = null;
      return { success: true, message: `No process found running on port ${N8N_PORT}` };
    }

    const killed = await killN8NProcess();
    if (killed) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const isStillRunning = await findProcessByPort(N8N_PORT);
      
      if (isStillRunning) {
        return { 
          success: false, 
          error: 'Failed to stop process. You may need to restart your system.' 
        };
      }
      
      n8nProcess = null;
      return { success: true, message: `Successfully stopped process (PID: ${processInfo.pid})` };
    } else {
      return { success: false, error: 'Failed to stop process' };
    }
  } catch (error) {
    return { success: false, error: error.message };
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