/**
 * Tool Execution Block Component
 * 
 * Renders a beautiful, collapsible block showing tool execution information
 * during agent mode operations. Similar to thinking blocks but for tool execution.
 */

import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Settings,
  Eye,
  EyeOff,
  Code2
} from 'lucide-react';

interface ToolExecutionData {
  type: 'tool_execution_block';
  tools: Array<{
    id: string;
    name: string;
    arguments: Record<string, any>;
    success: boolean;
    result?: any;
    error?: string;
    executionTime?: string;
    summary: string;
  }>;
}

interface ToolExecutionBlockProps {
  data: ToolExecutionData;
  className?: string;
}

const ToolExecutionBlock: React.FC<ToolExecutionBlockProps> = ({ data, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  const toggleToolDetails = (toolId: string) => {
    const newExpanded = new Set(expandedTools);
    if (newExpanded.has(toolId)) {
      newExpanded.delete(toolId);
    } else {
      newExpanded.add(toolId);
    }
    setExpandedTools(newExpanded);
  };

  const successCount = data.tools.filter(tool => tool.success).length;
  const totalCount = data.tools.length;

  return (
    <div className={`tool-execution-block bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200/50 dark:border-blue-700/50 rounded-xl backdrop-blur-sm ${className}`}>
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-blue-50/50 dark:hover:bg-blue-900/30 transition-colors rounded-t-xl"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 bg-blue-500 dark:bg-blue-600 rounded-lg">
            <Settings className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
              Tool Execution
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {successCount}/{totalCount} tools completed successfully
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Success indicator */}
          <div className="flex items-center gap-1">
            {successCount === totalCount ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-red-500" />
            )}
          </div>
          
          {/* Expand/collapse icon */}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          )}
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-blue-200/50 dark:border-blue-700/50">
          <div className="p-4 space-y-3">
            {data.tools.map((tool, index) => (
              <div key={tool.id} className="bg-white/60 dark:bg-gray-800/60 rounded-lg border border-gray-200/50 dark:border-gray-700/50">
                {/* Tool summary */}
                <div 
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-700/50 transition-colors rounded-lg"
                  onClick={() => toggleToolDetails(tool.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {index + 1}
                      </span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900 dark:text-white">
                          {tool.name}
                        </span>
                        {tool.success ? (
                          <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {tool.summary}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {tool.executionTime && tool.executionTime !== 'N/A' && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{tool.executionTime}</span>
                      </div>
                    )}
                    
                    {expandedTools.has(tool.id) ? (
                      <EyeOff className="w-4 h-4 text-gray-500" />
                    ) : (
                      <Eye className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                </div>

                {/* Tool details */}
                {expandedTools.has(tool.id) && (
                  <div className="border-t border-gray-200/50 dark:border-gray-700/50 p-3 space-y-3">
                    {/* Arguments */}
                    {Object.keys(tool.arguments).length > 0 && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                          <Code2 className="w-3 h-3" />
                          Arguments
                        </h4>
                        <div className="bg-gray-50 dark:bg-gray-900/50 rounded p-2 text-xs font-mono">
                          <pre className="text-gray-700 dark:text-gray-300 overflow-x-auto">
                            {JSON.stringify(tool.arguments, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Result or Error */}
                    {tool.success && tool.result !== undefined && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3 text-green-500" />
                          Result
                        </h4>
                        <div className="bg-green-50 dark:bg-green-900/20 rounded p-2 text-xs">
                          <div className="text-gray-700 dark:text-gray-300 max-h-32 overflow-y-auto">
                            {typeof tool.result === 'string' ? (
                              <pre className="whitespace-pre-wrap">{tool.result}</pre>
                            ) : (
                              <pre className="font-mono overflow-x-auto">
                                {JSON.stringify(tool.result, null, 2)}
                              </pre>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {!tool.success && tool.error && (
                      <div>
                        <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-1">
                          <XCircle className="w-3 h-3 text-red-500" />
                          Error
                        </h4>
                        <div className="bg-red-50 dark:bg-red-900/20 rounded p-2 text-xs">
                          <div className="text-red-700 dark:text-red-300">
                            {tool.error}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolExecutionBlock;
