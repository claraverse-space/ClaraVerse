import React, { useState, useEffect } from 'react';
import { Monitor, Cpu, Zap, AlertCircle, CheckCircle, RefreshCw, BarChart3, HardDrive } from 'lucide-react';

interface GPUInfo {
  hasGPU: boolean;
  gpuMemoryMB: number;
  gpuMemoryGB: number;
  gpuType: string;
  systemMemoryGB: number;
  platform: string;
}

interface ModelGPUInfo {
  name: string;
  path: string;
  sizeGB: number;
  estimatedLayers: number;
  allocatedLayers: number;
  estimatedParams: string;
}

const GPUDiagnostics: React.FC = () => {
  const [gpuInfo, setGpuInfo] = useState<GPUInfo | null>(null);
  const [modelGPUInfo, setModelGPUInfo] = useState<ModelGPUInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGPUDiagnostics = async () => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('Starting GPU diagnostics fetch...');
      
      // Debug: Check what's available on window
      console.log('window.electron:', window.electron);
      console.log('window.llamaSwap:', (window as any).llamaSwap);
      
      const llamaSwap = (window as any).llamaSwap;
      if (!llamaSwap) {
        throw new Error('LlamaSwap service not available');
      }
      
      console.log('llamaSwap object keys:', Object.keys(llamaSwap));
      
      if (!llamaSwap.getGPUDiagnostics) {
        console.error('getGPUDiagnostics method not found');
        console.log('Available llamaSwap methods:', Object.keys(llamaSwap));
        throw new Error('getGPUDiagnostics method not available');
      }

      console.log('Calling getGPUDiagnostics...');
      // Get GPU information
      const response = await llamaSwap.getGPUDiagnostics();
      console.log('GPU diagnostics response:', response);
      
      if (response.success) {
        setGpuInfo(response.gpuInfo);
        setModelGPUInfo(response.modelInfo || []);
      } else {
        throw new Error(response.error || 'Failed to get GPU diagnostics');
      }
    } catch (err) {
      console.error('Error fetching GPU diagnostics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch GPU diagnostics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGPUDiagnostics();
  }, []);

  const getGPUTypeIcon = (gpuType: string) => {
    switch (gpuType) {
      case 'apple_silicon':
        return <Monitor className="w-5 h-5 text-blue-500" />;
      case 'nvidia':
        return <Zap className="w-5 h-5 text-green-500" />;
      case 'amd':
        return <BarChart3 className="w-5 h-5 text-red-500" />;
      case 'intel':
        return <Cpu className="w-5 h-5 text-blue-400" />;
      case 'integrated':
        return <HardDrive className="w-5 h-5 text-gray-500" />;
      default:
        return <Monitor className="w-5 h-5 text-gray-400" />;
    }
  };

  const getGPUTypeName = (gpuType: string) => {
    switch (gpuType) {
      case 'apple_silicon':
        return 'Apple Silicon (Unified Memory)';
      case 'nvidia':
        return 'NVIDIA GPU';
      case 'amd':
        return 'AMD GPU';
      case 'intel':
        return 'Intel GPU';
      case 'integrated':
        return 'Integrated Graphics';
      case 'dedicated':
        return 'Dedicated GPU';
      default:
        return 'Unknown GPU';
    }
  };

  const getPlatformName = (platform: string) => {
    switch (platform) {
      case 'darwin':
        return 'macOS';
      case 'win32':
        return 'Windows';
      case 'linux':
        return 'Linux';
      default:
        return platform;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-amber-500"></div>
          <span className="text-gray-600 dark:text-gray-400">Detecting GPU capabilities...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <div>
            <h4 className="font-medium text-red-900 dark:text-red-100">
              GPU Diagnostics Error
            </h4>
            <p className="text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          </div>
        </div>
        <button
          onClick={fetchGPUDiagnostics}
          className="mt-3 px-3 py-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded text-sm hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-3 h-3" />
          Retry
        </button>
      </div>
    );
  }

  if (!gpuInfo) {
    return (
      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
        No GPU information available
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* GPU System Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* GPU Status Card */}
        <div className={`p-4 rounded-lg border ${
          gpuInfo.hasGPU 
            ? 'bg-green-50/50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
            : 'bg-yellow-50/50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
        }`}>
          <div className="flex items-center gap-3 mb-2">
            {gpuInfo.hasGPU ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-500" />
            )}
            <h4 className={`font-medium ${
              gpuInfo.hasGPU 
                ? 'text-green-900 dark:text-green-100' 
                : 'text-yellow-900 dark:text-yellow-100'
            }`}>
              GPU Status
            </h4>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              {getGPUTypeIcon(gpuInfo.gpuType)}
              <span className={
                gpuInfo.hasGPU 
                  ? 'text-green-700 dark:text-green-300' 
                  : 'text-yellow-700 dark:text-yellow-300'
              }>
                {getGPUTypeName(gpuInfo.gpuType)}
              </span>
            </div>
            <p className={
              gpuInfo.hasGPU 
                ? 'text-green-600 dark:text-green-400' 
                : 'text-yellow-600 dark:text-yellow-400'
            }>
              {gpuInfo.hasGPU ? 'GPU acceleration enabled' : 'Using CPU only'}
            </p>
          </div>
        </div>

        {/* Memory Information Card */}
        <div className="p-4 rounded-lg border bg-blue-50/50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3 mb-2">
            <HardDrive className="w-5 h-5 text-blue-500" />
            <h4 className="font-medium text-blue-900 dark:text-blue-100">
              Memory Information
            </h4>
          </div>
          <div className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
            <div className="flex justify-between">
              <span>GPU Memory:</span>
              <span className="font-mono">
                {gpuInfo.gpuMemoryGB.toFixed(1)} GB
              </span>
            </div>
            <div className="flex justify-between">
              <span>System Memory:</span>
              <span className="font-mono">
                {gpuInfo.systemMemoryGB} GB
              </span>
            </div>
            <div className="flex justify-between">
              <span>Platform:</span>
              <span>{getPlatformName(gpuInfo.platform)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Model GPU Allocation */}
      {modelGPUInfo.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900 dark:text-white">
              Model GPU Layer Allocation
            </h4>
            <button
              onClick={fetchGPUDiagnostics}
              className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>

          <div className="space-y-3">
            {modelGPUInfo.map((model, index) => (
              <div key={index} className="p-4 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h5 className="font-medium text-gray-900 dark:text-white">
                      {model.name}
                    </h5>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {model.estimatedParams} • {model.sizeGB.toFixed(1)} GB
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-gray-900 dark:text-white">
                      {model.allocatedLayers} / {model.estimatedLayers}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      GPU layers
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      model.allocatedLayers === 0
                        ? 'bg-gray-400'
                        : model.allocatedLayers === model.estimatedLayers
                        ? 'bg-green-500'
                        : 'bg-blue-500'
                    }`}
                    style={{
                      width: `${(model.allocatedLayers / model.estimatedLayers) * 100}%`
                    }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-gray-500 dark:text-gray-400">
                    {model.allocatedLayers === 0 ? 'CPU Only' : 
                     model.allocatedLayers === model.estimatedLayers ? 'Full GPU' : 'Hybrid'}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    {Math.round((model.allocatedLayers / model.estimatedLayers) * 100)}% on GPU
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GPU Tips */}
      <div className="bg-amber-50/50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-2">
          💡 Optimization Tips
        </h4>
        <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
          {gpuInfo.gpuType === 'apple_silicon' && (
            <>
              <li>• Apple Silicon uses unified memory - layer allocation is automatically optimized</li>
              <li>• Larger models benefit more from GPU acceleration on Apple Silicon</li>
            </>
          )}
          {gpuInfo.gpuType === 'nvidia' && (
            <>
              <li>• NVIDIA GPUs work best with full layer offloading when memory allows</li>
              <li>• Consider upgrading GPU memory for larger models</li>
            </>
          )}
          {gpuInfo.gpuType === 'integrated' && (
            <>
              <li>• Integrated graphics share system memory - consider adding more RAM</li>
              <li>• Smaller quantized models (Q4, Q5) work better with integrated graphics</li>
            </>
          )}
          {!gpuInfo.hasGPU && (
            <li>• CPU-only mode - consider getting a dedicated GPU for better performance</li>
          )}
          <li>• Restart the model manager after hardware changes to refresh detection</li>
        </ul>
      </div>
    </div>
  );
};

export default GPUDiagnostics; 