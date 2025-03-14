import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { ArrowDown, ArrowUp, ArrowDownUp } from 'lucide-react';
import { useTheme } from '../../../hooks/useTheme';

interface ConcatTextNodeProps {
  data: any;
  isConnectable: boolean;
}

const ConcatTextNode: React.FC<ConcatTextNodeProps> = ({ data, isConnectable }) => {
  const { isDark } = useTheme();
  const tool = data.tool;
  // Use the tool's light color for header background or fall back to a default color.
  const headerColor = tool?.lightColor || '#6366F1';

  // State for tracking which input comes first (true = top input first, false = bottom input first)
  const [topFirst, setTopFirst] = useState(data.config?.topFirst ?? true);
  
  // Get preview texts from the node config
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
    <div className={`p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-md w-64`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg" style={{ background: headerColor }}>
          <ArrowDownUp className="w-5 h-5 text-white" />
        </div>
        <div className="font-medium text-sm text-gray-900 dark:text-white">
          {data.label || 'Concat Text'}
        </div>
      </div>
      
      {/* Content */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Order:</span>
          <button
            onClick={() => setTopFirst(!topFirst)}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-800/50 transition-colors"
            title="Toggle order"
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
        
        {/* Input Previews */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full flex items-center justify-center bg-violet-500 text-white">
              {topFirst ? '1' : '2'}
            </div>
            <div className="flex-1 p-2 rounded border bg-gray-100 dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-300 truncate">
              {topInput || '(Top Input)'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full flex items-center justify-center bg-violet-500 text-white">
              {!topFirst ? '1' : '2'}
            </div>
            <div className="flex-1 p-2 rounded border bg-gray-100 dark:bg-gray-700 text-xs text-gray-700 dark:text-gray-300 truncate">
              {bottomInput || '(Bottom Input)'}
            </div>
          </div>
        </div>
        
        {/* Result Preview */}
        {(topInput || bottomInput) && (
          <div className="mt-3">
            <div className="flex items-center mb-1">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Result:</span>
            </div>
            <div className="p-2 rounded border bg-violet-100 dark:bg-violet-900/30 text-xs text-violet-700 dark:text-violet-300 truncate">
              {previewResult || '(Connect inputs to see preview)'}
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

// Export metadata as a named export so that NodeRegistry can pick it up.
export const metadata = {
  id: 'concat_text',
  name: 'Concat Text',
  description: 'Concatenates text inputs',
  icon: ArrowDownUp, // You can choose a different icon if preferred
  color: 'bg-indigo-500',
  bgColor: 'bg-indigo-100',
  lightColor: '#6366F1',
  darkColor: '#818CF8',
  category: 'function',
  inputs: ['text'],
  outputs: ['text'],
};

export default ConcatTextNode;
