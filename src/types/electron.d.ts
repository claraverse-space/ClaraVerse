interface ElectronAPI {
  send: (channel: string, data: unknown) => void;
  receive: (channel: string, func: (...args: unknown[]) => void) => void;
  getAppVersion: () => string;
  getPlatform: () => string;
}

declare interface Window {
  electron: ElectronAPI;
} 