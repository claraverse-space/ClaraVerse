const { contextBridge, ipcRenderer } = require('electron');

// Define valid channels for security
const validSendChannels = [
  'message-from-renderer',
  'app-ready', 
  'request-app-info'
];

const validReceiveChannels = [
  'message-from-main', 
  'app-update-available',
  'app-error',
  'deep-link'
];

// Get app version safely
function getAppVersion() {
  try {
    // First try to get version from electron app
    const { app } = require('@electron/remote');
    if (app) {
      return app.getVersion();
    }
  } catch (e) {
    // If remote is not available, use env var
    if (process.env.npm_package_version) {
      return process.env.npm_package_version;
    }
  }
  return '1.0.0'; // Fallback version
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron', 
  {
    send: (channel, data) => {
      // Whitelist channels
      if (validSendChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    receive: (channel, func) => {
      if (validReceiveChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender` 
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    // Additional API methods
    getAppVersion: getAppVersion,
    getPlatform: () => process.platform,
    getAppPath: () => process.env.APPDATA || process.env.HOME,
    // Remove event listener for cleanup
    removeListener: (channel, func) => {
      if (validReceiveChannels.includes(channel)) {
        ipcRenderer.removeListener(channel, func);
      }
    }
  }
);

// Notify main process when preload script has loaded
window.addEventListener('DOMContentLoaded', () => {
  ipcRenderer.send('app-ready', 'Preload script has loaded');
});