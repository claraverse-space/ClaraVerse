import React from 'react';
import { Info, XCircle } from 'lucide-react';

interface PrivacyWidgetProps {
  id: string;
  onRemove: (id: string) => void;
}

const PrivacyWidget: React.FC<PrivacyWidgetProps> = ({ id, onRemove }) => {
  return (
    <div className="glassmorphic rounded-2xl p-6 animate-fadeIn relative group">
      <button
        className="absolute top-4 right-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors opacity-0 group-hover:opacity-100"
        onClick={() => onRemove(id)}
        aria-label="Remove widget"
      >
        <XCircle className="w-5 h-5" />
      </button>
      <div className="flex items-start gap-3">
        <div className="p-2 bg-gray-500/5 dark:bg-gray-300/5 rounded-full flex-shrink-0">
          <Info className="w-5 h-5 text-sakura-500" />
        </div>
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-1">Private & Secure</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Clara runs locally on your machine. Your chats, images, and data stay on your device and are never sent to external servers.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyWidget; 