import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';
import { TextQuote } from 'lucide-react';

const StaticTextNode = ({ data, isConnectable }) => {
  const { isDark } = useTheme();
  const tool = data.tool || {};
  const nodeColor = isDark ? tool.darkColor || '#DC2626' : tool.lightColor || '#F87171';

  const [staticText, setStaticText] = useState(
    data.config?.staticText || 'Static text content'
  );

  // Update the node's configuration when static text changes
  useEffect(() => {
    if (!data.config) data.config = {};
    data.config.staticText = staticText;
  }, [staticText, data]);

  return (
    <div
      className={`p-3 rounded-lg border ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } shadow-md w-64`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header with Icon and Label */}
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg" style={{ background: nodeColor }}>
          <TextQuote className="w-5 h-5 text-white" />
        </div>
        <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
          {data.label || 'Static Text'}
        </div>
      </div>

      {/* Text area for static text */}
      <div className="mb-2" onClick={(e) => e.stopPropagation()}>
        <textarea
          className="w-full p-2 text-sm border rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 resize-none focus:ring-2 focus:ring-blue-500"
          rows={3}
          value={staticText}
          onChange={(e) => setStaticText(e.target.value)}
          placeholder="Enter text here..."
        />
      </div>

      {/* Preview section */}
      <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
        <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
          Preview:
        </div>
        <div className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
          {staticText || 'No text provided'}
        </div>
      </div>

      {/* Handle for output connection */}
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="!bg-green-500 !w-3 !h-3"
        style={{ right: -6 }}
      />
    </div>
  );
};

export const metadata = {
  id: 'static_text',
  name: 'Static Text',
  description: 'Fixed text content that does not change',
  icon: TextQuote,
  color: 'bg-red-500',
  bgColor: 'bg-red-100',
  lightColor: '#F87171',
  darkColor: '#DC2626',
  category: 'input',
  inputs: [],
  outputs: ['text'],
};

export default StaticTextNode;
