import React from 'react';

interface DebugModalProps {
  jsonData: any;
  onClose: () => void;
}

const DebugModal: React.FC<DebugModalProps> = ({ jsonData, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 p-4 rounded w-1/2 max-h-full overflow-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Execution Plan Debug</h2>
          <button onClick={onClose} className="text-gray-600 dark:text-gray-300">Close</button>
        </div>
        <pre className="bg-gray-100 dark:bg-gray-700 text-xs p-2 rounded">
          {JSON.stringify(jsonData, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default DebugModal;
