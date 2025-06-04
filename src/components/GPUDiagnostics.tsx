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
  batchSize: number;
  ubatchSize: number;
  gpuLayers: number;
  memoryLock: boolean;
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
    conversationMode: 'balanced',
    batchSize: 256,
    ubatchSize: 256,
    gpuLayers: 50,
    memoryLock: true
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
          // Store as previous settings for restart detection
          setPreviousSettings(settings.settings);
        }
      }
    } catch (error) {
      console.error('Error loading performance settings:', error);
    }
  };

  // Define which settings require a full restart vs hot reload
  const RESTART_REQUIRED_SETTINGS = [
    'gpuLayers', 'maxContextSize', 'memoryLock', 'threads', 'parallelSequences'
  ];

  const HOT_SWAPPABLE_SETTINGS = [
    'batchSize', 'ubatchSize', 'flashAttention', 'autoOptimization', 
    'aggressiveOptimization', 'prioritizeSpeed', 'optimizeFirstToken',
    'optimizeConversations', 'keepTokens', 'defragThreshold', 
    'enableContinuousBatching', 'conversationMode'
  ];

  // Check if any restart-required settings have changed
  const [previousSettings, setPreviousSettings] = useState<PerformanceSettings | null>(null);

  const requiresRestart = (newSettings: PerformanceSettings, oldSettings: PerformanceSettings | null): boolean => {
    if (!oldSettings) return true; // First time setup needs restart
    
    return RESTART_REQUIRED_SETTINGS.some(setting => 
      newSettings[setting as keyof PerformanceSettings] !== oldSettings[setting as keyof PerformanceSettings]
    );
  };

  const savePerformanceSettings = async () => {
    setSavingSettings(true);
    setSavingStatus('saving');
    try {
      const llamaSwap = (window as any).llamaSwap;
      if (llamaSwap?.savePerformanceSettings) {
        // Check if restart is needed
        const needsRestart = requiresRestart(performanceSettings, previousSettings);
        
        // First save the performance settings
        const result = await llamaSwap.savePerformanceSettings(performanceSettings);
        if (result.success) {
          console.log('Performance settings saved successfully');
          
          if (needsRestart) {
            console.log('🔄 Critical settings changed - full restart required');
            // Only restart for critical settings changes
            setSavingStatus('regenerating');
            console.log('Regenerating config with new performance settings...');
            if (llamaSwap?.regenerateConfig) {
              const configResult = await llamaSwap.regenerateConfig();
              if (configResult.success) {
                console.log(`Config regenerated with ${configResult.models} models`);
                
                setSavingStatus('restarting');
                console.log('Restarting llama server to apply critical changes...');
                if (llamaSwap?.restart) {
                  const restartResult = await llamaSwap.restart();
                  if (restartResult.success) {
                    console.log('Llama server restarted successfully');
                    await fetchGPUDiagnostics();
                  } else {
                    console.warn('Settings saved and config updated, but restart failed:', restartResult.error);
                  }
                }
              } else {
                console.warn('Settings saved but config regeneration failed:', configResult.error);
              }
            }
          } else {
            console.log('⚡ Hot-swappable settings changed - applying without restart');
            // For hot-swappable settings, just apply them without restart
            setSavingStatus('regenerating');
            if (llamaSwap?.applyHotSettings) {
              // Try to apply settings without restart
              const hotResult = await llamaSwap.applyHotSettings(performanceSettings);
              if (hotResult.success) {
                console.log('Hot settings applied successfully - no restart needed');
              } else {
                console.warn('Hot settings failed, falling back to restart:', hotResult.error);
                // Fallback to restart if hot reload fails
                if (llamaSwap?.regenerateConfig) {
                  const configResult = await llamaSwap.regenerateConfig();
                  if (configResult.success && llamaSwap?.restart) {
                    setSavingStatus('restarting');
                    await llamaSwap.restart();
                  }
                }
              }
            } else {
              // If hot settings not available, just regenerate config without restart
              if (llamaSwap?.regenerateConfig) {
                await llamaSwap.regenerateConfig();
              }
            }
            // Refresh diagnostics even for hot changes
            await fetchGPUDiagnostics();
          }
          
          // Update previous settings for next comparison
          setPreviousSettings({ ...performanceSettings });
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
        conversationMode: 'balanced',
        batchSize: 256,
        ubatchSize: 256,
        gpuLayers: 50,
        memoryLock: true
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
      conversationMode: 'balanced',
      batchSize: 256,
      ubatchSize: 256,
      gpuLayers: gpuInfo.hasGPU ? 50 : 0,
      memoryLock: true
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
              Performance Configuration
            </h3>
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            Adjust parameters to optimize model performance for your system.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Threads Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-medium text-gray-900 dark:text-white">Threads</label>
              <span className="text-lg font-mono text-sakura-600 dark:text-sakura-400 bg-sakura-50 dark:bg-sakura-900/20 px-3 py-1 rounded">
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
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1</span>
              <span>{Math.min(16, cpuCores)}</span>
            </div>
          </div>

          {/* Context Size Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-medium text-gray-900 dark:text-white">Context Size</label>
              <span className="text-lg font-mono text-sakura-600 dark:text-sakura-400 bg-sakura-50 dark:bg-sakura-900/20 px-3 py-1 rounded">
                {performanceSettings.maxContextSize.toLocaleString()}
              </span>
            </div>
            <input
              type="range"
              min="1024"
              max="32768"
              step="1024"
              value={performanceSettings.maxContextSize}
              onChange={(e) => updateSetting('maxContextSize', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1K</span>
              <span>32K</span>
            </div>
          </div>

          {/* Parallel Sequences Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-medium text-gray-900 dark:text-white">Parallel</label>
              <span className="text-lg font-mono text-sakura-600 dark:text-sakura-400 bg-sakura-50 dark:bg-sakura-900/20 px-3 py-1 rounded">
                {performanceSettings.parallelSequences}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              value={performanceSettings.parallelSequences}
              onChange={(e) => updateSetting('parallelSequences', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>1</span>
              <span>8</span>
            </div>
          </div>

          {/* Batch Size Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-medium text-gray-900 dark:text-white">Batch Size</label>
              <span className="text-lg font-mono text-sakura-600 dark:text-sakura-400 bg-sakura-50 dark:bg-sakura-900/20 px-3 py-1 rounded">
                {performanceSettings.batchSize}
              </span>
            </div>
            <input
              type="range"
              min="32"
              max="2048"
              step="32"
              value={performanceSettings.batchSize}
              onChange={(e) => updateSetting('batchSize', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>32</span>
              <span>2048</span>
            </div>
          </div>

          {/* GPU Layers Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-medium text-gray-900 dark:text-white">GPU Layers</label>
              <span className="text-lg font-mono text-sakura-600 dark:text-sakura-400 bg-sakura-50 dark:bg-sakura-900/20 px-3 py-1 rounded">
                {performanceSettings.gpuLayers}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={performanceSettings.gpuLayers}
              onChange={(e) => updateSetting('gpuLayers', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>0</span>
              <span>100</span>
            </div>
          </div>

          {/* UBatch Size Slider */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-medium text-gray-900 dark:text-white">UBatch Size</label>
              <span className="text-lg font-mono text-sakura-600 dark:text-sakura-400 bg-sakura-50 dark:bg-sakura-900/20 px-3 py-1 rounded">
                {performanceSettings.ubatchSize}
              </span>
            </div>
            <input
              type="range"
              min="16"
              max="1024"
              step="16"
              value={performanceSettings.ubatchSize}
              onChange={(e) => updateSetting('ubatchSize', parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>16</span>
              <span>1024</span>
            </div>
          </div>

          {/* Memory Lock Toggle */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-medium text-gray-900 dark:text-white">Memory Lock</label>
              <button
                onClick={() => updateSetting('memoryLock', !performanceSettings.memoryLock)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  performanceSettings.memoryLock 
                    ? 'bg-sakura-500' 
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    performanceSettings.memoryLock ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div className="text-center">
              <span className={`text-sm font-medium ${
                performanceSettings.memoryLock 
                  ? 'text-sakura-600 dark:text-sakura-400' 
                  : 'text-gray-500 dark:text-gray-400'
              }`}>
                {performanceSettings.memoryLock ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <p className="text-xs text-gray-500 text-center">
              {performanceSettings.memoryLock 
                ? 'Model stays in memory - no warmup needed' 
                : 'Model may be swapped out of memory'
              }
            </p>
          </div>
        </div>

        {/* Save/Reset buttons */}
        <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={savePerformanceSettings}
            disabled={savingSettings}
            className="flex items-center gap-2 px-4 py-2 bg-sakura-500 text-white rounded-lg hover:bg-sakura-600 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {savingSettings ? 'Saving...' : 'Save Settings'}
          </button>
          
          <button
            onClick={resetToOptimalDefaults}
            className="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </button>
        </div>

        {/* Save Status */}
        {savingStatus === 'regenerating' && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {requiresRestart(performanceSettings, previousSettings) 
                ? '🔄 Regenerating configuration files...' 
                : '⚡ Applying hot settings - no restart needed...'}
            </p>
          </div>
        )}

        {savingStatus === 'restarting' && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              ⚡ Restarting model servers with critical settings...
            </p>
          </div>
        )}

        {/* Settings Impact Info */}
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Performance Settings Impact</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium text-amber-700 dark:text-amber-300 mb-1">🔄 Requires Restart:</p>
                  <p className="text-gray-600 dark:text-gray-400">GPU Layers, Context Size, Memory Lock, Threads, Parallel Sequences</p>
                  <p className="text-xs text-gray-500 mt-1">These settings need model reload (~10-30 seconds)</p>
                </div>
                <div>
                  <p className="font-medium text-green-700 dark:text-green-300 mb-1">⚡ Hot Reload:</p>
                  <p className="text-gray-600 dark:text-gray-400">Batch Sizes, Flash Attention, Optimization Settings</p>
                  <p className="text-xs text-gray-500 mt-1">Applied instantly without restart (~1-2 seconds)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

  
    </div>
  );
};

export default GPUDiagnostics; 