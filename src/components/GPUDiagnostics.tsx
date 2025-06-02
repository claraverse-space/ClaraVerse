import React, { useState, useEffect } from 'react';
import { Monitor, Cpu, Zap, AlertCircle, CheckCircle, RefreshCw, BarChart3, HardDrive, Settings, ToggleLeft, ToggleRight, Save, RotateCcw } from 'lucide-react';

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

interface PerformanceSettings {
  flashAttention: boolean;
  autoOptimization: boolean;
  maxContextSize: number;
  aggressiveOptimization: boolean;
  prioritizeSpeed: boolean;
  optimizeFirstToken: boolean;
  threads: number;
  parallelSequences: number;
  optimizeConversations: boolean;
  keepTokens: number;
  defragThreshold: number;
  enableContinuousBatching: boolean;
  conversationMode: string;
}

const GPUDiagnostics: React.FC = () => {
  const [gpuInfo, setGpuInfo] = useState<GPUInfo | null>(null);
  const [modelGPUInfo, setModelGPUInfo] = useState<ModelGPUInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cpuCores, setCpuCores] = useState(4); // Default fallback
  const [performanceSettings, setPerformanceSettings] = useState<PerformanceSettings>({
    flashAttention: true,
    autoOptimization: true,
    maxContextSize: 32768,
    aggressiveOptimization: false,
    prioritizeSpeed: true,
    optimizeFirstToken: false,
    threads: 4,
    parallelSequences: 1,
    optimizeConversations: true,
    keepTokens: 1000,
    defragThreshold: 0.5,
    enableContinuousBatching: true,
    conversationMode: 'balanced'
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingStatus, setSavingStatus] = useState<'idle' | 'saving' | 'regenerating' | 'restarting'>('idle');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

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
        
        // Detect CPU cores for thread configuration
        if (navigator.hardwareConcurrency) {
          setCpuCores(navigator.hardwareConcurrency);
        }
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
    loadPerformanceSettings();
  }, []);

  const loadPerformanceSettings = async () => {
    try {
      const llamaSwap = (window as any).llamaSwap;
      if (llamaSwap?.getPerformanceSettings) {
        const settings = await llamaSwap.getPerformanceSettings();
        if (settings.success) {
          setPerformanceSettings(settings.settings);
        }
      }
    } catch (error) {
      console.error('Error loading performance settings:', error);
    }
  };

  const savePerformanceSettings = async () => {
    setSavingSettings(true);
    setSavingStatus('saving');
    try {
      const llamaSwap = (window as any).llamaSwap;
      if (llamaSwap?.savePerformanceSettings) {
        // First save the performance settings
        const result = await llamaSwap.savePerformanceSettings(performanceSettings);
        if (result.success) {
          console.log('Performance settings saved successfully');
          
          // Then regenerate config to apply the new settings
          setSavingStatus('regenerating');
          console.log('Regenerating config with new performance settings...');
          if (llamaSwap?.regenerateConfig) {
            const configResult = await llamaSwap.regenerateConfig();
            if (configResult.success) {
              console.log(`Config regenerated with ${configResult.models} models`);
              
              // Finally restart the llama server to apply changes
              setSavingStatus('restarting');
              console.log('Restarting llama server to apply new settings...');
              if (llamaSwap?.restart) {
                const restartResult = await llamaSwap.restart();
                if (restartResult.success) {
                  console.log('Llama server restarted successfully');
                  // Refresh GPU diagnostics to show updated configs
                  await fetchGPUDiagnostics();
                } else {
                  console.warn('Settings saved and config updated, but restart failed:', restartResult.error);
                  // Still show success as the settings are saved and config updated
                }
              }
            } else {
              console.warn('Settings saved but config regeneration failed:', configResult.error);
            }
          }
        } else {
          throw new Error(result.error || 'Failed to save settings');
        }
      }
    } catch (error) {
      console.error('Error saving performance settings:', error);
      setError(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setSavingSettings(false);
      setSavingStatus('idle');
    }
  };

  // Reset to optimal defaults based on detected hardware
  const resetToOptimalDefaults = async () => {
    setSavingSettings(true);
    setSavingStatus('saving');
    try {
      // Calculate optimal defaults based on detected hardware
      const optimalSettings = getOptimalDefaultSettings();
      setPerformanceSettings(optimalSettings);
      
      // Auto-save the optimal settings
      const llamaSwap = (window as any).llamaSwap;
      if (llamaSwap?.savePerformanceSettings) {
        const result = await llamaSwap.savePerformanceSettings(optimalSettings);
        if (result.success) {
          console.log('Optimal settings applied successfully');
          
          // Regenerate config and restart server
          setSavingStatus('regenerating');
          if (llamaSwap?.regenerateConfig) {
            const configResult = await llamaSwap.regenerateConfig();
            if (configResult.success && llamaSwap?.restart) {
              setSavingStatus('restarting');
              const restartResult = await llamaSwap.restart();
              if (restartResult.success) {
                console.log('System optimized with optimal settings');
                await fetchGPUDiagnostics();
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error applying optimal defaults:', error);
      setError(error instanceof Error ? error.message : 'Failed to apply optimal settings');
    } finally {
      setSavingSettings(false);
      setSavingStatus('idle');
    }
  };

  // Calculate optimal default settings based on hardware
  const getOptimalDefaultSettings = (): PerformanceSettings => {
    if (!gpuInfo) {
      // Fallback if GPU info not available
      return {
        flashAttention: true,
        autoOptimization: true,
        maxContextSize: 8192,
        aggressiveOptimization: false,
        prioritizeSpeed: false,
        optimizeFirstToken: false,
        threads: Math.max(4, Math.min(8, Math.floor(cpuCores / 2))),
        parallelSequences: 1,
        optimizeConversations: true,
        keepTokens: 1024,
        defragThreshold: 0.1,
        enableContinuousBatching: true,
        conversationMode: 'balanced'
      };
    }

    const optimalThreads = Math.max(4, Math.min(8, Math.floor(cpuCores / 2)));
    
    // GPU-based optimizations
    let optimalParallelSequences = 1;
    let optimalContextSize = 8192;
    let optimalKeepTokens = 1024;
    let aggressiveOpt = false;

    if (gpuInfo.hasGPU) {
      if (gpuInfo.gpuMemoryGB >= 16) {
        // High-end GPU: Enable aggressive optimizations
        optimalParallelSequences = 4;
        optimalContextSize = 16384;
        optimalKeepTokens = 2048;
        aggressiveOpt = true;
      } else if (gpuInfo.gpuMemoryGB >= 8) {
        // Mid-range GPU: Balanced optimizations
        optimalParallelSequences = 2;
        optimalContextSize = 12288;
        optimalKeepTokens = 1536;
      } else {
        // Lower-end GPU: Conservative settings
        optimalContextSize = 8192;
        optimalKeepTokens = 1024;
      }
    } else {
      // CPU-only: Conservative settings optimized for CPU
      optimalContextSize = 4096;
      optimalKeepTokens = 512;
    }

    // Apple Silicon specific optimizations
    if (gpuInfo.gpuType === 'apple_silicon') {
      // Apple Silicon has unified memory, can be more aggressive
      optimalContextSize = Math.min(32768, optimalContextSize * 2);
      optimalKeepTokens = Math.min(2048, optimalKeepTokens * 1.5);
    }

    return {
      flashAttention: true, // Enable by default for modern quantized models
      autoOptimization: true,
      maxContextSize: optimalContextSize,
      aggressiveOptimization: aggressiveOpt,
      prioritizeSpeed: false, // Prefer quality over raw speed by default
      optimizeFirstToken: false, // Prefer conversation mode
      threads: optimalThreads,
      parallelSequences: optimalParallelSequences,
      optimizeConversations: true,
      keepTokens: optimalKeepTokens,
      defragThreshold: 0.1,
      enableContinuousBatching: true,
      conversationMode: 'balanced'
    };
  };

  const updateSetting = (key: keyof PerformanceSettings, value: any) => {
    setPerformanceSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const getOptimizationLevel = () => {
    if (performanceSettings.aggressiveOptimization && performanceSettings.flashAttention) {
      return { level: 'Maximum', color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-50 dark:bg-red-900/20' };
    } else if (performanceSettings.flashAttention && performanceSettings.autoOptimization) {
      return { level: 'High', color: 'text-orange-600 dark:text-orange-400', bgColor: 'bg-orange-50 dark:bg-orange-900/20' };
    } else if (performanceSettings.autoOptimization) {
      return { level: 'Balanced', color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-900/20' };
    } else {
      return { level: 'Conservative', color: 'text-gray-600 dark:text-gray-400', bgColor: 'bg-gray-50 dark:bg-gray-900/20' };
    }
  };

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        {/* CPU Information Card */}
        <div className="p-4 rounded-lg border bg-purple-50/50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-3 mb-2">
            <Cpu className="w-5 h-5 text-purple-500" />
            <h4 className="font-medium text-purple-900 dark:text-purple-100">
              CPU Information
            </h4>
          </div>
          <div className="space-y-1 text-sm text-purple-700 dark:text-purple-300">
            <div className="flex justify-between">
              <span>CPU Cores:</span>
              <span className="font-mono">
                {cpuCores}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Recommended Threads:</span>
              <span className="font-mono">
                {Math.max(1, Math.min(8, Math.floor(cpuCores / 2)))}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Current Setting:</span>
              <span className="font-mono">
                {performanceSettings.threads}
              </span>
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

      {/* Performance Settings */}
      <div className="bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-purple-500" />
            <h4 className="font-medium text-gray-900 dark:text-white">
              Performance Optimization Settings
            </h4>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${getOptimizationLevel().bgColor} ${getOptimizationLevel().color}`}>
            {getOptimizationLevel().level} Performance
          </div>
        </div>

        <div className="space-y-4">
          {/* Flash Attention */}
          <div className="flex items-center justify-between">
            <div>
              <h5 className="font-medium text-gray-900 dark:text-white">Flash Attention</h5>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Advanced attention mechanism for faster processing
              </p>
            </div>
            <button
              onClick={() => setPerformanceSettings(prev => ({ 
                ...prev, 
                flashAttention: !prev.flashAttention 
              }))}
              className="relative inline-flex items-center"
            >
              {performanceSettings.flashAttention ? (
                <ToggleRight className="w-8 h-8 text-green-500" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-gray-400" />
              )}
            </button>
          </div>

          {/* Auto Optimization */}
          <div className="flex items-center justify-between">
            <div>
              <h5 className="font-medium text-gray-900 dark:text-white">Automatic Optimization</h5>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Automatically configure optimal settings for each model and hardware
              </p>
            </div>
            <button
              onClick={() => updateSetting('autoOptimization', !performanceSettings.autoOptimization)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                performanceSettings.autoOptimization 
                  ? 'bg-blue-500' 
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  performanceSettings.autoOptimization ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Speed Priority */}
          <div className="flex items-center justify-between">
            <div>
              <h5 className="font-medium text-gray-900 dark:text-white">Prioritize Speed</h5>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Optimize for maximum inference speed over memory efficiency
              </p>
            </div>
            <button
              onClick={() => updateSetting('prioritizeSpeed', !performanceSettings.prioritizeSpeed)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                performanceSettings.prioritizeSpeed 
                  ? 'bg-orange-500' 
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  performanceSettings.prioritizeSpeed ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Time to First Token Optimization */}
          <div className="flex items-center justify-between">
            <div>
              <h5 className="font-medium text-gray-900 dark:text-white">Optimize First Token</h5>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Prioritize speed of first response over overall throughput
              </p>
            </div>
            <button
              onClick={() => setPerformanceSettings(prev => ({ 
                ...prev, 
                optimizeFirstToken: !prev.optimizeFirstToken 
              }))}
              className="relative inline-flex items-center"
            >
              {performanceSettings.optimizeFirstToken ? (
                <ToggleRight className="w-8 h-8 text-blue-500" />
              ) : (
                <ToggleLeft className="w-8 h-8 text-gray-400" />
              )}
            </button>
          </div>

          {/* Conversation Optimization */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h5 className="font-medium text-green-900 dark:text-green-100 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Optimize Conversations
                </h5>
                <p className="text-xs text-green-700 dark:text-green-300">
                  Eliminate context reprocessing for faster subsequent responses
                </p>
              </div>
              <button
                onClick={() => setPerformanceSettings(prev => ({ 
                  ...prev, 
                  optimizeConversations: !prev.optimizeConversations 
                }))}
                className="relative inline-flex items-center"
              >
                {performanceSettings.optimizeConversations ? (
                  <ToggleRight className="w-8 h-8 text-green-500" />
                ) : (
                  <ToggleLeft className="w-8 h-8 text-gray-400" />
                )}
              </button>
            </div>

            {performanceSettings.optimizeConversations && (
              <div className="space-y-3 mt-3 pt-3 border-t border-green-200 dark:border-green-700">
                {/* Conversation Mode Selector */}
                <div>
                  <h6 className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">Conversation Mode</h6>
                  <div className="grid grid-cols-3 gap-2">
                    {(['speed', 'balanced', 'memory'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => updateSetting('conversationMode', mode)}
                        className={`px-3 py-2 text-xs rounded-lg font-medium transition-colors ${
                          performanceSettings.conversationMode === mode
                            ? 'bg-green-500 text-white'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-800'
                        }`}
                      >
                        {mode === 'speed' && '⚡ Speed'}
                        {mode === 'balanced' && '⚖️ Balanced'}
                        {mode === 'memory' && '💾 Memory'}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    {performanceSettings.conversationMode === 'speed' && 'Maximum cache retention, fastest responses'}
                    {performanceSettings.conversationMode === 'balanced' && 'Optimized balance of speed and memory usage'}
                    {performanceSettings.conversationMode === 'memory' && 'Conservative memory use, moderate speed gain'}
                  </p>
                </div>

                {/* Keep Tokens Slider */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h6 className="text-sm font-medium text-green-900 dark:text-green-100">Cache Retention</h6>
                    <span className="text-xs text-green-700 dark:text-green-300 font-mono">
                      {performanceSettings.keepTokens} tokens
                    </span>
                  </div>
                  <input
                    type="range"
                    min="256"
                    max="2048"
                    step="128"
                    value={performanceSettings.keepTokens}
                    onChange={(e) => updateSetting('keepTokens', parseInt(e.target.value))}
                    className="w-full h-2 bg-green-200 dark:bg-green-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-green-600 dark:text-green-400 mt-1">
                    <span>256 (minimal)</span>
                    <span>1024 (optimal)</span>
                    <span>2048 (maximum)</span>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    Higher values = faster responses but more memory usage
                  </p>
                </div>

                {/* Continuous Batching */}
                <div className="flex items-center justify-between">
                  <div>
                    <h6 className="text-sm font-medium text-green-900 dark:text-green-100">Continuous Batching</h6>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      Process multiple conversation turns efficiently
                    </p>
                  </div>
                  <button
                    onClick={() => updateSetting('enableContinuousBatching', !performanceSettings.enableContinuousBatching)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      performanceSettings.enableContinuousBatching 
                        ? 'bg-green-500' 
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                        performanceSettings.enableContinuousBatching ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Performance Impact Indicator */}
                <div className="bg-white/60 dark:bg-gray-700/60 rounded p-2">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-2 h-2 rounded-full ${
                      performanceSettings.conversationMode === 'speed' ? 'bg-red-400' :
                      performanceSettings.conversationMode === 'balanced' ? 'bg-yellow-400' :
                      'bg-green-400'
                    }`} />
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Performance Impact: {
                        performanceSettings.conversationMode === 'speed' ? 'High Memory' :
                        performanceSettings.conversationMode === 'balanced' ? 'Moderate' :
                        'Low Memory'
                      }
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Expected improvement: {
                      performanceSettings.conversationMode === 'speed' ? '70-90%' :
                      performanceSettings.conversationMode === 'balanced' ? '50-70%' :
                      '30-50%'
                    } faster subsequent responses
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Advanced Settings Toggle */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
            >
              <Settings className="w-4 h-4" />
              {showAdvancedSettings ? 'Hide' : 'Show'} Advanced Settings
            </button>
          </div>

          {/* Advanced Settings */}
          {showAdvancedSettings && (
            <div className="space-y-4 pt-2 border-t border-gray-200 dark:border-gray-700">
              {/* Aggressive Optimization */}
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="font-medium text-gray-900 dark:text-white">Aggressive Optimization</h5>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Use maximum performance settings (may use more memory)
                  </p>
                </div>
                <button
                  onClick={() => updateSetting('aggressiveOptimization', !performanceSettings.aggressiveOptimization)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    performanceSettings.aggressiveOptimization 
                      ? 'bg-red-500' 
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      performanceSettings.aggressiveOptimization ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Max Context Size */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium text-gray-900 dark:text-white">Maximum Context Size</h5>
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                    {performanceSettings.maxContextSize.toLocaleString()} tokens
                  </span>
                </div>
                <input
                  type="range"
                  min="2048"
                  max="131072"
                  step="2048"
                  value={performanceSettings.maxContextSize}
                  onChange={(e) => updateSetting('maxContextSize', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>2K</span>
                  <span>32K</span>
                  <span>131K</span>
                </div>
              </div>

              {/* Threads */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h5 className="font-medium text-gray-900 dark:text-white">CPU Threads</h5>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      Available CPU cores: {cpuCores} • Recommended: {Math.max(1, Math.min(8, Math.floor(cpuCores / 2)))}
                    </p>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                    {performanceSettings.threads}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max={Math.min(16, cpuCores)}
                  step="1"
                  value={performanceSettings.threads}
                  onChange={(e) => updateSetting('threads', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>1</span>
                  <span>{Math.min(16, cpuCores)}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Higher values may improve CPU performance but can cause system lag
                </p>
                {performanceSettings.threads > cpuCores && (
                  <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-700 dark:text-amber-300">
                    ⚠️ Using more threads than CPU cores ({cpuCores}) may reduce performance
                  </div>
                )}
              </div>

              {/* Parallel Sequences */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h5 className="font-medium text-gray-900 dark:text-white">Parallel Sequences</h5>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      GPU Memory: {gpuInfo?.gpuMemoryGB?.toFixed(1) || 'Unknown'} GB • Recommended: {gpuInfo && gpuInfo.gpuMemoryGB >= 8 ? (gpuInfo.gpuMemoryGB >= 16 ? '4' : '2') : '1'}
                    </p>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400 font-mono">
                    {performanceSettings.parallelSequences}
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max={gpuInfo && gpuInfo.gpuMemoryGB >= 16 ? 8 : gpuInfo && gpuInfo.gpuMemoryGB >= 8 ? 4 : 2}
                  step="1"
                  value={performanceSettings.parallelSequences}
                  onChange={(e) => updateSetting('parallelSequences', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>1</span>
                  <span>{gpuInfo && gpuInfo.gpuMemoryGB >= 16 ? 8 : gpuInfo && gpuInfo.gpuMemoryGB >= 8 ? 4 : 2}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Higher values enable concurrent requests but use more GPU memory
                </p>
                {gpuInfo && performanceSettings.parallelSequences > (gpuInfo.gpuMemoryGB >= 8 ? (gpuInfo.gpuMemoryGB >= 16 ? 4 : 2) : 1) && (
                  <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-700 dark:text-amber-300">
                    ⚠️ High parallel sequences may cause out-of-memory errors with {gpuInfo.gpuMemoryGB.toFixed(1)}GB GPU memory
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
            {/* Reset to Optimal Defaults Button */}
            <button
              onClick={resetToOptimalDefaults}
              disabled={savingSettings}
              className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {savingSettings ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {savingStatus === 'saving' && 'Optimizing System...'}
                  {savingStatus === 'regenerating' && 'Updating Config...'}
                  {savingStatus === 'restarting' && 'Restarting Server...'}
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4" />
                  Reset to Optimal Defaults
                </>
              )}
            </button>

            {/* Apply Custom Settings Button */}
            <button
              onClick={savePerformanceSettings}
              disabled={savingSettings}
              className="w-full px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {savingSettings ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {savingStatus === 'saving' && 'Saving Settings...'}
                  {savingStatus === 'regenerating' && 'Updating Config...'}
                  {savingStatus === 'restarting' && 'Restarting Server...'}
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Apply Performance Settings
                </>
              )}
            </button>
            
            <div className="bg-blue-50/50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-xs text-blue-700 dark:text-blue-300 text-center">
                <strong>⚡ Live Configuration:</strong> Settings are applied immediately with automatic config regeneration and server restart.
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 text-center mt-1">
                "Reset to Optimal Defaults" automatically configures Clara for best performance based on your hardware.
              </p>
            </div>
          </div>
        </div>
      </div>

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