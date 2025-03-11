import React from 'react';
import { Handle, Position } from 'reactflow';
import { useTheme } from '../../hooks/useTheme';

interface ToolItem {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  lightColor: string;
  darkColor: string;
  category: 'input' | 'process' | 'output' | 'function';
}

const CustomNode = ({ data, isConnectable }: any) => {
  const { isDark } = useTheme();
  const tool = data.tool as ToolItem;
  const Icon = tool.icon;
  const nodeColor = isDark ? tool.darkColor : tool.lightColor;

  return (
    <div 
      className={`p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-md`}
      onClick={(e) => e.stopPropagation()} // Stop event propagation
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={isConnectable}
        className="!bg-sakura-500 !w-3 !h-3"
      />
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg" style={{ background: nodeColor }}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="font-medium text-sm">
          {data.label}
        </div>
      </div>
      <div className="text-xs mb-2">
        <span className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          {tool.description}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={isConnectable}
        className="!bg-sakura-500 !w-3 !h-3"
      />
    </div>
  );
};

export default CustomNode;
