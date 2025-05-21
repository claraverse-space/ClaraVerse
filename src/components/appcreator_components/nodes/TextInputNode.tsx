import React, { useState, useRef } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';
import { MousePointer, GripHorizontal, X } from 'lucide-react';

const MIN_WIDTH = 200;
const MIN_HEIGHT = 60;
const INITIAL_WIDTH = 280;

const TextInputNode = ({ id, data, isConnectable }: any) => {
  const { isDark } = useTheme();
  const { deleteElements } = useReactFlow();
  const tool = data.tool;
  const Icon = tool.icon;
  const nodeColor = isDark ? tool.darkColor : tool.lightColor;
  const [text, setText] = useState(data.config.text || '');
  const [dimensions, setDimensions] = useState({ width: INITIAL_WIDTH, height: MIN_HEIGHT * 4 });
  const [isResizing, setIsResizing] = useState({ active: false, direction: '' });
  const nodeRef = useRef<HTMLDivElement>(null);

  const handleDelete = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    data.config.text = e.target.value;
  };

  const handleResizeStart = (e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();

    // Add class to prevent node dragging during resize
    if (nodeRef.current) {
      nodeRef.current.classList.add('noflow');
    }
    
    setIsResizing({ active: true, direction });

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = dimensions.width;
    const startHeight = dimensions.height;

    const handleResize = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      moveEvent.stopPropagation();
      
      if (direction.includes('e') || direction.includes('w')) {
        const deltaX = moveEvent.clientX - startX;
        const newWidth = direction.includes('w') ? startWidth - deltaX : startWidth + deltaX;
        if (newWidth >= MIN_WIDTH) {
          setDimensions(prev => ({ ...prev, width: newWidth }));
        }
      }
      
      if (direction.includes('s') || direction.includes('n')) {
        const deltaY = moveEvent.clientY - startY;
        const newHeight = direction.includes('n') ? startHeight - deltaY : startHeight + deltaY;
        if (newHeight >= MIN_HEIGHT) {
          setDimensions(prev => ({ ...prev, height: newHeight }));
        }
      }
    };

    const handleResizeEnd = () => {
      // Remove the class when resize is done
      if (nodeRef.current) {
        nodeRef.current.classList.remove('noflow');
      }
      
      setIsResizing({ active: false, direction: '' });
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', handleResizeEnd);
    };

    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  return (
    <div
      ref={nodeRef}
      className={`rounded-lg border ${
        isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
      } shadow-md relative ${isResizing.active ? 'noflow' : ''}`}
      style={{ width: dimensions.width }}
    >
      {/* Draggable header */}
      <div className="p-2 cursor-move border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-gray-400" />
          <div className="p-1.5 rounded-lg" style={{ background: nodeColor }}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div className="font-medium text-sm text-gray-900 dark:text-white">
            {data.label}
          </div>
        </div>
        <button
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
          onClick={handleDelete}
        >
          <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Content area */}
      <div className="p-3 nodrag">
        <textarea
          value={text}
          onChange={handleChange}
          placeholder="Enter text input..."
          className={`w-full p-2 rounded border ${
            isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 placeholder-gray-400'
          } text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sakura-500`}
          style={{ height: dimensions.height - 80 }} // Adjust for padding and header
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      {/* Resize handles */}
      <div 
        className={`absolute bottom-0 right-0 w-3 h-3 cursor-se-resize ${
          isResizing.active ? 'bg-sakura-500/50' : ''
        }`}
        onMouseDown={(e) => handleResizeStart(e, 'se')}
      />
      <div 
        className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize"
        onMouseDown={(e) => handleResizeStart(e, 'sw')}
      />
      <div
        className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize"
        onMouseDown={(e) => handleResizeStart(e, 'ne')}
      />
      <div
        className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize"
        onMouseDown={(e) => handleResizeStart(e, 'nw')}
      />
      <div
        className="absolute right-0 top-1/2 w-3 h-6 -translate-y-1/2 cursor-ew-resize"
        onMouseDown={(e) => handleResizeStart(e, 'e')}
      />
      <div
        className="absolute left-0 top-1/2 w-3 h-6 -translate-y-1/2 cursor-ew-resize"
        onMouseDown={(e) => handleResizeStart(e, 'w')}
      />
      <div
        className="absolute bottom-0 left-1/2 h-3 w-6 -translate-x-1/2 cursor-ns-resize"
        onMouseDown={(e) => handleResizeStart(e, 's')}
      />
      <div
        className="absolute top-0 left-1/2 h-3 w-6 -translate-x-1/2 cursor-ns-resize"
        onMouseDown={(e) => handleResizeStart(e, 'n')}
      />

      <Handle
        type="source"
        position={Position.Bottom}
        id="text-out"
        isConnectable={isConnectable}
        className="!bg-blue-500 !w-3 !h-3"
        style={{ bottom: -6 }}
      />
    </div>
  );
};

// Export metadata as a named export for NodeRegistry
export const metadata = {
  id: 'text_input',
  name: 'Text Input',
  description: 'Accept text input from users',
  icon: MousePointer,
  color: 'bg-blue-500',
  bgColor: 'bg-blue-100',
  lightColor: '#3B82F6',
  darkColor: '#60A5FA',
  category: 'input',
  inputs: [],
  outputs: ['text'],
};

export default TextInputNode;
