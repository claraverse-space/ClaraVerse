import React from 'react';
import { Handle, Position } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';
import ReactMarkdown from 'react-markdown';
import { FileText } from 'lucide-react';

const MarkdownOutputNode = ({ data, isConnectable }: any) => {
  const { isDark } = useTheme();
  const tool = data.tool;
  const Icon = tool.icon || FileText;
  const nodeColor = isDark ? tool.darkColor : tool.lightColor;
  
  // Use capture phase to stop events at the earliest possible point
  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };
  
  return (
    <div 
      className={`p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-md w-72`}
      onClick={stopPropagation}
      onMouseDown={stopPropagation}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg" style={{ background: nodeColor }}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="font-medium text-sm">
          {data.label}
        </div>
      </div>
      
      <div className="mb-2" onClick={stopPropagation}>
        <div className={`w-full p-2 rounded border ${
          isDark ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-100 border-gray-300 text-gray-600'
        } text-sm min-h-[100px] overflow-auto markdown-body`}>
          {data.config?.outputText ? (
            <ReactMarkdown>
              {data.config.outputText}
            </ReactMarkdown>
          ) : (
            <span className="text-gray-500 italic">Markdown output will appear here...</span>
          )}
        </div>
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

export default MarkdownOutputNode;
