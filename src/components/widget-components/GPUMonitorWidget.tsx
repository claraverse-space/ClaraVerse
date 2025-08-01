import React, { useState, useEffect } from 'react';
import { 
  XCircle, 
  Cpu, 
  Thermometer, 
  Zap, 
  HardDrive, 
  Activity,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Monitor
} from 'lucide-react';
import { widgetServiceClient } from '../../services/widgetServiceClient';
import type { SystemStats, GPUStats } from '../../types/widgetService';

interface GPUMonitorWidgetProps {
  id: string;
  onRemove: (id: string) => void;
  width?: number;
  height?: number;
}

const GPUMonitorWidget: React.FC<GPUMonitorWidgetProps> = ({ id, onRemove, width = 4, height = 4 }) => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Determine widget size category
  const isSmall = width <= 3 || height <= 3;
  const isMedium = (width <= 6 && height <= 6) && !isSmall;
  const isLarge = !isSmall && !isMedium;

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const initializeWidget = async () => {
      try {
        // Register this widget with the service
        const result = await widgetServiceClient.registerWidget('gpu-monitor');
        if (!result.success) {
          console.error('Failed to register GPU monitor widget:', result.error);
          setError(`Failed to initialize widget: ${result.error}`);
          setIsLoading(false);
          return;
        }
        
        console.log('GPU monitor widget registered successfully');
        
        // Start WebSocket connection after a brief delay to allow service startup
        setTimeout(connectWebSocket, 1000);
      } catch (err) {
        console.error('Error initializing widget:', err);
        setError('Failed to initialize widget service');
        setIsLoading(false);
      }
    };

    const connectWebSocket = () => {
      try {
        // Try to connect to the widgets service
        ws = new WebSocket('ws://localhost:8765/ws/stats');
        
        ws.onopen = () => {
          console.log('Connected to GPU monitor service');
          setIsConnected(true);
          setIsLoading(false);
          setError(null);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setStats(data);
            setLastUpdate(new Date());
          } catch (err) {
            console.error('Error parsing stats data:', err);
          }
        };

        ws.onclose = () => {
          console.log('Disconnected from GPU monitor service');
          setIsConnected(false);
          setError('Connection lost to monitoring service');
          
          // Attempt to reconnect after 5 seconds
          reconnectTimeout = setTimeout(connectWebSocket, 5000);
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setIsConnected(false);
          setIsLoading(false);
          setError('Failed to connect to monitoring service');
        };
      } catch (err) {
        console.error('Failed to create WebSocket connection:', err);
        setIsConnected(false);
        setIsLoading(false);
        setError('Monitoring service unavailable');
      }
    };

    // Initialize the widget
    initializeWidget();

    // Cleanup on unmount
    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      
      // Unregister the widget
      widgetServiceClient.unregisterWidget('gpu-monitor').catch((err) => {
        console.error('Error unregistering GPU monitor widget:', err);
      });
    };
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatTemperature = (temp: number): string => {
    return temp > 0 ? `${temp.toFixed(1)}°C` : 'N/A';
  };

  const getUsageColor = (percentage: number): string => {
    if (percentage < 30) return 'text-green-500';
    if (percentage < 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getTemperatureColor = (temp: number): string => {
    if (temp === 0) return 'text-gray-400';
    if (temp < 60) return 'text-green-500';
    if (temp < 80) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (isLoading) {
    return (
      <div className="glassmorphic rounded-2xl p-6 animate-fadeIn relative group h-full flex flex-col">
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onRemove(id)}
        >
          <XCircle className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-100/10 rounded-xl">
            <Monitor className="w-6 h-6 text-blue-500 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              GPU Monitor
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Connecting to monitoring service...
            </p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin">
            <RefreshCw className="w-8 h-8 text-blue-500" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !isConnected) {
    return (
      <div className="glassmorphic rounded-2xl p-6 animate-fadeIn relative group h-full flex flex-col">
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={() => onRemove(id)}
        >
          <XCircle className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-red-100 dark:bg-red-100/10 rounded-xl">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              GPU Monitor
            </h3>
            <p className="text-sm text-red-500">
              {error || 'Service unavailable'}
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-3" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            GPU monitoring service is not running. The service will start automatically when this widget is active.
          </p>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Make sure the widgets service is installed and running.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`glassmorphic rounded-2xl animate-fadeIn relative group h-full flex flex-col ${
      isSmall ? 'p-2' : isMedium ? 'p-3' : 'p-6'
    }`}>
      <button
        className="absolute top-1 right-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        onClick={() => onRemove(id)}
      >
        <XCircle className={isSmall ? "w-3 h-3" : "w-4 h-4"} />
      </button>

      {/* Header - Always show but scale */}
      <div className={`flex items-center justify-between ${isSmall ? 'mb-1' : isMedium ? 'mb-2' : 'mb-3'}`}>
        <div className="flex items-center gap-2">
          <div className={`bg-blue-100 dark:bg-blue-100/10 rounded-lg ${isSmall ? 'p-1' : isMedium ? 'p-1.5' : 'p-2'}`}>
            <Monitor className={`text-blue-500 ${isSmall ? 'w-3 h-3' : isMedium ? 'w-4 h-4' : 'w-5 h-5'}`} />
          </div>
          <div>
            <h3 className={`font-semibold text-gray-900 dark:text-white ${isSmall ? 'text-xs' : isMedium ? 'text-sm' : 'text-base'}`}>
              {isSmall ? 'GPU' : 'GPU Monitor'}
            </h3>
            {!isSmall && (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-2 h-2 text-green-500" />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {lastUpdate ? `${lastUpdate.toLocaleTimeString()}` : 'Live'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Overview */}
      {stats && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* CPU & Memory Quick Stats - Always show */}
          <div className={`grid grid-cols-2 gap-${isSmall ? '1' : isMedium ? '2' : '3'} ${isSmall ? 'mb-1' : isMedium ? 'mb-2' : 'mb-4'}`}>
            <div className={`bg-gray-50 dark:bg-gray-800/50 rounded-lg ${isSmall ? 'p-1.5' : isMedium ? 'p-2' : 'p-3'} flex-1`}>
              <div className={`flex items-center gap-1 ${isSmall ? 'mb-1' : isMedium ? 'mb-1' : 'mb-2'}`}>
                <Cpu className={`text-purple-500 ${isSmall ? 'w-3 h-3' : isMedium ? 'w-3 h-3' : 'w-4 h-4'}`} />
                <span className={`font-medium text-gray-700 dark:text-gray-300 ${isSmall ? 'text-xs' : isMedium ? 'text-xs' : 'text-sm'}`}>CPU</span>
              </div>
              <div className={`font-bold text-gray-900 dark:text-white ${isSmall ? 'text-lg' : isMedium ? 'text-xl' : 'text-2xl'}`}>
                {stats?.cpu?.usage ? stats.cpu.usage.toFixed(0) : '0'}%
              </div>
              {!isSmall && (
                <div className="text-xs text-gray-500">
                  {stats?.cpu ? `${stats.cpu.cores} cores @ ${(stats.cpu.frequency / 1000).toFixed(1)}GHz` : 'Loading...'}
                </div>
              )}
            </div>

            <div className={`bg-gray-50 dark:bg-gray-800/50 rounded-lg ${isSmall ? 'p-1.5' : isMedium ? 'p-2' : 'p-3'} flex-1`}>
              <div className={`flex items-center gap-1 ${isSmall ? 'mb-1' : isMedium ? 'mb-1' : 'mb-2'}`}>
                <HardDrive className={`text-green-500 ${isSmall ? 'w-3 h-3' : isMedium ? 'w-3 h-3' : 'w-4 h-4'}`} />
                <span className={`font-medium text-gray-700 dark:text-gray-300 ${isSmall ? 'text-xs' : isMedium ? 'text-xs' : 'text-sm'}`}>RAM</span>
              </div>
              <div className={`font-bold text-gray-900 dark:text-white ${isSmall ? 'text-lg' : isMedium ? 'text-xl' : 'text-2xl'}`}>
                {stats?.memory?.usedPercent ? stats.memory.usedPercent.toFixed(0) : '0'}%
              </div>
              {!isSmall && (
                <div className="text-xs text-gray-500">
                  {stats?.memory ? `${formatBytes(stats.memory.used)} / ${formatBytes(stats.memory.total)}` : 'Loading...'}
                </div>
              )}
            </div>
          </div>

          {/* GPU Stats - Always show with same design */}
          {stats?.gpu && stats.gpu.length > 0 ? (
            <div className={`${isSmall ? 'space-y-1' : isMedium ? 'space-y-2' : 'space-y-3'} flex-1`}>
              {!isSmall && (
                <h4 className={`font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2 ${isMedium ? 'text-xs' : 'text-sm'}`}>
                  <Monitor className={isMedium ? 'w-3 h-3' : 'w-4 h-4'} />
                  GPU Details
                </h4>
              )}
              
              {stats.gpu.map((gpu, index) => {
                const memoryUsedPercent = gpu?.memoryPercent || 0;
                
                return (
                <div key={index} className={`bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg ${isSmall ? 'p-2' : isMedium ? 'p-3' : 'p-4'} border border-blue-200/50 dark:border-blue-700/50 flex-1`}>
                  <div className={`flex items-center justify-between ${isSmall ? 'mb-2' : isMedium ? 'mb-2' : 'mb-3'}`}>
                    <h5 className={`font-medium text-gray-900 dark:text-white truncate ${isSmall ? 'text-sm' : isMedium ? 'text-sm' : 'text-base'}`}>
                      {isSmall ? (gpu?.name?.split(' ')[0] || 'GPU') : (gpu?.name || 'Unknown GPU')}
                    </h5>
                    <div className={`font-bold ${getUsageColor(gpu?.usage || 0)} ${isSmall ? 'text-xl' : isMedium ? 'text-2xl' : 'text-3xl'}`}>
                      {gpu?.usage ? gpu.usage.toFixed(0) : '0'}%
                    </div>
                  </div>
                  
                  {/* GPU Usage Bar */}
                  <div className={isSmall ? 'mb-2' : isMedium ? 'mb-3' : 'mb-3'}>
                    {!isSmall && (
                      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                        <span>GPU Usage</span>
                        <span>{gpu?.usage ? gpu.usage.toFixed(1) : '0.0'}%</span>
                      </div>
                    )}
                    <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full ${isSmall ? 'h-1.5' : isMedium ? 'h-2' : 'h-3'}`}>
                      <div 
                        className={`bg-blue-500 rounded-full transition-all duration-300 ${isSmall ? 'h-1.5' : isMedium ? 'h-2' : 'h-3'}`}
                        style={{ width: `${Math.min(gpu?.usage || 0, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* VRAM Usage */}
                  {gpu?.memoryTotal && gpu.memoryTotal > 0 && (
                    <div className={isSmall ? 'mb-2' : isMedium ? 'mb-3' : 'mb-3'}>
                      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
                        <span>VRAM</span>
                        <span>{memoryUsedPercent.toFixed(0)}%</span>
                      </div>
                      <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full ${isSmall ? 'h-1.5' : isMedium ? 'h-2' : 'h-3'}`}>
                        <div 
                          className={`bg-purple-500 rounded-full transition-all duration-300 ${isSmall ? 'h-1.5' : isMedium ? 'h-2' : 'h-3'}`}
                          style={{ width: `${Math.min(memoryUsedPercent, 100)}%` }}
                        />
                      </div>
                      {!isSmall && (
                        <div className="text-xs text-gray-500 mt-1">
                          {formatBytes(gpu.memoryUsed)} / {formatBytes(gpu.memoryTotal)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Additional Stats */}
                  <div className={`grid ${isSmall ? 'grid-cols-2' : 'grid-cols-2'} gap-${isSmall ? '2' : '3'} text-sm`}>
                    {gpu?.temperature && gpu.temperature > 0 && (
                      <div className="flex items-center gap-1">
                        <Thermometer className={`${getTemperatureColor(gpu.temperature)} ${isSmall ? 'w-3 h-3' : 'w-4 h-4'}`} />
                        <span className={getTemperatureColor(gpu.temperature)}>
                          {gpu.temperature.toFixed(0)}°C
                        </span>
                      </div>
                    )}
                    
                    {gpu?.powerDraw && gpu.powerDraw > 0 && (
                      <div className="flex items-center gap-1">
                        <Zap className={`text-yellow-500 ${isSmall ? 'w-3 h-3' : 'w-4 h-4'}`} />
                        <span className="text-gray-600 dark:text-gray-400">
                          {gpu.powerDraw.toFixed(0)}W
                        </span>
                      </div>
                    )}

                    {!isSmall && gpu?.clockCore && gpu.clockCore > 0 && (
                      <div className="flex items-center gap-1">
                        <Cpu className="w-4 h-4 text-purple-500" />
                        <span className="text-gray-600 dark:text-gray-400">
                          {gpu.clockCore}MHz
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                );
              })}
            </div>
          ) : (
            <div className={`bg-yellow-50 dark:bg-yellow-900/20 rounded-lg ${isSmall ? 'p-2' : isMedium ? 'p-3' : 'p-4'} border border-yellow-200/50 dark:border-yellow-700/50 flex-1 flex items-center justify-center`}>
              <div className="text-center">
                <AlertTriangle className={`text-yellow-500 ${isSmall ? 'w-6 h-6' : 'w-8 h-8'} mx-auto mb-2`} />
                <span className={`font-medium text-yellow-700 dark:text-yellow-300 ${isSmall ? 'text-sm' : 'text-base'}`}>
                  No GPU Detected
                </span>
                {!isSmall && (
                  <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                    No dedicated GPU found or GPU drivers not installed.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GPUMonitorWidget;
