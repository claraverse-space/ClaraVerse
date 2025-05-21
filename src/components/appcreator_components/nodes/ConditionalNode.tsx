import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';

const ConditionalNode = ({ data, isConnectable }: any) => {
  const { isDark } = useTheme();
  const tool = data.tool;
  const Icon = tool.icon;
  const nodeColor = isDark ? tool.darkColor : tool.lightColor;
  const [condition, setCondition] = useState(data.config.condition || '');
  const [evaluationResult, setEvaluationResult] = useState<boolean | null>(null);
  
  // Store input text for processing
  if (!data.config.inputText) {
    data.config.inputText = '';
  }
  
  // Evaluate the condition whenever input text changes
  useEffect(() => {
    if (data.config.inputText && condition) {
      try {
        let result = false;
        
        // If the condition is of the form contains('substring')
        if (condition.includes('contains(')) {
          const match = condition.match(/contains\(['"](.+)['"]\)/);
          const searchTerm = match ? match[1] : '';
          if (searchTerm) {
            result = String(data.config.inputText).includes(searchTerm);
            console.log(`Checking if "${data.config.inputText}" contains "${searchTerm}": ${result}`);
          }
        } else if (condition.trim()) {
          // Simple direct comparison
          result = String(data.config.inputText).includes(condition);
          console.log(`Checking if "${data.config.inputText}" contains "${condition}": ${result}`);
        }
        
        setEvaluationResult(result);
        data.config.result = result;
      } catch (error) {
        console.error('Error evaluating condition:', error);
        setEvaluationResult(null);
      }
    } else {
      setEvaluationResult(null);
    }
  }, [data.config.inputText, condition]);
  
  const handleConditionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation(); // Prevent event bubbling
    setCondition(e.target.value);
    data.config.condition = e.target.value;
  };
  
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
        <div className="font-medium text-sm text-gray-900 dark:text-white">
          {data.label}
        </div>
      </div>
      
      <div className="mb-2">
        <label className={`block text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          Condition
        </label>
        <input 
          type="text"
          value={condition}
          onChange={handleConditionChange}
          onClick={stopPropagation}
          onMouseDown={stopPropagation}
          placeholder="e.g. hello (or contains('hello'))"
          className={`w-full p-2 rounded border ${
            isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 placeholder-gray-400'
          } text-sm`}
        />
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Enter text to check if input contains it
        </div>
      </div>
      
      <div className="mb-2">
        <label className={`block text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          Input Text
        </label>
        <div className={`text-xs p-2 rounded ${isDark ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'} max-h-[80px] overflow-auto`}>
          {data.config.inputText || 'Waiting for input...'}
        </div>
      </div>
      
      <div className="mb-2">
        <label className={`block text-xs mb-1 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
          Result
        </label>
        <div className={`flex items-center gap-2`}>
          <div className={`flex-1 text-center p-1 rounded ${
            evaluationResult === true 
              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
          }`}>
            True
          </div>
          <div className={`flex-1 text-center p-1 rounded ${
            evaluationResult === false 
              ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200' 
              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
          }`}>
            False
          </div>
        </div>
      </div>
      
      <div className="flex justify-between items-center mb-1">
        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>If true</span>
        <span className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>If false</span>
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
        id="true-out"
        isConnectable={isConnectable}
        className="!bg-green-500 !w-3 !h-3"
        style={{ left: '30%', bottom: -6 }}
      />
      
      <Handle
        type="source"
        position={Position.Bottom}
        id="false-out"
        isConnectable={isConnectable}
        className="!bg-red-500 !w-3 !h-3"
        style={{ left: '70%', bottom: -6 }}
      />
    </div>
  );
};

export default ConditionalNode;
