import React, { useState, useEffect, useRef } from 'react';
import { 
  XCircle, 
  BarChart3, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp,
  Clock,
  Download
} from 'lucide-react';
import { widgetServiceClient } from '../../services/widgetServiceClient';
import type { SystemStats } from '../../types/widgetService';

interface SystemResourcesGraphWidgetProps {
  id: string;
  onRemove: (id: string) => void;
  width?: number;
  height?: number;
}

interface DataPoint {
  timestamp: number;
  cpu: number;
  memory: number;
  gpu: number;
  vram: number;
}

interface TimeRange {
  label: string;
  minutes: number;
  maxPoints: number;
}

const TIME_RANGES: TimeRange[] = [
  { label: '5m', minutes: 5, maxPoints: 150 },
  { label: '15m', minutes: 15, maxPoints: 150 },
  { label: '1h', minutes: 60, maxPoints: 180 },
  { label: '6h', minutes: 360, maxPoints: 180 }
];

const SystemResourcesGraphWidget: React.FC<SystemResourcesGraphWidgetProps> = ({ id, onRemove, width = 6, height = 4 }) => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRange>(TIME_RANGES[0]);

  // Determine widget size category
  const isSmall = width <= 3 || height <= 3;
  const isMedium = (width <= 8 && height <= 6) && !isSmall;
  const isLarge = !isSmall && !isMedium;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const initializeWidget = async () => {
      try {
        const result = await widgetServiceClient.registerWidget('system-resources');
        if (!result.success) {
          console.error('Failed to register system resources widget:', result.error);
          setError(`Failed to initialize widget: ${result.error}`);
          setIsLoading(false);
          return;
        }
        
        console.log('System resources widget registered successfully');
        setTimeout(connectWebSocket, 1000);
      } catch (err) {
        console.error('Error initializing widget:', err);
        setError('Failed to initialize widget service');
        setIsLoading(false);
      }
    };

    const connectWebSocket = () => {
      try {
        ws = new WebSocket('ws://localhost:8765/ws/stats');
        
        ws.onopen = () => {
          console.log('Connected to system resources service');
          setIsConnected(true);
          setIsLoading(false);
          setError(null);
        };

        ws.onmessage = (event) => {
          try {
            const data: SystemStats = JSON.parse(event.data);
            setStats(data);
            setLastUpdate(new Date());

            // Add new data point
            const newPoint: DataPoint = {
              timestamp: Date.now(),
              cpu: data.cpu?.usage || 0,
              memory: data.memory?.usedPercent || 0,
              gpu: data.gpu?.[0]?.usage || 0,
              vram: data.gpu?.[0]?.memoryPercent || 0
            };

            setDataPoints(prev => {
              const updated = [...prev, newPoint];
              // Keep only points within the selected time range
              const cutoffTime = Date.now() - (selectedTimeRange.minutes * 60 * 1000);
              const filtered = updated.filter(point => point.timestamp >= cutoffTime);
              
              // Limit to maxPoints for performance
              if (filtered.length > selectedTimeRange.maxPoints) {
                return filtered.slice(-selectedTimeRange.maxPoints);
              }
              return filtered;
            });
          } catch (err) {
            console.error('Error parsing stats data:', err);
          }
        };

        ws.onclose = () => {
          console.log('Disconnected from system resources service');
          setIsConnected(false);
          setError('Connection lost to monitoring service');
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

    initializeWidget();

    return () => {
      if (ws) {
        ws.close();
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      
      widgetServiceClient.unregisterWidget('system-resources').catch((err) => {
        console.error('Error unregistering system resources widget:', err);
      });
    };
  }, [selectedTimeRange]);

  // Filter data points based on selected time range
  useEffect(() => {
    const cutoffTime = Date.now() - (selectedTimeRange.minutes * 60 * 1000);
    setDataPoints(prev => prev.filter(point => point.timestamp >= cutoffTime));
  }, [selectedTimeRange]);

  // Canvas drawing
  useEffect(() => {
    if (!canvasRef.current || dataPoints.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      // Set canvas size
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      const width = rect.width;
      const height = rect.height;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      if (dataPoints.length < 2) return;

      // Setup
      const padding = 40;
      const graphWidth = width - padding * 2;
      const graphHeight = height - padding * 2;

      // Draw grid
      ctx.strokeStyle = 'rgba(156, 163, 175, 0.2)';
      ctx.lineWidth = 1;
      
      // Horizontal grid lines (percentage)
      for (let i = 0; i <= 4; i++) {
        const y = padding + (graphHeight / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(width - padding, y);
        ctx.stroke();
        
        // Y-axis labels
        ctx.fillStyle = 'rgba(107, 114, 128, 0.8)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`${100 - (i * 25)}%`, padding - 5, y + 3);
      }

      // Vertical grid lines (time)
      const timeSpan = selectedTimeRange.minutes * 60 * 1000;
      const gridCount = 5;
      for (let i = 0; i <= gridCount; i++) {
        const x = padding + (graphWidth / gridCount) * i;
        ctx.beginPath();
        ctx.moveTo(x, padding);
        ctx.lineTo(x, height - padding);
        ctx.stroke();
        
        // X-axis labels
        const timeAgo = timeSpan - (timeSpan / gridCount) * i;
        const label = timeAgo === 0 ? 'Now' : `${Math.round(timeAgo / 60000)}m`;
        ctx.fillStyle = 'rgba(107, 114, 128, 0.8)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, height - padding + 15);
      }

      // Draw lines
      const drawLine = (points: number[], color: string) => {
        if (points.length < 2) return;

        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();

        points.forEach((value, index) => {
          const x = padding + (graphWidth / (points.length - 1)) * index;
          const y = padding + graphHeight - (value / 100) * graphHeight;
          
          if (index === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        });

        ctx.stroke();
      };

      // Extract data series
      const cpuData = dataPoints.map(p => p.cpu);
      const memoryData = dataPoints.map(p => p.memory);
      const gpuData = dataPoints.map(p => p.gpu);
      const vramData = dataPoints.map(p => p.vram);

      // Draw lines for each metric
      drawLine(cpuData, '#8B5CF6'); // Purple
      drawLine(memoryData, '#10B981'); // Green
      drawLine(gpuData, '#3B82F6'); // Blue
      drawLine(vramData, '#F59E0B'); // Amber
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [dataPoints, selectedTimeRange]);

  const exportData = () => {
    const csvContent = [
      ['Timestamp', 'CPU %', 'Memory %', 'GPU %', 'VRAM %'],
      ...dataPoints.map(point => [
        new Date(point.timestamp).toISOString(),
        point.cpu.toFixed(2),
        point.memory.toFixed(2),
        point.gpu.toFixed(2),
        point.vram.toFixed(2)
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-resources-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
          <div className="p-3 bg-purple-100 dark:bg-purple-100/10 rounded-xl">
            <BarChart3 className="w-6 h-6 text-purple-500 animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              System Resources
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Connecting to monitoring service...
            </p>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin">
            <RefreshCw className="w-8 h-8 text-purple-500" />
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
              System Resources
            </h3>
            <p className="text-sm text-red-500">
              {error || 'Service unavailable'}
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mb-3" />
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            System monitoring service is not running.
          </p>
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
          <div className={`bg-purple-100 dark:bg-purple-100/10 rounded-lg ${isSmall ? 'p-1' : isMedium ? 'p-1.5' : 'p-2'}`}>
            <BarChart3 className={`text-purple-500 ${isSmall ? 'w-3 h-3' : isMedium ? 'w-4 h-4' : 'w-5 h-5'}`} />
          </div>
          <div>
            <h3 className={`font-semibold text-gray-900 dark:text-white ${isSmall ? 'text-xs' : isMedium ? 'text-sm' : 'text-base'}`}>
              {isSmall ? 'Resources' : 'System Resources'}
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

        {!isSmall && (
          <button
            onClick={exportData}
            className="p-1 text-gray-400 hover:text-purple-500 transition-colors"
            title="Export data as CSV"
          >
            <Download className={isMedium ? 'w-3 h-3' : 'w-4 h-4'} />
          </button>
        )}
      </div>

      {/* Time Range Selector - Only show in medium/large */}
      {!isSmall && (
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-gray-500" />
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            {TIME_RANGES.map((range) => (
              <button
                key={range.label}
                onClick={() => setSelectedTimeRange(range)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  selectedTimeRange.label === range.label
                    ? 'bg-purple-500 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-purple-500'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Current Stats */}
      {stats && (
        <>
          {/* Small Widget - Ultra Compact 3x3 */}
          {isSmall && (
            <div className="h-full flex flex-col flex-1">
              <div className="grid grid-cols-2 gap-2 flex-1">
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 flex flex-col items-center justify-center">
                  <div className="text-xs text-purple-600 dark:text-purple-400 mb-2">CPU</div>
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {stats.cpu?.usage?.toFixed(0) || '0'}%
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 flex flex-col items-center justify-center">
                  <div className="text-xs text-green-600 dark:text-green-400 mb-2">RAM</div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {stats.memory?.usedPercent?.toFixed(0) || '0'}%
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 flex flex-col items-center justify-center">
                  <div className="text-xs text-blue-600 dark:text-blue-400 mb-2">GPU</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {stats.gpu?.[0]?.usage?.toFixed(0) || '0'}%
                  </div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 flex flex-col items-center justify-center">
                  <div className="text-xs text-amber-600 dark:text-amber-400 mb-2">VRAM</div>
                  <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                    {stats.gpu?.[0]?.memoryPercent?.toFixed(0) || '0'}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Medium/Large Widget - Graph View */}
          {!isSmall && (
            <div className="flex-1 flex flex-col">
              {/* Enhanced Stats Grid for Medium/Large */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 text-center">
                  <div className="text-sm text-purple-600 dark:text-purple-400 mb-1">CPU</div>
                  <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                    {stats.cpu?.usage?.toFixed(0) || '0'}%
                  </div>
                </div>
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center">
                  <div className="text-sm text-green-600 dark:text-green-400 mb-1">RAM</div>
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">
                    {stats.memory?.usedPercent?.toFixed(0) || '0'}%
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center">
                  <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">GPU</div>
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {stats.gpu?.[0]?.usage?.toFixed(0) || '0'}%
                  </div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-3 text-center">
                  <div className="text-sm text-amber-600 dark:text-amber-400 mb-1">VRAM</div>
                  <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                    {stats.gpu?.[0]?.memoryPercent?.toFixed(0) || '0'}%
                  </div>
                </div>
              </div>

              {/* Graph */}
              <div className="flex-1 relative bg-white dark:bg-gray-900/50 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                <canvas
                  ref={canvasRef}
                  className="w-full h-full"
                  style={{ width: '100%', height: '100%' }}
                />
                
                {dataPoints.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <TrendingUp className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">Collecting data...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 mt-3 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-purple-500"></div>
                  <span className="text-gray-600 dark:text-gray-400">CPU</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-green-500"></div>
                  <span className="text-gray-600 dark:text-gray-400">Memory</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-blue-500"></div>
                  <span className="text-gray-600 dark:text-gray-400">GPU</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-amber-500"></div>
                  <span className="text-gray-600 dark:text-gray-400">VRAM</span>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SystemResourcesGraphWidget;
