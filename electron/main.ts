import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import * as path from 'path';
import { initialize, enable } from '@electron/remote/main';
const DockerSetup = require('./dockerSetup.cjs');

// Initialize remote module
initialize();

let dockerSetup: any = null;

async function initializeDockerServices(win: BrowserWindow) {
  dockerSetup = new DockerSetup();
  
  try {
    const success = await dockerSetup.setup((status: string, type: string = 'info') => {
      // Send status updates to renderer
      win.webContents.send('setup-status', { status, type });
      
      if (type === 'error') {
        dialog.showErrorBox('Setup Error', status);
      }
    });

    if (!success) {
      dialog.showMessageBox(win, {
        type: 'info',
        title: 'Docker Setup',
        message: 'Please start Docker Desktop and restart the application.',
        buttons: ['OK']
      });
      app.quit();
    }
  } catch (error) {
    dialog.showErrorBox('Setup Error', error.message);
    app.quit();
  }
}

// IPC Handlers
ipcMain.handle('get-service-ports', async () => {
  return dockerSetup ? dockerSetup.ports : null;
});

ipcMain.handle('check-n8n-health', async () => {
  try {
    return await dockerSetup.checkN8NHealth();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('start-n8n', async () => {
  try {
    return await dockerSetup.startN8N();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-n8n', async () => {
  try {
    return await dockerSetup.stopN8N();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-python-port', async () => {
  try {
    return dockerSetup ? dockerSetup.ports.python : null;
  } catch (error) {
    return null;
  }
});

ipcMain.handle('check-python-backend', async () => {
  try {
    const port = dockerSetup ? dockerSetup.ports.python : null;
    return { port };
  } catch (error) {
    return { port: null };
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Enable remote module for this window
  enable(win.webContents);

  // Initialize Docker services
  initializeDockerServices(win);

  // Load your app
  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    win.loadURL('http://localhost:5173'); // Vite dev server default port
  }

  // Open DevTools in development
  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  // Stop Docker containers when app closes
  if (dockerSetup) {
    await dockerSetup.stop();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
}); 