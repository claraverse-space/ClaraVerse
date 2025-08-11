import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, Activity, Zap } from 'lucide-react';
import { widgetServiceClient } from '../../services/widgetServiceClient';
import type { SystemStats as WidgetSystemStats } from '../../types/widgetService';
import { db } from '../../db';

const SystemMonitor: React.FC = () => {
  const [stats, setStats] = useState<WidgetSystemStats | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isEnabled, setIsEnabled] = useState(true); // New state for user preference

  // Load user preference for system monitor display
  useEffect(() => {
    const loadPreference = async () => {
      try {
        const personalInfo = await db.getPersonalInfo();
        const showMonitor = personalInfo?.ui_preferences?.show_system_monitor ?? true;
        setIsEnabled(showMonitor);
      } catch (error) {
        console.error('Failed to load system monitor preference:', error);
        setIsEnabled(true); // Default to enabled
      }
    };
    loadPreference();

    // Listen for preference changes in real-time
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && e.key.includes('personal_info')) {
        loadPreference();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    // Only initialize if enabled
    if (!isEnabled) {
      return;
    }

    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const initializeMonitor = async () => {
      try {
        // Register this monitor with the service
        const result = await widgetServiceClient.registerWidget('system-monitor');
        if (!result.success) {
          console.error('Failed to register system monitor:', result.error);
          setError(`Failed to initialize monitor: ${result.error}`);
          setIsLoading(false);
          return;
        }
        
        console.log('System monitor registered successfully');
        
        // Start WebSocket connection after a brief delay to allow service startup
        setTimeout(connectWebSocket, 1000);
      } catch (err) {
        console.error('Error initializing system monitor:', err);
        setError('Failed to initialize monitoring service');
        setIsLoading(false);
      }
    };

    const connectWebSocket = () => {
      try {
        // Try to connect to the widgets service
        ws = new WebSocket('ws://localhost:8765/ws/stats');
        
        ws.onopen = () => {
          console.log('Connected to system monitoring service');
          setIsConnected(true);
          setIsLoading(false);
          setError(null);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data) as WidgetSystemStats;
            setStats(data);
          } catch (err) {
            console.error('Error parsing stats data:', err);
          }
        };

        ws.onclose = () => {
          console.log('Disconnected from system monitoring service');
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
        setIsLoading(false);
        setError('Service unavailable');
      }
    };

    initializeMonitor();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws) {
        ws.close();
      }
      // Unregister widget when component unmounts
      widgetServiceClient.unregisterWidget('system-monitor').catch(err => {
        console.error('Error unregistering system monitor:', err);
      });
    };
  }, [isEnabled]);

  // Toggle visibility on click
  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0G';
    const gb = bytes / (1024 * 1024 * 1024); // Convert from bytes to GB
    return `${gb.toFixed(1)}G`;
  };

  const getUsageColor = (percentage: number): string => {
    if (percentage < 50) return 'text-emerald-500 dark:text-emerald-400';
    if (percentage < 80) return 'text-amber-500 dark:text-amber-400';
    return 'text-red-500 dark:text-red-400';
  };

  const getTempColor = (temp: number): string => {
    if (temp < 60) return 'text-blue-500 dark:text-blue-400';
    if (temp < 80) return 'text-amber-500 dark:text-amber-400';
    return 'text-red-500 dark:text-red-400';
  };

  // Don't render anything if disabled by user preference
  if (!isEnabled) {
    return null;
  }

  // Don't render anything if there are connection issues, errors, or no data
  if (error || !isConnected || !stats || isLoading) {
    return null;
  }

  if (!isVisible) {
    return (
      <button 
        onClick={toggleVisibility}
        className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
        title="Show system stats"
      >
        <Activity className="w-3 h-3" />
        <span>Stats</span>
      </button>
    );
  }

  const cpuPercentage = Math.round(stats.cpu.usage);
  const memoryPercentage = Math.round(stats.memory.usedPercent);
  
  // Get primary GPU stats (first GPU if available)
  const primaryGPU = stats.gpu && stats.gpu.length > 0 ? stats.gpu[0] : null;
  const vramPercentage = primaryGPU ? Math.round(primaryGPU.memoryPercent) : 0;
  const gpuPercentage = primaryGPU ? Math.round(primaryGPU.usage) : 0;

  return (
    <div 
      className="flex items-center gap-3 text-xs font-mono cursor-pointer" 
      onClick={toggleVisibility}
      title="Click to hide/show system stats"
    >
      {/* CPU Usage - only show if > 0% */}
      {cpuPercentage > 0 && (
        <div className="flex items-center gap-1">
          <Cpu className="w-3 h-3 text-gray-400 dark:text-gray-500" />
          <span className={`font-semibold ${getUsageColor(cpuPercentage)}`}>
            {cpuPercentage}%
          </span>
        </div>
      )}

      {/* Memory Usage - only show if memory data is available */}
      {stats.memory.used > 0 && stats.memory.total > 0 && (
        <div className="flex items-center gap-1">
          <HardDrive className="w-3 h-3 text-gray-400 dark:text-gray-500" />
          <span className={`font-semibold ${getUsageColor(memoryPercentage)}`}>
            {formatBytes(stats.memory.used)}
          </span>
          <span className="text-gray-500 dark:text-gray-400 text-[10px]">
            /{formatBytes(stats.memory.total)}
          </span>
        </div>
      )}

      {/* VRAM Usage - only show if GPU available and VRAM usage > 0 */}
      {primaryGPU && primaryGPU.memoryUsed > 0 && primaryGPU.memoryTotal > 0 && (
        <div className="flex items-center gap-1">
          <Zap className="w-3 h-3 text-gray-400 dark:text-gray-500" />
          <span className={`font-semibold ${getUsageColor(vramPercentage)}`}>
            {formatBytes(primaryGPU.memoryUsed)}
          </span>
          <span className="text-gray-500 dark:text-gray-400 text-[10px]">
            /{formatBytes(primaryGPU.memoryTotal)}
          </span>
        </div>
      )}

      {/* GPU Usage - only show if GPU available and usage > 0% */}
      {primaryGPU && gpuPercentage > 0 && (
        <div className="flex items-center gap-1">
          <Activity className="w-3 h-3 text-gray-400 dark:text-gray-500" />
          <span className={`font-semibold ${getUsageColor(gpuPercentage)}`}>
            {gpuPercentage}%
          </span>
          {/* GPU Temperature - only show if temperature > 0 */}
          {primaryGPU.temperature > 0 && (
            <span className={`text-[10px] ${getTempColor(primaryGPU.temperature)}`}>
              {Math.round(primaryGPU.temperature)}°
            </span>
          )}
        </div>
      )}

      {/* Visual indicator - always show when monitoring is active */}
      <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" title="Live monitoring" />
    </div>
  );
};

export default SystemMonitor;
