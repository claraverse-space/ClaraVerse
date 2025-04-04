import React, { useState, useRef, useEffect } from 'react';
import { X, Download, Loader2, Cpu, Code, Brain, Image as ImageIcon, Globe, Terminal, Search, RefreshCw } from 'lucide-react';

interface ModelPullModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPullModel: (modelName: string) => AsyncGenerator<any, void, unknown>;
}

const SYSTEM_TIERS = {
  LOW: {
    name: 'Low End Systems',
    description: '4-8GB RAM, Integrated/Basic GPU',
    models: [
      { 
        name: 'gemma3:4b', 
        description: 'Image, Text and multilingual support',
        tags: ['image', 'text', 'multilingual'],
        icon: Globe 
      },
      { 
        name: 'llama3.1', 
        description: 'Image, Text and multilingual support',
        tags: [ 'text', 'multilingual'],
        icon: Globe 
      },
      { 
        name: 'deepseek-r1:1.5b', 
        description: 'Basic reasoning and coding',
        tags: ['reasoning', 'code'],
        icon: Brain 
      },
    ]
  },
  MID: {
    name: 'Mid Tier Systems',
    description: '16GB RAM, Dedicated GPU',
    models: [
      { 
        name: 'llama3.1', 
        description: 'Text and better code generation',
        tags: ['text', 'code'],
        icon: Code 
      },
      { 
        name: 'qwen2.5', 
        description: 'Better text understanding',
        tags: ['text'],
        icon: Brain 
      },
      { 
        name: 'qwen2.5-coder', 
        description: 'Specialized for code',
        tags: ['code'],
        icon: Code 
      },
    ]
  },
  HIGH: {
    name: 'High End Systems',
    description: '32GB+ RAM, High-end GPU',
    models: [
      { 
        name: 'deepseek-coder:33b', 
        description: 'Best reasoning capabilities',
        tags: ['reasoning', 'code'],
        icon: Brain 
      },
      { 
        name: 'qwen2.5-coder:32b', 
        description: 'Best coding and all text tasks',
        tags: ['code', 'text'],
        icon: Code 
      },
      { 
        name: 'deepseek-r1:32b', 
        description: 'All-rounder model',
        tags: ['text', 'code', 'reasoning'],
        icon: Brain 
      },
    ]
  },
  SUPER: {
    name: 'Super High End Systems',
    description: '64GB+ RAM, High-end GPU with 16GB+ VRAM',
    models: [
      { 
        name: 'qwen:72b', 
        description: 'Near O3-mini performance, reasoning and all tasks',
        tags: ['text', 'code', 'reasoning'],
        icon: Cpu 
      },
      { 
        name: 'gemma3:27b', 
        description: 'Advanced all-purpose model',
        tags: ['text', 'code', 'image', 'reasoning'],
        icon: Brain 
      },
    ]
  }
};

const USE_CASES = [
  { id: 'text', name: 'Text Generation', icon: Globe },
  { id: 'code', name: 'Code Generation', icon: Code },
  { id: 'reasoning', name: 'Reasoning & Analysis', icon: Brain },
  { id: 'image', name: 'Image Understanding', icon: ImageIcon },
  { id: 'multilingual', name: 'Multilingual', icon: Globe },
];

