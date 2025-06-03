import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './Sidebar';
import ImageGenHeader from './ImageGenHeader';
import { db } from '../db';

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

const ImageGen: React.FC<ImageGenProps> = ({ onPageChange }) => {
  // UI state variables
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [mustSelectModel, setMustSelectModel] = useState(false);
  const [progress, setProgress] = useState<{ value: number; max: number } | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [currentPipeline, setCurrentPipeline] = useState<any | null>(null);

  // localStorage key for storing selected model
  const LAST_USED_MODEL_KEY = 'clara-ollama-last-used-model';

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

  // Data from comfyui-api
  const [systemStats, setSystemStats] = useState<any>(null);
  const [sdModels, setSDModels] = useState<string[]>([]);
  const [loras, setLoras] = useState<string[]>([]);
  const [vaes, setVAEs] = useState<string[]>([]);

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

  // Wallpaper state
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);
  useEffect(() => {
    const loadWallpaper = async () => {
      try {
        const wallpaper = await db.getWallpaper();
        if (wallpaper) {
          setWallpaperUrl(wallpaper);
        }
      } catch (error) {
        console.error('Error loading wallpaper:', error);
      }
    };
    loadWallpaper();
  }, []);

  // comfyui-api base url helper
  const getComfyApiUrl = async () => {
    const config = await db.getAPIConfig();
    let url = config?.comfyui_base_url || '127.0.0.1:8188';
    if (!url.startsWith('http')) url = 'http://' + url;
    url = url.replace(/:(\d+)$/, ':8189');
    return url;
  };

  // Fetch models, loras, vaes, and system stats from comfyui-api
  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoadingStatus(prev => ({ ...prev, connection: 'connecting' }));
        const apiUrl = await getComfyApiUrl();
        // System stats
        setLoadingStatus(prev => ({ ...prev, systemStats: 'loading' }));
        const sysResp = await fetch(`${apiUrl}/system_stats`);
        if (!sysResp.ok) throw new Error('Failed to fetch system stats');
        const sysStats = await sysResp.json();
        setSystemStats(sysStats);
        setLoadingStatus(prev => ({ ...prev, systemStats: 'success' }));
        setLoadingStatus(prev => ({ ...prev, connection: 'connected' }));
        // Models
        setLoadingStatus(prev => ({ ...prev, sdModels: 'loading' }));
        const modelsResp = await fetch(`${apiUrl}/object_info`);
        if (!modelsResp.ok) throw new Error('Failed to fetch models info');
        const modelsInfo = await modelsResp.json();
        // Parse models, loras, vaes from object_info
        const models = modelsInfo?.model_list || [];
        setSDModels(models);
        setLoadingStatus(prev => ({ ...prev, sdModels: 'success' }));
        const loras = modelsInfo?.lora_list || [];
        setLoras(loras);
        setLoadingStatus(prev => ({ ...prev, loras: 'success' }));
        const vaes = modelsInfo?.vae_list || [];
        setVAEs(vaes);
        setLoadingStatus(prev => ({ ...prev, vaes: 'success' }));
        setIsInitialSetupComplete(true);
      } catch (err) {
        setConnectionError('Cannot connect to ComfyUI API. Please check your ComfyUI server is running and configure the correct URL in Settings.');
        setLoadingStatus(prev => ({ ...prev, connection: 'error', systemStats: 'error', sdModels: 'error', loras: 'error', vaes: 'error' }));
        setIsInitialSetupComplete(true);
      }
    };
    fetchAll();
  }, []);

  // Generation logic: Build and execute the workflow via comfyui-api
  const handleGenerate = async () => {
    setGenerationError(null);
    try {
      if (!selectedModel) {
        const lastUsedModel = localStorage.getItem(LAST_USED_MODEL_KEY);
        if (lastUsedModel && sdModels.includes(lastUsedModel)) {
          setSelectedModel(lastUsedModel);
        } else if (sdModels.length > 0) {
          setSelectedModel(sdModels[0]);
        } else {
          setMustSelectModel(true);
          setShowSettings(true);
          return;
        }
      }
      
      // Check if we have a connection error before attempting generation
      if (connectionError) {
        setGenerationError('Cannot generate images: ComfyUI is not connected. Please check your ComfyUI server is running and configure the correct URL in Settings.');
        return;
      }
      
      setMustSelectModel(false);
      setIsGenerating(true);
      // Build workflow JSON for comfyui-api
      let width = selectedResolution.width;
      let height = selectedResolution.height;
      if (selectedResolution.label === 'Custom') {
        width = customWidth;
        height = customHeight;
      }
      // Build a simple workflow JSON (you may need to adapt this to your workflow structure)
      const workflow_id = 'default';
      const workflowPrompt = {
        model: selectedModel,
        prompt,
        negative: negativeTags.join(', '),
        width,
        height,
        steps,
        cfg: guidanceScale,
        denoise,
        sampler,
        scheduler,
        lora: selectedLora,
        loraStrength,
        vae: selectedVae,
        // Add more fields as needed
      };
      const apiUrl = await getComfyApiUrl();
      const resp = await fetch(`${apiUrl}/v1/workflows/${workflow_id}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflow_id, prompt: workflowPrompt }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      const runId = data.id || data.run_id;
      // Poll for result
      let result = null;
      for (let i = 0; i < 150; i++) { // up to 5 minutes
        await new Promise(res => setTimeout(res, 2000));
        const pollResp = await fetch(`${apiUrl}/v1/workflows/${workflow_id}/runs/${runId}`);
        if (!pollResp.ok) throw new Error(await pollResp.text());
        const pollData = await pollResp.json();
        if (pollData.status === 'COMPLETED') {
          result = pollData;
          break;
        } else if (pollData.status === 'ERROR') {
          throw new Error('Generation failed: ' + (pollData.error || 'Unknown error'));
        }
      }
      if (!result) throw new Error('Generation timed out');
      // Assume result.images is an array of base64 strings or URLs
      const base64Images = result.images || [];
      setGeneratedImages((prev) => [...prev, ...base64Images]);
      // Save to DB if needed
      base64Images.forEach((dataUrl: string) => {
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
    } catch (err) {
      const errorMessage = (err as Error)?.message || 'Unknown error';
      if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('connect')) {
        setGenerationError(`Connection failed: Cannot reach ComfyUI server. Please check if ComfyUI is running and configure the correct URL in Settings.`);
      } else {
        setGenerationError(`Failed to generate image: ${errorMessage}`);
      }
    } finally {
      setProgress(null);
      setIsGenerating(false);
      setCurrentPipeline(null);
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
    if (!isLLMConnected) {
      setNotificationMessage('LLM is not connected. Please configure your Ollama or OpenAI settings to use prompt enhancement.');
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 5000);
      return;
    }
    
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
      if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('connect')) {
        setNotificationMessage('Cannot connect to LLM service. Please check your Ollama server is running or configure your OpenAI API key in Settings.');
      } else {
        setNotificationMessage(`Failed to enhance prompt: ${errorMessage}`);
      }
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 5000);
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

  // --- Add missing handler stubs to fix ReferenceError ---
  const handleNavigateHome = () => {
    // TODO: Implement navigation to home if needed
  };

  const handleRetryConnection = () => {
    // TODO: Implement retry logic if needed
  };

  const handleCancelGeneration = () => {
    // TODO: Implement cancel logic if needed
  };

  const handleRetryGeneration = () => {
    // TODO: Implement retry logic if needed
  };

  const handleSettingsClick = () => {
    setShowSettings((prev) => !prev);
  };

  return (
    <div className="relative flex h-screen">
      {/* Wallpaper */}
      {wallpaperUrl && (
        <div 
          className="absolute top-0 left-0 right-0 bottom-0 z-0"
          style={{
            backgroundImage: `url(${wallpaperUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.1,
            filter: 'blur(1px)',
            pointerEvents: 'none'
          }}
        />
      )}
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
      />
      <div className="flex-1 flex flex-col">
        <ImageGenHeader userName="User" onPageChange={onPageChange} systemStats={systemStats} />
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
              {/* Connection Status Warning */}
              {(connectionError || !isLLMConnected) && (
                <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-300">Service Connection Issues</h3>
                  </div>
                  <div className="text-sm text-yellow-700 dark:text-yellow-400 space-y-2">
                    {connectionError && (
                      <p>• ComfyUI is not connected - Image generation is unavailable</p>
                    )}
                    {!isLLMConnected && (
                      <p>• LLM service is not connected - Prompt enhancement is unavailable</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => onPageChange?.('settings')}
                      className="text-sm bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded-md transition-colors"
                    >
                      Configure Settings
                    </button>
                    <button
                      onClick={() => window.location.reload()}
                      className="text-sm text-yellow-600 hover:text-yellow-700 dark:text-yellow-400 dark:hover:text-yellow-300 underline"
                    >
                      Retry Connection
                    </button>
                  </div>
                </div>
              )}
              
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
