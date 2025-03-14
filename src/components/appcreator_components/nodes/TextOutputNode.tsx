import React from 'react';
import { Handle, Position } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';
import { MousePointer } from 'lucide-react';

const TextOutputNode = ({ data, isConnectable }: any) => {
  const { isDark } = useTheme();
  const tool = data.tool;
  const Icon = tool.icon;
  const nodeColor = isDark ? tool.darkColor : tool.lightColor;
  
  return (
    <div 
      className={`p-3 rounded-lg border ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } shadow-md w-64`}
      onClick={(e) => e.stopPropagation()} // Stop event propagation
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg" style={{ background: nodeColor }}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="font-medium text-sm">
          {data.label}
        </div>
      </div>
      
      <div className="mb-2" onClick={(e) => e.stopPropagation()}>
        <div className={`w-full p-2 rounded border ${
          isDark ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-100 border-gray-300 text-gray-600'
        } text-sm min-h-[60px]`}>
          {data.config?.outputText || 'Output will appear here...'}
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

// Export metadata as a named export so that NodeRegistry can pick it up.
export const metadata = {
  id: 'text_output',
  name: 'Text Output',
  description: 'Display text to users',
  icon: MousePointer,
  color: 'bg-green-500',
  bgColor: 'bg-green-100',
  lightColor: '#10B981',
  darkColor: '#34D399',
  category: 'output',
  inputs: ['text'],
  outputs: [],
};

export default TextOutputNode;
