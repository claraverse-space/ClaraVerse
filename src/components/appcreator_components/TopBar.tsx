import React, { useState } from 'react';
import { ArrowLeft, Save, PlayCircle, Bug } from 'lucide-react';

interface TopBarProps {
  onPageChange: (page: string) => void;
  handleOpenSaveModal: () => void;
  handleTestApp: () => void;
  handleDebug: () => void;
  appName?: string;
  setAppName?: (name: string) => void;
  isExecuting?: boolean;
}

const TopBar: React.FC<TopBarProps> = ({ 
  onPageChange, 
  handleOpenSaveModal, 
  handleTestApp, 
  handleDebug, 
  appName = "New App", 
  setAppName,
  isExecuting = false
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(appName);
  
  const handleTitleClick = () => {
    if (setAppName) {
      setIsEditingTitle(true);
      setTempTitle(appName);
    }
  };
  
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTempTitle(e.target.value);
  };
  
  const handleTitleBlur = () => {
    setIsEditingTitle(false);
    if (setAppName && tempTitle.trim()) {
      setAppName(tempTitle.trim());
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleBlur();
    }
  };
  
  return (
    <div className="glassmorphic flex items-center justify-between p-4 shadow-sm">
      <div className="flex items-center gap-4">
        <button
          onClick={() => onPageChange('apps')}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/10 text-gray-700 dark:text-gray-300"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Apps</span>
        </button>
        
        {isEditingTitle ? (
          <input
            type="text"
            value={tempTitle}
            onChange={handleTitleChange}
            onBlur={handleTitleBlur}
            onKeyDown={handleKeyDown}
            autoFocus
            className="text-xl font-semibold bg-transparent border-b-2 border-sakura-300 focus:border-sakura-500 outline-none text-gray-900 dark:text-white"
          />
        ) : (
          <h1 
            className="text-xl font-semibold text-gray-900 dark:text-white cursor-pointer hover:text-sakura-600 dark:hover:text-sakura-400"
            onClick={handleTitleClick}
          >
            {appName}
          </h1>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button 
          onClick={handleOpenSaveModal} // changed handler here
          className="flex items-center justify-center p-2 rounded-lg bg-sakura-500 hover:bg-sakura-600 text-white transition-colors shadow-sm border border-sakura-400"
          aria-label="Save"
        >
          <Save className="w-5 h-5" />
        </button>
        <button 
          onClick={handleTestApp}
          disabled={isExecuting}
          className={`flex items-center justify-center p-2 rounded-lg shadow-sm border ${
            isExecuting 
              ? 'bg-gray-400 cursor-not-allowed border-gray-300 text-gray-100' 
              : 'bg-green-500 hover:bg-green-600 border-green-400 text-white'
          } transition-colors`}
          aria-label="Test"
        >
          <PlayCircle className="w-5 h-5" />
        </button>
        <button 
          onClick={handleDebug}
          className="flex items-center justify-center p-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white transition-colors shadow-sm border border-blue-400"
          aria-label="Debug"
        >
          <Bug className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default TopBar;
