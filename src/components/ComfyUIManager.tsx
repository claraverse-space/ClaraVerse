import React, { useState, useEffect } from 'react';
import { Play, Square, Settings, Download, Folder, Cpu, HardDrive, Activity } from 'lucide-react';

interface ComfyUIManagerProps {
  onClose: () => void;
}

interface ComfyUIStatus {
  running: boolean;
  port: number;
  gpuSupport: boolean;
  memoryUsage: number;
  modelCount: number;
  customNodeCount: number;
}

interface ModelInfo {
  name: string;
  type: 'checkpoint' | 'lora' | 'vae' | 'controlnet' | 'upscaler';
  size: string;
  format: string;
}

interface CustomNode {
  name: string;
  author: string;
  description: string;
  installed: boolean;
  enabled: boolean;
  url: string;
}

const ComfyUIManager: React.FC<ComfyUIManagerProps> = ({ onClose }) => {
  const [status, setStatus] = useState<ComfyUIStatus>({
    running: false,
    port: 8188,
    gpuSupport: false,
    memoryUsage: 0,
    modelCount: 0,
    customNodeCount: 0
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'models' | 'nodes' | 'settings'>('overview');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [customNodes, setCustomNodes] = useState<CustomNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkComfyUIStatus();
    if (status.running) {
      fetchModels();
      fetchCustomNodes();
    }
  }, []);

  const checkComfyUIStatus = async () => {
    try {
      // Use dedicated ComfyUI status check
      const result = await window.electronAPI?.comfyuiStatus();
      
      if (result && result.running) {
        // Verify ComfyUI is responding by checking system stats
        try {
          const response = await fetch('http://localhost:8188/system_stats');
          if (response.ok) {
            const stats = await response.json();
            setStatus({
              running: true,
              port: result.port || 8188,
              gpuSupport: stats.device_name?.includes('CUDA') || false,
              memoryUsage: stats.system?.ram_used || 0,
              modelCount: Object.keys(stats.models || {}).length,
              customNodeCount: Object.keys(stats.custom_nodes || {}).length
            });
          } else {
            // Container running but ComfyUI not ready yet
            setStatus(prev => ({ 
              ...prev, 
              running: true,
              port: result.port || 8188,
              gpuSupport: false,
              memoryUsage: 0,
              modelCount: 0,
              customNodeCount: 0
            }));
          }
        } catch (fetchError) {
          // Container running but ComfyUI not responding yet
          setStatus(prev => ({ 
            ...prev, 
            running: true,
            port: result.port || 8188,
            gpuSupport: false,
            memoryUsage: 0,
            modelCount: 0,
            customNodeCount: 0
          }));
        }
      } else {
        setStatus(prev => ({ ...prev, running: false }));
      }
    } catch (error) {
      console.error('Error checking ComfyUI status:', error);
      setStatus(prev => ({ ...prev, running: false }));
    }
  };

  const fetchModels = async () => {
    try {
      const response = await fetch('http://localhost:8188/object_info');
      if (!response.ok) {
        throw new Error('Failed to fetch model info');
      }
      
      const objectInfo = await response.json();
      const modelList: ModelInfo[] = [];
      
      // Parse different model types from ComfyUI API
      Object.entries(objectInfo).forEach(([key, value]: [string, any]) => {
        if (key.includes('CheckpointLoaderSimple')) {
          value.input?.required?.ckpt_name?.[0]?.forEach((name: string) => {
            modelList.push({
              name,
              type: 'checkpoint',
              size: 'Unknown',
              format: name.endsWith('.safetensors') ? 'SafeTensors' : 'Pickle'
            });
          });
        }
        // Add parsing for LoRAs
        if (key.includes('LoraLoader')) {
          value.input?.required?.lora_name?.[0]?.forEach((name: string) => {
            modelList.push({
              name,
              type: 'lora',
              size: 'Unknown',
              format: name.endsWith('.safetensors') ? 'SafeTensors' : 'Pickle'
            });
          });
        }
        // Add parsing for VAEs
        if (key.includes('VAELoader')) {
          value.input?.required?.vae_name?.[0]?.forEach((name: string) => {
            modelList.push({
              name,
              type: 'vae',
              size: 'Unknown',
              format: name.endsWith('.safetensors') ? 'SafeTensors' : 'Pickle'
            });
          });
        }
      });
      
      setModels(modelList);
    } catch (error) {
      console.error('Error fetching models:', error);
      // Set mock data for demo
      setModels([
        {
          name: 'sd_xl_base_1.0.safetensors',
          type: 'checkpoint',
          size: '6.94 GB',
          format: 'SafeTensors'
        }
      ]);
    }
  };

  const fetchCustomNodes = async () => {
    try {
      // This would come from ComfyUI Manager API
      const mockNodes: CustomNode[] = [
        {
          name: 'ComfyUI Manager',
          author: 'ltdrdata',
          description: 'ComfyUI extension for managing custom nodes',
          installed: true,
          enabled: true,
          url: 'https://github.com/ltdrdata/ComfyUI-Manager'
        },
        {
          name: 'ControlNet Aux',
          author: 'Fannovel16',
          description: 'Auxiliary preprocessors for ControlNet',
          installed: true,
          enabled: true,
          url: 'https://github.com/Fannovel16/comfyui_controlnet_aux'
        },
        {
          name: 'ComfyUI Essentials',
          author: 'cubiq',
          description: 'Essential nodes for ComfyUI workflows',
          installed: true,
          enabled: true,
          url: 'https://github.com/cubiq/ComfyUI_essentials'
        }
      ];
      
      setCustomNodes(mockNodes);
    } catch (error) {
      console.error('Error fetching custom nodes:', error);
    }
  };

  const startComfyUI = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI?.comfyuiStart();
      if (result?.success) {
        // Wait for container to start and ComfyUI to be ready
        setTimeout(() => {
          checkComfyUIStatus();
          setIsLoading(false);
        }, 10000); // Increased timeout for ComfyUI startup
      } else {
        console.error('Failed to start ComfyUI:', result?.error);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error starting ComfyUI:', error);
      setIsLoading(false);
    }
  };

  const stopComfyUI = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI?.comfyuiStop();
      if (result?.success) {
        setTimeout(() => {
          checkComfyUIStatus();
          setIsLoading(false);
        }, 3000);
      } else {
        console.error('Failed to stop ComfyUI:', result?.error);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error stopping ComfyUI:', error);
      setIsLoading(false);
    }
  };

  const restartComfyUI = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI?.comfyuiRestart();
      if (result?.success) {
        setTimeout(() => {
          checkComfyUIStatus();
          setIsLoading(false);
        }, 10000);
      } else {
        console.error('Failed to restart ComfyUI:', result?.error);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error restarting ComfyUI:', error);
      setIsLoading(false);
    }
  };

  const openComfyUI = () => {
    window.open('http://localhost:8188', '_blank');
  };

  const toggleCustomNode = async (nodeName: string) => {
    // Implementation for enabling/disabling custom nodes
    console.log('Toggle custom node:', nodeName);
  };

  const installCustomNode = async (nodeUrl: string) => {
    // Implementation for installing new custom nodes
    console.log('Install custom node:', nodeUrl);
  };

  const optimizeComfyUI = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI?.comfyuiOptimize();
      if (result?.success) {
        console.log('ComfyUI optimization completed:', result.message);
        // Show success notification
        alert('ComfyUI optimization completed! GPU performance should be improved.');
      } else {
        console.error('Failed to optimize ComfyUI:', result?.error);
        alert(`Failed to optimize ComfyUI: ${result?.error}`);
      }
    } catch (error) {
      console.error('Error optimizing ComfyUI:', error);
      alert('Error optimizing ComfyUI. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-4xl h-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            ComfyUI Manager
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        {/* Status Bar */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <div
                  className={`w-3 h-3 rounded-full ${
                    status.running ? 'bg-green-500' : 'bg-red-500'
                  }`}
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {status.running ? 'Running' : 'Stopped'}
                </span>
              </div>
              {status.running && (
                <>
                  <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
                    <Cpu className="w-4 h-4" />
                    <span>{status.gpuSupport ? 'GPU' : 'CPU'}</span>
                  </div>
                  <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
                    <HardDrive className="w-4 h-4" />
                    <span>{status.modelCount} Models</span>
                  </div>
                  <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
                    <Activity className="w-4 h-4" />
                    <span>{status.customNodeCount} Nodes</span>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {status.running ? (
                <>
                  <button
                    onClick={openComfyUI}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    Open ComfyUI
                  </button>
                  <button
                    onClick={optimizeComfyUI}
                    disabled={isLoading}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 text-sm flex items-center space-x-1"
                    title="Optimize GPU performance and fix compatibility issues"
                  >
                    <Settings className="w-4 h-4" />
                    <span>Optimize GPU</span>
                  </button>
                  <button
                    onClick={stopComfyUI}
                    disabled={isLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-sm flex items-center space-x-1"
                  >
                    <Square className="w-4 h-4" />
                    <span>Stop</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={startComfyUI}
                  disabled={isLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm flex items-center space-x-1"
                >
                  <Play className="w-4 h-4" />
                  <span>Start</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'models', label: 'Models' },
            { id: 'nodes', label: 'Custom Nodes' },
            { id: 'settings', label: 'Settings' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    System Status
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Port:</span>
                      <span className="text-gray-900 dark:text-white">{status.port}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">GPU Support:</span>
                      <span className="text-gray-900 dark:text-white">
                        {status.gpuSupport ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Memory Usage:</span>
                      <span className="text-gray-900 dark:text-white">
                        {(status.memoryUsage / 1024 / 1024 / 1024).toFixed(1)} GB
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Models
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Total Models:</span>
                      <span className="text-gray-900 dark:text-white">{status.modelCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Checkpoints:</span>
                      <span className="text-gray-900 dark:text-white">
                        {models.filter(m => m.type === 'checkpoint').length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">LoRAs:</span>
                      <span className="text-gray-900 dark:text-white">
                        {models.filter(m => m.type === 'lora').length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    Custom Nodes
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Installed:</span>
                      <span className="text-gray-900 dark:text-white">{status.customNodeCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Enabled:</span>
                      <span className="text-gray-900 dark:text-white">
                        {customNodes.filter(n => n.enabled).length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {status.running && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                    Quick Actions
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={openComfyUI}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                    >
                      Open ComfyUI Interface
                    </button>
                    <button
                      onClick={() => window.open('http://localhost:8188/manager', '_blank')}
                      className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 text-sm"
                    >
                      Node Manager
                    </button>
                    <button
                      onClick={() => setActiveTab('models')}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                    >
                      Manage Models
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'models' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Installed Models
                </h3>
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm flex items-center space-x-1">
                  <Download className="w-4 h-4" />
                  <span>Download Models</span>
                </button>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th className="px-4 py-3 text-left font-medium text-gray-900 dark:text-white">
                          Name
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-900 dark:text-white">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-900 dark:text-white">
                          Format
                        </th>
                        <th className="px-4 py-3 text-left font-medium text-gray-900 dark:text-white">
                          Size
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {models.map((model, index) => (
                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                          <td className="px-4 py-3 text-gray-900 dark:text-white">
                            {model.name}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                model.type === 'checkpoint'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                                  : model.type === 'lora'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {model.type.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            {model.format}
                          </td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                            {model.size}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'nodes' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Custom Nodes
                </h3>
                <button className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm flex items-center space-x-1">
                  <Download className="w-4 h-4" />
                  <span>Install Node</span>
                </button>
              </div>

              <div className="space-y-3">
                {customNodes.map((node, index) => (
                  <div
                    key={index}
                    className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                            {node.name}
                          </h4>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            by {node.author}
                          </span>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              node.enabled
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                            }`}
                          >
                            {node.enabled ? 'Enabled' : 'Disabled'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {node.description}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => toggleCustomNode(node.name)}
                          className={`px-3 py-1 rounded-md text-sm ${
                            node.enabled
                              ? 'bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300'
                              : 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300'
                          }`}
                        >
                          {node.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => window.open(node.url, '_blank')}
                          className="px-3 py-1 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 text-sm"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                ComfyUI Settings
              </h3>

              {/* GPU Optimization Section */}
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                <h4 className="text-lg font-medium text-purple-900 dark:text-purple-100 mb-2">
                  GPU Performance Optimization
                </h4>
                <p className="text-sm text-purple-700 dark:text-purple-300 mb-4">
                  Fix xFormers compatibility issues and optimize GPU performance for faster image generation.
                </p>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-purple-600 dark:text-purple-400">
                    <div>• Fixes xFormers version mismatch warnings</div>
                    <div>• Installs optimized ONNX runtime for ControlNet</div>
                    <div>• Clears GPU memory cache</div>
                    <div>• Improves generation speed and stability</div>
                  </div>
                  <button
                    onClick={optimizeComfyUI}
                    disabled={isLoading || !status.running}
                    className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 text-sm flex items-center space-x-1"
                    title={!status.running ? "ComfyUI must be running to optimize" : "Optimize GPU performance"}
                  >
                    <Settings className="w-4 h-4" />
                    <span>Optimize Now</span>
                  </button>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    GPU Memory Management
                  </label>
                  <select className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                    <option>Auto</option>
                    <option>Conservative</option>
                    <option>Aggressive</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    CPU Threads
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    max="16" 
                    defaultValue="4"
                    className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                
                <div>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" defaultChecked className="rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Enable CORS headers
                    </span>
                  </label>
                </div>
                
                <div>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" className="rounded" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Disable metadata in outputs
                    </span>
                  </label>
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                  Save Settings
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ComfyUIManager; 