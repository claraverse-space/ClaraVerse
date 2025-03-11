import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';
import { Type } from 'lucide-react';

const TextCombinerNode = ({ data, isConnectable }: any) => {
  const { isDark } = useTheme();
  const tool = data.tool;
  const Icon = tool.icon || Type;
  const nodeColor = isDark ? tool.darkColor : tool.lightColor;
  
  // Initialize state from data.config
  const [additionalText, setAdditionalText] = useState(data.config.additionalText || '');
  const [combinedText, setCombinedText] = useState(data.config.combinedText || '');

  // Update config when the input changes
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.stopPropagation(); // Prevent event bubbling
    setAdditionalText(e.target.value);
    data.config.additionalText = e.target.value;
    
    // Combine the input text with additional text
    const inputText = data.config.inputText || '';
    const newCombinedText = `${inputText}${e.target.value}`;
    setCombinedText(newCombinedText);
    data.config.combinedText = newCombinedText;
  };
  
  // Update combined text when input text changes
  useEffect(() => {
    const inputText = data.config.inputText || '';
    const newCombinedText = `${inputText}${additionalText}`;
    setCombinedText(newCombinedText);
    data.config.combinedText = newCombinedText;
  }, [data.config.inputText]);
  
  // Use capture phase to stop events at the earliest possible point
  const stopPropagation = (e: React.SyntheticEvent) => {
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
  };
  
  return (
    <div 
      className={`p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-md w-64`}
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
      
      <div className="mb-2">
        <label className={`block text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          Input Text
        </label>
        <div className={`w-full p-2 rounded border ${
          isDark ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-100 border-gray-300 text-gray-600'
        } text-sm min-h-[40px]`}>
          {data.config.inputText || 'Waiting for input...'}
        </div>
      </div>
      
      <div className="mb-2">
        <label className={`block text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          Additional Text
        </label>
        <textarea 
          value={additionalText}
          onChange={handleTextChange}
          placeholder="Enter additional text..."
          className={`w-full p-2 rounded border ${
            isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
          } text-sm`}
          rows={2}
          onClick={stopPropagation}
          onMouseDown={stopPropagation}
          onKeyDown={stopPropagation}
          onFocus={stopPropagation}
        />
      </div>
      
      <div className="mb-2">
        <label className={`block text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          Combined Result
        </label>
        <div className={`w-full p-2 rounded border ${
          isDark ? 'bg-gray-700 border-gray-600 text-gray-300' : 'bg-gray-100 border-gray-300 text-gray-600'
        } text-sm min-h-[40px]`}>
          {combinedText || 'No content to combine yet'}
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

export default TextCombinerNode;
