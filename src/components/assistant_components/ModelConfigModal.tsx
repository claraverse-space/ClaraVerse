import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { db } from '../../db';

interface ModelConfig {
  visionModel: string;
  toolModel: string;
  ragModel: string;
}

interface ModelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: any[];
  onSave: (config: ModelConfig) => void;
  currentConfig?: ModelConfig;
}

const defaultConfig: ModelConfig = {
  visionModel: '',
  toolModel: '',
  ragModel: ''
};

const ModelConfigModal: React.FC<ModelConfigModalProps> = ({
  isOpen,
  onClose,
  models,
  onSave,
  currentConfig = defaultConfig
}) => {
  const [visionModel, setVisionModel] = useState(currentConfig.visionModel);
  const [toolModel, setToolModel] = useState(currentConfig.toolModel);
  const [ragModel, setRagModel] = useState(currentConfig.ragModel);
  const [apiType, setApiType] = useState('ollama');

  useEffect(() => {
    const loadApiType = async () => {
      const config = await db.getAPIConfig();
      if (config) {
        setApiType(config.api_type || 'ollama');
      }
    };
    loadApiType();
  }, []);

  useEffect(() => {
    // Only update if currentConfig changes and is not undefined
    if (currentConfig) {
      setVisionModel(currentConfig.visionModel);
      setToolModel(currentConfig.toolModel);
      setRagModel(currentConfig.ragModel);
    }
  }, [currentConfig]);

  const handleSave = () => {
    onSave({
      visionModel,
      toolModel,
      ragModel
    });
    onClose();
  };

  // Filter models based on API type
  const filteredModels = models.filter(model => {
    if (apiType === 'ollama') {
      return !model.name.startsWith('gpt-');
    } else {
      return model.name.startsWith('gpt-');
    }
  });

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="fixed inset-0 z-50 overflow-y-auto"
    >
      <div className="flex items-center justify-center min-h-screen">
        <div className="fixed inset-0 bg-black/30" />

        <div className="relative bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
          <div className="absolute right-4 top-4">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 focus:outline-none"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <Dialog.Title className="text-lg font-medium mb-4 dark:text-white">
            Model Configuration
          </Dialog.Title>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-white">
                Vision Model
              </label>
              <select
                value={visionModel}
                onChange={(e) => setVisionModel(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 px-3 text-sm dark:text-white"
              >
                <option value="">Select a model</option>
                {filteredModels.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 dark:text-white">
                Tool Model
              </label>
              <select
                value={toolModel}
                onChange={(e) => setToolModel(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 px-3 text-sm dark:text-white"
              >
                <option value="">Select a model</option>
                {filteredModels.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 dark:text-white">
                RAG Model
              </label>
              <select
                value={ragModel}
                onChange={(e) => setRagModel(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 py-2 px-3 text-sm dark:text-white"
              >
                <option value="">Select a model</option>
                {filteredModels.map((model) => (
                  <option key={model.name} value={model.name}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-md"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};

export default ModelConfigModal; 