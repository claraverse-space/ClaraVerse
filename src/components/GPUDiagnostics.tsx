import React, { useState, useEffect } from 'react';
import { Monitor, Cpu, Zap, AlertCircle, CheckCircle, RefreshCw, BarChart3, HardDrive, Settings, ToggleLeft, ToggleRight, Save, RotateCcw, Info } from 'lucide-react';

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
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
          <div className="text-center">
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Looking at your computer...</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">Checking what kind of brain (GPU/CPU) you have!</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto bg-white dark:bg-gray-800 border border-red-200 dark:border-red-700 rounded-xl p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
              Oops! Something went wrong
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              We couldn't check your computer's capabilities. This usually means the system is still starting up.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mb-4 font-mono bg-gray-50 dark:bg-gray-700 p-2 rounded">
              {error}
            </p>
            <button
              onClick={fetchGPUDiagnostics}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!gpuInfo) {
    return (
      <div className="text-center py-8">
        <div className="max-w-md mx-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
          <Monitor className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">No Information Available</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            We couldn't find information about your computer's capabilities right now.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Your Computer's Performance Center
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Let's see what your computer can do and make it work better! 🚀
        </p>
      </div>

      {/* System Information Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* GPU Status Card */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            {gpuInfo.hasGPU ? (
              <CheckCircle className="w-6 h-6 text-green-500" />
            ) : (
              <Cpu className="w-6 h-6 text-blue-500" />
            )}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Your Graphics Power</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">What makes things look pretty and fast</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {getGPUTypeIcon(gpuInfo.gpuType)}
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {getGPUTypeName(gpuInfo.gpuType)}
              </span>
            </div>
            
            <div className={`p-3 rounded-lg text-sm ${
              gpuInfo.hasGPU 
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' 
                : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
            }`}>
              {gpuInfo.hasGPU ? (
                <span>✨ You have special graphics power! This makes AI much faster.</span>
              ) : (
                <span>🧠 Using your main processor. Still works great, just a bit slower.</span>
              )}
            </div>
          </div>
        </div>

        {/* Memory Information Card */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <HardDrive className="w-6 h-6 text-purple-500" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Memory Space</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">How much stuff your computer can remember</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Graphics Memory:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {gpuInfo.gpuMemoryGB.toFixed(1)} GB
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">System Memory:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {gpuInfo.systemMemoryGB} GB
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Platform:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {getPlatformName(gpuInfo.platform)}
              </span>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-xs text-gray-600 dark:text-gray-400">
              💡 More memory = bigger AI models can fit and work faster!
            </div>
          </div>
        </div>

        {/* CPU Information Card */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Cpu className="w-6 h-6 text-orange-500" />
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Processor Power</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Your computer's main thinking brain</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">CPU Cores:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {cpuCores}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Best Threads:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {Math.max(1, Math.min(8, Math.floor(cpuCores / 2)))}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600 dark:text-gray-400">Current Setting:</span>
              <span className={`font-semibold ${
                performanceSettings.threads === Math.max(1, Math.min(8, Math.floor(cpuCores / 2)))
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-orange-600 dark:text-orange-400'
              }`}>
                {performanceSettings.threads}
              </span>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg text-xs text-gray-600 dark:text-gray-400">
              🧵 Threads are like having multiple workers doing the job at the same time!
            </div>
          </div>
        </div>
      </div>

      {/* Model GPU Allocation */}
      {modelGPUInfo.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">AI Models and Your Graphics Power</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">See how much of each AI model fits on your graphics card</p>
            </div>
            <button
              onClick={fetchGPUDiagnostics}
              className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>

          <div className="space-y-4">
            {modelGPUInfo.map((model, index) => (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {model.name}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {model.estimatedParams} parameters • {model.sizeGB.toFixed(1)} GB size
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900 dark:text-white">
                      {model.allocatedLayers} / {model.estimatedLayers}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      layers on GPU
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${
                      model.allocatedLayers === 0
                        ? 'bg-gray-400'
                        : model.allocatedLayers === model.estimatedLayers
                        ? 'bg-green-500'
                        : 'bg-blue-500'
                    }`}
                    style={{
                      width: `${Math.max(5, (model.allocatedLayers / model.estimatedLayers) * 100)}%`
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                    model.allocatedLayers === 0
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      : model.allocatedLayers === model.estimatedLayers
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                  }`}>
                    {model.allocatedLayers === 0 ? '🧠 CPU Only' : 
                     model.allocatedLayers === model.estimatedLayers ? '⚡ Full GPU Power' : '🤝 CPU + GPU Team'}
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {Math.round((model.allocatedLayers / model.estimatedLayers) * 100)}% on graphics
                  </span>
                </div>

                <div className="mt-3 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {model.allocatedLayers === 0 && '🐌 This model runs on your main processor. It works but might be slower.'}
                    {model.allocatedLayers > 0 && model.allocatedLayers < model.estimatedLayers && 
                     '⚡ This model uses both your graphics card and processor working together!'}
                    {model.allocatedLayers === model.estimatedLayers && 
                     '🚀 This model runs entirely on your graphics card for maximum speed!'}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">What does this mean?</h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  AI models are made of "layers" - think of them like floors in a building. The more floors (layers) 
                  we can fit on your graphics card, the faster the AI will respond to you!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Performance Settings */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 shadow-sm">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-6 h-6 text-blue-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Make Your AI Faster
            </h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            These settings help your computer run AI models better. Don't worry - we'll explain everything! 😊
          </p>
          
          <div className={`mt-4 px-4 py-2 rounded-lg ${getOptimizationLevel().bgColor}`}>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                getOptimizationLevel().level === 'Maximum' ? 'bg-red-500' :
                getOptimizationLevel().level === 'High' ? 'bg-orange-500' :
                getOptimizationLevel().level === 'Balanced' ? 'bg-blue-500' :
                'bg-gray-500'
              }`} />
              <span className={`font-medium ${getOptimizationLevel().color}`}>
                Current Mode: {getOptimizationLevel().level} Performance
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Flash Attention */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-white mb-1">Flash Attention ⚡</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  A special way to help AI think faster and use less memory
                </p>
              </div>
              <button
                onClick={() => setPerformanceSettings(prev => ({ 
                  ...prev, 
                  flashAttention: !prev.flashAttention 
                }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  performanceSettings.flashAttention 
                    ? 'bg-blue-500' 
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    performanceSettings.flashAttention ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div className="space-y-3">
              <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  {performanceSettings.flashAttention 
                    ? '✅ ON: Your AI will think faster and use memory more efficiently!'
                    : '❌ OFF: AI will work normally but might be slower and use more memory.'
                  }
                </p>
              </div>
              
              {/* Pros and Cons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                  <h5 className="text-xs font-semibold text-green-800 dark:text-green-200 mb-1">✅ Good Things:</h5>
                  <ul className="text-xs text-green-700 dark:text-green-300 space-y-1">
                    <li>• 30-50% faster processing</li>
                    <li>• Uses less memory</li>
                    <li>• Works great with modern models</li>
                    <li>• Better for long conversations</li>
                  </ul>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  <h5 className="text-xs font-semibold text-red-800 dark:text-red-200 mb-1">⚠️ Watch Out:</h5>
                  <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
                    <li>• Might crash with older AI models</li>
                    <li>• Can cause "compatibility errors"</li>
                    <li>• Not all models support it yet</li>
                    <li>• If AI stops working, turn this OFF</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Auto Optimization */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-white mb-1">Smart Auto-Tuning 🧠</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Let your computer automatically figure out the best settings for each AI model
                </p>
              </div>
              <button
                onClick={() => updateSetting('autoOptimization', !performanceSettings.autoOptimization)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  performanceSettings.autoOptimization 
                    ? 'bg-green-500' 
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
            <div className="space-y-3">
              <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {performanceSettings.autoOptimization 
                    ? '✅ ON: Your computer will automatically adjust settings for the best performance with each AI model!'
                    : '❌ OFF: You have full control over all settings, but need to adjust them manually.'
                  }
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                  <h5 className="text-xs font-semibold text-green-800 dark:text-green-200 mb-1">✅ Good Things:</h5>
                  <ul className="text-xs text-green-700 dark:text-green-300 space-y-1">
                    <li>• Perfect for beginners</li>
                    <li>• Saves time configuring</li>
                    <li>• Usually picks safe settings</li>
                    <li>• Adapts to each model automatically</li>
                  </ul>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                  <h5 className="text-xs font-semibold text-yellow-800 dark:text-yellow-200 mb-1">⚠️ Keep in Mind:</h5>
                  <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                    <li>• Might not be the absolute fastest</li>
                    <li>• Less control over specific settings</li>
                    <li>• Computer decides, not you</li>
                    <li>• May be conservative for safety</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Speed Priority */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-white mb-1">Prioritize Speed 🏎️</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Make AI respond as fast as possible, even if it uses more memory
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
            <div className="space-y-3">
              <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {performanceSettings.prioritizeSpeed 
                    ? '🏎️ ON: Maximum speed mode! AI will respond as fast as possible.'
                    : '⚖️ OFF: Balanced mode - good speed while being careful with memory.'
                  }
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                  <h5 className="text-xs font-semibold text-green-800 dark:text-green-200 mb-1">✅ Good Things:</h5>
                  <ul className="text-xs text-green-700 dark:text-green-300 space-y-1">
                    <li>• Much faster responses</li>
                    <li>• Great for quick questions</li>
                    <li>• Less waiting time</li>
                    <li>• Feels more responsive</li>
                  </ul>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  <h5 className="text-xs font-semibold text-red-800 dark:text-red-200 mb-1">⚠️ Watch Out:</h5>
                  <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
                    <li>• Uses much more memory</li>
                    <li>• Might make computer slower</li>
                    <li>• Can cause "out of memory" crashes</li>
                    <li>• May overheat your computer</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Optimize First Token */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-white mb-1">Optimize First Response ⚡</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Make the very first word appear super fast (but rest might be slower)
                </p>
              </div>
              <button
                onClick={() => setPerformanceSettings(prev => ({ 
                  ...prev, 
                  optimizeFirstToken: !prev.optimizeFirstToken 
                }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  performanceSettings.optimizeFirstToken 
                    ? 'bg-blue-500' 
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    performanceSettings.optimizeFirstToken ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div className="space-y-3">
              <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {performanceSettings.optimizeFirstToken 
                    ? '⚡ ON: First word appears instantly, but overall response might be slower.'
                    : '🔄 OFF: Consistent speed throughout the entire response.'
                  }
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                  <h5 className="text-xs font-semibold text-green-800 dark:text-green-200 mb-1">✅ Good Things:</h5>
                  <ul className="text-xs text-green-700 dark:text-green-300 space-y-1">
                    <li>• AI starts responding immediately</li>
                    <li>• Feels super responsive</li>
                    <li>• Good for showing AI is "thinking"</li>
                    <li>• Less waiting for first word</li>
                  </ul>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                  <h5 className="text-xs font-semibold text-yellow-800 dark:text-yellow-200 mb-1">⚠️ Trade-offs:</h5>
                  <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                    <li>• Rest of response might be slower</li>
                    <li>• Total time could be longer</li>
                    <li>• Quality might be slightly lower</li>
                    <li>• Uses more processing power</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Conversation Optimization */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900 dark:text-white mb-1">Optimize Conversations 💬</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Remember conversation context to make follow-up responses much faster
                </p>
              </div>
              <button
                onClick={() => setPerformanceSettings(prev => ({ 
                  ...prev, 
                  optimizeConversations: !prev.optimizeConversations 
                }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  performanceSettings.optimizeConversations 
                    ? 'bg-green-500' 
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    performanceSettings.optimizeConversations ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div className="space-y-3">
              <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  {performanceSettings.optimizeConversations 
                    ? '🚀 ON: After the first message, follow-ups will be lightning fast!'
                    : '🐌 OFF: Every message takes the same time (AI "forgets" between messages).'
                  }
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                  <h5 className="text-xs font-semibold text-green-800 dark:text-green-200 mb-1">✅ Amazing Benefits:</h5>
                  <ul className="text-xs text-green-700 dark:text-green-300 space-y-1">
                    <li>• 50-90% faster follow-up responses</li>
                    <li>• Perfect for long conversations</li>
                    <li>• AI remembers what you talked about</li>
                    <li>• Biggest performance boost you'll notice!</li>
                  </ul>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  <h5 className="text-xs font-semibold text-red-800 dark:text-red-200 mb-1">⚠️ Big Warning:</h5>
                  <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
                    <li>• Can use A LOT of memory</li>
                    <li>• Might crash with "out of memory"</li>
                    <li>• Long conversations = more memory used</li>
                    <li>• If crashes happen, turn this OFF</li>
                  </ul>
                </div>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  💡 <strong>Learning Tip:</strong> This is like keeping a conversation "warm" in memory. 
                  The AI doesn't have to re-read everything from the beginning each time, but it uses more "brain space" to remember!
                </p>
              </div>
            </div>
          </div>

          {/* Conversation Optimization Details */}
          {performanceSettings.optimizeConversations && (
            <div className="border border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-5 h-5 text-green-600" />
                <h4 className="font-semibold text-green-900 dark:text-green-100">Conversation Super Speed Settings 🚀</h4>
              </div>
              
              <div className="space-y-4">
                {/* Conversation Mode Selector */}
                <div>
                  <h5 className="font-medium text-green-900 dark:text-green-100 mb-2">How fast should conversations be?</h5>
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    {(['speed', 'balanced', 'memory'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => updateSetting('conversationMode', mode)}
                        className={`px-3 py-2 text-sm rounded-lg font-medium transition-colors ${
                          performanceSettings.conversationMode === mode
                            ? 'bg-green-600 text-white shadow-md'
                            : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-800 border border-gray-200 dark:border-gray-600'
                        }`}
                      >
                        {mode === 'speed' && '⚡ Super Fast'}
                        {mode === 'balanced' && '⚖️ Just Right'}
                        {mode === 'memory' && '💾 Save Memory'}
                      </button>
                    ))}
                  </div>
                  
                  {/* Mode-specific explanations with pros/cons */}
                  <div className="space-y-3">
                    {performanceSettings.conversationMode === 'speed' && (
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                        <h6 className="font-medium text-green-800 dark:text-green-200 mb-2">🏎️ Super Fast Mode</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded">
                            <h6 className="text-xs font-semibold text-green-800 dark:text-green-200 mb-1">✅ You Get:</h6>
                            <ul className="text-xs text-green-700 dark:text-green-300 space-y-1">
                              <li>• 70-90% faster responses</li>
                              <li>• Instant follow-up answers</li>
                              <li>• Smooth conversation flow</li>
                              <li>• Best for quick back-and-forth</li>
                            </ul>
                          </div>
                          <div className="bg-red-50 dark:bg-red-900/30 p-3 rounded">
                            <h6 className="text-xs font-semibold text-red-800 dark:text-red-200 mb-1">⚠️ But Watch Out:</h6>
                            <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
                              <li>• Uses 2-3x more memory</li>
                              <li>• Might crash after long chats</li>
                              <li>• Can slow down other apps</li>
                              <li>• Not good for weak computers</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {performanceSettings.conversationMode === 'balanced' && (
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                        <h6 className="font-medium text-blue-800 dark:text-blue-200 mb-2">⚖️ Just Right Mode (Recommended)</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded">
                            <h6 className="text-xs font-semibold text-green-800 dark:text-green-200 mb-1">✅ Perfect Balance:</h6>
                            <ul className="text-xs text-green-700 dark:text-green-300 space-y-1">
                              <li>• 50-70% faster responses</li>
                              <li>• Safe memory usage</li>
                              <li>• Works on most computers</li>
                              <li>• Rarely crashes</li>
                            </ul>
                          </div>
                          <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded">
                            <h6 className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-1">📝 Good to Know:</h6>
                            <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                              <li>• Not the absolute fastest</li>
                              <li>• Still uses extra memory</li>
                              <li>• Best choice for most people</li>
                              <li>• Great starting point</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {performanceSettings.conversationMode === 'memory' && (
                      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                        <h6 className="font-medium text-purple-800 dark:text-purple-200 mb-2">💾 Save Memory Mode</h6>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded">
                            <h6 className="text-xs font-semibold text-green-800 dark:text-green-200 mb-1">✅ Safe Choice:</h6>
                            <ul className="text-xs text-green-700 dark:text-green-300 space-y-1">
                              <li>• 30-50% faster (still good!)</li>
                              <li>• Very safe memory usage</li>
                              <li>• Won't slow other apps</li>
                              <li>• Perfect for older computers</li>
                            </ul>
                          </div>
                          <div className="bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded">
                            <h6 className="text-xs font-semibold text-yellow-800 dark:text-yellow-200 mb-1">📋 Trade-off:</h6>
                            <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                              <li>• Not as dramatically fast</li>
                              <li>• Still faster than no optimization</li>
                              <li>• More conservative approach</li>
                              <li>• Good if you multitask a lot</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Keep Tokens Slider */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-green-900 dark:text-green-100">How much conversation to remember?</h5>
                    <span className="text-sm font-mono bg-white dark:bg-gray-800 px-2 py-1 rounded text-green-700 dark:text-green-300">
                      {performanceSettings.keepTokens} words
                    </span>
                  </div>
                  <input
                    type="range"
                    min="256"
                    max="2048"
                    step="128"
                    value={performanceSettings.keepTokens}
                    onChange={(e) => updateSetting('keepTokens', parseInt(e.target.value))}
                    className="w-full h-3 bg-green-200 dark:bg-green-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-green-600 dark:text-green-400 mt-1">
                    <span>256 (small)</span>
                    <span>1024 (perfect)</span>
                    <span>2048 (lots)</span>
                  </div>
                  
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg">
                      <h6 className="text-xs font-semibold text-green-800 dark:text-green-200 mb-1">✅ More Memory =</h6>
                      <ul className="text-xs text-green-700 dark:text-green-300 space-y-1">
                        <li>• Faster follow-up questions</li>
                        <li>• AI remembers more context</li>
                        <li>• Better for long discussions</li>
                        <li>• Can reference earlier topics</li>
                      </ul>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/30 p-3 rounded-lg">
                      <h6 className="text-xs font-semibold text-red-800 dark:text-red-200 mb-1">⚠️ Too Much =</h6>
                      <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
                        <li>• Computer runs out of memory</li>
                        <li>• Sudden crashes mid-conversation</li>
                        <li>• Other apps become slow</li>
                        <li>• System might freeze</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="mt-2 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      💡 <strong>Sweet Spot:</strong> 1024 words is perfect for most people. It's like giving your AI a good notebook to remember your conversation, 
                      but not so big that it fills up your computer's memory!
                    </p>
                  </div>
                </div>

                {/* Continuous Batching */}
                <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex-1">
                      <h5 className="font-medium text-green-900 dark:text-green-100 mb-1">Smart Conversation Processing 🤖</h5>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        Let your computer handle multiple conversation parts efficiently
                      </p>
                    </div>
                    <button
                      onClick={() => updateSetting('enableContinuousBatching', !performanceSettings.enableContinuousBatching)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        performanceSettings.enableContinuousBatching 
                          ? 'bg-green-500' 
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          performanceSettings.enableContinuousBatching ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-green-50 dark:bg-green-900/30 p-3 rounded-lg">
                      <h6 className="text-xs font-semibold text-green-800 dark:text-green-200 mb-1">✅ When ON:</h6>
                      <ul className="text-xs text-green-700 dark:text-green-300 space-y-1">
                        <li>• Processes conversation chunks together</li>
                        <li>• More efficient use of AI brain</li>
                        <li>• Smoother conversation flow</li>
                        <li>• Works well with other optimizations</li>
                      </ul>
                    </div>
                    <div className="bg-yellow-50 dark:bg-yellow-900/30 p-3 rounded-lg">
                      <h6 className="text-xs font-semibold text-yellow-800 dark:text-yellow-200 mb-1">📝 When OFF:</h6>
                      <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1">
                        <li>• Processes each part separately</li>
                        <li>• More predictable behavior</li>
                        <li>• Easier to debug problems</li>
                        <li>• Slightly less efficient</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Performance Impact Indicator */}
                <div className="bg-gradient-to-r from-white to-green-50 dark:from-gray-800 dark:to-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-3 h-3 rounded-full ${
                      performanceSettings.conversationMode === 'speed' ? 'bg-orange-400' :
                      performanceSettings.conversationMode === 'balanced' ? 'bg-green-400' :
                      'bg-blue-400'
                    }`} />
                    <span className="font-medium text-gray-800 dark:text-gray-200">
                      Expected Speed Boost: {
                        performanceSettings.conversationMode === 'speed' ? '70-90%' :
                        performanceSettings.conversationMode === 'balanced' ? '50-70%' :
                        '30-50%'
                      } faster!
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    After the first message, follow-up responses in the same conversation will be much faster because 
                    your AI won't need to "re-read" the whole conversation every time! 🏃‍♂️💨
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Advanced Settings Toggle */}
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              className="flex items-center gap-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium"
            >
              <Settings className="w-5 h-5" />
              {showAdvancedSettings ? 'Hide' : 'Show'} Advanced Settings (For Experts) 🔧
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              These are more technical settings. Only change if you know what you're doing!
            </p>
          </div>

          {/* Advanced Settings */}
          {showAdvancedSettings && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-6 space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-5 h-5 text-purple-600" />
                <h4 className="font-semibold text-purple-900 dark:text-purple-100">Expert Settings</h4>
              </div>

              {/* Aggressive Optimization */}
              <div className="border border-purple-200 dark:border-purple-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900 dark:text-white mb-1">Maximum Power Mode 🚀</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Use every trick to make AI super fast (DANGER: High crash risk!)
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
                <div className="space-y-3">
                  <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {performanceSettings.aggressiveOptimization 
                        ? '🚨 ON: MAXIMUM POWER! Your computer will work extremely hard.'
                        : '✅ OFF: Normal performance settings. Safer for your computer.'
                      }
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                      <h5 className="text-xs font-semibold text-green-800 dark:text-green-200 mb-1">🚀 Incredible Speed:</h5>
                      <ul className="text-xs text-green-700 dark:text-green-300 space-y-1">
                        <li>• Absolutely fastest possible performance</li>
                        <li>• Uses all available tricks and hacks</li>
                        <li>• Perfect for powerful gaming computers</li>
                        <li>• Amazing if it works!</li>
                      </ul>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                      <h5 className="text-xs font-semibold text-red-800 dark:text-red-200 mb-1">💥 SERIOUS RISKS:</h5>
                      <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
                        <li>• High chance of sudden crashes</li>
                        <li>• Might freeze your entire computer</li>
                        <li>• Can overheat and damage hardware</li>
                        <li>• Makes other apps unusable</li>
                      </ul>
                    </div>
                  </div>
                  
                  <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 p-3 rounded-lg">
                    <p className="text-xs text-red-800 dark:text-red-200">
                      ⚠️ <strong>Only for Experts:</strong> Turn this on only if you have a powerful computer and know how to fix problems. 
                      If weird things happen, turn this OFF immediately!
                    </p>
                  </div>
                </div>
              </div>

              {/* Max Context Size */}
              <div className="border border-purple-200 dark:border-purple-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-gray-900 dark:text-white">Maximum Memory for Conversations 🧠</h5>
                    <span className="text-sm font-mono bg-purple-100 dark:bg-purple-900/50 px-2 py-1 rounded text-purple-700 dark:text-purple-300">
                      {performanceSettings.maxContextSize.toLocaleString()} words
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    How much conversation history your AI can remember at once
                  </p>
                  <input
                    type="range"
                    min="2048"
                    max="131072"
                    step="2048"
                    value={performanceSettings.maxContextSize}
                    onChange={(e) => updateSetting('maxContextSize', parseInt(e.target.value))}
                    className="w-full h-3 bg-purple-200 dark:bg-purple-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-purple-600 dark:text-purple-400 mt-1">
                    <span>2K (short)</span>
                    <span>32K (good)</span>
                    <span>131K (huge!)</span>
                  </div>
                  
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                        <h6 className="text-xs font-semibold text-green-800 dark:text-green-200 mb-1">✅ More Context =</h6>
                        <ul className="text-xs text-green-700 dark:text-green-300 space-y-1">
                          <li>• AI remembers much longer conversations</li>
                          <li>• Can discuss complex topics in detail</li>
                          <li>• Perfect for research and long chats</li>
                          <li>• AI understands full context better</li>
                        </ul>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                        <h6 className="text-xs font-semibold text-red-800 dark:text-red-200 mb-1">⚠️ Too Much =</h6>
                        <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
                          <li>• Massive memory usage</li>
                          <li>• "Out of memory" crashes</li>
                          <li>• Very slow responses</li>
                          <li>• Computer becomes unusable</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        💡 <strong>Learning Tip:</strong> Think of this like how many pages of a book your AI can remember at once. 
                        More pages = better understanding but uses more "brain space". Most people need 8K-32K words (like a short essay).
                      </p>
                    </div>
                    
                    {performanceSettings.maxContextSize > 65536 && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 p-3 rounded-lg">
                        <p className="text-xs text-amber-800 dark:text-amber-200">
                          ⚠️ <strong>Warning:</strong> You're using a huge context size! This might crash on computers with less than 16GB RAM.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* CPU Threads */}
              <div className="border border-purple-200 dark:border-purple-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900 dark:text-white">CPU Workers (Threads) 🧵</h5>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        How many workers your processor uses at the same time
                      </p>
                    </div>
                    <span className="text-lg font-bold text-purple-700 dark:text-purple-300">
                      {performanceSettings.threads}
                    </span>
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-3">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      👨‍💼 Your CPU has {cpuCores} cores. We recommend {Math.max(1, Math.min(8, Math.floor(cpuCores / 2)))} threads.
                      {performanceSettings.threads > cpuCores && (
                        <span className="text-orange-600 dark:text-orange-400 block mt-1">
                          ⚠️ You're using more threads than CPU cores - this might slow things down!
                        </span>
                      )}
                    </p>
                  </div>
                  
                  <input
                    type="range"
                    min="1"
                    max={Math.min(16, cpuCores)}
                    step="1"
                    value={performanceSettings.threads}
                    onChange={(e) => updateSetting('threads', parseInt(e.target.value))}
                    className="w-full h-3 bg-purple-200 dark:bg-purple-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-purple-600 dark:text-purple-400 mt-1">
                    <span>1 (slow)</span>
                    <span>{Math.max(1, Math.min(8, Math.floor(cpuCores / 2)))} (recommended)</span>
                    <span>{Math.min(16, cpuCores)} (max)</span>
                  </div>
                  
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                        <h6 className="text-xs font-semibold text-green-800 dark:text-green-200 mb-1">✅ More Threads =</h6>
                        <ul className="text-xs text-green-700 dark:text-green-300 space-y-1">
                          <li>• Faster AI processing</li>
                          <li>• Better use of your CPU power</li>
                          <li>• Good for multi-core processors</li>
                          <li>• Can handle bigger models better</li>
                        </ul>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                        <h6 className="text-xs font-semibold text-red-800 dark:text-red-200 mb-1">⚠️ Too Many =</h6>
                        <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
                          <li>• Other apps become very slow</li>
                          <li>• Computer might freeze or lag</li>
                          <li>• CPU gets very hot</li>
                          <li>• Actually slower due to fighting</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        🏭 <strong>Factory Analogy:</strong> Imagine threads as workers in a factory. If you have 8 machines but hire 16 workers, 
                        they'll bump into each other and work slower! The sweet spot is usually half your CPU cores.
                      </p>
                    </div>
                    
                    {performanceSettings.threads > Math.max(1, Math.min(8, Math.floor(cpuCores * 0.75))) && (
                      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700 p-3 rounded-lg">
                        <p className="text-xs text-orange-800 dark:text-orange-200">
                          ⚠️ <strong>High Thread Warning:</strong> You're using a lot of threads. If your computer becomes slow or unresponsive, lower this number!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Parallel Sequences */}
              <div className="border border-purple-200 dark:border-purple-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900 dark:text-white">Multiple Conversations ⚡</h5>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        How many conversations your AI can handle at the same time
                      </p>
                    </div>
                    <span className="text-lg font-bold text-purple-700 dark:text-purple-300">
                      {performanceSettings.parallelSequences}
                    </span>
                  </div>
                  
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-3">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      🎮 Your graphics memory: {gpuInfo?.gpuMemoryGB?.toFixed(1) || 'Unknown'} GB. 
                      We recommend: {gpuInfo && gpuInfo.gpuMemoryGB >= 8 ? (gpuInfo.gpuMemoryGB >= 16 ? '4' : '2') : '1'} parallel conversations.
                      {gpuInfo && performanceSettings.parallelSequences > (gpuInfo.gpuMemoryGB >= 8 ? (gpuInfo.gpuMemoryGB >= 16 ? 4 : 2) : 1) && (
                        <span className="text-orange-600 dark:text-orange-400 block mt-1">
                          ⚠️ This might be too much for your graphics memory!
                        </span>
                      )}
                    </p>
                  </div>
                  
                  <input
                    type="range"
                    min="1"
                    max={gpuInfo && gpuInfo.gpuMemoryGB >= 16 ? 8 : gpuInfo && gpuInfo.gpuMemoryGB >= 8 ? 4 : 2}
                    step="1"
                    value={performanceSettings.parallelSequences}
                    onChange={(e) => updateSetting('parallelSequences', parseInt(e.target.value))}
                    className="w-full h-3 bg-purple-200 dark:bg-purple-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-purple-600 dark:text-purple-400 mt-1">
                    <span>1 (safe)</span>
                    <span>{gpuInfo && gpuInfo.gpuMemoryGB >= 16 ? 8 : gpuInfo && gpuInfo.gpuMemoryGB >= 8 ? 4 : 2} (max)</span>
                  </div>
                  
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                        <h6 className="text-xs font-semibold text-green-800 dark:text-green-200 mb-1">✅ More Sequences =</h6>
                        <ul className="text-xs text-green-700 dark:text-green-300 space-y-1">
                          <li>• Handle multiple requests at once</li>
                          <li>• Great for busy applications</li>
                          <li>• Better throughput overall</li>
                          <li>• Multiple users can chat simultaneously</li>
                        </ul>
                      </div>
                      <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                        <h6 className="text-xs font-semibold text-red-800 dark:text-red-200 mb-1">⚠️ Too Many =</h6>
                        <ul className="text-xs text-red-700 dark:text-red-300 space-y-1">
                          <li>• "Out of GPU memory" crashes</li>
                          <li>• Each conversation becomes slower</li>
                          <li>• Quality might be lower</li>
                          <li>• Graphics card gets very hot</li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        🎪 <strong>Stage Analogy:</strong> Think of this like having multiple AI performers on stage at once. Each performer needs stage space (memory). 
                        Too many performers and they can't move around properly!
                      </p>
                    </div>
                    
                    {gpuInfo && performanceSettings.parallelSequences > (gpuInfo.gpuMemoryGB >= 8 ? (gpuInfo.gpuMemoryGB >= 16 ? 4 : 2) : 1) && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 p-3 rounded-lg">
                        <p className="text-xs text-red-800 dark:text-red-200">
                          💥 <strong>Memory Warning:</strong> You're using more parallel sequences than recommended for {gpuInfo.gpuMemoryGB.toFixed(1)}GB graphics memory. 
                          This might cause sudden crashes!
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-6">
            <div className="text-center mb-6">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Ready to Make Changes? 🚀</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Choose how you want to optimize your AI performance!
              </p>
            </div>

            <div className="space-y-4">
              {/* Reset to Optimal Defaults Button */}
              <div className="bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center">
                    <RotateCcw className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900 dark:text-white">Smart Auto-Setup (Recommended!) ⭐</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Let us figure out the perfect settings for your computer automatically
                    </p>
                  </div>
                </div>
                <button
                  onClick={resetToOptimalDefaults}
                  disabled={savingSettings}
                  className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  {savingSettings && savingStatus !== 'idle' ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {savingStatus === 'saving' && 'Setting up your computer...'}
                      {savingStatus === 'regenerating' && 'Updating AI configurations...'}
                      {savingStatus === 'restarting' && 'Restarting AI system...'}
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-5 h-5" />
                      Use Smart Auto-Setup
                    </>
                  )}
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                  This will automatically choose the best settings based on your computer's capabilities
                </p>
              </div>

              {/* Apply Custom Settings Button */}
              <div className="bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/50 rounded-full flex items-center justify-center">
                    <Save className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900 dark:text-white">Apply My Custom Settings 🎯</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Use the exact settings you've chosen above
                    </p>
                  </div>
                </div>
                <button
                  onClick={savePerformanceSettings}
                  disabled={savingSettings}
                  className="w-full px-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  {savingSettings && savingStatus !== 'idle' ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {savingStatus === 'saving' && 'Saving your settings...'}
                      {savingStatus === 'regenerating' && 'Updating AI configurations...'}
                      {savingStatus === 'restarting' && 'Restarting AI system...'}
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Apply My Settings
                    </>
                  )}
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
                  This will save your custom settings and restart the AI system to use them
                </p>
              </div>
            </div>
            
            {/* Information Box */}
            <div className="mt-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-medium text-green-900 dark:text-green-100 mb-1">What happens when I apply settings?</h5>
                  <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
                    <p>1. 💾 Your settings get saved safely</p>
                    <p>2. 🔧 All AI models get updated with new settings</p>
                    <p>3. 🔄 The AI system restarts to use the new settings</p>
                    <p>4. ⚡ You'll see improved performance in your conversations!</p>
                  </div>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                    Don't worry - this process is automatic and takes about 10-15 seconds!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tips Section */}
      <div className="bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-700 rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/50 rounded-full flex items-center justify-center">
            💡
          </div>
          <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
            Tips to Make Your AI Even Better!
          </h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Hardware-specific tips */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-white">For Your Hardware:</h4>
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
              {gpuInfo.gpuType === 'apple_silicon' && (
                <>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">🍎</span>
                    <span>Your Apple computer shares memory between graphics and processing - this is actually great for AI!</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">⚡</span>
                    <span>Bigger AI models will work better on your machine than smaller computers</span>
                  </li>
                </>
              )}
              {gpuInfo.gpuType === 'nvidia' && (
                <>
                  <li className="flex items-start gap-2">
                    <span className="text-green-500 mt-0.5">🚀</span>
                    <span>NVIDIA graphics cards are excellent for AI - you have great hardware!</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">💾</span>
                    <span>More graphics memory = ability to run bigger, smarter AI models</span>
                  </li>
                </>
              )}
              {gpuInfo.gpuType === 'integrated' && (
                <>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-500 mt-0.5">⚡</span>
                    <span>Built-in graphics work great with smaller AI models</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">🧠</span>
                    <span>Adding more system memory (RAM) can help performance</span>
                  </li>
                </>
              )}
              {!gpuInfo.hasGPU && (
                <li className="flex items-start gap-2">
                  <span className="text-purple-500 mt-0.5">🧠</span>
                  <span>CPU-only mode still works great - consider a graphics card for even better speed!</span>
                </li>
              )}
            </ul>
          </div>

          {/* General tips */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900 dark:text-white">General Tips:</h4>
            <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-green-500 mt-0.5">🔄</span>
                <span>If you upgrade your hardware, come back here to refresh settings</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">⚖️</span>
                <span>Start with "Smart Auto-Setup" - you can always adjust later</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-500 mt-0.5">💡</span>
                <span>Conversation optimization gives the biggest speed boost for daily use</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 mt-0.5">⚠️</span>
                <span>If things get slow or crash, try "Smart Auto-Setup" to reset to safe settings</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GPUDiagnostics; 