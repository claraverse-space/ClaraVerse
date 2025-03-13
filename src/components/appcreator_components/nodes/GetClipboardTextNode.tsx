import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Clipboard, RefreshCw } from 'lucide-react';

interface GetClipboardTextNodeProps {
  data: any;
  isConnectable: boolean;
}

const GetClipboardTextNode: React.FC<GetClipboardTextNodeProps> = ({ data, isConnectable }) => {
  const [clipboardText, setClipboardText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Function to preview clipboard content during design time
  const handleRefreshClipboard = async () => {
    setIsLoading(true);
    try {
      const text = await navigator.clipboard.readText();
      setClipboardText(text);
      // Update node data for preview
      if (!data.config) data.config = {};
      data.config.previewText = text;
    } catch (error) {
      console.error('Failed to read clipboard:', error);
      setClipboardText('Error: Could not access clipboard');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="node-container min-w-[200px] rounded-md shadow-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      {/* Node header */}
      <div className="node-header flex items-center p-2 border-b border-gray-200 dark:border-gray-700 rounded-t-md" 
           style={{ backgroundColor: data.tool?.lightColor || '#10B981' }}>
        <Clipboard className="w-4 h-4 mr-2 text-white" />
        <div className="text-sm font-medium text-white truncate">{data.label || 'Get Clipboard Text'}</div>
      </div>
      
      {/* Node content */}
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-600 dark:text-gray-300">Get text from clipboard</span>
          <button 
            onClick={handleRefreshClipboard}
            disabled={isLoading}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            title="Preview clipboard content"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {/* Preview section */}
        {clipboardText && (
          <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Preview:</p>
            <div className="text-xs text-gray-600 dark:text-gray-400 max-h-16 overflow-y-auto">
              {clipboardText.length > 100 
                ? clipboardText.substring(0, 100) + '...' 
                : clipboardText}
            </div>
          </div>
        )}
        
        {!clipboardText && (
          <div className="text-xs text-gray-500 dark:text-gray-400 italic">
            Click refresh to preview clipboard content
          </div>
        )}
      </div>
      
      {/* Output handle for connections */}
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="w-2 h-2 rounded-full bg-green-500 border-2 border-white dark:border-gray-800"
      />
    </div>
  );
};

export default GetClipboardTextNode;