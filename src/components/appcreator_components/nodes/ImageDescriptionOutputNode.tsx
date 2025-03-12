import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';
import { Copy, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const ImageDescriptionOutputNode = ({ data, isConnectable }: any) => {
  const { isDark } = useTheme();
  const tool = data.tool;
  const Icon = tool.icon;
  const nodeColor = isDark ? tool.darkColor : tool.lightColor;
  
  const outputText = data.config.outputText || 'Waiting for image description...';
  const [copied, setCopied] = useState(false);
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(outputText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  
  // Use capture phase to stop events at the earliest possible point
  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };
  
  return (
    <div 
      className={`p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-md w-80`}
      onClick={stopPropagation}
      onMouseDown={stopPropagation}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ background: nodeColor }}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="font-medium text-sm">
            {data.label}
          </div>
        </div>
        <button 
          onClick={copyToClipboard}
          className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700`}
        >
          {copied ? 
            <CheckCircle size={16} className="text-green-500" /> : 
            <Copy size={16} className={isDark ? 'text-gray-300' : 'text-gray-600'} />
          }
        </button>
      </div>
      
      <div 
        className={`w-full p-3 rounded ${isDark ? 'bg-gray-700 text-gray-200' : 'bg-gray-50 text-gray-800'} overflow-auto max-h-60 prose prose-sm ${isDark ? 'prose-invert' : ''}`}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {outputText}
        </ReactMarkdown>
      </div>
      
      <Handle
        type="target"
        position={Position.Top}
        id="text-in"
        isConnectable={isConnectable}
        className="!bg-blue-500 !w-3 !h-3"
        style={{ top: -6 }}
      />
    </div>
  );
};

export default ImageDescriptionOutputNode;
