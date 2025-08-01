/**
 * Widget Service Client
 * 
 * Frontend service for communicating with the widget service via Electron IPC
 */

import { 
  WidgetServiceManager, 
  WidgetServiceResponse, 
  WidgetType, 
  WIDGET_SERVICE_CHANNELS 
} from '../types/widgetService';

// Type for electron API
interface ElectronAPI {
  invoke: (channel: string, ...args: any[]) => Promise<any>;
}

export class WidgetServiceClient implements WidgetServiceManager {
  private static instance: WidgetServiceClient;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): WidgetServiceClient {
    if (!WidgetServiceClient.instance) {
      WidgetServiceClient.instance = new WidgetServiceClient();
    }
    return WidgetServiceClient.instance;
  }

  /**
   * Get the electron API from the window object
   */
  private get electronAPI(): ElectronAPI {
    return (window as any).electronAPI;
  }

  /**
   * Initialize the widget service
   */
  async init(): Promise<WidgetServiceResponse> {
    try {
      const response = await this.electronAPI.invoke(WIDGET_SERVICE_CHANNELS.INIT);
      if (response.success) {
        this.isInitialized = true;
      }
      return response;
    } catch (error) {
      console.error('Error initializing widget service:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Start the widget service manually
   */
  async start(): Promise<WidgetServiceResponse> {
    try {
      await this.ensureInitialized();
      return await this.electronAPI.invoke(WIDGET_SERVICE_CHANNELS.START);
    } catch (error) {
      console.error('Error starting widget service:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Stop the widget service manually
   */
  async stop(): Promise<WidgetServiceResponse> {
    try {
      return await this.electronAPI.invoke(WIDGET_SERVICE_CHANNELS.STOP);
    } catch (error) {
      console.error('Error stopping widget service:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Restart the widget service
   */
  async restart(): Promise<WidgetServiceResponse> {
    try {
      await this.ensureInitialized();
      return await this.electronAPI.invoke(WIDGET_SERVICE_CHANNELS.RESTART);
    } catch (error) {
      console.error('Error restarting widget service:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Register a widget as active
   */
  async registerWidget(widgetType: WidgetType): Promise<WidgetServiceResponse> {
    try {
      await this.ensureInitialized();
      const response = await this.electronAPI.invoke(
        WIDGET_SERVICE_CHANNELS.REGISTER_WIDGET, 
        widgetType
      );
      
      console.log(`Widget '${widgetType}' registered:`, response);
      return response;
    } catch (error) {
      console.error(`Error registering widget '${widgetType}':`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Unregister a widget
   */
  async unregisterWidget(widgetType: WidgetType): Promise<WidgetServiceResponse> {
    try {
      const response = await this.electronAPI.invoke(
        WIDGET_SERVICE_CHANNELS.UNREGISTER_WIDGET, 
        widgetType
      );
      
      console.log(`Widget '${widgetType}' unregistered:`, response);
      return response;
    } catch (error) {
      console.error(`Error unregistering widget '${widgetType}':`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get widget service status
   */
  async getStatus(): Promise<WidgetServiceResponse> {
    try {
      return await this.electronAPI.invoke(WIDGET_SERVICE_CHANNELS.GET_STATUS);
    } catch (error) {
      console.error('Error getting widget service status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check widget service health
   */
  async checkHealth(): Promise<WidgetServiceResponse> {
    try {
      return await this.electronAPI.invoke(WIDGET_SERVICE_CHANNELS.HEALTH);
    } catch (error) {
      console.error('Error checking widget service health:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        healthy: false
      };
    }
  }

  /**
   * Manage service (start/stop based on active widgets)
   */
  async manage(): Promise<WidgetServiceResponse> {
    try {
      await this.ensureInitialized();
      return await this.electronAPI.invoke(WIDGET_SERVICE_CHANNELS.MANAGE);
    } catch (error) {
      console.error('Error managing widget service:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Ensure the service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      const result = await this.init();
      if (!result.success) {
        throw new Error(`Failed to initialize widget service: ${result.error}`);
      }
    }
  }

  /**
   * Get service URL for WebSocket connections
   */
  getServiceUrl(port: number = 8765): string {
    return `ws://localhost:${port}`;
  }

  /**
   * Check if the service is available via HTTP
   */
  async isServiceReachable(port: number = 8765): Promise<boolean> {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get system stats via HTTP (fallback for WebSocket)
   */
  async getSystemStats(port: number = 8765): Promise<any> {
    try {
      const response = await fetch(`http://localhost:${port}/stats`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching system stats:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const widgetServiceClient = WidgetServiceClient.getInstance();
