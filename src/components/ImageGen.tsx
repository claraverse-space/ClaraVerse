import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Client, BasePipe, EfficientPipe } from '@stable-canvas/comfyui-client';
import Sidebar from './Sidebar';
import ImageGenHeader from './ImageGenHeader';
import { db } from '../db';
import ComfyUIManager from './ComfyUIManager';
import ModelManager from './ModelManager';

import PromptArea from './imagegen_components/PromptArea';
import GeneratedGallery from './imagegen_components/GeneratedGallery';
import SettingsDrawer, { Resolution } from './imagegen_components/SettingsDrawer';
import LoadingOverlay from './imagegen_components/LoadingOverlay';
import InitialLoadingOverlay from './imagegen_components/InitialLoadingOverlay';
import { Buffer } from 'buffer';

// Resolutions constant
const RESOLUTIONS: Resolution[] = [
  { label: 'Square (1:1)', width: 1024, height: 1024 },
  { label: 'Portrait (2:3)', width: 832, height: 1216 },
  { label: 'Landscape (3:2)', width: 1216, height: 832 },
  { label: 'Wide (16:9)', width: 1280, height: 720 },
  { label: 'Mobile', width: 720, height: 1280 },
  { label: '4K', width: 3840, height: 2160 },
  { label: '2K', width: 2560, height: 1440 },
  { label: 'Custom', width: 0, height: 0 },
];

interface ModelConfig {
  denoise: number;
  steps: number;
  guidanceScale: number;
  sampler: string;
  scheduler: string;
  negativeTags: string[];
}

const MODEL_CONFIGS_KEY = 'clara-ollama-model-configs';

const getOptimalConfig = (modelName: string): ModelConfig => {
  const baseNegative = ['nsfw', '(worst quality, low quality, normal quality:2)'];
  
  if (modelName.toLowerCase().includes('flux')) {
    return {
      denoise: 1.0,
      steps: 20,
      guidanceScale: 1.0,
      sampler: 'euler',
      scheduler: 'normal',
      negativeTags: baseNegative,
    };
  } else if (modelName.toLowerCase().includes('sdxl') || modelName.toLowerCase().includes('xl')) {
    return {
      denoise: 1.0,
      steps: 22,
      guidanceScale: 8.0,
      sampler: 'euler',
      scheduler: 'normal',
      negativeTags: baseNegative,
    };
  } else if (modelName.toLowerCase().includes('1.5') || modelName.toLowerCase().includes('sd1.5')) {
    return {
      denoise: 1.0,
      steps: 22,
      guidanceScale: 5.0,
      sampler: 'dpmpp_2m_sde_gpu',
      scheduler: 'karras',
      negativeTags: baseNegative,
    };
  }
  return {
    denoise: 1,
    steps: 15,
    guidanceScale: 7.5,
    sampler: 'euler',
    scheduler: 'normal',
    negativeTags: baseNegative,
  };
};

const saveModelConfig = (modelName: string, config: ModelConfig) => {
  const storedConfigs = JSON.parse(localStorage.getItem(MODEL_CONFIGS_KEY) || '{}');
  storedConfigs[modelName] = config;
  localStorage.setItem(MODEL_CONFIGS_KEY, JSON.stringify(storedConfigs));
};

