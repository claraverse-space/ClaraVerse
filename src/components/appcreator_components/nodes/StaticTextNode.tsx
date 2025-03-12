import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { TextQuote } from 'lucide-react';

interface StaticTextNodeProps {
  data: any;
  isConnectable: boolean;
}

const StaticTextNode: React.FC<StaticTextNodeProps> = ({ data, isConnectable }) => {
  const [staticText, setStaticText] = useState(
    data.config?.staticText || 'Static text content'
  );

  // Update the node's configuration when static text changes
  useEffect(() => {
    if (!data.config) data.config = {};
    data.config.staticText = staticText;
  }, [staticText, data]);

  return (
    <div className="node-container min-w-[200px] rounded-md shadow-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="node-header flex items-center p-2 border-b border-gray-200 dark:border-gray-700 rounded-t-md" 
           style={{ backgroundColor: data.tool?.lightColor || '#F87171' }}>
        <TextQuote className="w-4 h-4 mr-2 text-white" />
        <div className="text-sm font-medium text-white truncate">{data.label || 'Static Text'}</div>
      </div>
      
      <div className="p-3 flex flex-col gap-2">
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Text Content:
          </label>
          <textarea
            className="w-full p-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 resize-none"
            rows={3}
            value={staticText}
            onChange={e => setStaticText(e.target.value)}
            placeholder="Enter text here..."
          />
        </div>
        
        <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-md">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Preview:
          </div>
          <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
            {staticText || 'No text provided'}
          </div>
        </div>
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="w-2 h-2 rounded-full bg-green-500 border-2 border-white dark:border-gray-800"
      />
    </div>
  );
};

export default StaticTextNode;
