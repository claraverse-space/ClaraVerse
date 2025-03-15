import React from 'react';

interface BulkActionBarProps {
  handleSelectAll: () => void;
  handleDeselectAll: () => void;
  handleBulkDelete: () => void;
  handleBulkDownload: () => void;
  handleBulkShare: () => void;
}

const glassmorphicButton = "px-3 py-2 bg-white/20 dark:bg-gray-800/30 backdrop-blur-md border border-white/30 dark:border-gray-700/50 rounded-lg transition-all duration-300 shadow-sm";

const BulkActionBar: React.FC<BulkActionBarProps> = ({
  handleSelectAll,
  handleDeselectAll,
  handleBulkDelete,
  handleBulkDownload,
  handleBulkShare
}) => {
  return (
    <div className="flex items-center gap-3 mt-2 sm:mt-0">
      <button onClick={handleSelectAll} className={glassmorphicButton} title="Select All">
        Select All
      </button>
      <button onClick={handleDeselectAll} className={glassmorphicButton} title="Deselect All">
        Deselect All
      </button>
      <button
        onClick={handleBulkDelete}
        className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
        title="Bulk Delete"
      >
        Delete Selected
      </button>
      <button
        onClick={handleBulkDownload}
        className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
        title="Bulk Download"
      >
        Download Selected
      </button>
      <button
        onClick={handleBulkShare}
        className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        title="Bulk Share"
      >
        Share Selected
      </button>
    </div>
  );
};

export default BulkActionBar;
