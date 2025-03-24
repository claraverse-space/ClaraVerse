import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';
import { MousePointer, GripHorizontal, X, Maximize2 } from 'lucide-react';

const MIN_WIDTH = 200;
const MIN_HEIGHT = 60;
const INITIAL_WIDTH = 280;
const MAX_HEIGHT = 400;

const TextOutputNode = ({ id, data, isConnectable }: any) => {
  const { isDark } = useTheme();
  const { deleteElements } = useReactFlow();
  const tool = data.tool;
  const Icon = tool.icon;
  const nodeColor = isDark ? tool.darkColor : tool.lightColor;
  
  // Refs for resizing functionality
  const resizeRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: INITIAL_WIDTH, height: MIN_HEIGHT });
  const [isResizing, setIsResizing] = useState({ active: false, direction: '' });
  const [showPopup, setShowPopup] = useState(false);
  
  // Adjust height based on content
  useEffect(() => {
    if (contentRef.current) {
      const textLength = (data.config?.outputText || '').length;
      // Base height calculation on text length, with a minimum
      const calculatedHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, textLength * 0.5));
      setDimensions(prev => ({ ...prev, height: calculatedHeight }));
    }
  }, [data.config?.outputText]);

  const handleResizeStart = (e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing({ active: true, direction });

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = dimensions.width;
    const startHeight = dimensions.height;

    const handleResize = (moveEvent: MouseEvent) => {
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
      setIsResizing({ active: false, direction: '' });
      document.removeEventListener('mousemove', handleResize);
      document.removeEventListener('mouseup', handleResizeEnd);
    };

    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleDelete = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  };

  return (
    <>
      <div 
        ref={nodeRef}
        className={`rounded-lg border ${
          isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
        } shadow-md relative`}
        style={{ width: dimensions.width }}
      >
        {/* Draggable header */}
        <div className="p-2 cursor-move border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripHorizontal className="w-4 h-4 text-gray-400" />
            <div className="p-1.5 rounded-lg" style={{ background: nodeColor }}>
              <Icon className="w-4 h-4 text-white" />
            </div>
            <div className="font-medium text-sm">
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
          <div className="mb-1 relative" onClick={(e) => e.stopPropagation()}>
            <div 
              ref={contentRef}
              className={`w-full p-2 rounded border ${
                isDark ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-100 border-gray-300 text-gray-600'
              } text-sm overflow-y-scroll scrollbar-thin scrollbar-thumb-rounded-md ${
                isDark 
                  ? 'scrollbar-thumb-gray-500 scrollbar-track-gray-700 hover:scrollbar-thumb-gray-400' 
                  : 'scrollbar-thumb-gray-400 scrollbar-track-gray-200 hover:scrollbar-thumb-gray-500'
              } group`}
              style={{ 
                height: dimensions.height - 80, // Adjust for padding and header
                overflowX: 'hidden',
                overscrollBehavior: 'contain',
              }}
            >
              <div className="whitespace-pre-wrap break-words">
                {data.config?.outputText || 'Output will appear here...'}
              </div>
              <button
                onClick={() => setShowPopup(true)}
                className="absolute top-2 right-2 p-1 rounded-md bg-gray-800/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Resize handles */}
        <div 
          className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize"
          onMouseDown={(e) => handleResizeStart(e, 'se')}
        />
        {/* Add other resize handles as needed */}

        <Handle
          type="target"
          position={Position.Top}
          id="text-in"
          isConnectable={isConnectable}
          className="!bg-blue-500 !w-3 !h-3"
          style={{ top: -6 }}
        />
      </div>

      {/* Output Popup */}
      {showPopup && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={() => setShowPopup(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div 
            className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[600px] max-w-[90vw] max-h-[90vh] border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                {data.label}
              </h3>
              <button
                onClick={() => setShowPopup(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div 
              className={`p-4 overflow-y-scroll ${
                isDark ? 'text-gray-300' : 'text-gray-600'
              } scrollbar-thin scrollbar-thumb-rounded-md ${
                isDark 
                  ? 'scrollbar-thumb-gray-500 scrollbar-track-gray-700 hover:scrollbar-thumb-gray-400' 
                  : 'scrollbar-thumb-gray-400 scrollbar-track-gray-200 hover:scrollbar-thumb-gray-500'
              }`}
              style={{ maxHeight: 'calc(80vh - 120px)' }}
            >
              <pre className="whitespace-pre-wrap break-words text-sm">
                {data.config?.outputText || 'No output available'}
              </pre>
            </div>
          </div>
        </div>
      )}
    </>
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
