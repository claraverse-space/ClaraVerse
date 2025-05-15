// Define the expected structure for service ports
interface ServicePorts {
  python: number;
  n8n: number;
  ollama: number;
}

// Define the expected structure for setup status messages
interface SetupStatus {
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface ElectronAPI {
  getAppVersion: () => string;
  getElectronVersion: () => string;
  getPlatform: () => string;
  getOsVersion: () => string;
  getWorkflowsPath: () => Promise<string>;
  getServicePorts: () => Promise<{ n8nPort: number }>;
  checkN8NHealth: () => Promise<boolean>;
  startN8N: () => Promise<void>;
  stopN8N: () => Promise<void>;
  getPythonPort: () => Promise<number>;
  checkPythonBackend: () => Promise<boolean>;
  restartInterpreterContainer: () => Promise<{ success: boolean; error?: string }>;
  checkForUpdates: () => Promise<void>;
  clipboard: {
    writeText: (text: string) => void;
    readText: () => string;
  };
  ipcRenderer: {
    on: (channel: string, callback: (data: any) => void) => void;
    removeListener: (channel: string, callback: (...args: any[]) => void) => void;
    removeAllListeners: (channel: string) => void;
  };
  receive: (channel: string, callback: (data: any) => void) => void;
  removeListener: (channel: string) => void;
  requestMicrophonePermission?: () => Promise<boolean>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

// Electron specific types
declare namespace Electron {
  interface WebViewElement extends HTMLElement {
    src: string;
    reload(): void;
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<Electron.WebViewElement>, Electron.WebViewElement> & {
        src?: string;
        allowpopups?: string;
      };
    }
  }
} 