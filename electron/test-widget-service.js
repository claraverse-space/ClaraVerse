/**
 * Widget Service Integration Test
 * 
 * Test script to verify the widget service IPC integration
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Import the widget service
const WidgetService = require('./widgetService.cjs');

let mainWindow;
let widgetService;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Initialize widget service
  widgetService = new WidgetService();
  
  // Test the widget service
  await testWidgetService();
  
  mainWindow.loadFile('test.html');
}

async function testWidgetService() {
  console.log('Testing Widget Service Integration...');
  
  try {
    // Test initialization
    console.log('1. Testing initialization...');
    
    // Test registering a widget
    console.log('2. Testing widget registration...');
    widgetService.registerWidget('gpu-monitor');
    let status = await widgetService.getStatus();
    console.log('Status after registration:', status);
    
    // Test starting service
    console.log('3. Testing service start...');
    const startResult = await widgetService.startService();
    console.log('Start result:', startResult);
    
    // Wait a bit and check if running
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const isRunning = await widgetService.isServiceRunning();
    console.log('Service running:', isRunning);
    
    // Test unregistering widget
    console.log('4. Testing widget unregistration...');
    widgetService.unregisterWidget('gpu-monitor');
    status = await widgetService.getStatus();
    console.log('Status after unregistration:', status);
    
    // Test stopping service
    console.log('5. Testing service stop...');
    const stopResult = await widgetService.stopService();
    console.log('Stop result:', stopResult);
    
    console.log('Widget Service test completed successfully!');
    
  } catch (error) {
    console.error('Widget Service test failed:', error);
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', async () => {
  if (widgetService) {
    await widgetService.cleanup();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
