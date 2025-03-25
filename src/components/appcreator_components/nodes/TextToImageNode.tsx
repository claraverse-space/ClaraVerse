import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';
import { Image, Settings, Sliders, RefreshCw } from 'lucide-react';
import { db } from '../../../db';
import { Client } from '@stable-canvas/comfyui-client';

const SAMPLERS = [
  'euler', 'euler_ancestral', 'heun', 'dpm_2', 'dpm_2_ancestral',
  'lms', 'dpm_solver_pp', 'dpm_solver', 'unipc', 'ddim'
];

const SCHEDULERS = [
  'normal', 'karras', 'exponential', 'sgm_uniform', 
  'simple', 'ddim_uniform'
];

const TextToImageNode = ({ data, isConnectable }: any) => {
  const { isDark } = useTheme();
  const tool = data.tool;
  const Icon = tool.icon || Image;
  const nodeColor = isDark ? tool.darkColor : tool.lightColor;

  const [showSettings, setShowSettings] = useState(false);
  const [model, setModel] = useState(data.config?.model || '');
  const [steps, setSteps] = useState(data.config?.steps || 20);
  const [guidance, setGuidance] = useState(data.config?.guidance || 7);
  const [width, setWidth] = useState(data.config?.width || 512);
  const [height, setHeight] = useState(data.config?.height || 512);
  const [negativePrompt, setNegativePrompt] = useState(data.config?.negativePrompt || '');
  const [comfyuiUrl, setComfyuiUrl] = useState(data.config?.comfyuiUrl || '');
  const [sampler, setSampler] = useState(data.config?.sampler || 'euler');
  const [scheduler, setScheduler] = useState(data.config?.scheduler || 'normal');

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  // Initialize config object if it doesn't exist
  useEffect(() => {
    if (!data.config) {
      data.config = {
        model: '',
        steps: 20,
        guidance: 7,
        width: 512,
        height: 512,
        negativePrompt: '',
        sampler: 'euler',
        scheduler: 'normal',
        comfyuiUrl: ''
      };
    }
  }, [data]);

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

  // Function to fetch available models from ComfyUI
  const fetchModels = async (url: string) => {
    setIsLoadingModels(true);
    setModelError(null);
    try {
      const client = new Client({ 
        api_host: url.replace(/^https?:\/\//, ''),
        ssl: url.startsWith('https')
      });
      
      // Connect and wait for ready state
      client.connect();
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Connection timeout')), 15000);
        const checkConnection = setInterval(() => {
          if (client.socket?.readyState === WebSocket.OPEN) {
            clearInterval(checkConnection);
            clearTimeout(timeout);
            resolve(true);
          }
        }, 100);
      });

      const models = await client.getSDModels();
      setAvailableModels(models);
      
      // If no model is selected but models are available, select the first one
      if (!model && models.length > 0) {
        setModel(models[0]);
        if (!data.config) data.config = {};
        data.config.model = models[0];
      }

      client.close();
    } catch (error) {
      console.error('Error fetching models:', error);
      setModelError((error as Error)?.message || 'Failed to fetch models');
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Fetch models when ComfyUI URL changes
  useEffect(() => {
    if (comfyuiUrl) {
      fetchModels(comfyuiUrl);
    }
  }, [comfyuiUrl]);

  // Update data.config whenever settings change
  useEffect(() => {
    if (!data.config) data.config = {};
    Object.assign(data.config, {
      model,
      steps,
      guidance,
      width,
      height,
      negativePrompt,
      comfyuiUrl,
      sampler,
      scheduler
    });
  }, [model, steps, guidance, width, height, negativePrompt, comfyuiUrl, sampler, scheduler]);

  // Handle settings panel close
  const handleSettingsToggle = () => {
    if (showSettings) {
      // Save all settings to data.config when closing
      if (!data.config) data.config = {};
      Object.assign(data.config, {
        model,
        steps,
        guidance,
        width,
        height,
        negativePrompt,
        comfyuiUrl,
        sampler,
        scheduler
      });
    }
    setShowSettings(!showSettings);
  };

  return (
    <div className={`p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-md w-80`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ background: nodeColor }}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="font-medium text-sm">{data.label || 'Text to Image'}</div>
        </div>
        <button 
          onClick={handleSettingsToggle}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {showSettings && (
        <div className="mb-3 space-y-3">
          <div>
            <label className="block text-xs mb-1">ComfyUI URL</label>
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
                disabled={isLoadingModels}
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingModels ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1 text-gray-700 dark:text-gray-300">Model</label>
            <div className="relative">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full p-2 text-sm rounded border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={isLoadingModels}
              >
                {isLoadingModels ? (
                  <option>Loading models...</option>
                ) : availableModels.length === 0 ? (
                  <option>No models found</option>
                ) : (
                  availableModels.map(modelName => (
                    <option key={modelName} value={modelName}>
                      {modelName}
                    </option>
                  ))
                )}
              </select>
            </div>
            {modelError && (
              <p className="text-xs text-red-500 mt-1">{modelError}</p>
            )}
          </div>

          <div>
            <label className="block text-xs mb-1">Steps: {steps}</label>
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
            <label className="block text-xs mb-1">Guidance Scale: {guidance}</label>
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

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs mb-1">Width</label>
              <input
                type="number"
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="w-full p-2 text-sm rounded border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                step="8"
              />
            </div>
            <div>
              <label className="block text-xs mb-1 text-gray-700 dark:text-gray-300">Height</label>
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                className="w-full p-2 text-sm rounded border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                step="8"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs mb-1 text-gray-700 dark:text-gray-300">Negative Prompt</label>
            <textarea
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              className="w-full p-2 text-sm rounded border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
              rows={2}
              placeholder="Enter negative prompt"
            />
          </div>

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
        </div>
      )}

      <Handle
        type="target"
        position={Position.Top}
        id="text-in"
        isConnectable={isConnectable}
        className="!bg-blue-500 !w-3 !h-3"
        style={{ top: -6 }}
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
  id: 'text_to_image',
  name: 'Text to Image',
  description: 'Generate images from text prompts',
  icon: Image,
  color: 'bg-violet-500',
  bgColor: 'bg-violet-100',
  lightColor: '#8B5CF6',
  darkColor: '#7C3AED',
  category: 'function',
  inputs: ['text'],
  outputs: ['image'],
};

export default TextToImageNode;
