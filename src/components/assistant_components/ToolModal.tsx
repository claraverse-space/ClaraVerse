import React from 'react';
import { X, Wrench } from 'lucide-react';
import { ToolManager } from './ToolManager';
import { OllamaClient } from '../../utils';

interface ToolModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: OllamaClient;
  model: string;
}

export const ToolModal: React.FC<ToolModalProps> = ({ isOpen, onClose, client, model }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glassmorphic rounded-2xl p-8 max-w-4xl w-full mx-4 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wrench className="w-6 h-6 text-sakura-500" />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-50">
              Tool Management
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto text-gray-900 dark:text-gray-100">
          <ToolManager client={client} model={model} />
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-white bg-sakura-500 hover:bg-sakura-600 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}; 