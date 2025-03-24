import React, { useState, useEffect } from 'react';
import { AlertCircle, LucideArchiveRestore, FilePlus2 } from 'lucide-react';

interface DraftRestoreModalProps {
  onRestore: () => void;
  onStartNew: () => void;
  onCancel: () => void;
}

const DraftRestoreModal: React.FC<DraftRestoreModalProps> = ({
  onRestore,
  onStartNew,
  onCancel,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  
  // Animation effect for modal entrance
  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      <div 
        className="absolute inset-0 bg-black bg-opacity-60 backdrop-blur-sm" 
        onClick={onCancel}
      />
      <div 
        className={`relative glassmorphic dark:bg-gray-800/90 bg-white/95 rounded-lg shadow-xl overflow-hidden 
          w-full max-w-md transform border border-white/20 dark:border-gray-700/50
          ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'} 
          transition-all duration-300 ease-in-out backdrop-blur-md`}
      >
        <div className="p-6 space-y-6">
          <div className="flex items-center space-x-4">
            <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-900/40">
              <AlertCircle className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <h3 className="text-xl font-medium dark:text-white">Unsaved Work Found</h3>
              <p className="text-gray-600 dark:text-gray-300 mt-1">
                We found a draft of your previous work. Would you like to continue where you left off?
              </p>
            </div>
          </div>
        </div>
        
        {/* Footer buttons */}
        <div className="glassmorphic dark:bg-gray-900/50 bg-white px-6 py-4 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-700/50 backdrop-blur-sm">
          <button 
            onClick={onStartNew} 
            className="px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 
              text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/80 transition-colors flex items-center gap-2"
          >
            <FilePlus2 className="w-4 h-4" />
            Start New
          </button>
          <button 
            onClick={onRestore} 
            className="px-4 py-2 rounded-md bg-sakura-500 hover:bg-sakura-600 text-white transition-colors flex items-center gap-2 shadow-sm"
          >
            <LucideArchiveRestore className="w-4 h-4" />
            Restore Draft
          </button>
        </div>
      </div>
    </div>
  );
};

export default DraftRestoreModal;
