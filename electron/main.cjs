const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');

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

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false, // For security reasons
      contextIsolation: true, // Protect against prototype pollution
      preload: path.join(__dirname, 'preload.cjs') // Use a preload script
    }
  });

  // Determine the URL to load
  const startUrl = process.env.ELECTRON_START_URL || url.format({
    pathname: path.join(__dirname, '../dist/index.html'),
    protocol: 'file:',
    slashes: true
  });
  
  console.log('Loading URL:', startUrl);
  console.log('Environment:', process.env.NODE_ENV);
  
  // Load the app
  mainWindow.loadURL(startUrl);

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // Emitted when the window is closed
  mainWindow.on('closed', () => {
    // Dereference the window object
    mainWindow = null;
  });
}

// Create window when Electron has finished initialization
app.whenReady().then(createWindow);

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