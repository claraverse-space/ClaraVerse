import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';
import { Sparkles, RefreshCw } from 'lucide-react';

const GetClipboardTextNode = ({ data, isConnectable }: any) => {
  const { isDark } = useTheme();
  const tool = data.tool || {};
  const Icon = tool.icon || Sparkles;
  const nodeColor = isDark ? tool.darkColor || '#059669' : tool.lightColor || '#10B981';

  const [clipboardText, setClipboardText] = useState(data.config?.previewText || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleRefreshClipboard = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsLoading(true);
    try {
      const text = await navigator.clipboard.readText();
      setClipboardText(text);
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
    <div
      className={`p-3 rounded-lg border ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } shadow-md w-64`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header with Icon and Label */}
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg" style={{ background: nodeColor }}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="font-medium text-sm text-gray-900 dark:text-white">
          {data.label || 'Get Clipboard Text'}
        </div>
      </div>

      {/* Clipboard refresh button */}
      <div className="mb-2" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleRefreshClipboard}
          disabled={isLoading}
          className="flex items-center justify-center gap-2 p-2 w-full border rounded hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span className="text-sm">Refresh Clipboard</span>
        </button>
      </div>

      {/* Clipboard preview */}
      {clipboardText ? (
        <div className="p-2 bg-gray-50 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600">
          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Preview:</p>
          <div className="text-xs text-gray-600 dark:text-gray-400 max-h-16 overflow-y-auto">
            {clipboardText.length > 100 ? clipboardText.substring(0, 100) + '...' : clipboardText}
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
          Click refresh to preview clipboard content
        </p>
      )}

      {/* Handle for output connection */}
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="!bg-green-500 !w-3 !h-3"
        style={{ bottom: -6 }}
      />
    </div>
  );
};

export const metadata = {
  id: 'get_clipboard_text',
  name: 'Get Clipboard Text',
  description: 'Retrieve text from system clipboard',
  icon: Sparkles,
  color: 'bg-emerald-500',
  bgColor: 'bg-emerald-100',
  lightColor: '#10B981',
  darkColor: '#059669',
  category: 'input',
  inputs: [],
  outputs: ['text'],
};

export default GetClipboardTextNode;
