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
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
} 