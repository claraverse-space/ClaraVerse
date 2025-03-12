import React from 'react';
import { ImagePlus } from 'lucide-react';

// This component will serve as a backup way to access the Image+Text LLM tool
const ToolbarDebug = () => {
  const tool = {
    id: 'image_text_llm',
    name: 'Image + Text LLM',
    description: 'Process image and text with a vision model',
    icon: ImagePlus,
    color: 'bg-violet-500',
    bgColor: 'bg-violet-100',
    lightColor: '#8B5CF6',
    darkColor: '#7C3AED',
    category: 'function',
    inputs: ['image', 'text'],
    outputs: ['text']
  };
  
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/reactflow', tool.id);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  return (
    <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
      <h2 className="font-bold text-lg mb-2">Debug Tools</h2>
      <div 
        draggable
        onDragStart={handleDragStart}
        className="flex items-center gap-2 p-2 bg-violet-100 dark:bg-violet-900/30 hover:bg-violet-200 rounded-lg cursor-grab"
      >
        <div className="p-2 bg-violet-500 rounded-lg">
          <ImagePlus className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="font-medium">Image + Text LLM</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Process image and text with vision model</div>
        </div>
      </div>
      <div className="mt-2 text-xs text-gray-500">Drag this tool if it's missing from the sidebar</div>
    </div>
  );
};

export default ToolbarDebug;
