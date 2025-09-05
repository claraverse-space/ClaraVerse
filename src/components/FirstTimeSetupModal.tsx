import React, { useState, useEffect } from 'react';
import { 
  Monitor, 
  Cpu, 
  Zap, 
  ChevronRight, 
  CheckCircle, 
  AlertTriangle,
  Info,
  ArrowLeft,
  Gauge,
  Brain,
  Shield,
  Rocket
} from 'lucide-react';

interface SystemInfo {
  hasGPU: boolean;
  gpuType: string;
  gpuMemoryGB: number;
  systemMemoryGB: number;
  platform: string;
  availableBackends: Array<{
    id: string;
    name: string;
    gpuType: string;
    isAvailable: boolean;
  }>;
}

interface WorkloadProfile {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  settings: {
    flashAttention: boolean;
    continuousBatching: boolean;
    cacheTypeK: 'f16' | 'f32' | 'q8_0' | 'q4_0';
    cacheTypeV: 'f16' | 'f32' | 'q8_0' | 'q4_0';
    contextSize: number;
    batchSize: number;
  };
  recommendation: string;
}

interface FirstTimeSetupModalProps {
  isOpen: boolean;
  onComplete: (config: {
    backendType: string;
    workloadProfile: string;
    settings: any;
  }) => void;
  onSkip: () => void;
}

