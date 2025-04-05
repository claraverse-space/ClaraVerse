export interface ElectronAPI {
  send: (channel: string, data?: unknown) => void;
  receive: (channel: string, func: (...args: unknown[]) => void) => void;
  removeListener: (channel: string, func: (...args: unknown[]) => void) => void;
  getAppVersion: () => string;
  getPlatform: () => string;
  getAppPath: () => string;
  getPythonPort: () => Promise<number | null>;
  checkPythonBackend: () => Promise<boolean>;
}

declare interface Window {
  electron: ElectronAPI;
} 