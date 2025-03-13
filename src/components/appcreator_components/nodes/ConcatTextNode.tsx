import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { ArrowDown, ArrowUp, ArrowDownUp } from 'lucide-react';

interface ConcatTextNodeProps {
  data: any;
  isConnectable: boolean;
}

const ConcatTextNode: React.FC<ConcatTextNodeProps> = ({ data, isConnectable }) => {
  // State for tracking which input comes first (true = top input first, false = bottom input first)
  const [topFirst, setTopFirst] = useState(data.config?.topFirst ?? true);
  
  // Preview texts from the connected nodes (for display only)
  const topInput = data.config?.topInput || '';
  const bottomInput = data.config?.bottomInput || '';
  
  // Update the node's configuration when the order changes
  useEffect(() => {
    if (!data.config) data.config = {};
    data.config.topFirst = topFirst;
  }, [topFirst, data]);
  
  // Compute preview of the concatenated result
  const previewResult = topFirst 
    ? `${topInput}${bottomInput}`
    : `${bottomInput}${topInput}`;

  return (
    <div className="node-container min-w-[250px] rounded-md shadow-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="node-header flex items-center p-2 border-b border-gray-200 dark:border-gray-700 rounded-t-md" 
           style={{ backgroundColor: data.tool?.lightColor || '#8B5CF6' }}>
        <ArrowDownUp className="w-4 h-4 mr-2 text-white" />
        <div className="text-sm font-medium text-white truncate">{data.label || 'Concat Text'}</div>
      </div>
      
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Concatenation Order:</span>
          <button
            onClick={() => setTopFirst(!topFirst)}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-800/50 transition-colors"
            title="Change concatenation order"
          >
            {topFirst ? (
              <>
                <ArrowDown className="w-3 h-3" /> Top → Bottom
              </>
            ) : (
              <>
                <ArrowUp className="w-3 h-3" /> Bottom → Top
              </>
            )}
          </button>
        </div>
        
        {/* Input previews */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center mr-2 ${
              topFirst ? 'bg-violet-500 text-white' : 'bg-gray-300 dark:bg-gray-700'
            }`}>
              {topFirst ? '1' : '2'}
            </div>
            <div className="p-1.5 px-2 bg-gray-100 dark:bg-gray-700 rounded-md text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">
              {topInput || '(Top Input)'}
            </div>
          </div>
          
          <div className="flex items-center">
            <div className={`w-4 h-4 rounded-full flex items-center justify-center mr-2 ${
              !topFirst ? 'bg-violet-500 text-white' : 'bg-gray-300 dark:bg-gray-700'
            }`}>
              {!topFirst ? '1' : '2'}
            </div>
            <div className="p-1.5 px-2 bg-gray-100 dark:bg-gray-700 rounded-md text-xs text-gray-700 dark:text-gray-300 flex-1 truncate">
              {bottomInput || '(Bottom Input)'}
            </div>
          </div>
        </div>
        
        {/* Result preview */}
        {(topInput || bottomInput) && (
          <div className="mt-3">
            <div className="flex items-center mb-1">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Result Preview:</span>
            </div>
            <div className="p-1.5 px-2 bg-violet-100 dark:bg-violet-900/30 rounded-md text-xs text-violet-700 dark:text-violet-300 flex-1">
              {previewResult || '(Connect both inputs to see preview)'}
            </div>
          </div>
        )}
        
        {!(topInput && bottomInput) && (
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic text-center">
            Connect two text sources to concatenate them
          </div>
        )}
      </div>
      
      {/* Input/output handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="top-in"
        style={{ top: '35%' }}
        isConnectable={isConnectable}
        className="w-2 h-2 rounded-full bg-blue-500 border-2 border-white dark:border-gray-800"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="bottom-in"
        style={{ top: '65%' }}
        isConnectable={isConnectable}
        className="w-2 h-2 rounded-full bg-green-500 border-2 border-white dark:border-gray-800"
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="w-2 h-2 rounded-full bg-violet-500 border-2 border-white dark:border-gray-800"
      />
    </div>
  );
};

export default ConcatTextNode;
