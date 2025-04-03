const { BrowserWindow, app } = require('electron');
const path = require('path');

class SplashScreen {
  constructor() {
    const isDev = process.env.NODE_ENV === 'development';
    
    this.window = new BrowserWindow({
      width: 500,  // Increased from 400
      height: 400, // Increased from 300
      frame: false,
      transparent: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      },
      skipTaskbar: true,
      resizable: false,
      center: true
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
  }

  setStatus(message, type = 'info') {
    if (!this.window) return;
    
    const data = {
      message: message,
      type: type,
      timestamp: new Date().toISOString()
    };
    
    console.log(`[Splash] Setting status:`, data);
    this.window.webContents.send('status', data);
  }

  close() {
    if (this.window) {
      this.window.close();
      this.window = null;
    }
  }
}

module.exports = SplashScreen;