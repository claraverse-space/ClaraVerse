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
    ""
  );
};

export default ToolbarDebug;