const FirstTimeSetupModal: React.FC<FirstTimeSetupModalProps> = ({
  isOpen,
  onComplete,
  onSkip
}) => {
  const [currentStep, setCurrentStep] = useState<'welcome' | 'backend' | 'workload' | 'summary'>('welcome');
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [isLoadingSystem, setIsLoadingSystem] = useState(true);
  const [selectedBackend, setSelectedBackend] = useState<string>('');
  const [selectedWorkload, setSelectedWorkload] = useState<string>('');
  const [isCompleting, setIsCompleting] = useState(false);
  const [completionStep, setCompletionStep] = useState<string>('');

  // Workload profiles
  const workloadProfiles: WorkloadProfile[] = [
    {
      id: 'balanced',
      name: 'Balanced',
      description: 'Great for everyday AI tasks, coding assistance, and general conversations. Optimized for good performance with reasonable resource usage.',
      icon: <Gauge className="w-8 h-8 text-blue-500" />,
      settings: {
        flashAttention: true,
        continuousBatching: true,
        cacheTypeK: 'q8_0',
        cacheTypeV: 'q8_0',
        contextSize: 16384,
        batchSize: 256
      },
      recommendation: 'Recommended for most users'
    },
    {
      id: 'more_context',
      name: 'More Context',
      description: 'Extended memory for complex projects, long documents, and detailed conversations. Higher context window for better understanding.',
      icon: <Brain className="w-8 h-8 text-purple-500" />,
      settings: {
        flashAttention: true,
        continuousBatching: true,
        cacheTypeK: 'q4_0',
        cacheTypeV: 'q4_0',
        contextSize: 32768,
        batchSize: 128
      },
      recommendation: 'For complex projects and long conversations'
    },
    {
      id: 'speed',
      name: 'Speed',
      description: 'Optimized for fastest response times. Perfect for quick questions, code completion, and rapid interactions.',
      icon: <Rocket className="w-8 h-8 text-green-500" />,
      settings: {
        flashAttention: true,
        continuousBatching: false,
        cacheTypeK: 'f16',
        cacheTypeV: 'f16',
        contextSize: 8192,
        batchSize: 512
      },
      recommendation: 'For fastest response times'
    },
    {
      id: 'system_safe',
      name: 'System Safe',
      description: 'Conservative settings that work on any system. Minimal memory usage, maximum compatibility.',
      icon: <Shield className="w-8 h-8 text-orange-500" />,
      settings: {
        flashAttention: false,
        continuousBatching: false,
        cacheTypeK: 'f16',
        cacheTypeV: 'f16',
        contextSize: 4096,
        batchSize: 128
      },
      recommendation: 'For older systems or limited resources'
    }
  ];

  // Load system information
  useEffect(() => {
    const loadSystemInfo = async () => {
      if (!isOpen) return;
      
      setIsLoadingSystem(true);
      try {
        const llamaSwap = (window as any).llamaSwap;
        if (!llamaSwap) {
          throw new Error('LlamaSwap service not available');
        }

        const result = await llamaSwap.getConfigurationInfo();
        if (result.success) {
          setSystemInfo({
            hasGPU: result.gpuInfo?.hasGPU || false,
            gpuType: result.gpuInfo?.gpuType || 'none',
            gpuMemoryGB: result.gpuInfo?.gpuMemoryGB || 0,
            systemMemoryGB: result.gpuInfo?.systemMemoryGB || 8,
            platform: result.platform || 'unknown',
            availableBackends: result.availableBackends || []
          });

          // Auto-suggest backend based on system
          autoSuggestBackend(result);
        }
      } catch (error) {
        console.error('Failed to load system info:', error);
      } finally {
        setIsLoadingSystem(false);
      }
    };

    loadSystemInfo();
  }, [isOpen]);

  // Auto-suggest backend based on system capabilities
  const autoSuggestBackend = (configInfo: any) => {
    const { gpuInfo, availableBackends } = configInfo;
    
    if (!gpuInfo?.hasGPU) {
      // No GPU - suggest CPU backend
      setSelectedBackend('cpu');
      return;
    }

    // Check for NVIDIA GPU
    if (gpuInfo.gpuType?.toLowerCase().includes('nvidia')) {
      const cudaBackend = availableBackends.find((b: any) => 
        b.gpuType === 'nvidia' && b.isAvailable
      );
      if (cudaBackend) {
        setSelectedBackend(cudaBackend.id);
        return;
      }
    }

    // Check for AMD GPU
    if (gpuInfo.gpuType?.toLowerCase().includes('amd') || 
        gpuInfo.gpuType?.toLowerCase().includes('radeon')) {
      const rocmBackend = availableBackends.find((b: any) => 
        b.gpuType === 'amd' && b.isAvailable
      );
      if (rocmBackend) {
        setSelectedBackend(rocmBackend.id);
        return;
      }
    }

    // Fallback to Vulkan if available
    const vulkanBackend = availableBackends.find((b: any) => 
      b.gpuType === 'any' && b.isAvailable && b.id.includes('vulkan')
    );
    if (vulkanBackend) {
      setSelectedBackend(vulkanBackend.id);
      return;
    }

    // Final fallback to auto-detect
    setSelectedBackend('auto');
  };

  // Get backend icon
  const getBackendIcon = (gpuType: string) => {
    switch (gpuType) {
      case 'nvidia': return <Zap className="w-6 h-6 text-green-500" />;
      case 'amd': return <Monitor className="w-6 h-6 text-red-500" />;
      case 'any': return <Gauge className="w-6 h-6 text-purple-500" />;
      default: return <Cpu className="w-6 h-6 text-gray-500" />;
    }
  };

  // Handle setup completion
  const handleComplete = async () => {
    const selectedProfile = workloadProfiles.find(p => p.id === selectedWorkload);
    if (!selectedProfile) return;

    setIsCompleting(true);
    
    try {
      // Step 1: Setting backend
      setCompletionStep('Setting backend configuration...');
      await new Promise(resolve => setTimeout(resolve, 500)); // Brief delay to show progress
      
      // Step 2: Applying workload settings
      setCompletionStep('Applying workload settings...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 3: Saving configuration
      setCompletionStep('Saving configuration...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 4: Restarting service
      setCompletionStep('Restarting Clara Core...');
      
      await onComplete({
        backendType: selectedBackend,
        workloadProfile: selectedWorkload,
        settings: selectedProfile.settings
      });
      
      setCompletionStep('Setup complete!');
    } catch (error) {
      console.error('Setup completion failed:', error);
      setCompletionStep('');
      // The error handling is done in the parent component
      throw error;
    } finally {
      setIsCompleting(false);
      setCompletionStep('');
    }
  };

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden">
        
        {/* Welcome Step */}
        {currentStep === 'welcome' && (
          <div className="p-6 text-center">
            <div className="mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-xl font-bold text-white">✨</span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                Welcome to Clara AI!
              </h2>
              <p className="text-base text-gray-600 dark:text-gray-400">
                Let's set up your AI assistant for optimal performance
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                🚀 Quick 2-Step Setup
              </h3>
              <div className="space-y-1 text-sm text-blue-700 dark:text-blue-300">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>Detect your hardware for best performance</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  <span>Choose your preferred AI workload style</span>
                </div>
              </div>
            </div>

            <div className="flex justify-center gap-3">
              <button
                onClick={() => setCurrentStep('backend')}
                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-200 flex items-center gap-2"
              >
                Get Started
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={onSkip}
                className="px-5 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Skip Setup
              </button>
            </div>
          </div>
        )}

        {/* Backend Selection Step */}
        {currentStep === 'backend' && (
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                Choose Your AI Backend
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                We'll automatically detect your hardware and suggest the best option
              </p>
            </div>

            {isLoadingSystem ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Detecting your system...</p>
                </div>
              </div>
            ) : systemInfo ? (
              <>
                {/* System Info Display */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">
                    🖥️ Detected System
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">Platform:</span>
                      <p className="text-gray-600 dark:text-gray-400">{systemInfo.platform}</p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">GPU:</span>
                      <p className="text-gray-600 dark:text-gray-400">
                        {systemInfo.hasGPU 
                          ? `${systemInfo.gpuType} (${systemInfo.gpuMemoryGB}GB)` 
                          : 'None detected'
                        }
                      </p>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700 dark:text-gray-300">System RAM:</span>
                      <p className="text-gray-600 dark:text-gray-400">{systemInfo.systemMemoryGB}GB</p>
                    </div>
                  </div>
                </div>

                {/* Backend Options */}
                <div className="space-y-2 mb-6">
                  {/* Recommended options first */}
                  {systemInfo.availableBackends
                    .filter(backend => backend.isAvailable)
                    .map((backend) => (
                      <button
                        key={backend.id}
                        onClick={() => setSelectedBackend(backend.id)}
                        className={`w-full p-3 rounded-lg text-left transition-all duration-200 border-2 ${
                          selectedBackend === backend.id
                            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400'
                            : 'bg-white dark:bg-gray-800/30 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          {getBackendIcon(backend.gpuType)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                                {backend.name}
                              </h4>
                              {selectedBackend === backend.id && (
                                <CheckCircle className="w-4 h-4 text-blue-500" />
                              )}
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {backend.gpuType === 'nvidia' && 'NVIDIA GPU acceleration (CUDA)'}
                              {backend.gpuType === 'amd' && 'AMD GPU acceleration (ROCm)'}
                              {backend.gpuType === 'any' && 'Universal GPU acceleration (Vulkan)'}
                              {backend.gpuType === 'none' && 'CPU-only processing'}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))
                  }

                  {/* Not Sure Option */}
                  <button
                    onClick={() => setSelectedBackend('auto')}
                    className={`w-full p-3 rounded-lg text-left transition-all duration-200 border-2 ${
                      selectedBackend === 'auto'
                        ? 'bg-orange-50 dark:bg-orange-900/30 border-orange-400'
                        : 'bg-white dark:bg-gray-800/30 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-orange-500" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                            I'm Not Sure
                          </h4>
                          {selectedBackend === 'auto' && (
                            <CheckCircle className="w-4 h-4 text-orange-500" />
                          )}
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          Let Clara automatically detect and choose the best backend
                        </p>
                      </div>
                    </div>
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
                <p className="text-red-600 dark:text-red-400 mb-3 text-sm">
                  Failed to detect system information
                </p>
                <button
                  onClick={() => setSelectedBackend('auto')}
                  className="px-5 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                >
                  Use Auto-Detect
                </button>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep('welcome')}
                className="px-5 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={() => setCurrentStep('workload')}
                disabled={!selectedBackend}
                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Next Step
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Workload Selection Step */}
        {currentStep === 'workload' && (
          <div className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                Choose Your Workload Style
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Select the configuration that best matches how you plan to use Clara
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
              {workloadProfiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => setSelectedWorkload(profile.id)}
                  className={`p-4 rounded-lg text-left transition-all duration-200 border-2 ${
                    selectedWorkload === profile.id
                      ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-400'
                      : 'bg-white dark:bg-gray-800/30 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-8 h-8 flex items-center justify-center">
                      {profile.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900 dark:text-white text-base">
                          {profile.name}
                        </h3>
                        {selectedWorkload === profile.id && (
                          <CheckCircle className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mb-1">
                        {profile.recommendation}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    {profile.description}
                  </p>
                </button>
              ))}
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep('backend')}
                className="px-5 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={() => setCurrentStep('summary')}
                disabled={!selectedWorkload}
                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-purple-700 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                Review Setup
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Summary Step */}
        {currentStep === 'summary' && (
          <div className="p-6 relative">
            {/* Loading Overlay */}
            {isCompleting && (
              <div className="absolute inset-0 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    Setting up Clara AI
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {completionStep || 'Please wait while we configure your AI assistant...'}
                  </p>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2 text-xs text-blue-700 dark:text-blue-300">
                    This may take a few moments. Clara will restart with your optimized settings.
                  </div>
                </div>
              </div>
            )}
            
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                Setup Summary
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Review your configuration before applying
              </p>
            </div>

            <div className="space-y-4 mb-6">
              {/* Backend Summary */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 dark:text-green-100 mb-2 flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Backend Configuration
                </h3>
                <div className="text-xs text-green-700 dark:text-green-300">
                  <p><strong>Selected Backend:</strong> {
                    selectedBackend === 'auto' 
                      ? 'Auto-detect (will choose best available)'
                      : systemInfo?.availableBackends.find(b => b.id === selectedBackend)?.name || selectedBackend
                  }</p>
                </div>
              </div>

              {/* Workload Summary */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4" />
                  Workload Profile
                </h3>
                <div className="text-xs text-blue-700 dark:text-blue-300">
                  {(() => {
                    const profile = workloadProfiles.find(p => p.id === selectedWorkload);
                    return profile ? (
                      <div>
                        <p className="mb-1"><strong>{profile.name}:</strong> {profile.description}</p>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <p>Context Size: {(profile.settings.contextSize / 1024).toFixed(0)}K tokens</p>
                          <p>Flash Attention: {profile.settings.flashAttention ? 'Enabled' : 'Disabled'}</p>
                          <p>Cache Type: {profile.settings.cacheTypeK}</p>
                          <p>Batch Size: {profile.settings.batchSize}</p>
                        </div>
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>

              {/* Info Note */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3 border border-yellow-200 dark:border-yellow-700">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-yellow-700 dark:text-yellow-300">
                    <p className="font-medium mb-1">Configuration Notes:</p>
                    <ul className="space-y-0.5 text-xs">
                      <li>• Settings will be applied to all AI models automatically</li>
                      <li>• You can change these settings later in Backend Configuration</li>
                      <li>• Clara will restart briefly to apply the new configuration</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep('workload')}
                disabled={isCompleting}
                className="px-5 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <button
                onClick={handleComplete}
                disabled={isCompleting}
                className="px-6 py-2 bg-gradient-to-r from-green-500 to-blue-600 text-white rounded-lg font-semibold hover:from-green-600 hover:to-blue-700 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isCompleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {completionStep || 'Processing...'}
                  </>
                ) : (
                  <>
                    Complete Setup
                    <CheckCircle className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FirstTimeSetupModal;
