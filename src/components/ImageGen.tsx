import React, { useState, useEffect } from 'react';
import { Client, BasePipe } from '@stable-canvas/comfyui-client'; 
import { ImageIcon, Wand2, Download, RefreshCw, Trash2, ChevronLeft, X, Plus } from 'lucide-react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { db, type APIConfig } from '../db';

// Map your UI “model name” to the actual .safetensors or model path
const MODEL_MAP: Record<string, string> = {
  'stable-diffusion-xl': 'SDXL/sd_xl_base_1.0.safetensors',
  'flux':"FLUX1/flux1-dev-fp8.safetensors"
};

// For your resolution preset buttons
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
];

const MODELS = ['stable-diffusion-xl', 'flux'];

interface ImageGenProps {
  onPageChange?: (page: string) => void;
}

const ImageGen: React.FC<ImageGenProps> = ({ onPageChange }) => {
  // ──────────────────────────────────────────────
  // State: prompts, generation, etc.
  // ──────────────────────────────────────────────
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);

  // Side panel (settings) toggle
  const [showSettings, setShowSettings] = useState(false);

  // Generation settings
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [negativeTags, setNegativeTags] = useState<string[]>([]);
  const [steps, setSteps] = useState(50);
  const [guidanceScale, setGuidanceScale] = useState(7.5);
  const [selectedResolution, setSelectedResolution] = useState<Resolution>(RESOLUTIONS[0]);
  const [negativeInput, setNegativeInput] = useState('');

  // ──────────────────────────────────────────────
  // State for API config (loaded from DB)
  // ──────────────────────────────────────────────
  const [apiConfig, setApiConfig] = useState<APIConfig>({
    comfyui_base_url: '',
    ollama_base_url: '',
  });

  // ──────────────────────────────────────────────
  // Load user's ComfyUI config from IndexedDB
  // ──────────────────────────────────────────────
  useEffect(() => {
    const loadApiConfig = async () => {
      try {
        const storedConfig = await db.getAPIConfig();
        if (storedConfig) {
          setApiConfig(storedConfig);
        }
      } catch (error) {
        console.error('Failed to load API config:', error);
      }
    };
    loadApiConfig();
  }, []);

  // ──────────────────────────────────────────────
  // Negative prompt tags handlers
  // ──────────────────────────────────────────────
  const handleAddTag = (tag: string) => {
    const trimmedTag = tag.trim();
    if (trimmedTag && !negativeTags.includes(trimmedTag)) {
      setNegativeTags((prev) => [...prev, trimmedTag]);
      setNegativeInput('');
    }
  };

  const handleNegativeInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ' || e.key === ',' || e.key === 'Enter') {
      e.preventDefault();
      handleAddTag(negativeInput);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setNegativeTags((tags) => tags.filter((tag) => tag !== tagToRemove));
  };

  // ──────────────────────────────────────────────
  // Utility: Convert ArrayBuffer to base64
  // ──────────────────────────────────────────────
  const arrayBufferToDataURL = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64String = window.btoa(binary);
    return `data:image/png;base64,${base64String}`;
  };

  // ──────────────────────────────────────────────
  // Main Generate handler
  // ──────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    setIsGenerating(true);

    // Figure out the user’s actual configured host/port
    let apiHost = '127.0.0.1:8188'; // fallback if user’s config is invalid
    if (apiConfig.comfyui_base_url) {
      try {
        const url = new URL(apiConfig.comfyui_base_url);
        apiHost = url.host;
      } catch (err) {
        console.warn('Invalid ComfyUI base URL, using default 127.0.0.1:8188');
      }
    }

    // Create client (on demand) and connect
    const client = new Client({ api_host: apiHost , ssl: true});

    try {
    // wait for connection
    let  data = client.connect();

    console.log(data);

    //  wait for some time
     await new Promise((resolve) => setTimeout(resolve, 1000));

      const pipe = new BasePipe()
        .with(client)
        .model(MODEL_MAP[selectedModel] || MODEL_MAP['stable-diffusion-xl'])
        .prompt(prompt)
        .negative(negativeTags.join(', '))
        .steps(steps)
        .cfg(guidanceScale)
        .size(selectedResolution.width, selectedResolution.height)
        .save();

      // Wait for images
      const { images } = await pipe.wait();

      // Convert each image’s ArrayBuffer → base64 data URL
      const newImageUrls = images.map((img) => arrayBufferToDataURL(img.data));
      setGeneratedImages((prev) => [...prev, ...newImageUrls]);

    } catch (err) {
      console.error('Error generating images:', err);
    } finally {
      // Clean up
      client.close();
      setIsGenerating(false);
    }
  };

  // ──────────────────────────────────────────────
  // Remove an image from the grid
  // ──────────────────────────────────────────────
  const handleDelete = (index: number) => {
    setGeneratedImages((prev) => prev.filter((_, i) => i !== index));
  };

  // ──────────────────────────────────────────────
  // Render
  // ──────────────────────────────────────────────
  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <Sidebar activePage="image-gen" onPageChange={onPageChange || (() => {})} />

      {/* Main area */}
      <div className="flex-1 flex flex-col">
        <Topbar userName="User" onPageChange={onPageChange} />

        <div className="flex-1 overflow-hidden flex">
          {/* Main Content */}
          <div
            className={`flex-1 overflow-y-auto transition-all duration-300 ${
              showSettings ? 'pr-80' : 'pr-0'
            }`}
          >
            <div
              className={`mx-auto space-y-8 p-6 transition-all duration-300 ${
                showSettings ? 'max-w-5xl' : 'max-w-7xl'
              }`}
            >
              {/* Header */}
              <div className="mb-8">
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                  Image Generation
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Create unique images using AI-powered image generation
                </p>
              </div>

              {/* Prompt Input */}
              <div className="glassmorphic rounded-xl p-6">
                <div className="space-y-4">
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

                  {/* Generate button & toggle sidebar */}
                  <div className="flex justify-between items-center">
                    <button
                      onClick={() => setShowSettings(!showSettings)}
                      className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    >
                      <ChevronLeft
                        className={`w-6 h-6 transform transition-transform ${
                          showSettings ? 'rotate-180' : ''
                        }`}
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

              {/* Generated Images Grid */}
              {generatedImages.length > 0 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">
                    Generated Images
                  </h2>
                  <div
                    className={`grid gap-6 ${
                      showSettings
                        ? 'grid-cols-1 sm:grid-cols-2'
                        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                    }`}
                  >
                    {generatedImages.map((image, index) => (
                      <div
                        key={index}
                        className="glassmorphic rounded-xl overflow-hidden group relative"
                      >
                        <img
                          src={image}
                          alt={`Generated ${index + 1}`}
                          className="w-full h-64 object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                          <button
                            onClick={() => window.open(image, '_blank')}
                            className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                            title="Download"
                          >
                            <Download className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(index)}
                            className="p-2 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {generatedImages.length === 0 && !isGenerating && (
                <div className="text-center py-16 border border-dashed rounded-lg border-gray-300 dark:border-gray-700">
                  <div className="inline-flex items-center justify-center p-6 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                    <ImageIcon className="w-8 h-8 text-sakura-500" />
                  </div>
                  <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                    No images generated yet
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                    Enter a description above and click generate to create your first AI-powered
                    image.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Settings Sidebar */}
          <div
            className={`w-80 glassmorphic border-l border-gray-200 dark:border-gray-700 fixed right-0 top-16 bottom-0 transform transition-transform duration-300 ${
              showSettings ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="p-6 space-y-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Generation Settings
              </h3>

              {/* Model Selection */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Model
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                >
                  {MODELS.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>

              {/* Negative Prompts */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Negative Prompts
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {negativeTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-sm flex items-center gap-1"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={negativeInput}
                    onChange={(e) => setNegativeInput(e.target.value)}
                    onKeyDown={handleNegativeInputKeyDown}
                    placeholder="Add tags..."
                    className="flex-1 px-3 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100 text-sm"
                  />
                  <button
                    onClick={() => handleAddTag(negativeInput)}
                    className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    <Plus className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Press space, comma, or enter to add tags
                </p>
              </div>

              {/* Steps Slider */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Steps: {steps}
                </label>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={steps}
                  onChange={(e) => setSteps(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Guidance Scale Slider */}
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

              {/* Resolution Selection */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Resolution
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {RESOLUTIONS.map((resolution) => (
                    <button
                      key={resolution.label}
                      onClick={() => setSelectedResolution(resolution)}
                      className={`p-2 rounded-lg text-sm text-center transition-colors ${
                        selectedResolution === resolution
                          ? 'bg-sakura-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <div>{resolution.label}</div>
                      <div className="text-xs opacity-75">
                        {resolution.width}×{resolution.height}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div> 
    </div>
  );
};

export default ImageGen;
