import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { Type, ArrowRight } from 'lucide-react';

interface TextCombinerNodeProps {
  data: any;
  isConnectable: boolean;
}

const TextCombinerNode: React.FC<TextCombinerNodeProps> = ({ data, isConnectable }) => {
  const [additionalText, setAdditionalText] = useState(
    data.config?.additionalText || ''
  );

  // tempInputText is used for UI display only during execution
  const tempInputText = data.config?.tempInputText || '';
  
  // Update the node's configuration when additionalText changes
  useEffect(() => {
    if (!data.config) data.config = {};
    data.config.additionalText = additionalText;
  }, [additionalText, data]);
  
  return (
    <div className="node-container min-w-[200px] rounded-md shadow-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="node-header flex items-center p-2 border-b border-gray-200 dark:border-gray-700 rounded-t-md" 
           style={{ backgroundColor: data.tool?.lightColor || '#6366F1' }}>
        <Type className="w-4 h-4 mr-2 text-white" />
        <div className="text-sm font-medium text-white truncate">{data.label || 'Text Combiner'}</div>
      </div>
      
      <div className="p-3 flex flex-col gap-2">
        {/* Text Combiner UI */}
        <div className="flex flex-col">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Text to append:
          </label>
          <textarea
            className="w-full p-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 resize-none"
            rows={2}
            value={additionalText}
            onChange={e => setAdditionalText(e.target.value)}
            placeholder="Enter text to combine..."
          />
        </div>

        {/* Preview section - only shown when there's input data */}
        {tempInputText && (
          <div className="mt-1">
            <div className="flex items-center mb-1">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Preview:</span>
            </div>
            <div className="flex items-center text-xs">
              <div className="p-1.5 px-2 bg-gray-100 dark:bg-gray-700 rounded-md text-gray-700 dark:text-gray-300 flex-1 truncate">
                {tempInputText}
              </div>
              <ArrowRight className="mx-1 w-3 h-3 text-gray-500" />
              <div className="p-1.5 px-2 bg-blue-100 dark:bg-blue-900/30 rounded-md text-blue-700 dark:text-blue-300 flex-1 truncate">
                {tempInputText + additionalText}
              </div>
            </div>
          </div>
        )}
        
        {/* Show hint when not connected */}
        {!tempInputText && (
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic">
            Connect to a source node to combine its text output
          </div>
        )}
      </div>
      
      {/* Input/output handles */}
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="w-2 h-2 rounded-full bg-blue-500 border-2 border-white dark:border-gray-800"
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="w-2 h-2 rounded-full bg-green-500 border-2 border-white dark:border-gray-800"
      />
    </div>
  );
};

export default TextCombinerNode;
