/// <reference types="vite/client" />

interface Window {
  electron: {
    getAppPath: () => Promise<string>;
    getAppVersion: () => string;
    getElectronVersion: () => string;
    getPlatform: () => string;
    isDev: boolean;
    requestMicrophonePermission: () => Promise<boolean>;
    getServicePorts: () => Promise<any>;
    getPythonPort: () => Promise<number>;
    checkPythonBackend: () => Promise<any>;
    checkDockerServices: () => Promise<any>;
    getPythonBackendInfo: () => Promise<any>;
    startDockerService: (serviceName: string) => Promise<any>;
    stopDockerService: (serviceName: string) => Promise<any>;
    restartDockerService: (serviceName: string) => Promise<any>;
    checkDockerUpdates: () => Promise<any>;
    updateDockerContainers: (containerNames: string[]) => Promise<any>;
    getSystemInfo: () => Promise<any>;
    checkForUpdates: () => Promise<any>;
    getUpdateInfo: () => Promise<any>;
    checkLlamacppUpdates: () => Promise<any>;
    updateLlamacppBinaries: () => Promise<any>;
    clipboard: {
      writeText: (text: string) => void;
      readText: () => string;
    };
    send: (channel: string, data: any) => void;
    sendReactReady: () => void;
    receive: (channel: string, callback: (...args: any[]) => void) => void;
    removeListener: (channel: string, callback: (...args: any[]) => void) => void;
    removeAllListeners: (channel: string) => void;
    getWorkflowsPath: () => Promise<string>;
    dialog: {
      showOpenDialog: (options: any) => Promise<any>;
    };
  };
  electronAPI: any;
  llamaSwap: any;
  modelManager: any;
}
