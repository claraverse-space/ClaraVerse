import { contextBridge } from 'electron';
import * as os from 'os';
import { app } from '@electron/remote';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'electron',
  {
    getAppVersion: () => app.getVersion(),
    getElectronVersion: () => process.versions.electron,
    getPlatform: () => process.platform,
    getOsVersion: () => {
      const platform = process.platform;
      if (platform === 'darwin') {
        return `${os.type()} ${os.release()}`;
      } else if (platform === 'win32') {
        return `${os.type()} ${os.release()}`;
      } else {
        return `${os.type()} ${os.release()}`;
      }
    },
  }
); 