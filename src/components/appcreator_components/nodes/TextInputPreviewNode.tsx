import React, { useRef, useState, useEffect } from 'react';
import { Handle, Position, useReactFlow } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';
import { MousePointer, GripHorizontal, X, ChevronDown } from 'lucide-react';

const MIN_WIDTH = 200;
const MIN_HEIGHT = 60;
const INITIAL_WIDTH = 280;

const evaluateExpression = (data: any, expression: string) => {
  try {
    // Ensure expression starts with 'data.'
    const cleanExpression = expression.trim().startsWith('data.') 
      ? expression.trim()
      : `data.${expression.trim()}`;

    return new Function('data', `
      try {
        return ${cleanExpression};
      } catch (e) {
        return "Expression error: " + e.message;
      }
    `)(data);
  } catch (error) {
    return `Expression error: ${error instanceof Error ? error.message : String(error)}`;
  }
};

// Function to extract all possible paths from a JSON object
const extractPaths = (obj: any, prefix = ''): string[] => {
  let paths: string[] = [];
  
  if (obj && typeof obj === 'object') {
    if (Array.isArray(obj)) {
      // Handle array
      obj.forEach((item, index) => {
        // Don't add the prefix for root level array indices
        const newPrefix = prefix ? `${prefix}[${index}]` : `[${index}]`;
        paths.push(newPrefix);
        paths = paths.concat(extractPaths(item, newPrefix));
      });
    } else {
      // Handle object
      Object.keys(obj).forEach(key => {
        // Don't add the prefix for root level keys
        const newPrefix = prefix ? `${prefix}.${key}` : key;
        paths.push(newPrefix);
        paths = paths.concat(extractPaths(obj[key], newPrefix));
      });
    }
  }
  
  return paths;
};

