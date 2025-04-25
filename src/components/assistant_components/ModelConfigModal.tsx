import React, { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Settings as SettingsIcon, ChevronDown } from 'lucide-react';
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
  const filteredModels = models;

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      className="relative z-50"
    >
      {/* Backdrop with blur effect */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="relative w-full max-w-2xl rounded-2xl overflow-hidden">
          {/* Glassmorphic background */}
          <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md" />
          
          {/* Content container */}
          <div className="relative p-8">
            <div className="absolute right-6 top-6">
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5"
              >
                <XMarkIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="flex items-center gap-3 mb-8">
              <SettingsIcon className="w-6 h-6 text-sakura-500" />
              <Dialog.Title className="text-xl font-semibold text-gray-900 dark:text-white">
                Model Configuration
              </Dialog.Title>
            </div>

            <div className="space-y-8">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">
                  Vision Model
                </label>
                <div className="relative">
                  <select
                    value={visionModel}
                    onChange={(e) => setVisionModel(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl appearance-none bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm focus:bg-white/50 dark:focus:bg-gray-900/50 focus:outline-none focus:ring-2 focus:ring-sakura-500/20 border-0 text-gray-900 dark:text-white shadow-sm transition-all cursor-pointer"
                  >
                    <option value="" className="text-gray-900 dark:text-white bg-white dark:bg-gray-900">Select a model</option>
                    {filteredModels.map((model) => (
                      <option key={model.name} value={model.name} className="text-gray-900 dark:text-white bg-white dark:bg-gray-900">
                        {model.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">
                  Tool Model
                </label>
                <div className="relative">
                  <select
                    value={toolModel}
                    onChange={(e) => setToolModel(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl appearance-none bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm focus:bg-white/50 dark:focus:bg-gray-900/50 focus:outline-none focus:ring-2 focus:ring-sakura-500/20 border-0 text-gray-900 dark:text-white shadow-sm transition-all cursor-pointer"
                  >
                    <option value="" className="text-gray-900 dark:text-white bg-white dark:bg-gray-900">Select a model</option>
                    {filteredModels.map((model) => (
                      <option key={model.name} value={model.name} className="text-gray-900 dark:text-white bg-white dark:bg-gray-900">
                        {model.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-200">
                  RAG Model
                </label>
                <div className="relative">
                  <select
                    value={ragModel}
                    onChange={(e) => setRagModel(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl appearance-none bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm focus:bg-white/50 dark:focus:bg-gray-900/50 focus:outline-none focus:ring-2 focus:ring-sakura-500/20 border-0 text-gray-900 dark:text-white shadow-sm transition-all cursor-pointer"
                  >
                    <option value="" className="text-gray-900 dark:text-white bg-white dark:bg-gray-900">Select a model</option>
                    {filteredModels.map((model) => (
                      <option key={model.name} value={model.name} className="text-gray-900 dark:text-white bg-white dark:bg-gray-900">
                        {model.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-4 pt-8">
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm hover:bg-white/50 dark:hover:bg-gray-900/50 text-gray-700 dark:text-white font-medium transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-sakura-600 to-sakura-400 text-white font-medium hover:from-sakura-700 hover:to-sakura-500 transition-all duration-200 shadow-lg shadow-sakura-500/20 hover:shadow-sakura-500/30"
              >
                Save Changes
              </button>
            </div>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
};

export default ModelConfigModal; 