const { app, BrowserWindow, ipcMain, Menu, dialog, shell } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const { setupAutoUpdater, checkForUpdates } = require('./updateService.cjs');

// Load environment variables from .env file if it exists
try {
  const dotenvPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(dotenvPath)) {
    require('dotenv').config({ path: dotenvPath });
  }
} catch (error) {
  console.error('Error loading .env file:', error);
}

// Keep a global reference of the window object to prevent garbage collection
let mainWindow;
const isDevelopment = process.env.NODE_ENV === 'development';

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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
    console.log('Loading file:', path.join(__dirname, '../dist/index.html'));
  } else {
    // In development, use the development server URL
    const devUrl = process.env.ELECTRON_START_URL || 'http://localhost:5173';
    mainWindow.loadURL(devUrl);
    console.log('Loading URL:', devUrl);
  }
  
  console.log('Environment:', process.env.NODE_ENV);
  
  // Open DevTools in development mode
  if (isDevelopment) {
    mainWindow.webContents.openDevTools();
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
    const options = {
      type: 'error',
      title: 'Application Error',
      message: 'An error occurred',
      detail: error.toString(),
    };
    dialog.showMessageBox(options);
  });

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    // Dereference the window object
    mainWindow = null;
  });
}

// Create window when Electron has finished initialization
app.whenReady().then(() => {
  // Handle macOS security checks
  if (process.platform === 'darwin') {
    // Ensure we're not running from a quarantined location
    app.setAsDefaultProtocolClient('clara');
    
    // For development only - bypass Gatekeeper
    if (isDevelopment) {
      app.commandLine.appendSwitch('no-sandbox');
    }
  }

  createWindow();
  
  // Set app user model id for windows
  if (process.platform === 'win32') {
    app.setAppUserModelId(app.name);
  }
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
    createWindow();
  }
});

// Handle any IPC messages from the renderer process here
ipcMain.on('message-from-renderer', (event, arg) => {
  console.log('Message from renderer:', arg);
  // You can send a response back
  event.reply('message-from-main', 'Hello from the main process!');
});

// Handle protocol associations (deep linking)
app.on('open-url', (event, url) => {
  event.preventDefault();
  if (mainWindow) {
    mainWindow.webContents.send('deep-link', url);
  }
});

// Limit resource usage
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=512');