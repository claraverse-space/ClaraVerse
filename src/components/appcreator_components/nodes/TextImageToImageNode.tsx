import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';
import { ImageIcon, Settings, Sliders, RefreshCw } from 'lucide-react';
import { db } from '../../../db';

const SAMPLERS = [
  'euler', 'euler_ancestral', 'heun', 'dpm_2', 'dpm_2_ancestral',
  'lms', 'dpm_solver_pp', 'dpm_solver', 'unipc', 'ddim'
];

const SCHEDULERS = [
  'normal', 'karras', 'exponential', 'sgm_uniform', 
  'simple', 'ddim_uniform'
];

const TextImageToImageNode = ({ data, isConnectable }: any) => {
  const { isDark } = useTheme();
  const tool = data.tool;
  const Icon = tool.icon || ImageIcon;
  const nodeColor = isDark ? tool.darkColor : tool.lightColor;

  // Settings state
  const [showSettings, setShowSettings] = useState(false);
  const [model, setModel] = useState(data.config?.model || '');
  const [lora, setLora] = useState(data.config?.lora || '');
  const [loraStrength, setLoraStrength] = useState(data.config?.loraStrength || 0.75);
  const [vae, setVae] = useState(data.config?.vae || '');
  const [controlNet, setControlNet] = useState(data.config?.controlNet || '');
  const [steps, setSteps] = useState(data.config?.steps || 20);
  const [guidance, setGuidance] = useState(data.config?.guidance || 7);
  const [width, setWidth] = useState(data.config?.width || 512);
  const [height, setHeight] = useState(data.config?.height || 512);
  const [denoise, setDenoise] = useState(data.config?.denoise || 0.7);
  const [sampler, setSampler] = useState(data.config?.sampler || 'euler');
  const [scheduler, setScheduler] = useState(data.config?.scheduler || 'normal');
  const [comfyuiUrl, setComfyuiUrl] = useState(data.config?.comfyuiUrl || '');

  // Available models and options
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [availableLoras, setAvailableLoras] = useState<string[]>([]);
  const [availableVaes, setAvailableVaes] = useState<string[]>([]);
  const [availableControlNets, setAvailableControlNets] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  // Add progress state
  const [progress, setProgress] = useState<{ value: number; max: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Load ComfyUI URL from database
  useEffect(() => {
    const loadConfig = async () => {
      const config = await db.getAPIConfig();
      const url = config?.comfyui_base_url || 'http://127.0.0.1:8188';
      setComfyuiUrl(url);
      if (!data.config) data.config = {};
      data.config.comfyuiUrl = url;
    };
    loadConfig();
  }, []);

  // Fetch available models from comfyui-api
  const fetchModels = async (url: string) => {
    setIsLoadingModels(true);
    setModelError(null);
    try {
      let comfyuiApiUrl = url;
      if (!comfyuiApiUrl.startsWith('http')) comfyuiApiUrl = 'http://' + comfyuiApiUrl;
      comfyuiApiUrl = comfyuiApiUrl.replace(/:(\d+)$/, ':8189');
      const resp = await fetch(`${comfyuiApiUrl}/object_info`);
      if (!resp.ok) throw new Error('Failed to fetch models info');
      const modelsInfo = await resp.json();
      const models = modelsInfo?.model_list || [];
      setAvailableModels(models);
      // Add similar logic for loras, vaes, controlnets if needed
    } catch (error) {
      setModelError((error as Error)?.message || 'Failed to fetch models');
    } finally {
      setIsLoadingModels(false);
    }
  };

  useEffect(() => {
    if (comfyuiUrl) {
      fetchModels(comfyuiUrl);
    }
  }, [comfyuiUrl]);

  // Update node config when settings change
  useEffect(() => {
    if (!data.config) data.config = {};
    Object.assign(data.config, {
      model, lora, loraStrength, vae, controlNet,
      steps, guidance, width, height, denoise,
      sampler, scheduler, comfyuiUrl
    });
  }, [model, lora, loraStrength, vae, controlNet, steps, guidance, 
      width, height, denoise, sampler, scheduler, comfyuiUrl]);

  // Handle node output updates
  useEffect(() => {
    if (data.config?.output) {
      const output = data.config.output;
      if (output.type === 'progress') {
        setProgress({ value: output.value, max: output.max });
        setIsGenerating(true);
      } else if (output.type === 'complete') {
        setProgress(null);
        setIsGenerating(false);
        setError(null);
      } else if (output.type === 'error') {
        setError(output.message);
        setIsGenerating(false);
        setProgress(null);
      }
    }
  }, [data.config?.output]);

  return (
    <div className={`p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-md w-80`}>
      {/* ... Header section ... */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ background: nodeColor }}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="font-medium text-sm text-gray-900 dark:text-white">
            {data.label || 'Text & Image to Image'}
          </div>
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {showSettings && (
        <div className="mb-3 space-y-3">
          <div>
            <label className="block text-xs mb-1 text-gray-700 dark:text-gray-300">ComfyUI URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={comfyuiUrl}
                onChange={(e) => setComfyuiUrl(e.target.value)}
                className="flex-1 p-2 text-sm rounded border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="http://127.0.0.1:8188"
              />
              <button
                onClick={() => fetchModels(comfyuiUrl)}
                className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
                title="Refresh Models"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingModels ? 'animate-spin' : ''}`} />
              </button>
            </div>
            {modelError && (
              <p className="text-xs text-red-500 mt-1">{modelError}</p>
            )}
          </div>
          
          {/* Show loading state for models */}
          {isLoadingModels ? (
            <div className="text-center py-4 text-gray-600 dark:text-gray-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-500" />
              <p className="text-sm mt-2">Loading models...</p>
            </div>
          ) : (
            <>
              {/* Model selection */}
              <div>
                <label className="block text-xs mb-1 text-gray-700 dark:text-gray-300">Model</label>
                <div className="flex gap-2">
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="flex-1 p-2 text-sm rounded border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {availableModels.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => fetchModels(comfyuiUrl)}
                    className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingModels ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* LoRA selection */}
              <div>
                <label className="block text-xs mb-1 text-gray-700 dark:text-gray-300">LoRA</label>
                <select
                  value={lora}
                  onChange={(e) => setLora(e.target.value)}
                  className="w-full p-2 text-sm rounded border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">None</option>
                  {availableLoras.map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
                {lora && (
                  <div className="mt-2">
                    <label className="block text-xs mb-1 text-gray-700 dark:text-gray-300">LoRA Strength: {loraStrength}</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={loraStrength}
                      onChange={(e) => setLoraStrength(Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                )}
              </div>

              {/* VAE selection */}
              <div>
                <label className="block text-xs mb-1 text-gray-700 dark:text-gray-300">VAE</label>
                <select
                  value={vae}
                  onChange={(e) => setVae(e.target.value)}
                  className="w-full p-2 text-sm rounded border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Default</option>
                  {availableVaes.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              {/* ControlNet selection */}
              <div>
                <label className="block text-xs mb-1 text-gray-700 dark:text-gray-300">ControlNet</label>
                <select
                  value={controlNet}
                  onChange={(e) => setControlNet(e.target.value)}
                  className="w-full p-2 text-sm rounded border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">None</option>
                  {availableControlNets.map(cn => (
                    <option key={cn} value={cn}>{cn}</option>
                  ))}
                </select>
              </div>

              {/* Generation parameters */}
              <div>
                <label className="block text-xs mb-1 text-gray-700 dark:text-gray-300">Steps: {steps}</label>
                <input
                  type="range"
                  min="1"
                  max="150"
                  value={steps}
                  onChange={(e) => setSteps(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs mb-1 text-gray-700 dark:text-gray-300">Guidance Scale: {guidance}</label>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.1"
                  value={guidance}
                  onChange={(e) => setGuidance(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-xs mb-1 text-gray-700 dark:text-gray-300">Denoise Strength: {denoise}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={denoise}
                  onChange={(e) => setDenoise(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* Sampler and Scheduler */}
              <div>
                <label className="block text-xs mb-1 text-gray-700 dark:text-gray-300">Sampler</label>
                <select
                  value={sampler}
                  onChange={(e) => setSampler(e.target.value)}
                  className="w-full p-2 text-sm rounded border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {SAMPLERS.map(s => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, ' ').split(' ').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs mb-1 text-gray-700 dark:text-gray-300">Scheduler</label>
                <select
                  value={scheduler}
                  onChange={(e) => setScheduler(e.target.value)}
                  className="w-full p-2 text-sm rounded border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {SCHEDULERS.map(s => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, ' ').split(' ').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                      ).join(' ')}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>
      )}

      {/* Add progress indicator */}
      {isGenerating && progress && (
        <div className="mt-2 mb-4">
          <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
            <span>Generating...</span>
            <span>{Math.round((progress.value / progress.max) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${(progress.value / progress.max) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Add error message */}
      {error && (
        <div className="mt-2 mb-4 p-2 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded text-xs">
          {error}
        </div>
      )}

      {/* Input/Output handles */}
      <Handle
        type="target"
        position={Position.Top}
        id="text-in"
        isConnectable={isConnectable}
        className="!bg-blue-500 !w-3 !h-3"
        style={{ top: -6, left: '30%' }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="image-in"
        isConnectable={isConnectable}
        className="!bg-pink-500 !w-3 !h-3"
        style={{ top: -6, left: '70%' }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="image-out"
        isConnectable={isConnectable}
        className="!bg-pink-500 !w-3 !h-3"
        style={{ bottom: -6 }}
      />
    </div>
  );
};

export const metadata = {
  id: 'text_image_to_image',
  name: 'Text & Image to Image',
  description: 'Generate images from text prompt and input image',
  icon: ImageIcon,
  color: 'bg-violet-500',
  bgColor: 'bg-violet-100',
  lightColor: '#8B5CF6',
  darkColor: '#7C3AED',
  category: 'function',
  inputs: ['text', 'image'],
  outputs: ['image'],
};

export default TextImageToImageNode;
