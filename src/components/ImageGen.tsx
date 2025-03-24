import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Client, BasePipe, EfficientPipe } from '@stable-canvas/comfyui-client';
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
    denoise: 0.7,
    steps: 50,
    guidanceScale: 7.5,
    sampler: 'euler',
    scheduler: 'normal',
    negativeTags: [],
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

  // Data from ComfyUI (models, LoRAs, VAEs, system stats)
  const [systemStats, setSystemStats] = useState<any>(null);
  const [sdModels, setSDModels] = useState<string[]>([]);
  const [loras, setLoras] = useState<string[]>([]);
  const [vaes, setVAEs] = useState<string[]>([]);

  // Debug state: WebSocket connection status
  const [wsStatus, setWsStatus] = useState<string>('Not Connected');

  // Reference to the ComfyUI client instance
  const clientRef = useRef<Client | null>(null);

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

  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');

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

  // (1) Connect to ComfyUI and set up client event listeners
  // IMPORTANT: This effect now runs only once on mount to avoid reinitialization
  useEffect(() => {
    const fetchAndConnectClient = async () => {
      try {
        const config = await db.getAPIConfig();
        console.log('API Config:', config);
        let comfyuiBaseUrl = config?.comfyui_base_url;
        if (!comfyuiBaseUrl) {
          console.warn('No comfyui_base_url found; using default 127.0.0.1:8188');
          comfyuiBaseUrl = '127.0.0.1:8188';
        }

        // some times user provides with protocol and some times not make sure everytime url without protocol is passed
        let url = comfyuiBaseUrl;
        if (comfyuiBaseUrl.includes('http://') || comfyuiBaseUrl.includes('https://')) {
          url = comfyuiBaseUrl.split('//')[1];
        }
        console.log('ComfyUI base URL:', url);
        // based on the baseURL decide ssl true or false
        const ssl_type =  comfyuiBaseUrl.includes('https') ? true : false;
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

    // Run only once on mount
    fetchAndConnectClient();

    // Cleanup: close client on unmount
    return () => {
      if (clientRef.current) {
        clientRef.current.close();
        clientRef.current = null;
      }
    };
  }, []); // Empty dependency array to avoid reinitializing the client

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
      client.free(
        {
          free_memory: true,
          unload_models: true
        }
      );
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
      
      // Clear the image buffer after successful generation
      setImageBuffer(null);

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
              <PromptArea
                prompt={prompt}
                setPrompt={setPrompt}
                mustSelectModel={mustSelectModel}
                isGenerating={isGenerating}
                handleSettingsClick={handleSettingsClick}
                handleGenerate={handleGenerate}
                showSettings={showSettings}
                handleImageUpload={handleImageUpload}
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
