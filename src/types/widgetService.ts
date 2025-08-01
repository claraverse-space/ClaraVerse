/**
 * Widget Service Types and Interface
 * 
 * Types for communicating with the widget service via Electron IPC
 */

export interface WidgetServiceStatus {
  running: boolean;
  port: number;
  activeWidgets: string[];
  shouldRun: boolean;
  pid?: number;
  uptime?: number;
}

export interface WidgetServiceResponse {
  success: boolean;
  error?: string;
  message?: string;
  status?: WidgetServiceStatus;
  healthy?: boolean;
}

export interface WidgetServiceManager {
  // Service lifecycle
  init(): Promise<WidgetServiceResponse>;
  start(): Promise<WidgetServiceResponse>;
  stop(): Promise<WidgetServiceResponse>;
  restart(): Promise<WidgetServiceResponse>;
  
  // Widget registration
  registerWidget(widgetType: string): Promise<WidgetServiceResponse>;
  unregisterWidget(widgetType: string): Promise<WidgetServiceResponse>;
  
  // Status and health
  getStatus(): Promise<WidgetServiceResponse>;
  checkHealth(): Promise<WidgetServiceResponse>;
  manage(): Promise<WidgetServiceResponse>;
}

export type WidgetType = 'gpu-monitor' | 'system-monitor' | 'network-monitor' | 'system-resources';

// IPC Channel names
export const WIDGET_SERVICE_CHANNELS = {
  INIT: 'widget-service:init',
  START: 'widget-service:start',
  STOP: 'widget-service:stop',
  RESTART: 'widget-service:restart',
  REGISTER_WIDGET: 'widget-service:register-widget',
  UNREGISTER_WIDGET: 'widget-service:unregister-widget',
  GET_STATUS: 'widget-service:get-status',
  HEALTH: 'widget-service:health',
  MANAGE: 'widget-service:manage'
} as const;

// System stats interfaces (from the Go service)
export interface GPUStats {
  name: string;
  usage: number; // Changed from utilization to usage to match Go service
  memoryTotal: number; // Flattened memory fields
  memoryUsed: number;
  memoryFree: number;
  memoryPercent: number;
  temperature: number;
  powerDraw: number;
  fanSpeed?: number;
  clockCore?: number; // Changed from clockSpeed
  clockMemory?: number; // Added memory clock
}

export interface CPUStats {
  usage: number;
  cores: number;
  threads?: number; // Made optional since Go service doesn't provide this
  frequency: number;
  temperature?: number;
}

export interface MemoryStats {
  used: number;
  total: number;
  available: number;
  usedPercent: number; // Changed from usage to usedPercent to match Go service
  swap?: {
    total: number;
    used: number;
    usedPercent: number;
  };
}

export interface DiskStats {
  used: number;
  total: number;
  available: number;
  usage: number;
  readSpeed: number;
  writeSpeed: number;
}

export interface NetworkStats {
  bytesSent: number;
  bytesReceived: number;
  packetsSent: number;
  packetsReceived: number;
  uploadSpeed: number;
  downloadSpeed: number;
}

export interface SystemStats {
  timestamp: string;
  gpu: GPUStats[];
  cpu: CPUStats;
  memory: MemoryStats;
  disk: DiskStats;
  network: NetworkStats;
  uptime: number;
}

// WebSocket connection status
export interface ServiceConnectionStatus {
  connected: boolean;
  url: string;
  lastConnected?: Date;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}
