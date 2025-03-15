import React, { useState, useEffect, useRef } from 'react';
import {
  ImageIcon,
  Wand2,
  Download,
  RefreshCw,
  Trash2,
  Settings,
  X,
  Plus,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import Sidebar from './Sidebar';
import ImageGenHeader from './ImageGenHeader';
import { db } from '../db';

// Import ComfyUI client & pipes from the library
import { Client, BasePipe, EfficientPipe } from '@stable-canvas/comfyui-client';

interface ImageGenProps {
  onPageChange?: (page: string) => void;
}

interface Resolution {
  label: string;
  width: number;
  height: number;
}

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

// Utility function to convert an ArrayBuffer to a base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Basic full-screen loading overlay with a playful "dino"
function LoadingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 text-white text-center">
      <div>
        <pre className="mb-4">
          {`
         /\\_./\\
        ( o.o  )
         > ^ < 
          `}
        </pre>
        <p className="text-lg">Generating Image... Please wait!</p>
      </div>
    </div>
  );
}

const ImageGen: React.FC<ImageGenProps> = ({ onPageChange }) => {
  // UI state variables
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [mustSelectModel, setMustSelectModel] = useState(false);

  // Data from ComfyUI (models, LoRAs, VAEs, system stats)
  const [systemStats, setSystemStats] = useState<any>(null);
  const [sdModels, setSDModels] = useState<string[]>([]);
  const [loras, setLoras] = useState<string[]>([]);
  const [vaes, setVAEs] = useState<string[]>([]);

  // Debug state: to track WebSocket connection status
  const [wsStatus, setWsStatus] = useState<string>('Not Connected');

  // Reference to the ComfyUI client instance
  const clientRef = useRef<Client | null>(null);

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
    resolution: true
  });

  const edgeRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout>();

  // (1) Connect to ComfyUI, fetch models, and set up WebSocket and event listeners
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

        const client = new Client({ api_host: comfyuiBaseUrl, ssl: true });
        clientRef.current = client;

        // Connect to the server (which sets up the socket)
        client.connect();
        console.log('ComfyUI client connected');

        // Debug: Check for WebSocket instance using the correct property (socket)
        if (client.socket) {
          console.log('Debug: WebSocket instance:', client.socket);
          client.socket.addEventListener('open', (e) => {
            console.log('Debug: WebSocket open:', e);
            setWsStatus('Connected');
          });
          client.socket.addEventListener('message', (e) => {
            console.log('Debug: WebSocket message:', e);
          });
          client.socket.addEventListener('close', (e) => {
            console.log('Debug: WebSocket close:', e);
            setWsStatus('Disconnected');
          });
          client.socket.addEventListener('error', (e) => {
            console.log('Debug: WebSocket error:', e);
            setWsStatus('Error');
          });
        } else {
          console.warn('Debug: No WebSocket instance on client.');
        }

        // Listen to client events via the EventEmitter
        client.events.on('status', (data) => console.log('Debug: status event:', data));
        client.events.on('progress', (data) => console.log('Debug: progress event:', data));
        client.events.on('executing', (data) => console.log('Debug: executing event:', data));
        client.events.on('executed', (data) => console.log('Debug: executed event:', data));
        client.events.on('execution_interrupted', (data) => console.log('Debug: execution_interrupted event:', data));
        client.events.on('execution_start', (data) => console.log('Debug: execution_start event:', data));
        client.events.on('execution_error', (data) => console.log('Debug: execution_error event:', data));
        client.events.on('execution_cached', (data) => console.log('Debug: execution_cached event:', data));
        client.events.on('execution_success', (data) => console.log('Debug: execution_success event:', data));
        client.events.on('reconnected', () => console.log('Debug: reconnected event'));
        client.events.on('reconnecting', () => console.log('Debug: reconnecting event'));
        client.events.on('image_data', (data) => console.log('Debug: image_data event:', data));
        client.events.on('message', (data) => console.log('Debug: client message event:', data));
        client.events.on('close', (data) => console.log('Debug: client close event:', data));
        client.events.on('connection_error', (data) => console.log('Debug: connection_error event:', data));
        client.events.on('unhandled', (data) => console.log('Debug: unhandled event:', data));

        // Fetch models, LoRAs, VAEs, and system stats
        try {
          const sdModelsResp = await client.getSDModels();
          setSDModels(sdModelsResp);
          console.log('SD Models:', sdModelsResp);
        } catch (err) {
          console.error('Error fetching SD Models:', err);
        }
        try {
          const lorasResp = await client.getLoRAs();
          setLoras(lorasResp);
          console.log('LoRAs:', lorasResp);
        } catch (err) {
          console.error('Error fetching LoRAs:', err);
        }
        try {
          const vaesResp = await client.getVAEs();
          setVAEs(vaesResp);
          console.log('VAEs:', vaesResp);
        } catch (err) {
          console.error('Error fetching VAEs:', err);
        }
        try {
          const sysStats = await client.getSystemStats();
          setSystemStats(sysStats);
          console.log('System Stats:', sysStats);
        } catch (err) {
          console.error('Error fetching system stats:', err);
        }
      } catch (error) {
        console.error('Error connecting to ComfyUI client:', error);
      }
    };

    fetchAndConnectClient();

    // Cleanup: close client on unmount
    return () => {
      if (clientRef.current) {
        clientRef.current.close();
        clientRef.current = null;
      }
    };
  }, []);

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

  // (3) Generation logic: build and execute the image-generation pipeline
  const handleGenerate = async () => {
    if (!selectedModel) {
      setMustSelectModel(true);
      setShowSettings(true);
      return;
    }
    setMustSelectModel(false);
    setIsGenerating(true);
    try {
      let client = clientRef.current;
      if (!client) {
        const config = await db.getAPIConfig();
        const url = config?.comfyui_base_url || '127.0.0.1:8188';
        client = new Client({ api_host: url, ssl: true });
        client.connect();
      }

      let width = selectedResolution.width;
      let height = selectedResolution.height;
      if (selectedResolution.label === 'Custom') {
        width = customWidth;
        height = customHeight;
      }

      const pipeline = selectedLora
        ? new EfficientPipe()
            .with(client)
            .model(selectedModel)
            .prompt(prompt)
            .negative(negativeTags.join(', '))
            .size(width, height)
            .steps(steps)
            .cfg(guidanceScale)
            .lora(selectedLora)
        : new BasePipe()
            .with(client)
            .model(selectedModel)
            .prompt(prompt)
            .negative(negativeTags.join(', '))
            .size(width, height)
            .steps(steps)
            .cfg(guidanceScale);

      // Optionally, add VAE configuration if a VAE is selected

      await pipeline.save().wait().then(({ images }) => {
        console.log('Generated images:', images[0].data);
        const base64Images = images.map((img) => {
          const base64 = arrayBufferToBase64(img.data);
          return `data:${img.mime};base64,${base64}`;
        });

        // Save each image to local storage
        base64Images.forEach((dataUrl) => {
          try {
            db.addStorageItem({
              title: 'Generated Image',
              description: `Prompt: ${prompt}`,
              size: dataUrl.length,
              type: 'image',
              mime_type: 'image/png',
              data: dataUrl
            });
          } catch (err) {
            console.error('Error saving image to DB:', err);
          }
        });

        setGeneratedImages(prev => [...prev, ...base64Images]);
      });
    } catch (err) {
      console.error('Error generating image:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handlers for negative prompt tags
  const handleNegativeTagAdd = () => {
    if (negativeInput.trim()) {
      setNegativeTags([...negativeTags, negativeInput.trim()]);
      setNegativeInput('');
    }
  };
  const handleNegativeTagRemove = (tagToRemove: string) => {
    setNegativeTags(negativeTags.filter(tag => tag !== tagToRemove));
  };
  const handleNegativeInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleNegativeTagAdd();
    }
  };

  // Helpers to delete or download generated images
  const handleDelete = (index: number) => {
    setGeneratedImages(prev => prev.filter((_, i) => i !== index));
  };
  const handleDownload = (imageDataUrl: string, index: number) => {
    const a = document.createElement('a');
    a.href = imageDataUrl;
    a.download = `generated-${index + 1}.png`;
    a.click();
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="flex h-screen">
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

        {/* Debug UI: Display current WebSocket status */}
        {/* <div className="p-2 text-center bg-gray-200 dark:bg-gray-700">
          <p className="text-sm">WebSocket Status: {wsStatus}</p>
        </div> */}

        {isGenerating && <LoadingOverlay />}

        <div className="flex-1 overflow-hidden flex">
          <div className={`flex-1 overflow-y-auto transition-all duration-300 ${showSettings ? 'pr-80' : 'pr-0'}`}>
            <div className={`mx-auto space-y-8 p-6 transition-all duration-300 ${showSettings ? 'max-w-5xl' : 'max-w-7xl'}`}>
              {/* Prompt Area */}
              <div className="glassmorphic rounded-xl p-6">
                <div className="space-y-4">
                  {mustSelectModel && (
                    <div className="bg-red-100 text-red-800 p-2 rounded">
                      <strong>Please select a model from the side panel first.</strong>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Describe your image
                    </label>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      placeholder="A serene landscape with mountains and a lake at sunset..."
                      className="w-full px-4 py-3 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100 min-h-[100px]"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <button onClick={handleSettingsClick} className="p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5 cursor-pointer transition-colors">
                      <Settings
                        className={`w-6 h-6 text-gray-600 dark:text-gray-400 transition-transform duration-300 ${showSettings ? 'rotate-180' : ''}`}
                      />
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating || !prompt.trim()}
                      className="flex items-center gap-2 px-6 py-2 rounded-lg bg-sakura-500 text-white hover:bg-sakura-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {isGenerating ? (
                        <>
                          <RefreshCw className="w-5 h-5 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Wand2 className="w-5 h-5" />
                          Generate
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Generated Images Gallery */}
              {generatedImages.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">Generated Images</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {generatedImages.map((image, index) => (
                      <div key={index} className="glassmorphic rounded-xl overflow-hidden group relative">
                        <img src={image} alt={`Generated ${index + 1}`} className="w-full h-64 object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                          <button onClick={() => handleDownload(image, index)} className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors" title="Download">
                            <Download className="w-5 h-5" />
                          </button>
                          <button onClick={() => handleDelete(index)} className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors" title="Delete">
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Placeholder UI when no images are generated */}
              {generatedImages.length === 0 && !isGenerating && (
                <div className="text-center py-16 border border-dashed rounded-lg border-gray-300 dark:border-gray-700">
                  <div className="inline-flex items-center justify-center p-6 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                    <ImageIcon className="w-8 h-8 text-sakura-500" />
                  </div>
                  <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No images generated yet</h3>
                  <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                    Enter a description above and click Generate to create your first AI-powered image.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Right-side Settings Drawer */}
      <div
        ref={edgeRef}
        className={`w-80 glassmorphic border-l border-gray-200 dark:border-gray-700 fixed right-0 top-16 bottom-0 transform transition-transform duration-300 ${
          showSettings ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-6 space-y-6 h-full overflow-y-auto">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Generation Settings</h3>
          {/* Model Selection */}
          <div className="space-y-4 border-b border-gray-200 dark:border-gray-700 pb-4">
            <button onClick={() => toggleSection('model')} className="flex items-center justify-between w-full">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Model</span>
              {expandedSections.model ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedSections.model && (
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
              >
                <option value="">-- Select a Model --</option>
                {sdModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
          </div>
          {/* LoRA Selection */}
          <div className="space-y-4 border-b border-gray-200 dark:border-gray-700 pb-4">
            <button onClick={() => toggleSection('lora')} className="flex items-center justify-between w-full">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">LoRA</span>
              {expandedSections.lora ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedSections.lora && (
              <div className="space-y-3">
                <select
                  value={selectedLora}
                  onChange={(e) => setSelectedLora(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                >
                  <option value="">-- No LoRA --</option>
                  {loras.map((loraName) => (
                    <option key={loraName} value={loraName}>
                      {loraName}
                    </option>
                  ))}
                </select>
                {selectedLora && (
                  <div className="space-y-2">
                    <label className="block text-sm text-gray-700 dark:text-gray-300">
                      Strength: {loraStrength.toFixed(2)}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={loraStrength}
                      onChange={(e) => setLoraStrength(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
          {/* VAE Selection */}
          <div className="space-y-4 border-b border-gray-200 dark:border-gray-700 pb-4">
            <button onClick={() => toggleSection('vae')} className="flex items-center justify-between w-full">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">VAE Model</span>
              {expandedSections.vae ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedSections.vae && (
              <select
                value={selectedVae}
                onChange={(e) => setSelectedVae(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
              >
                <option value="">-- No VAE --</option>
                {vaes.map((vaeName) => (
                  <option key={vaeName} value={vaeName}>
                    {vaeName}
                  </option>
                ))}
              </select>
            )}
          </div>
          {/* Negative Prompts */}
          <div className="space-y-4 border-b border-gray-200 dark:border-gray-700 pb-4">
            <button onClick={() => toggleSection('negative')} className="flex items-center justify-between w-full">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Negative Prompts</span>
              {expandedSections.negative ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedSections.negative && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={negativeInput}
                    onChange={(e) => setNegativeInput(e.target.value)}
                    onKeyDown={handleNegativeInputKeyDown}
                    placeholder="Add negative prompt..."
                    className="flex-1 px-3 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                  />
                  <button onClick={handleNegativeTagAdd} className="p-2 rounded-lg bg-sakura-500 text-white hover:bg-sakura-600">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {negativeTags.map((tag, index) => (
                    <div key={index} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{tag}</span>
                      <button onClick={() => handleNegativeTagRemove(tag)} className="p-0.5 hover:text-red-500">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Steps and Guidance Scale */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Steps: {steps}</label>
            <input
              type="range"
              min="1"
              max="100"
              value={steps}
              onChange={(e) => setSteps(parseInt(e.target.value))}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Guidance Scale: {guidanceScale.toFixed(1)}
            </label>
            <input
              type="range"
              min="1"
              max="10"
              step="0.1"
              value={guidanceScale}
              onChange={(e) => setGuidanceScale(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
          {/* Resolution Settings */}
          <div className="space-y-4">
            <button onClick={() => toggleSection('resolution')} className="flex items-center justify-between w-full">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Resolution</span>
              {expandedSections.resolution ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {expandedSections.resolution && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {RESOLUTIONS.map((res) => (
                    <button
                      key={res.label}
                      onClick={() => setSelectedResolution(res)}
                      className={`p-2 rounded-lg text-sm text-center transition-colors ${
                        selectedResolution.label === res.label
                          ? 'bg-sakura-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <div>{res.label}</div>
                      {res.label !== 'Custom' && (
                        <div className="text-xs opacity-75">
                          {res.width}×{res.height}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                {selectedResolution.label === 'Custom' && (
                  <div className="mt-4 space-y-2">
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300">Custom Width</label>
                      <input
                        type="number"
                        value={customWidth}
                        onChange={(e) => setCustomWidth(parseInt(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-700 dark:text-gray-300">Custom Height</label>
                      <input
                        type="number"
                        value={customHeight}
                        onChange={(e) => setCustomHeight(parseInt(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImageGen;
