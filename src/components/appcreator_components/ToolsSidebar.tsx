import React from 'react';
import { ToolItem } from '../AppCreator';
import ToolSidebar from './ToolSidebar';

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
  // Add console logging to debug what tools are being passed
  console.log("ToolItems in ToolsSidebar:", toolItems);
  
  // Make sure we're passing the complete toolItems array
  return (
    <ToolSidebar 
      tools={toolItems} 
      onDragStart={onDragStart} 
    />
  );
};

export default ToolsSidebar;
