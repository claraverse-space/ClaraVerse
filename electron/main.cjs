const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const PythonSetup = require('./pythonSetup.cjs');
const { setupAutoUpdater } = require('./updateService.cjs');

let pythonProcess;
let mainWindow;
const pythonSetup = new PythonSetup();

async function startPythonBackend() {
  const isDev = process.env.NODE_ENV === 'development';
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';
  
  // Ensure venv is ready
  await pythonSetup.createVirtualEnv();

  const backendPath = isDev 
    ? path.join(__dirname, '..', 'py_backend')
    : isWin
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'py_backend')
      : isMac 
        ? path.join(process.resourcesPath, 'py_backend')
        : path.join(process.resourcesPath, 'app.asar.unpacked', 'py_backend');

  console.log('Starting Python backend from:', backendPath);
  console.log('Using Python command:', pythonSetup.pythonCommand);

  // Get virtual environment site-packages
  const sitePackages = process.platform === 'win32'
    ? path.join(pythonSetup.venvPath, 'Lib', 'site-packages')
    : path.join(pythonSetup.venvPath, 'lib', `python${process.versions.python}`, 'site-packages');

  const env = {
    ...process.env,
    PYTHONPATH: [backendPath, sitePackages].join(path.delimiter),
    VIRTUAL_ENV: pythonSetup.venvPath,
    PATH: [path.dirname(pythonSetup.venvPython), process.env.PATH].join(path.delimiter),
    PYTHONUNBUFFERED: '1'
  };

  return new Promise((resolve, reject) => {
    const pythonCmd = isDev 
      ? pythonSetup.pythonCommand 
      : `"${pythonSetup.pythonCommand}"`;
    const scriptPath = path.join(backendPath, 'main.py');
    
    console.log('Executing:', isDev 
      ? `${pythonCmd} ${scriptPath}`
      : `${pythonCmd} "${scriptPath}"`
    );
    
    pythonProcess = spawn(pythonCmd, [scriptPath], {
      cwd: backendPath,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONUNBUFFERED: '1',
        NODE_ENV: process.env.NODE_ENV
      }
    });

    let startupOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
      startupOutput += data.toString();
      console.log('Python stdout:', data.toString());
      
      // Check if FastAPI server has started - match the actual log format
      if (data.toString().includes('Application startup complete')) {
        // Give a small delay to ensure the server is ready
        setTimeout(() => resolve(), 100);
      }
    });

    pythonProcess.stderr.on('data', (data) => {
      startupOutput += data.toString();
      console.error('Python stderr:', data.toString());
    });

    pythonProcess.on('error', (err) => {
      console.error('Failed to start Python backend:', err);
      reject(err);
    });

    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}\n${startupOutput}`));
      }
    });

    // Timeout if server doesn't start in 10 seconds
    setTimeout(() => {
      if (pythonProcess) {
        reject(new Error('Python server failed to start in time\n' + startupOutput));
      }
    }, 10000);
  });
}

async function initialize() {
  try {
    mainWindow?.webContents.send('initialization-status', { status: 'checking-python' });
    
    // Always ensure Python is available first
    await pythonSetup.ensureSystemPython();
    
    if (!pythonSetup.isInitialized()) {
      mainWindow?.webContents.send('initialization-status', { status: 'installing-dependencies' });
      await pythonSetup.installDependencies();
    }
    
    mainWindow?.webContents.send('initialization-status', { status: 'starting-backend' });
    await startPythonBackend();
    mainWindow?.webContents.send('initialization-status', { status: 'ready' });
  } catch (error) {
    console.error('Initialization error:', error);
    mainWindow?.webContents.send('initialization-status', { 
      status: 'error',
      error: error.message 
    });
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow.loadURL(process.env.ELECTRON_START_URL || 'http://localhost:5173');
  
  setupAutoUpdater(mainWindow);
  initialize();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  if (pythonProcess) {
    pythonProcess.kill();
  }
});
