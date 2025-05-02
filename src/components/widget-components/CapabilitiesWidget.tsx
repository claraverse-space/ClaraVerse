import React from 'react';
import { 
  Zap, 
  XCircle,
  Code,
  FileText,
  ImageIcon
} from 'lucide-react';

interface CapabilitiesWidgetProps {
  id: string;
  onRemove: (id: string) => void;
}

const CapabilitiesWidget: React.FC<CapabilitiesWidgetProps> = ({ id, onRemove }) => {
  return (
    <div className="glassmorphic rounded-2xl p-8 animate-fadeIn animation-delay-400 relative group">
      <button
        className="absolute top-4 right-4 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => onRemove(id)}
        aria-label="Remove widget"
      >
        <XCircle className="w-5 h-5" />
      </button>
      
      <div className="flex items-center gap-4 mb-6">
        <div className="p-4 bg-green-100 dark:bg-green-800/30 rounded-xl">
          <Zap className="w-8 h-8 text-green-500" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-1">
            What You Can Do
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Explore Clara's capabilities
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
        <div className="bg-white/50 dark:bg-gray-800/50 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <Code className="w-5 h-5 text-indigo-500" />
            <h3 className="font-medium text-gray-900 dark:text-white">Code Assistant</h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Ask about coding problems, debug issues, or generate code snippets in multiple languages.
          </p>
        </div>
        
        <div className="bg-white/50 dark:bg-gray-800/50 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <FileText className="w-5 h-5 text-emerald-500" />
            <h3 className="font-medium text-gray-900 dark:text-white">Content Creation</h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Generate creative writing, summaries, translations, or professional documents.
          </p>
        </div>
        
        <div className="bg-white/50 dark:bg-gray-800/50 p-5 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <ImageIcon className="w-5 h-5 text-pink-500" />
            <h3 className="font-medium text-gray-900 dark:text-white">Image Generation</h3>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Create custom images with detailed prompts, adjust styles, and explore various artistic effects.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CapabilitiesWidget; 