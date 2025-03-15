import React from 'react';

interface BulkActionBarProps {
  handleSelectAll: () => void;
  handleDeselectAll: () => void;
  handleBulkDelete: () => void;
  handleBulkDownload: () => void;
  handleBulkShare: () => void;
  selectedCount: number;
  isDarkMode?: boolean;
}

const BulkActionBar: React.FC<BulkActionBarProps> = ({
  handleSelectAll,
  handleDeselectAll,
  handleBulkDelete,
  handleBulkDownload,
  handleBulkShare,
  selectedCount,
  isDarkMode
}) => {
  return (
    <div className="p-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
          {selectedCount} {selectedCount === 1 ? 'image' : 'images'} selected
        </span>
        <div className="flex gap-2">
          <button
            onClick={handleSelectAll}
            className="px-3 py-1.5 bg-sakura-400/80 dark:bg-blue-500/80 
                     text-white rounded-lg hover:bg-sakura-500/80 dark:hover:bg-blue-600/80
                     transition-all duration-200 shadow-sm backdrop-blur-md text-sm font-medium"
          >
            Select All
          </button>
          <button
            onClick={handleDeselectAll}
            className="px-3 py-1.5 bg-white/50 dark:bg-gray-700/50 
                     border border-white/50 dark:border-gray-600/30
                     text-sm text-gray-700 dark:text-gray-200 rounded-lg 
                     hover:bg-white/70 dark:hover:bg-gray-600/70 
                     transition-all duration-200 shadow-sm backdrop-blur-md font-medium"
          >
            Deselect All
          </button>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <button
          onClick={handleBulkDownload}
          className="flex items-center gap-1 px-3 py-2 bg-white/50 dark:bg-gray-700/50 
                   border border-white/50 dark:border-gray-600/30
                   text-gray-700 dark:text-gray-200 rounded-lg 
                   hover:bg-white/70 dark:hover:bg-gray-600/70 
                   transition-all duration-200 shadow-sm backdrop-blur-md"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          Download
        </button>
        <button
          onClick={handleBulkShare}
          className="flex items-center gap-1 px-3 py-2 bg-white/50 dark:bg-gray-700/50 
                   border border-white/50 dark:border-gray-600/30
                   text-gray-700 dark:text-gray-200 rounded-lg 
                   hover:bg-white/70 dark:hover:bg-gray-600/70 
                   transition-all duration-200 shadow-sm backdrop-blur-md"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
          </svg>
          Share
        </button>
        <button
          onClick={handleBulkDelete}
          className="flex items-center gap-1 px-3 py-2 bg-red-500/80 
                   text-white rounded-lg hover:bg-red-600/80
                   transition-all duration-200 shadow-sm backdrop-blur-md"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Delete
        </button>
      </div>
    </div>
  );
};

export default BulkActionBar;
