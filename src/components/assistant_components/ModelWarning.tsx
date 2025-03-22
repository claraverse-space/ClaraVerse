import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ModelWarningProps {
  onClose: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const ModelWarning: React.FC<ModelWarningProps> = ({ onClose, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glassmorphic rounded-xl p-6 max-w-md w-full mx-4">
        <div className="flex items-start gap-4">
          <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
            <AlertTriangle className="w-6 h-6 text-yellow-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Image Support Not Confirmed
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              The current model hasn't been confirmed to support images. Would you like to:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Switch to a known image-capable model</li>
                <li>Try with current model (will update support status based on response)</li>
              </ul>
            </p>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="px-4 py-2 text-sm font-medium text-white bg-yellow-500 hover:bg-yellow-600 rounded-lg transition-colors"
              >
                Continue Anyway
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModelWarning;