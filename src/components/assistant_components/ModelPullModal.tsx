import React, { useState, useRef, useEffect } from 'react';
import { X, Download, Loader2, Cpu, Code, Brain, Image as ImageIcon, Globe, Terminal } from 'lucide-react';

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
  const [pullProgress, setPullProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

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
    setPullProgress(0);
    setLogs([`Starting download of ${modelName}...`]);
    
    let currentDigestDone = false;
    let currentDigest = '';
    
    try {
      for await (const data of onPullModel(modelName)) {
        if (data.status === 'downloading') {
          let percent = 0;
          if (data.completed && data.total) {
            percent = Math.round((data.completed / data.total) * 100);
            setPullProgress(percent);
            
            // Log detailed progress
            const downloaded = (data.completed / 1024 / 1024).toFixed(1);
            const total = (data.total / 1024 / 1024).toFixed(1);
            
            if (data.digest !== currentDigest) {
              currentDigest = data.digest;
              currentDigestDone = false;
              addLog(`\nPulling new layer: ${currentDigest.slice(0, 12)}...`);
            }
            
            const logMessage = `${data.status}: ${percent}% (${downloaded}MB / ${total}MB)`;
            addLog(logMessage);
            
            if (percent === 100 && !currentDigestDone) {
              addLog('Layer download complete');
              currentDigestDone = true;
            }
          }
        } else if (data.status === 'verifying') {
          addLog(`Verifying ${modelName}...`);
          setPullProgress(99);
        } else if (data.status === 'done') {
          addLog(`Successfully pulled ${modelName}`);
          setPullProgress(100);
        } else {
          addLog(`${data.status}`);
        }
      }
      
      // Reset after completion
      setTimeout(() => {
        setIsPulling(false);
        setCurrentModel('');
        setPullProgress(0);
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Error pulling model:', error);
      addLog(`Error: Failed to pull ${modelName}`);
      if (error instanceof Error) {
        addLog(`Error details: ${error.message}`);
      }
      setIsPulling(false);
      setCurrentModel('');
      setPullProgress(0);
    }
  };

  const filteredModels = selectedTier 
    ? SYSTEM_TIERS[selectedTier].models.filter(model =>
        selectedUseCases.length === 0 ||
        selectedUseCases.some(useCase => model.tags.includes(useCase))
      )
    : [];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glassmorphic rounded-2xl p-8 max-w-4xl w-full mx-4 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Download className="w-6 h-6 text-sakura-500" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Select Your Model
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Terminal Output */}
        {isPulling && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Terminal className="w-4 h-4 text-sakura-500" />
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                Download Progress
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

        {/* System Tier Selection */}
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 ${isPulling ? 'opacity-50 pointer-events-none' : ''}`}>
          {Object.entries(SYSTEM_TIERS).map(([tier, config]) => (
            <button
              key={tier}
              onClick={() => setSelectedTier(tier as keyof typeof SYSTEM_TIERS)}
              className={`p-4 rounded-lg border transition-all ${
                selectedTier === tier
                  ? 'border-sakura-500 bg-sakura-50 dark:bg-sakura-500/10'
                  : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
              }`}
            >
              <h3 className="font-medium text-gray-900 dark:text-white">
                {config.name}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {config.description}
              </p>
            </button>
          ))}
        </div>

        {/* Use Case Selection */}
        <div className={`space-y-2 ${isPulling ? 'opacity-50 pointer-events-none' : ''}`}>
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            Use Cases (Optional)
          </h3>
          <div className="flex flex-wrap gap-2">
            {USE_CASES.map(useCase => {
              const isSelected = selectedUseCases.includes(useCase.id);
              const Icon = useCase.icon;
              return (
                <button
                  key={useCase.id}
                  onClick={() => setSelectedUseCases(prev =>
                    isSelected
                      ? prev.filter(id => id !== useCase.id)
                      : [...prev, useCase.id]
                  )}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${
                    isSelected
                      ? 'bg-sakura-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {useCase.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Model List */}
        {selectedTier && (
          <div className={`space-y-4 ${isPulling ? 'opacity-50 pointer-events-none' : ''}`}>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Recommended Models
            </h3>
            <div className="grid grid-cols-1 gap-3">
              {filteredModels.map((model) => {
                const Icon = model.icon;
                const isCurrentModel = currentModel === model.name;
                return (
                  <div
                    key={model.name}
                    className="p-4 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Icon className="w-5 h-5 text-gray-500" />
                        <div>
                          <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {model.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {model.description}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handlePull(model.name)}
                        disabled={isPulling}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sakura-500 text-white hover:bg-sakura-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {isCurrentModel ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            {pullProgress}%
                          </>
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            Pull
                          </>
                        )}
                      </button>
                    </div>
                    {isCurrentModel && (
                      <div className="mt-3">
                        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-sakura-500 transition-all duration-500"
                            style={{ width: `${pullProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModelPullModal;