const TextInputPreviewNode = ({ id, data, isConnectable }: any) => {
  const { isDark } = useTheme();
  const { deleteElements } = useReactFlow();
  const tool = data.tool;
  const Icon = tool.icon;
  const nodeColor = isDark ? tool.darkColor : tool.lightColor;
  const [dimensions, setDimensions] = useState({ width: INITIAL_WIDTH, height: MIN_HEIGHT * 2 });
  const [isResizing, setIsResizing] = useState({ active: false, direction: '' });
  const [expression, setExpression] = useState(data.config?.jsonKey || '');
  const [extractedValue, setExtractedValue] = useState('');
  const [availablePaths, setAvailablePaths] = useState<string[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const nodeRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleDelete = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    deleteElements({ nodes: [{ id }] });
  };

  useEffect(() => {
    if (data.config?.text) {
      try {
        const jsonData = JSON.parse(data.config.text);
        const paths = extractPaths(jsonData);
        setAvailablePaths(paths);
      } catch (error) {
        setAvailablePaths([]);
      }
    }
  }, [data.config?.text]);

  useEffect(() => {
    if (data.config?.text && expression) {
      try {
        const jsonData = JSON.parse(data.config.text);
        const result = evaluateExpression(jsonData, expression);
        const value = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
        setExtractedValue(value);
        
        // Only update the UI, don't store in node data
        if (data.onOutputChange) {
          data.onOutputChange(value);
        }
      } catch (error) {
        setExtractedValue('Invalid JSON input');
      }
    }
  }, [data.config?.text, expression]);

  const handleExpressionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newExpression = e.target.value;
    setExpression(newExpression);
    if (data.config) {
      // Only store the expression path persistently
      data.config.jsonKey = newExpression;
      
      if (data.config.text) {
        try {
          const jsonData = JSON.parse(data.config.text);
          const result = evaluateExpression(jsonData, newExpression);
          const value = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
          setExtractedValue(value);
          
          // Only update the UI, don't store in node data
          if (data.onOutputChange) {
            data.onOutputChange(value);
          }
        } catch (error) {
          setExtractedValue('Invalid JSON input');
        }
      }
    }
  };

  const handlePathSelect = (path: string) => {
    setExpression(path);
    setIsDropdownOpen(false);
    if (data.config) {
      data.config.jsonKey = path;
      
      if (data.config.text) {
        try {
          const jsonData = JSON.parse(data.config.text);
          const result = evaluateExpression(jsonData, path);
          const value = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
          setExtractedValue(value);
          if (data.onOutputChange) {
            data.onOutputChange(value);
          }
        } catch (error) {
          setExtractedValue('Invalid JSON input');
        }
      }
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleResizeStart = (e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();

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
          setDimensions((prev: { width: number; height: number }) => ({ ...prev, width: newWidth }));
        }
      }
      
      if (direction.includes('s') || direction.includes('n')) {
        const deltaY = moveEvent.clientY - startY;
        const newHeight = direction.includes('n') ? startHeight - deltaY : startHeight + deltaY;
        if (newHeight >= MIN_HEIGHT) {
          setDimensions((prev: { width: number; height: number }) => ({ ...prev, height: newHeight }));
        }
      }
    };

    const handleResizeEnd = () => {
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
        {/* Input JSON Preview */}
        <div className="mb-3">
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Input JSON:</div>
          <div 
            className={`w-full p-2 rounded border ${
              isDark ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-100 border-gray-300 text-gray-600'
            } text-sm overflow-y-auto`}
            style={{ height: '100px' }}
          >
            <pre className="whitespace-pre-wrap break-words text-xs">
              {data.config?.text ? JSON.stringify(JSON.parse(data.config.text), null, 2) : 'Waiting for input...'}
            </pre>
          </div>
        </div>

        {/* JSON Expression Input with Dropdown */}
        <div className="mb-3" ref={dropdownRef}>
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">JSON Expression:</div>
          <div className="relative">
            <div className="flex">
              <input
                type="text"
                value={expression}
                onChange={handleExpressionChange}
                className={`flex-1 p-2 rounded-l border-l border-y text-sm ${
                  isDark 
                    ? 'bg-gray-700 border-gray-600 text-gray-300' 
                    : 'bg-gray-50 border-gray-300 text-gray-600'
                }`}
                placeholder="Enter path (e.g., output[0].output)"
              />
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`px-3 border-r border-y rounded-r flex items-center justify-center ${
                  isDark
                    ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            {isDropdownOpen && availablePaths.length > 0 && (
              <div className={`absolute z-10 w-full mt-1 rounded-md shadow-lg border ${
                isDark
                  ? 'bg-gray-700 border-gray-600'
                  : 'bg-white border-gray-200'
              }`}>
                <div className="max-h-48 overflow-y-auto">
                  {availablePaths.map((path, index) => (
                    <div
                      key={index}
                      className={`px-3 py-2 text-sm cursor-pointer ${
                        isDark
                          ? 'text-gray-300 hover:bg-gray-600'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => handlePathSelect(path)}
                    >
                      {path}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Preview Section */}
        <div>
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Extracted Value:</div>
          <div 
            className={`w-full p-2 rounded border ${
              isDark ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-100 border-gray-300 text-gray-600'
            } text-sm overflow-y-auto`}
            style={{ height: dimensions.height - 280 }}
          >
            <div className="whitespace-pre-wrap break-words">
              {extractedValue || 'Waiting for input...'}
            </div>
          </div>
        </div>
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
        type="target"
        position={Position.Top}
        id="text-in"
        isConnectable={isConnectable}
        className="!bg-blue-500 !w-3 !h-3"
        style={{ top: -6 }}
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
  id: 'text_input_preview',
  name: 'JSON Expression Extractor',
  description: 'Extract values from JSON using JavaScript expressions',
  icon: MousePointer,
  color: 'bg-blue-500',
  bgColor: 'bg-blue-100',
  lightColor: '#3B82F6',
  darkColor: '#60A5FA',
  category: 'string_manipulation',
  inputs: ['text'],
  outputs: ['text'],
};

export default TextInputPreviewNode;
