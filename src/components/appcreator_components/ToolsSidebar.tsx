import React from 'react';
import { ToolItem } from '../AppCreator'; // Or recreate the interface

interface ToolsSidebarProps {
  toolItems: ToolItem[];
  isDark: boolean;
  selectedTool: ToolItem | null;
  onDragStart: (event: React.DragEvent<HTMLDivElement>, tool: ToolItem) => void;
  onDragEnd: () => void;
}

const ToolsSidebar: React.FC<ToolsSidebarProps> = ({
  toolItems,
  isDark,
  selectedTool,
  onDragStart,
  onDragEnd
}) => {
  const renderToolItem = (tool: ToolItem) => {
    const Icon = tool.icon;
    return (
      <div
        key={tool.id}
        draggable
        onDragStart={(e) => onDragStart(e, tool)}
        onDragEnd={onDragEnd}
        className={`flex items-center gap-3 p-3 rounded-lg ${isDark ? 'bg-gray-800 shadow-sm border-gray-700' : 'bg-white shadow-sm border-gray-200'} border cursor-grab transition-all hover:shadow-md`}
      >
        <div className={`p-2 rounded-lg ${tool.color} text-white`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h4 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{tool.name}</h4>
          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{tool.description}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="glassmorphic w-64 p-4 overflow-y-auto">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Tools</h2>
      <div className="space-y-2 mb-6">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Inputs</h3>
        {toolItems.filter(tool => tool.category === 'input').map(renderToolItem)}
      </div>
      <div className="space-y-2 mb-6">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Process</h3>
        {toolItems.filter(tool => tool.category === 'process').map(renderToolItem)}
      </div>
      <div className="space-y-2 mb-6">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Functions</h3>
        {toolItems.filter(tool => tool.category === 'function').map(renderToolItem)}
      </div>
      <div className="space-y-2">
        <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Outputs</h3>
        {toolItems.filter(tool => tool.category === 'output').map(renderToolItem)}
      </div>
    </div>
  );
};

export default ToolsSidebar;
