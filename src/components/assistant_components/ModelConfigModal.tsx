import React, { useState, useEffect } from 'react';
import { X, Sparkles } from 'lucide-react';

interface ModelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: any[];
  modelConfig: {
    visionModel: string;
    toolModel: string;
    ragModel: string;
  };
  onSave: (config: {
    visionModel: string;
    toolModel: string;
    ragModel: string;
  }) => void;
  onModelSelect?: (modelName: string) => void;
}

const ModelConfigModal: React.FC<ModelConfigModalProps> = ({
  isOpen,
  onClose,
  models,
  modelConfig,
  onSave,
  onModelSelect,
}) => {
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [glowEffect, setGlowEffect] = useState(false);

  if (!isOpen) return null;

  const handleModelChange = (modelName: string, field: 'visionModel' | 'toolModel' | 'ragModel') => {
    // Update the form and trigger the glow effect
    const formElement = document.querySelector(`select[name="${field}"]`) as HTMLSelectElement;
    if (formElement) {
      formElement.value = modelName;
    }

    // Update the selected model in the header
    if (onModelSelect) {
      onModelSelect(modelName);
      setSelectedModel(modelName);
      // Trigger glow effect
      setGlowEffect(true);
      setTimeout(() => setGlowEffect(false), 1500);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const config = {
      visionModel: formData.get('visionModel') as string,
      toolModel: formData.get('toolModel') as string,
      ragModel: formData.get('ragModel') as string,
    };
    onSave(config);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Model Configuration</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Vision Model
              </label>
              <div className="relative">
                <select
                  name="visionModel"
                  defaultValue={modelConfig.visionModel}
                  onChange={(e) => handleModelChange(e.target.value, 'visionModel')}
                  className={`w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all ${
                    glowEffect && selectedModel === modelConfig.visionModel
                      ? 'ring-2 ring-sakura-500 ring-opacity-50 border-sakura-500'
                      : ''
                  }`}
                >
                  <option value="">Select a model</option>
                  {models.map(model => (
                    <option key={model.name} value={model.name}>
                      {model.name}
                      {selectedModel === model.name && ' ✨'}
                    </option>
                  ))}
                </select>
                {glowEffect && selectedModel === modelConfig.visionModel && (
                  <Sparkles className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 text-sakura-500 animate-pulse" />
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500">Model used for image-related tasks</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tool Model
              </label>
              <div className="relative">
                <select
                  name="toolModel"
                  defaultValue={modelConfig.toolModel}
                  onChange={(e) => handleModelChange(e.target.value, 'toolModel')}
                  className={`w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all ${
                    glowEffect && selectedModel === modelConfig.toolModel
                      ? 'ring-2 ring-sakura-500 ring-opacity-50 border-sakura-500'
                      : ''
                  }`}
                >
                  <option value="">Select a model</option>
                  {models.map(model => (
                    <option key={model.name} value={model.name}>
                      {model.name}
                      {selectedModel === model.name && ' ✨'}
                    </option>
                  ))}
                </select>
                {glowEffect && selectedModel === modelConfig.toolModel && (
                  <Sparkles className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 text-sakura-500 animate-pulse" />
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500">Model used for tool-related tasks</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                RAG Model
              </label>
              <div className="relative">
                <select
                  name="ragModel"
                  defaultValue={modelConfig.ragModel}
                  onChange={(e) => handleModelChange(e.target.value, 'ragModel')}
                  className={`w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all ${
                    glowEffect && selectedModel === modelConfig.ragModel
                      ? 'ring-2 ring-sakura-500 ring-opacity-50 border-sakura-500'
                      : ''
                  }`}
                >
                  <option value="">Select a model</option>
                  {models.map(model => (
                    <option key={model.name} value={model.name}>
                      {model.name}
                      {selectedModel === model.name && ' ✨'}
                    </option>
                  ))}
                </select>
                {glowEffect && selectedModel === modelConfig.ragModel && (
                  <Sparkles className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 text-sakura-500 animate-pulse" />
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500">Model used for RAG (Retrieval-Augmented Generation)</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-sakura-500 hover:bg-sakura-600 rounded-lg"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModelConfigModal; 