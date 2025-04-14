const { BrowserWindow, app, screen } = require('electron');
const path = require('path');

class SplashScreen {
  constructor() {
    const isDev = process.env.NODE_ENV === 'development';
    
    // Get primary display dimensions
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    
    // Calculate 80% of screen dimensions
    const windowWidth = Math.floor(width * 0.8);
    const windowHeight = Math.floor(height * 0.8);
    
    this.window = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
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