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
  checkN8NHealth: () => Promise<{ success: boolean; data?: any; error?: string }>;
  startN8N: () => Promise<{ success: boolean; pid?: number; error?: string }>;
  stopN8N: () => Promise<{ success: boolean; error?: string }>;
  receive: (channel: string, callback: (data: any) => void) => void;
  removeListener: (channel: string) => void;
  getPythonPort: () => Promise<number | null>;
  checkPythonBackend: () => Promise<{ port: number | null }>;
  getAppVersion: () => string;
  getElectronVersion: () => string;
  getPlatform: () => string;
  getOsVersion: () => string;
  getServicePorts: () => Promise<ServicePorts>;
  ipcRenderer: {
    on: (channel: string, listener: (status: SetupStatus | string) => void) => () => void;
    removeListener: (channel: string, listener: (...args: any[]) => void) => void;
    removeAllListeners: (channel: string) => void;
  };
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