const ModelPullModal: React.FC<ModelPullModalProps> = ({
  isOpen,
  onClose,
  onPullModel,
}) => {
  const [selectedTier, setSelectedTier] = useState<keyof typeof SYSTEM_TIERS | null>(null);
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([]);
  const [isPulling, setIsPulling] = useState(false);
  const [currentModel, setCurrentModel] = useState<string>('');
  const [logs, setLogs] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'recommended' | 'all' | 'custom'>('recommended');
  const [customModelName, setCustomModelName] = useState('');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchModels = async () => {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      const data = await response.json();
      if (data.models) {
        setAvailableModels(data.models.map((model: any) => model.name));
      }
    } catch (error) {
      console.error('Error fetching models:', error);
      setAvailableModels([]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchModels();
    }
  }, [isOpen]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
  };

  if (!isOpen) return null;

  const handlePull = async (modelName: string) => {
    setCurrentModel(modelName);
    setIsPulling(true);
    setLogs([
      `Starting download of ${modelName}...`,
      'Note: Download time may vary based on model size and internet speed.',
      'Please wait while we download and verify the model...'
    ]);
    
    try {
      for await (const data of onPullModel(modelName)) {
        if (data.status === 'downloading') {
          if (data.digest) {
            addLog(`Downloading model files...`);
          }
        } else if (data.status === 'verifying') {
          addLog(`\nVerifying ${modelName}...`);
        } else if (data.status === 'done') {
          addLog(`\nSuccessfully installed ${modelName}`);
          await fetchModels(); // Refresh the model list
        } else {
          addLog(`${data.status}`);
        }
      }
      
      // Close modal after successful installation with a small delay
      setTimeout(() => {
        setIsPulling(false);
        setCurrentModel('');
        onClose();
      }, 2000); // Increased delay to 2 seconds to ensure user sees success message
    } catch (error) {
      console.error('Error pulling model:', error);
      addLog(`\nError: Failed to pull ${modelName}`);
      if (error instanceof Error) {
        addLog(`Error details: ${error.message}`);
      }
      setIsPulling(false);
      setCurrentModel('');
    }
  };

  const filteredModels = selectedTier 
    ? SYSTEM_TIERS[selectedTier].models.filter(model =>
        selectedUseCases.length === 0 ||
        selectedUseCases.some(useCase => model.tags.includes(useCase))
      )
    : [];

  const filteredAvailableModels = availableModels.filter(model => 
    model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Modify DownloadButton component
  const DownloadButton = ({ modelName, showProgress = false }: { modelName: string, showProgress?: boolean }) => (
    <button
      onClick={() => handlePull(modelName)}
      disabled={isPulling}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
        showProgress ? 'w-full justify-center' : ''
      } ${
        isPulling && currentModel === modelName
          ? 'bg-sakura-100 dark:bg-sakura-100/10 text-sakura-800'
          : 'bg-sakura-500 text-white hover:bg-sakura-600'
      } disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
    >
      {isPulling && currentModel === modelName ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Installing...</span>
        </>
      ) : (
        <>
          <Download className="w-4 h-4" />
          <span>Download</span>
        </>
      )}
    </button>
  );

  // Add RefreshButton component
  const RefreshButton = () => (
    <button
      onClick={fetchModels}
      className="p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5 text-gray-500 dark:text-gray-400"
      title="Refresh model list"
    >
      <RefreshCw className="w-5 h-5" />
    </button>
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glassmorphic rounded-2xl p-6 w-full max-w-4xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Download className="w-6 h-6 text-sakura-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Model Manager
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <RefreshButton />
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('recommended')}
            className={`px-4 py-2 rounded-t-lg ${
              activeTab === 'recommended'
                ? 'bg-sakura-50 dark:bg-sakura-100/5 text-sakura-600 dark:text-sakura-400 border-b-2 border-sakura-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-sakura-600 dark:hover:text-sakura-400'
            }`}
          >
            Recommended Models
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-t-lg ${
              activeTab === 'all'
                ? 'bg-sakura-50 dark:bg-sakura-100/5 text-sakura-600 dark:text-sakura-400 border-b-2 border-sakura-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-sakura-600 dark:hover:text-sakura-400'
            }`}
          >
            All Models
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`px-4 py-2 rounded-t-lg ${
              activeTab === 'custom'
                ? 'bg-sakura-50 dark:bg-sakura-100/5 text-sakura-600 dark:text-sakura-400 border-b-2 border-sakura-500'
                : 'text-gray-500 dark:text-gray-400 hover:text-sakura-600 dark:hover:text-sakura-400'
            }`}
          >
            Custom Model
          </button>
        </div>

        {/* Terminal Output - Modified to remove progress bar */}
        {isPulling && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-4 h-4 text-sakura-500" />
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                Installation Progress - {currentModel}
              </h3>
            </div>
            <div
              ref={terminalRef}
              className="bg-gray-900 rounded-lg p-4 h-48 overflow-y-auto font-mono text-sm text-gray-100 whitespace-pre-wrap"
            >
              {logs.map((log, index) => (
                <div key={index} className="mb-1">
                  <span className="text-sakura-500">&gt;</span> {log}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content based on active tab */}
        <div className={`space-y-4 ${isPulling ? 'opacity-50 pointer-events-none' : ''}`}>
          {activeTab === 'recommended' && (
            <>
              {/* System Tier Selection */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(SYSTEM_TIERS).map(([tier, config]) => (
                  <button
                    key={tier}
                    onClick={() => setSelectedTier(tier as keyof typeof SYSTEM_TIERS)}
                    className={`p-4 rounded-xl border transition-all ${
                      selectedTier === tier
                        ? 'border-sakura-500 bg-sakura-50 dark:bg-sakura-100/5'
                        : 'border-gray-200 dark:border-gray-700 hover:border-sakura-300'
                    }`}
                  >
                    <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                      {config.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {config.description}
                    </p>
                  </button>
                ))}
              </div>

              {/* Use Case Filters */}
              <div className="flex flex-wrap gap-2">
                {USE_CASES.map(useCase => {
                  const isSelected = selectedUseCases.includes(useCase.id);
                  const Icon = useCase.icon;
                  return (
                    <button
                      key={useCase.id}
                      onClick={() => {
                        setSelectedUseCases(prev =>
                          isSelected
                            ? prev.filter(id => id !== useCase.id)
                            : [...prev, useCase.id]
                        );
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-all ${
                        isSelected
                          ? 'bg-sakura-100 dark:bg-sakura-100/10 text-sakura-800 dark:text-sakura-200'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {useCase.name}
                    </button>
                  );
                })}
              </div>

              {/* Updated Model List */}
              {selectedTier && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredModels.map(model => {
                    const Icon = model.icon;
                    const isCurrentModel = currentModel === model.name;
                    return (
                      <div
                        key={model.name}
                        className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-sakura-300 transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className="w-5 h-5 text-sakura-500" />
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {model.name}
                            </h4>
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                          {model.description}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-1">
                          {model.tags.map(tag => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="mt-3">
                          <DownloadButton modelName={model.name} showProgress={true} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'all' && (
            <div className="space-y-4">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search models..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-sakura-500"
                />
              </div>

              {/* Updated Available models list */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAvailableModels.map(model => {
                  const isCurrentModel = currentModel === model;
                  return (
                    <div
                      key={model}
                      className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-sakura-300 transition-all"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {model}
                        </h4>
                      </div>
                      <DownloadButton modelName={model} showProgress={true} />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'custom' && (
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customModelName}
                    onChange={(e) => setCustomModelName(e.target.value)}
                    placeholder="Enter model name (e.g., llama2:latest)"
                    className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-sakura-500"
                  />
                  <DownloadButton 
                    modelName={customModelName.trim()} 
                    showProgress={false}
                  />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enter the name of any Ollama-compatible model. You can specify tags (e.g., :latest) or use the default tag.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModelPullModal;