const loadModelConfig = (modelName: string): ModelConfig | null => {
  const storedConfigs = JSON.parse(localStorage.getItem(MODEL_CONFIGS_KEY) || '{}');
  return storedConfigs[modelName] || null;
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function arrayBufferToUint8Array(buffer: ArrayBuffer): Uint8Array {
  return new Uint8Array(buffer);
}

interface ImageGenProps {
  onPageChange?: (page: string) => void;
}

const LAST_USED_LLM_KEY = 'clara-ollama-last-used-llm';

interface EnhancePromptSettings {
  selectedModel: string;
  systemPrompt: string;
}

const defaultSystemPrompt = `You are a creative writing assistant specializing in enhancing image generation prompts.
Your task is to expand and improve the given prompt while maintaining its core concept.
Focus on adding descriptive details, artistic style, lighting, and atmosphere.
Keep the enhanced prompt concise and effective.`;

// Add system info interface
interface SystemInfo {
  platform: string;
  arch: string;
  hasNvidiaGPU: boolean;
  gpuName?: string;
  isMac: boolean;
  isAMD: boolean;
  isSupported: boolean;
  warnings: string[];
}

// Add consent modal component
const SystemCompatibilityModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  systemInfo: SystemInfo;
}> = ({ isOpen, onClose, onAccept, systemInfo }) => {
  if (!isOpen) return null;

  const getCompatibilityIcon = () => {
    if (systemInfo.isSupported) {
      return <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>;
    } else {
      return <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
        <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      </div>;
    }
  };

  const getCompatibilityMessage = () => {
    if (systemInfo.isSupported) {
      return {
        title: "✅ Your System is Compatible!",
        message: "Your NVIDIA GPU setup is fully supported for optimal image generation performance.",
        color: "text-green-800"
      };
    } else {
      return {
        title: "⚠️ Limited Compatibility",
        message: "Your system may experience reduced performance or compatibility issues.",
        color: "text-yellow-800"
      };
    }
  };

  const compatibility = getCompatibilityMessage();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="text-center">
            {getCompatibilityIcon()}
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              ComfyUI System Compatibility
            </h2>
            <p className={`text-lg font-medium ${compatibility.color} dark:text-yellow-300 mb-6`}>
              {compatibility.title}
            </p>
          </div>

          {/* System Information */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Your System Information
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Platform:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">
                  {systemInfo.platform === 'darwin' ? 'macOS' : 
                   systemInfo.platform === 'win32' ? 'Windows' : 
                   systemInfo.platform === 'linux' ? 'Linux' : systemInfo.platform}
                </span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Architecture:</span>
                <span className="ml-2 font-medium text-gray-900 dark:text-white">{systemInfo.arch}</span>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">GPU Support:</span>
                <span className={`ml-2 font-medium ${systemInfo.hasNvidiaGPU ? 'text-green-600' : 'text-red-600'}`}>
                  {systemInfo.hasNvidiaGPU ? 'NVIDIA GPU Detected' : 'No NVIDIA GPU'}
                </span>
              </div>
              {systemInfo.gpuName && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400">GPU Model:</span>
                  <span className="ml-2 font-medium text-gray-900 dark:text-white">{systemInfo.gpuName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Compatibility Warnings */}
          {systemInfo.warnings.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
              <h4 className="text-lg font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                ⚠️ Important Compatibility Notes
              </h4>
              <ul className="space-y-2">
                {systemInfo.warnings.map((warning, index) => (
                  <li key={index} className="text-sm text-yellow-700 dark:text-yellow-300 flex items-start">
                    <span className="mr-2">•</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <h4 className="text-lg font-medium text-blue-800 dark:text-blue-200 mb-2">
              💡 Recommendations
            </h4>
            <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
              {systemInfo.isSupported ? (
                <>
                  <p>• Your NVIDIA GPU will provide excellent performance</p>
                  <p>• GPU acceleration will be automatically enabled</p>
                  <p>• All ComfyUI features are fully supported</p>
                </>
              ) : (
                <>
                  {systemInfo.isMac && (
                    <>
                      <p>• macOS currently lacks Metal acceleration support in ComfyUI</p>
                      <p>• Image generation will be significantly slower on CPU</p>
                      <p>• Consider using cloud-based alternatives for better performance</p>
                    </>
                  )}
                  {systemInfo.isAMD && (
                    <>
                      <p>• AMD GPU support in ComfyUI is experimental and limited</p>
                      <p>• You may experience compatibility issues or crashes</p>
                      <p>• CPU fallback will be used, resulting in slower generation</p>
                    </>
                  )}
                  {!systemInfo.hasNvidiaGPU && !systemInfo.isMac && !systemInfo.isAMD && (
                    <>
                      <p>• CPU-only image generation will be very slow</p>
                      <p>• Large models may not fit in system RAM</p>
                      <p>• Consider upgrading to an NVIDIA GPU for optimal experience</p>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={onAccept}
              className={`px-6 py-2 rounded-lg font-medium ${
                systemInfo.isSupported
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-yellow-600 hover:bg-yellow-700 text-white'
              }`}
            >
              {systemInfo.isSupported ? 'Start ComfyUI' : 'Continue Anyway'}
            </button>
          </div>

          {/* Disclaimer */}
          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              By continuing, you acknowledge the compatibility information above and understand that 
              performance may vary based on your system configuration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const ImageGen: React.FC<ImageGenProps> = ({ onPageChange }) => {
  // UI state variables
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [mustSelectModel, setMustSelectModel] = useState(false);
  const [progress, setProgress] = useState<{ value: number; max: number } | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [currentPipeline, setCurrentPipeline] = useState<BasePipe | EfficientPipe | null>(null);

  // Add new state for system compatibility
  const [showCompatibilityModal, setShowCompatibilityModal] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [userHasConsented, setUserHasConsented] = useState(false);

  // localStorage key for storing selected model
  const LAST_USED_MODEL_KEY = 'clara-ollama-last-used-model';
  const COMFYUI_CONSENT_KEY = 'clara-comfyui-user-consent';

  // Initial loading states
  const [isInitialSetupComplete, setIsInitialSetupComplete] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  type LoadingStatus = {
    sdModels: 'pending' | 'loading' | 'success' | 'error';
    loras: 'pending' | 'loading' | 'success' | 'error';
    vaes: 'pending' | 'loading' | 'success' | 'error';
    systemStats: 'pending' | 'loading' | 'success' | 'error';
    connection: 'connecting' | 'connected' | 'error' | 'timeout';
  };
  const [loadingStatus, setLoadingStatus] = useState<LoadingStatus>({
    sdModels: 'pending',
    loras: 'pending',
    vaes: 'pending',
    systemStats: 'pending',
    connection: 'connecting',
  });

  // Data from ComfyUI (models, LoRAs, VAEs, system stats)
  const [systemStats, setSystemStats] = useState<any>(null);
  const [sdModels, setSDModels] = useState<string[]>([]);
  const [loras, setLoras] = useState<string[]>([]);
  const [vaes, setVAEs] = useState<string[]>([]);

  // Debug state: WebSocket connection status
  const [wsStatus, setWsStatus] = useState<string>('Not Connected');

  // Reference to the ComfyUI client instance
  const clientRef = useRef<Client | null>(null);
  
  // Track the last used model to optimize memory management
  const lastUsedModelRef = useRef<string | null>(null);

  // Disconnect any lingering client created in a different page on mount
  useEffect(() => {
    if (clientRef.current) {
      try {
        clientRef.current.close();
        console.log("Disconnected previous client connection on mount");
      } catch (error) {
        console.error("Error disconnecting previous client connection on mount", error);
      }
      clientRef.current = null;
    }
  }, []);

  // Remove reconnection interval dependency from generation;
  // Instead, handle connection issues in the initial connection effect.
  const generationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Settings state variables
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedLora, setSelectedLora] = useState<string>('');
  const [loraStrength, setLoraStrength] = useState<number>(0.75);
  const [selectedVae, setSelectedVae] = useState<string>('');
  const [negativeTags, setNegativeTags] = useState<string[]>([]);
  const [negativeInput, setNegativeInput] = useState('');
  const [steps, setSteps] = useState(50);
  const [guidanceScale, setGuidanceScale] = useState(7.5);
  const [selectedResolution, setSelectedResolution] = useState<Resolution>(RESOLUTIONS[0]);
  const [customWidth, setCustomWidth] = useState<number>(1024);
  const [customHeight, setCustomHeight] = useState<number>(1024);
  const [expandedSections, setExpandedSections] = useState({
    model: true,
    lora: false,
    vae: false,
    negative: false,
    resolution: true,
    controlnet: false,
    upscaler: false,
  });

  const [controlNetModels, setControlNetModels] = useState<string[]>([]);
  const [selectedControlNet, setSelectedControlNet] = useState<string>('');
  const [upscaleModels, setUpscaleModels] = useState<string[]>([]);
  const [selectedUpscaler, setSelectedUpscaler] = useState<string>('');

  const edgeRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout>();

  const [denoise, setDenoise] = useState<number>(0.7);
  const [sampler, setSampler] = useState<string>("euler");
  const [scheduler, setScheduler] = useState<string>("normal");

  // Add state for storing the uploaded image buffer
  const [imageBuffer, setImageBuffer] = useState<ArrayBuffer | null>(null);
  const [clearImageFlag, setClearImageFlag] = useState(false);

  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

  // Add new state variables
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhanceSettings, setEnhanceSettings] = useState<EnhancePromptSettings>({
    selectedModel: localStorage.getItem(LAST_USED_LLM_KEY) || '',
    systemPrompt: defaultSystemPrompt,
  });
  const [isLLMConnected, setIsLLMConnected] = useState(false);
  const [showComfyUIManager, setShowComfyUIManager] = useState(false);
  const [showModelManager, setShowModelManager] = useState(false);

  // Wait for the client's WebSocket connection to open before proceeding - with timeout
  const waitForClientConnection = async (client: Client): Promise<void> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("WebSocket connection timeout - failed to connect after 15 seconds"));
        setLoadingStatus(prev => ({ ...prev, connection: 'timeout' }));
      }, 15000);
      
      if (client.socket && client.socket.readyState === WebSocket.OPEN) {
        clearTimeout(timeout);
        resolve();
      } else {
        const checkInterval = setInterval(() => {
          if (client.socket && client.socket.readyState === WebSocket.OPEN) {
            clearInterval(checkInterval);
            clearTimeout(timeout);
            resolve();
          }
        }, 100);
      }
    });
  };

  // Check system compatibility and user consent on mount
  useEffect(() => {
    const checkSystemCompatibility = async () => {
      try {
        // Check if user has already consented (check both localStorage and file)
        let hasConsented = localStorage.getItem(COMFYUI_CONSENT_KEY) === 'true';
        
        // Also check the consent file to ensure consistency
        try {
          const consentData = await window.electronAPI?.getComfyUIConsent?.();
          if (consentData?.hasConsented !== undefined) {
            hasConsented = consentData.hasConsented;
            // Sync localStorage with file
            localStorage.setItem(COMFYUI_CONSENT_KEY, hasConsented.toString());
          }
        } catch (error) {
          console.warn('Could not read ComfyUI consent file:', error);
        }
        
        setUserHasConsented(hasConsented);

        // Get system information
        const systemInfo = await getSystemInfo();
        setSystemInfo(systemInfo);

        // If user hasn't consented, show modal
        if (!hasConsented) {
          setShowCompatibilityModal(true);
          setIsInitialSetupComplete(true); // Don't start ComfyUI setup
          return;
        }

        // If user has consented, proceed with ComfyUI setup
        if (hasConsented) {
          initializeComfyUI();
        }
      } catch (error) {
        console.error('Error checking system compatibility:', error);
        setIsInitialSetupComplete(true);
      }
    };

    checkSystemCompatibility();
  }, []);

  // Cleanup: close client on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.close();
        clientRef.current = null;
      }
    };
  }, []);

  // Function to get system information
  const getSystemInfo = async (): Promise<SystemInfo> => {
    try {
      // Get basic system info
      const platform = window.electronAPI?.getPlatform() || 'unknown';
      const systemInfoResult = await window.electronAPI?.getSystemInfo();
      
      const isMac = platform === 'darwin';
      const isWindows = platform === 'win32';
      const isLinux = platform === 'linux';

      // Detect GPU information
      let hasNvidiaGPU = false;
      let gpuName = '';
      let isAMD = false;

      try {
        // Try to get GPU diagnostics from llama-swap service
        const gpuDiagnostics = await window.llamaSwap?.getGPUDiagnostics();
        console.log('GPU Diagnostics result:', gpuDiagnostics);
        
        if (gpuDiagnostics?.gpuInfo) {
          const gpuInfo = gpuDiagnostics.gpuInfo;
          hasNvidiaGPU = gpuInfo.hasGPU && (gpuInfo.gpuType === 'nvidia' || gpuInfo.hasNvidiaGPU);
          gpuName = gpuInfo.gpuName || gpuInfo.gpuType || '';
          isAMD = gpuInfo.gpuType === 'amd' || gpuInfo.isAMD || gpuName.toLowerCase().includes('amd') || gpuName.toLowerCase().includes('radeon');
          
          console.log('Parsed GPU info:', { hasNvidiaGPU, gpuName, isAMD, gpuType: gpuInfo.gpuType });
        }
      } catch (error) {
        console.warn('Could not get GPU diagnostics:', error);
      }

      // Fallback: Try direct GPU detection via electron API
      if (!hasNvidiaGPU && !gpuName) {
        try {
          const directGPUInfo = await window.electronAPI?.getGPUInfo?.();
          console.log('Direct GPU info result:', directGPUInfo);
          
          if (directGPUInfo?.success && directGPUInfo.gpuInfo) {
            const info = directGPUInfo.gpuInfo;
            hasNvidiaGPU = info.hasNvidiaGPU || false;
            gpuName = info.gpuName || info.renderer || '';
            isAMD = info.isAMD || gpuName.toLowerCase().includes('amd') || gpuName.toLowerCase().includes('radeon');
            
            console.log('Direct GPU detection result:', { hasNvidiaGPU, gpuName, isAMD });
          }
        } catch (error) {
          console.warn('Direct GPU detection failed:', error);
        }
      }

      // Additional fallback: Check WebGL renderer info
      if (!hasNvidiaGPU && !gpuName) {
        try {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
              const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
              const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
              
              console.log('WebGL GPU info:', { renderer, vendor });
              
              if (renderer) {
                gpuName = renderer;
                hasNvidiaGPU = renderer.toLowerCase().includes('nvidia') || 
                              renderer.toLowerCase().includes('geforce') || 
                              renderer.toLowerCase().includes('rtx') || 
                              renderer.toLowerCase().includes('gtx');
                isAMD = renderer.toLowerCase().includes('amd') || 
                       renderer.toLowerCase().includes('radeon');
                
                console.log('WebGL detection result:', { hasNvidiaGPU, gpuName, isAMD });
              }
            }
          }
        } catch (error) {
          console.warn('WebGL GPU detection failed:', error);
        }
      }

      // Final debug logging
      console.log('Final GPU detection results:', {
        hasNvidiaGPU,
        gpuName,
        isAMD,
        platform,
        isMac,
        isWindows,
        isLinux
      });

      // Determine system support
      const isSupported = hasNvidiaGPU && !isMac;
      
      // Generate warnings
      const warnings: string[] = [];
      
      if (isMac) {
        warnings.push('macOS does not currently support Metal acceleration in ComfyUI Docker containers');
        warnings.push('Image generation will be significantly slower using CPU-only processing');
        warnings.push('Memory usage will be higher, potentially causing system slowdowns');
      }
      
      if (isAMD && !isMac) {
        warnings.push('AMD GPU support in ComfyUI is experimental and may not work reliably');
        warnings.push('Many models and features may not be compatible with AMD GPUs');
        warnings.push('You may experience crashes or generation failures');
      }
      
      if (!hasNvidiaGPU && !isMac && !isAMD) {
        warnings.push('CPU-only image generation is extremely slow and resource-intensive');
        warnings.push('Large models (SDXL, Flux) may not fit in system memory');
        warnings.push('Generation times can be 10-50x slower than GPU acceleration');
      }

      if (!isSupported) {
        warnings.push('For optimal performance, we recommend using a system with an NVIDIA GPU');
      }

      return {
        platform,
        arch: systemInfoResult?.arch || 'unknown',
        hasNvidiaGPU,
        gpuName: gpuName || undefined,
        isMac,
        isAMD,
        isSupported,
        warnings
      };
    } catch (error) {
      console.error('Error getting system info:', error);
      return {
        platform: 'unknown',
        arch: 'unknown',
        hasNvidiaGPU: false,
        isMac: false,
        isAMD: false,
        isSupported: false,
        warnings: ['Unable to detect system configuration']
      };
    }
  };

  // Handle user consent
  const handleUserConsent = async () => {
    localStorage.setItem(COMFYUI_CONSENT_KEY, 'true');
    setUserHasConsented(true);
    setShowCompatibilityModal(false);
    
    // Save consent to file for watchdog service
    try {
      await window.electronAPI?.saveComfyUIConsent?.(true);
    } catch (error) {
      console.warn('Could not save ComfyUI consent to file:', error);
    }
    
    // Start ComfyUI initialization
    initializeComfyUI();
  };

  // Handle user rejection
  const handleUserRejection = async () => {
    setShowCompatibilityModal(false);
    setIsInitialSetupComplete(true);
    
    // Save rejection to file (so we don't keep asking immediately)
    try {
      await window.electronAPI?.saveComfyUIConsent?.(false);
    } catch (error) {
      console.warn('Could not save ComfyUI rejection to file:', error);
    }
    
    // Don't set localStorage consent, so modal will show again next session
  };

  // Separate ComfyUI initialization function
  const initializeComfyUI = useCallback(async () => {
    // Original ComfyUI connection logic here
    const fetchAndConnectClient = async () => {
      try {
        // First, check if we have a bundled ComfyUI container
        let comfyuiBaseUrl = '127.0.0.1:8188';
        
        try {
          // Check if Clara's ComfyUI container is available
          const containers = await window.electronAPI?.getContainers();
          const comfyuiContainer = containers?.find(c => c.name === 'clara_comfyui');
          
          if (comfyuiContainer) {
            console.log('Found Clara ComfyUI container:', comfyuiContainer.state);
            
            // Start the container if it's not running
            if (comfyuiContainer.state !== 'running') {
              setLoadingStatus(prev => ({ ...prev, connection: 'connecting' }));
              console.log('Starting Clara ComfyUI container...');
              await window.electronAPI?.containerAction(comfyuiContainer.id, 'start');
              
              // Wait for container to fully start
              await new Promise(resolve => setTimeout(resolve, 10000));
            }
            
            comfyuiBaseUrl = '127.0.0.1:8188'; // Use bundled ComfyUI
          } else {
            // Fall back to user's configuration
            const config = await db.getAPIConfig();
            comfyuiBaseUrl = config?.comfyui_base_url || '127.0.0.1:8188';
          }
        } catch (error) {
          console.warn('Could not check for bundled ComfyUI, using configuration:', error);
          // Fall back to user's configuration
          const config = await db.getAPIConfig();
          comfyuiBaseUrl = config?.comfyui_base_url || '127.0.0.1:8188';
        }

        console.log('API Config:', { comfyui_base_url: comfyuiBaseUrl });

        let url = comfyuiBaseUrl;
        if (comfyuiBaseUrl.includes('http://') || comfyuiBaseUrl.includes('https://')) {
          url = comfyuiBaseUrl.split('//')[1];
        }
        console.log('ComfyUI base URL:', url);
        const ssl_type = comfyuiBaseUrl.includes('https') ? true : false;
        console.log('SSL Type:', ssl_type);
        const client = new Client({ api_host: url, ssl: ssl_type });
        clientRef.current = client;
        client.connect();
        console.log('ComfyUI client connected');

        if (client.socket) {
          console.log('Debug: WebSocket instance:', client.socket);
          client.socket.addEventListener('open', (e) => {
            console.log('Debug: WebSocket open:', e);
            setWsStatus('Connected');
            setLoadingStatus(prev => ({ ...prev, connection: 'connected' }));
          });
          client.socket.addEventListener('message', (e) => {
            console.log('Debug: WebSocket message:', e);
          });
          client.socket.addEventListener('close', (e) => {
            console.log('Debug: WebSocket close:', e);
            setWsStatus('Disconnected');
            setLoadingStatus(prev => ({ ...prev, connection: 'error' }));
            setConnectionError('WebSocket connection closed unexpectedly');
          });
          client.socket.addEventListener('error', (e) => {
            console.log('Debug: WebSocket error:', e);
            setWsStatus('Error');
            setLoadingStatus(prev => ({ ...prev, connection: 'error' }));
            setConnectionError('Error establishing WebSocket connection');
          });
        } else {
          console.warn('Debug: No WebSocket instance on client.');
          setConnectionError('Failed to initialize WebSocket connection');
        }

        // Try to wait for connection to establish with timeout
        try {
          await waitForClientConnection(client);
        } catch (connErr) {
          console.error("Connection timeout:", connErr);
          setLoadingStatus(prev => ({ ...prev, connection: 'timeout' }));
          setConnectionError(`Connection timeout: ComfyUI is not responding after 15 seconds`);
          // Continue with the setup process even after timeout to handle remaining setup tasks
        }

        // Attach event listeners for progress and execution events
        client.events.on('status', (data) => console.log('Debug: status event:', data));
        client.events.on('progress', (data) => {
          console.log('Debug: progress event:', data);
          setProgress({ value: data.value, max: data.max });
        });
        client.events.on('execution_error', (data) => {
          console.log('Debug: execution_error event:', data);
          setGenerationError(`Execution error: ${data?.message || 'Unknown error'}`);
        });
        client.events.on('execution_success', (data) => {
          console.log('Debug: execution_success event:', data);
          setProgress(null);
        });
        client.events.on('reconnected', () => console.log('Debug: reconnected event'));
        client.events.on('reconnecting', () => console.log('Debug: reconnecting event'));
        client.events.on('image_data', (data) => console.log('Debug: image_data event:', data));
        client.events.on('message', (data) => console.log('Debug: client message event:', data));
        // client.events.on('close', (data) => console.log('Debug: client close event:', data));
        client.events.on('connection_error', (data) => {
          console.log('Debug: connection_error event:', data);
          setConnectionError(`Connection error: ${data?.message || 'Unknown error'}`);
        });
        client.events.on('unhandled', (data) => console.log('Debug: unhandled event:', data));

        // Fetch SD Models, LoRAs, VAEs, and system stats
        try {
          setLoadingStatus(prev => ({ ...prev, sdModels: 'loading' }));
          const sdModelsResp = await client.getSDModels();
          setSDModels(sdModelsResp);
          setLoadingStatus(prev => ({ ...prev, sdModels: 'success' }));
          console.log('SD Models:', sdModelsResp);
          const lastUsedModel = localStorage.getItem(LAST_USED_MODEL_KEY);
          if (lastUsedModel && sdModelsResp.includes(lastUsedModel)) {
            console.log('Found previously used model:', lastUsedModel);
            setSelectedModel(lastUsedModel);
          }
        } catch (err) {
          console.error('Error fetching SD Models:', err);
          setLoadingStatus(prev => ({ ...prev, sdModels: 'error' }));
        }
        try {
          setLoadingStatus(prev => ({ ...prev, loras: 'loading' }));
          const lorasResp = await client.getLoRAs();
          setLoras(lorasResp);
          setLoadingStatus(prev => ({ ...prev, loras: 'success' }));
          console.log('LoRAs:', lorasResp);
        } catch (err) {
          console.error('Error fetching LoRAs:', err);
          setLoadingStatus(prev => ({ ...prev, loras: 'error' }));
        }
        try {
          setLoadingStatus(prev => ({ ...prev, vaes: 'loading' }));
          const vaesResp = await client.getVAEs();
          setVAEs(vaesResp);
          setLoadingStatus(prev => ({ ...prev, vaes: 'success' }));
          console.log('VAEs:', vaesResp);
        } catch (err) {
          console.error('Error fetching VAEs:', err);
          setLoadingStatus(prev => ({ ...prev, vaes: 'error' }));
        }
        try {
          setLoadingStatus(prev => ({ ...prev, systemStats: 'loading' }));
          const sysStats = await client.getSystemStats();
          setSystemStats(sysStats);
          setLoadingStatus(prev => ({ ...prev, systemStats: 'success' }));
          console.log('System Stats:', sysStats);
        } catch (err) {
          console.error('Error fetching system stats:', err);
          setLoadingStatus(prev => ({ ...prev, systemStats: 'error' }));
        }

        // Load Control Net Models
        try {
          const controlNetResp = await client.getCNetModels();
          setControlNetModels(controlNetResp);
          console.log('Control Net Models:', controlNetResp);
        } catch (err) {
          console.error('Error fetching Control Net Models:', err);
        }

        // Load Upscale Models
        try {
          const upscaleResp = await client.getUpscaleModels();
          setUpscaleModels(upscaleResp);
          console.log('Upscale Models:', upscaleResp);
        } catch (err) {
          console.error('Error fetching Upscale Models:', err);
        }

        // Mark initial setup as complete, even if some parts failed
        setIsInitialSetupComplete(true);
      } catch (error) {
        console.error('Error connecting to ComfyUI client:', error);
        if ((error as Error)?.message?.includes('timeout')) {
          setLoadingStatus(prev => ({ ...prev, connection: 'timeout' }));
          setConnectionError(`Connection timeout: ComfyUI is not responding after 15 seconds`);
        } else {
          setConnectionError(`Failed to connect to ComfyUI: ${(error as Error)?.message || 'Unknown error'}`);
        }
        setIsInitialSetupComplete(true);
      }
    };

    fetchAndConnectClient();
  }, []);

  // Save the selected model to localStorage when it changes
  useEffect(() => {
    if (selectedModel) {
      localStorage.setItem(LAST_USED_MODEL_KEY, selectedModel);
      console.log('Saved model to localStorage:', selectedModel);
    }
  }, [selectedModel]);

  // Timeout to detect stalled generations (e.g. generation taking too long)
  useEffect(() => {
    if (!isGenerating) return;
    const timeout = setTimeout(() => {
      if (isGenerating && !generationError) {
        console.warn('Generation taking too long - may have stalled');
      }
    }, 60000);
    return () => clearTimeout(timeout);
  }, [isGenerating, generationError]);

  // (2) Auto show/hide the settings drawer based on mouse position
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const windowWidth = window.innerWidth;
      const edgeThreshold = 20;
      if (e.clientX >= windowWidth - edgeThreshold) {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setShowSettings(true);
      } else if (e.clientX < windowWidth - 320) {
        const sidebarBounds = edgeRef.current?.getBoundingClientRect();
        if (sidebarBounds) {
          const insideSidebar =
            e.clientX >= sidebarBounds.left &&
            e.clientX <= sidebarBounds.right &&
            e.clientY >= sidebarBounds.top &&
            e.clientY <= sidebarBounds.bottom;
          if (!insideSidebar) {
            hoverTimeoutRef.current = setTimeout(() => setShowSettings(false), 300);
          }
        }
      }
    };
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const handleSettingsClick = () => {
    setShowSettings(!showSettings);
  };

  // Function to cancel the current generation with cleanup
  const handleCancelGeneration = useCallback(() => {
    console.log("Cancelling generation...");
    if (currentPipeline && clientRef.current) {
      try {
        // Attempt to interrupt the pipeline (if supported)
        clientRef.current.interrupt();
      } catch (e) {
        console.error('Failed to interrupt pipeline:', e);
      }
    }
    setIsGenerating(false);
    setProgress(null);
    setGenerationError(null);
    setCurrentPipeline(null);
    if (generationTimeoutRef.current) {
      clearTimeout(generationTimeoutRef.current);
      generationTimeoutRef.current = null;
    }
  }, [currentPipeline]);

  // Function to retry generation
  const handleRetryGeneration = useCallback(() => {
    console.log("Retrying generation...");
    setGenerationError(null);
    setProgress(null);
    if (clientRef.current?.socket?.readyState !== WebSocket.OPEN) {
      console.log("WebSocket not open, attempting to reconnect...");
      if (clientRef.current) {
        try {
          clientRef.current.close();
        } catch (e) {
          console.error("Error closing existing client:", e);
        }
        clientRef.current = null;
      }
    }
    setTimeout(() => {
      handleGenerate();
    }, 300);
  }, []);

  // Add a function to retry the connection
  const handleRetryConnection = useCallback(() => {
    console.log("Retrying connection...");
    setConnectionError(null);
    setLoadingStatus(prev => ({ ...prev, connection: 'connecting' }));
    
    if (clientRef.current) {
      try {
        clientRef.current.close();
      } catch (e) {
        console.error("Error closing existing client:", e);
      }
      clientRef.current = null;
    }
    
    // Re-initialize the connection
    const fetchAndConnectClient = async () => {
      try {
        const config = await db.getAPIConfig();
        let comfyuiBaseUrl = config?.comfyui_base_url;
        if (!comfyuiBaseUrl) {
          console.warn('No comfyui_base_url found; using default 127.0.0.1:8188');
          comfyuiBaseUrl = '127.0.0.1:8188';
        }

        const client = new Client({ api_host: comfyuiBaseUrl, ssl: true });
        clientRef.current = client;
        client.connect();
        console.log('ComfyUI client connected');

        if (client.socket) {
          client.socket.addEventListener('open', (e) => {
            console.log('Debug: WebSocket open:', e);
            setWsStatus('Connected');
            setLoadingStatus(prev => ({ ...prev, connection: 'connected' }));
          });
          client.socket.addEventListener('message', (e) => {
            console.log('Debug: WebSocket message:', e);
          });
          client.socket.addEventListener('close', (e) => {
            console.log('Debug: WebSocket close:', e);
            setWsStatus('Disconnected');
            setLoadingStatus(prev => ({ ...prev, connection: 'error' }));
            setConnectionError('WebSocket connection closed unexpectedly');
          });
          client.socket.addEventListener('error', (e) => {
            console.log('Debug: WebSocket error:', e);
            setWsStatus('Error');
            setLoadingStatus(prev => ({ ...prev, connection: 'error' }));
            setConnectionError('Error establishing WebSocket connection');
          });
        }

        // Try to wait for connection to establish with timeout
        try {
          await waitForClientConnection(client);
          // Continue with model loading if connection successful
          loadModelsAndData(client);
        } catch (connErr) {
          console.error("Connection retry failed:", connErr);
          setLoadingStatus(prev => ({ ...prev, connection: 'timeout' }));
          setConnectionError(`Connection timeout: ComfyUI is not responding after 15 seconds`);
        }
      } catch (error) {
        console.error('Error connecting to ComfyUI client:', error);
        setConnectionError(`Failed to connect to ComfyUI: ${(error as Error)?.message || 'Unknown error'}`);
      }
    };
    
    fetchAndConnectClient();
  }, []);
  
  // Helper function to load models and data
  const loadModelsAndData = async (client: Client) => {
    // Try to load SD Models
    try {
      setLoadingStatus(prev => ({ ...prev, sdModels: 'loading' }));
      const sdModelsResp = await client.getSDModels();
      setSDModels(sdModelsResp);
      setLoadingStatus(prev => ({ ...prev, sdModels: 'success' }));
      
      const lastUsedModel = localStorage.getItem(LAST_USED_MODEL_KEY);
      if (lastUsedModel && sdModelsResp.includes(lastUsedModel)) {
        setSelectedModel(lastUsedModel);
      }
    } catch (err) {
      console.error('Error fetching SD Models:', err);
      setLoadingStatus(prev => ({ ...prev, sdModels: 'error' }));
    }
    
    // Try to load LoRAs, VAEs, and system stats
    try {
      setLoadingStatus(prev => ({ ...prev, loras: 'loading' }));
      const lorasResp = await client.getLoRAs();
      setLoras(lorasResp);
      setLoadingStatus(prev => ({ ...prev, loras: 'success' }));
    } catch (err) {
      console.error('Error fetching LoRAs:', err);
      setLoadingStatus(prev => ({ ...prev, loras: 'error' }));
    }
    try {
      setLoadingStatus(prev => ({ ...prev, vaes: 'loading' }));
      const vaesResp = await client.getVAEs();
      setVAEs(vaesResp);
      setLoadingStatus(prev => ({ ...prev, vaes: 'success' }));
    } catch (err) {
      console.error('Error fetching VAEs:', err);
      setLoadingStatus(prev => ({ ...prev, vaes: 'error' }));
    }
    try {
      setLoadingStatus(prev => ({ ...prev, systemStats: 'loading' }));
      const sysStats = await client.getSystemStats();
      setSystemStats(sysStats);
      setLoadingStatus(prev => ({ ...prev, systemStats: 'success' }));
    } catch (err) {
      console.error('Error fetching system stats:', err);
      setLoadingStatus(prev => ({ ...prev, systemStats: 'error' }));
    }

    // Load Control Net Models
    try {
      const controlNetResp = await client.getCNetModels();
      setControlNetModels(controlNetResp);
      console.log('Control Net Models:', controlNetResp);
    } catch (err) {
      console.error('Error fetching Control Net Models:', err);
    }

    // Load Upscale Models
    try {
      const upscaleResp = await client.getUpscaleModels();
      setUpscaleModels(upscaleResp);
      console.log('Upscale Models:', upscaleResp);
    } catch (err) {
      console.error('Error fetching Upscale Models:', err);
    }

    setIsInitialSetupComplete(true);
  };

  // Handling home navigation
  const handleNavigateHome = useCallback(() => {
    console.log("Navigating back to home/dashboard");
    if (onPageChange) {
      onPageChange('dashboard');
    }
  }, [onPageChange]);

  // (3) Generation logic: Build and execute the pipeline with improved error handling
  const handleGenerate = async () => {
    setGenerationError(null);
    try {
      if (!selectedModel) {
        // If no model is selected, attempt to use a stored or first available model
        const lastUsedModel = localStorage.getItem(LAST_USED_MODEL_KEY);
        if (lastUsedModel && sdModels.includes(lastUsedModel)) {
          console.log('Using last used model:', lastUsedModel);
          setSelectedModel(lastUsedModel);
        } else if (sdModels.length > 0) {
          console.log('Using first available model:', sdModels[0]);
          setSelectedModel(sdModels[0]);
        } else {
          setMustSelectModel(true);
          setShowSettings(true);
          return;
        }
      }
      setMustSelectModel(false);
      setIsGenerating(true);
      
      // Use existing client; do not reinitialize if already connected
      let client = clientRef.current;
      console.log('handleGenerate - client before check:', client);
      
      if (!client || client.socket?.readyState !== WebSocket.OPEN) {
        console.log('Client not available or not connected, creating new client...');
        if (client) {
          try {
            client.close();
          } catch (e) {
            console.error("Error closing existing client:", e);
          }
        }
        const config = await db.getAPIConfig();
        const url = config?.comfyui_base_url || '127.0.0.1:8188';
        client = new Client({ api_host: url, ssl: true });
        client.connect();
        clientRef.current = client;
        console.log('handleGenerate - new client created:', client);
      }
      
      try {
        await waitForClientConnection(client);
        console.log('Client connection is now open.');
      } catch (connErr) {
        console.error("Connection error:", connErr);
        if ((connErr as Error)?.message?.includes('timeout')) {
          setGenerationError(`Connection timeout: ComfyUI is not responding after 15 seconds. Please check if ComfyUI is running correctly.`);
        } else {
          setGenerationError(`Failed to establish WebSocket connection: ${(connErr as Error)?.message}`);
        }
        setIsGenerating(false);
        return;
      }

      let width = selectedResolution.width;
      let height = selectedResolution.height;
      if (selectedResolution.label === 'Custom') {
        width = customWidth;
        height = customHeight;
      }

      // Determine which pipeline to use and set it up
      let pipeline: BasePipe | EfficientPipe;
      
      // Use EfficientPipe if we have ControlNet, LoRA, or uploaded image
      // since these features are only supported in EfficientPipe
      const shouldUseEfficientPipe = imageBuffer || selectedLora || selectedControlNet;

      if (shouldUseEfficientPipe) {
        const pipe = new EfficientPipe();
        pipeline = pipe
          .with(client)
          .model(selectedModel)
          .prompt(prompt)
          .negative(negativeTags.join(', '))
          .size(width, height)
          .steps(steps)
          .cfg(guidanceScale)
          .denoise(denoise)
          .sampler(sampler)
          .scheduler(scheduler)
          .seed();

        

        // Add ControlNet if both image and controlnet model are selected
        if (selectedControlNet && imageBuffer) {
          console.log('Adding ControlNet to pipeline:', selectedControlNet, imageBuffer);
          
          const imageData = Buffer.from(arrayBufferToUint8Array(imageBuffer));
          pipeline = pipe.cnet(selectedControlNet, imageData);
        }

        // Add input image if provided
        if (imageBuffer) {
          const imageData = arrayBufferToUint8Array(imageBuffer);
          pipeline = pipe.image(Buffer.from(imageData));
        }

        // Add LoRA if selected
        if (selectedLora) {
          pipeline = pipe.lora(selectedLora, { strength: loraStrength });
        }
      } else {
        // Use BasePipe for simple text-to-image generation
        pipeline = new BasePipe()
          .with(client)
          .model(selectedModel)
          .prompt(prompt)
          .negative(negativeTags.join(', '))
          .size(width, height)
          .steps(steps)
          .cfg(guidanceScale)
          .denoise(denoise)
          .sampler(sampler)
          .scheduler(scheduler)
          .seed();
      }

      setCurrentPipeline(pipeline);
      console.log('Pipeline built:', pipeline);

      // Execute pipeline with a 5-minute timeout
      const pipelinePromise = pipeline.save().wait();
      const result = await Promise.race([
        pipelinePromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Generation timed out")), 5 * 60 * 1000)
        )
      ]) as { images: any[] };

      console.log('Generated images:', result.images[0].data);
      
      // Smart memory management: only free when switching models
      // RTX 4090 has 24GB VRAM - keep current model loaded for performance
      if (lastUsedModelRef.current && lastUsedModelRef.current !== selectedModel) {
        console.log(`Model changed from ${lastUsedModelRef.current} to ${selectedModel}, freeing memory`);
        client.free({
          free_memory: true,
          unload_models: true
        });
      }
      lastUsedModelRef.current = selectedModel;
      
      const base64Images = result.images.map((img) => {
        const base64 = arrayBufferToBase64(img.data);
        return `data:${img.mime};base64,${base64}`;
      });
      
      base64Images.forEach((dataUrl) => {
        try {
          db.addStorageItem({
            title: 'Generated Image',
            description: `Prompt: ${prompt}`,
            size: dataUrl.length,
            type: 'image',
            mime_type: 'image/png',
            data: dataUrl,
          });
        } catch (err) {
          console.error('Error saving image to DB:', err);
        }
      });

      setGeneratedImages((prev) => [...prev, ...base64Images]);
      
      const currentConfig: ModelConfig = {
        denoise,
        steps,
        guidanceScale,
        sampler,
        scheduler,
        negativeTags,
      };
      saveModelConfig(selectedModel, currentConfig);
    } catch (err) {
      console.error('Error generating image:', err);
      if (!generationError) {
        if ((err as Error)?.message?.includes('timeout')) {
          setGenerationError(`Connection timeout: ComfyUI is not responding. Please check if ComfyUI is running correctly.`);
        } else {
          setGenerationError(`Failed to generate image: ${(err as Error)?.message || 'Unknown error'}`);
        }
      }
    } finally {
      setProgress(null);
      setIsGenerating(false);
      setCurrentPipeline(null);
      if (generationTimeoutRef.current) {
        clearTimeout(generationTimeoutRef.current);
        generationTimeoutRef.current = null;
      }
    }
  };

  const handleModelSelection = (model: string) => {
    setSelectedModel(model);
    
    // Try to load saved config
    const savedConfig = loadModelConfig(model);
    
    if (savedConfig) {
      setDenoise(savedConfig.denoise);
      setSteps(savedConfig.steps);
      setGuidanceScale(savedConfig.guidanceScale);
      setSampler(savedConfig.sampler);
      setScheduler(savedConfig.scheduler);
      setNegativeTags(savedConfig.negativeTags);
      
      setNotificationMessage('Loaded your saved settings for this model');
    } else {
      // Load optimal config
      const optimalConfig = getOptimalConfig(model);
      setDenoise(optimalConfig.denoise);
      setSteps(optimalConfig.steps);
      setGuidanceScale(optimalConfig.guidanceScale);
      setSampler(optimalConfig.sampler);
      setScheduler(optimalConfig.scheduler);
      setNegativeTags(optimalConfig.negativeTags);
      
      setNotificationMessage('Clara loaded optimal settings for this model');
    }
    setShowNotification(true);
    setTimeout(() => setShowNotification(false), 3000);
  };

  // Handlers for negative prompt tags
  const handleNegativeTagAdd = () => {
    if (negativeInput.trim()) {
      setNegativeTags([...negativeTags, negativeInput.trim()]);
      setNegativeInput('');
    }
  };
  const handleNegativeTagRemove = (tagToRemove: string) => {
    setNegativeTags(negativeTags.filter((tag) => tag !== tagToRemove));
  };
  const handleNegativeInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleNegativeTagAdd();
    }
  };

  // Helpers to delete or download generated images
  const handleDelete = (index: number) => {
    setGeneratedImages((prev) => prev.filter((_, i) => i !== index));
  };
  const handleDownload = (imageDataUrl: string, index: number) => {
    const a = document.createElement('a');
    a.href = imageDataUrl;
    a.download = `generated-${index + 1}.png`;
    a.click();
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleImageUpload = (buffer: ArrayBuffer) => {
    console.log('Received image buffer in ImageGen:', buffer);
    setImageBuffer(buffer);
  };

  // Add this effect to check LLM connection
  useEffect(() => {
    const checkLLMConnection = async () => {
      try {
        const config = await db.getAPIConfig();
        
        // Fix URL construction - don't add http:// if already present
        const baseUrl = config?.ollama_base_url || 'localhost:11434';
        const url = baseUrl.startsWith('http') ? baseUrl : `http://${baseUrl}`;
        
        // Use the correct API endpoint based on the preferred server and api_type
        if (config?.api_type === 'ollama') {
          const response = await fetch(`${url}/api/tags`);
          if (response.ok) {
            setIsLLMConnected(true);
          }
        } else if (config?.api_type === 'openai') {
          // For OpenAI, we can't easily test connection without making a charged API call
          // So we'll just check if we have an API key
          setIsLLMConnected(!!config?.openai_api_key);
        }
      } catch (error) {
        console.error('LLM connection check failed:', error);
        setIsLLMConnected(false);
      }
    };
    
    checkLLMConnection();
  }, []);

  // Add enhance prompt handler
  const handleEnhancePrompt = async (currentPrompt: string, imageData?: { preview: string; buffer: ArrayBuffer; base64: string }) => {
    if (!isLLMConnected) return;
    
    setIsEnhancing(true);
    try {
      const config = await db.getAPIConfig();
      
      // Fix URL construction - don't add http:// if already present
      const baseUrl = config?.ollama_base_url || 'localhost:11434';
      const url = baseUrl.startsWith('http') ? baseUrl : `http://${baseUrl}`;
      
      console.log(`Enhancing with ${enhanceSettings.selectedModel}...`);
      
      // Case 1: Image only - Generate a prompt from the image
      // Case 2: Text only - Enhance the existing prompt
      // Case 3: Image + Text - Analyze image and incorporate original text
      const requestBody = {
        model: enhanceSettings.selectedModel,
        prompt: imageData 
          ? currentPrompt
            ? `Analyze this image and enhance the following prompt by incorporating visual details from the image: "${currentPrompt}". 
               Include specific details about style, composition, lighting, and important elements from both the image and original prompt.`
            : "Analyze this image and provide a detailed text-to-image generation prompt that would recreate it. Include style, composition, lighting, and important details."
          : enhanceSettings.systemPrompt + `\n\n ${currentPrompt}\n\n don't include the text "Original prompt:" or "Enhanced prompt:" in your response`,
        stream: false,
        max_tokens: 1000,
        images: imageData ? [imageData.base64] : undefined
      };

      console.log('Sending request with body:', {
        ...requestBody,
        images: requestBody.images ? ['[base64 data]'] : undefined
      });
      
      const response = await fetch(`${url}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to enhance prompt: ${errorText}`);
      }
      
      const data = await response.json();
      const enhancedPrompt = data.response.trim();
      
      // Update prompt and notification based on the case
      if (imageData && currentPrompt) {
        // Case 3: Image + Text
        setPrompt(`${currentPrompt}\n\n${enhancedPrompt}`);
        setNotificationMessage(`Enhanced prompt using image context and original text`);
      } else if (imageData) {
        // Case 1: Image only
        setPrompt(enhancedPrompt);
        setNotificationMessage(`Generated prompt from image using ${enhanceSettings.selectedModel}`);
      } else {
        // Case 2: Text only
        if (enhancedPrompt === currentPrompt) {
          setNotificationMessage('No changes needed to your prompt');
        } else {
          setPrompt(enhancedPrompt);
          setNotificationMessage(`Prompt enhanced with ${enhanceSettings.selectedModel}`);
        }
      }
      
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
      return enhancedPrompt;
    } catch (error) {
      console.error('Error enhancing prompt:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setNotificationMessage(`Failed to enhance prompt: ${errorMessage}`);
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 3000);
      throw error;
    } finally {
      setIsEnhancing(false);
    }
  };

  // Add function to fetch available LLM models
  const fetchLLMModels = async () => {
    try {
      const config = await db.getAPIConfig();
      
      // Fix URL construction - don't add http:// if already present
      const baseUrl = config?.ollama_base_url || 'localhost:11434';
      const url = baseUrl.startsWith('http') ? baseUrl : `http://${baseUrl}`;
      
      // Use the correct API type
      if (config?.api_type === 'ollama') {
        const response = await fetch(`${url}/api/tags`);
        if (response.ok) {
          const data = await response.json();
          return data.models.map((model: any) => model.name || model) || [];
        }
      } else if (config?.api_type === 'openai' && config.openai_api_key) {
        // For OpenAI, return some standard models that support image enhancement
        return ['gpt-4o-mini'];
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch LLM models:', error);
      return [];
    }
  };

  // Add state for available models
  const [availableLLMModels, setAvailableLLMModels] = useState<string[]>([]);

  // Add effect to fetch models when LLM is connected
  useEffect(() => {
    if (isLLMConnected) {
      fetchLLMModels().then(setAvailableLLMModels);
    }
  }, [isLLMConnected]);

  // Add handler for model selection
  const handleLLMModelSelect = (model: string) => {
    localStorage.setItem(LAST_USED_LLM_KEY, model);
    setEnhanceSettings(prev => ({ ...prev, selectedModel: model }));
  };

  // Add a new function to handle explicit image clearing
  const handleImageClear = () => {
    setImageBuffer(null);
    setClearImageFlag(true);
    // Reset the flag after a short delay to allow for future clears
    setTimeout(() => setClearImageFlag(false), 100);
  };

  return (
    <div className="flex h-screen">
      {!isInitialSetupComplete && (
        <InitialLoadingOverlay 
          loadingStatus={loadingStatus} 
          connectionError={connectionError}
          onNavigateHome={handleNavigateHome}
          onRetry={handleRetryConnection}
        />
      )}
      <Sidebar
        activePage="image-gen"
        onPageChange={onPageChange || (() => {})}
        sdModels={sdModels}
        loras={loras}
        vaes={vaes}
        systemStats={systemStats}
      />
      <div className="flex-1 flex flex-col">
        <ImageGenHeader 
          userName="User" 
          onPageChange={onPageChange} 
          systemStats={systemStats}
          onComfyUIManager={() => setShowComfyUIManager(true)}
          onModelManager={() => setShowModelManager(true)}
        />
        {isGenerating && (
          <LoadingOverlay 
            progress={progress} 
            images={generatedImages}
            error={generationError}
            onCancel={handleCancelGeneration}
            onRetry={handleRetryGeneration}
            onNavigateHome={handleNavigateHome}
          />
        )}
        <div className="flex-1 overflow-hidden flex">
          <div className={`flex-1 overflow-y-auto transition-all duration-300 ${showSettings ? 'pr-80' : 'pr-0'}`}>
            <div className={`mx-auto space-y-8 p-6 transition-all duration-300 ${showSettings ? 'max-w-5xl' : 'max-w-7xl'}`}>
              <PromptArea
                prompt={prompt}
                setPrompt={setPrompt}
                mustSelectModel={mustSelectModel}
                isGenerating={isGenerating}
                handleSettingsClick={handleSettingsClick}
                handleGenerate={handleGenerate}
                showSettings={showSettings}
                handleImageUpload={handleImageUpload}
                onEnhancePrompt={handleEnhancePrompt}
                isEnhancing={isEnhancing}
                isLLMConnected={isLLMConnected}
                availableModels={availableLLMModels}
                onModelSelect={handleLLMModelSelect}
                clearImage={clearImageFlag}
                onImageClear={handleImageClear}
              />
              <GeneratedGallery
                generatedImages={generatedImages}
                isGenerating={isGenerating}
                handleDownload={handleDownload}
                handleDelete={handleDelete}
              />
            </div>
          </div>
        </div>
      </div>
      {showNotification && (
        <div className="fixed top-4 right-4 z-50 bg-gray-800 text-white px-6 py-3 rounded-lg shadow-lg transition-opacity duration-300">
          {notificationMessage}
        </div>
      )}
      {showComfyUIManager && (
        <ComfyUIManager onClose={() => setShowComfyUIManager(false)} />
      )}
      {showModelManager && (
        <ModelManager onClose={() => setShowModelManager(false)} />
      )}
      {showCompatibilityModal && systemInfo && (
        <SystemCompatibilityModal
          isOpen={showCompatibilityModal}
          onClose={handleUserRejection}
          onAccept={handleUserConsent}
          systemInfo={systemInfo}
        />
      )}
      <SettingsDrawer
        drawerRef={edgeRef}
        showSettings={showSettings}
        expandedSections={expandedSections}
        toggleSection={toggleSection}
        sdModels={sdModels}
        selectedModel={selectedModel}
        setSelectedModel={handleModelSelection}
        loras={loras}
        selectedLora={selectedLora}
        setSelectedLora={setSelectedLora}
        loraStrength={loraStrength}
        setLoraStrength={setLoraStrength}
        vaes={vaes}
        selectedVae={selectedVae}
        setSelectedVae={setSelectedVae}
        negativeTags={negativeTags}
        negativeInput={negativeInput}
        setNegativeInput={setNegativeInput}
        handleNegativeTagAdd={handleNegativeTagAdd}
        handleNegativeTagRemove={handleNegativeTagRemove}
        handleNegativeInputKeyDown={handleNegativeInputKeyDown}
        steps={steps}
        setSteps={setSteps}
        guidanceScale={guidanceScale}
        setGuidanceScale={setGuidanceScale}
        resolutions={RESOLUTIONS}
        selectedResolution={selectedResolution}
        setSelectedResolution={setSelectedResolution}
        customWidth={customWidth}
        setCustomWidth={setCustomWidth}
        customHeight={customHeight}
        setCustomHeight={setCustomHeight}
        controlNetModels={controlNetModels}
        selectedControlNet={selectedControlNet}
        setSelectedControlNet={setSelectedControlNet}
        upscaleModels={upscaleModels}
        selectedUpscaler={selectedUpscaler}
        setSelectedUpscaler={setSelectedUpscaler}
        denoise={denoise}
        setDenoise={setDenoise}
        sampler={sampler}
        setSampler={setSampler}
        scheduler={scheduler}
        setScheduler={setScheduler}
      />
    </div>
  );
};

export default ImageGen;
