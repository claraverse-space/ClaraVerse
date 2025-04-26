import { contextBridge, ipcRenderer, clipboard } from 'electron';
import * as os from 'os';
import { app } from '@electron/remote';
import * as path from 'path';

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
    getWorkflowsPath: () => {
      // Get the app's root directory
      const appPath = app.getAppPath();
      // Return the absolute path to the workflows file
      return path.join(appPath, 'workflows', 'n8n_workflows_full.json');
    },
    getServicePorts: () => ipcRenderer.invoke('get-service-ports'),
    checkN8NHealth: () => ipcRenderer.invoke('check-n8n-health'),
    startN8N: () => ipcRenderer.invoke('start-n8n'),
    stopN8N: () => ipcRenderer.invoke('stop-n8n'),
    getPythonPort: () => ipcRenderer.invoke('get-python-port'),
    checkPythonBackend: () => ipcRenderer.invoke('check-python-backend'),
    clipboard: {
      writeText: (text: string) => clipboard.writeText(text),
      readText: () => clipboard.readText()
    },
    ipcRenderer: {
      on: (channel: string, callback: (data: any) => void) => {
        ipcRenderer.on(channel, (_event, data) => callback(data));
        return () => ipcRenderer.removeListener(channel, callback);
      },
      removeListener: (channel: string, callback: (...args: any[]) => void) => {
        ipcRenderer.removeListener(channel, callback);
      },
      removeAllListeners: (channel: string) => {
        ipcRenderer.removeAllListeners(channel);
      }
    }
  }
);

contextBridge.exposeInMainWorld(
  'api', {
    onSetupStatus: (callback: (status: { status: string, type: string }) => void) => {
      ipcRenderer.on('setup-status', (_event, status) => callback(status));
    }
  }
); 