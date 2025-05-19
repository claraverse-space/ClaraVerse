import React, { useState, useRef, useEffect } from 'react';
import { AppWindow, X, Send, Loader2, RefreshCw, Bot, Play, Code, Settings } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { appStore } from '../../services/AppStore';
import { executeFlow, generateExecutionPlan } from '../../ExecutionEngine';
import ReactMarkdown from 'react-markdown';

interface AppWidgetProps {
  id: string;
  appId: string;
  name: string;
  description: string;
  icon?: string;
  onRemove: (id: string) => void;
}

interface ChatMessage {
  id: string;
  content: any;
  type: 'user' | 'ai';
  timestamp: number;
  isImage?: boolean;
}

const AppWidget: React.FC<AppWidgetProps> = ({
  id,
  appId,
  name,
  description,
  icon,
  onRemove
}) => {
  const { isDark } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [messageHistory, setMessageHistory] = useState<ChatMessage[]>([]);
  const [appData, setAppData] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Load app data when component mounts
  useEffect(() => {
    const loadApp = async () => {
      try {
        const app = await appStore.getApp(appId);
        if (app) {
          setAppData(app);
        } else {
          setError('App not found');
        }
      } catch (err) {
        console.error('Error loading app:', err);
        setError('Failed to load app');
      }
    };
    loadApp();
  }, [appId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messageHistory]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && inputValue.trim() !== '') {
        handleRunApp();
      }
    }
  };

  const handleRunApp = async () => {
    if (!inputValue.trim() || !appData) return;

    setIsLoading(true);
    setError(null);

    try {
      // Add user message to chat
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        content: inputValue,
        type: 'user',
        timestamp: Date.now()
      };
      setMessageHistory(prev => [...prev, userMessage]);

      // Clone app data and inject user input
      const appDataClone = JSON.parse(JSON.stringify(appData));
      const inputNode = appDataClone.nodes.find((node: any) => node.type === 'textInputNode');
      
      if (inputNode) {
        inputNode.data.config = {
          ...inputNode.data.config,
          text: inputValue
        };
      }

      // Update app store temporarily
      await appStore.tempUpdateAppNodes(appId, appDataClone.nodes);

      // Generate and execute flow
      const plan = generateExecutionPlan(appDataClone.nodes, appDataClone.edges);

      // Callback to capture node outputs
      const updateNodeOutput = (nodeId: string, output: any) => {
        const node = appData.nodes.find((n: any) => n.id === nodeId);
        if (node && (node.type === 'textOutputNode' || node.type === 'markdownOutputNode' || node.type === 'imageOutputNode')) {
          const isImage = node.type === 'imageOutputNode' || 
                        (typeof output === 'string' && output.startsWith('data:image'));
          
          const aiMessage: ChatMessage = {
            id: `ai-${Date.now()}-${nodeId}`,
            content: output,
            type: 'ai',
            timestamp: Date.now(),
            isImage
          };
          setMessageHistory(prev => [...prev, aiMessage]);
        }
      };

      // Execute the flow
      await executeFlow(plan, updateNodeOutput);
      setInputValue('');
    } catch (err) {
      console.error('Error running app:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to format output for Markdown
  const formatOutputForMarkdown = (output: any): string => {
    if (typeof output === 'string') return output;
    try {
      return JSON.stringify(output, null, 2);
    } catch {
      return String(output);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col glassmorphic rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex-none p-2 sm:p-3 lg:p-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 flex items-center justify-center rounded-lg bg-sakura-100 dark:bg-sakura-900/30">
            <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-sakura-500" />
          </div>
          <h3 className="font-medium text-gray-900 dark:text-white truncate text-sm sm:text-base">
            {name}
          </h3>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(id);
          }}
          className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-grow p-2 sm:p-3 lg:p-4 flex flex-col min-h-0">
        <div className="flex-none mb-2 sm:mb-3">
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {description}
          </p>
        </div>

        {/* Chat Messages */}
        <div className="flex-grow overflow-y-auto mb-2 sm:mb-3 space-y-2 sm:space-y-3">
          {messageHistory.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-2 sm:p-3 ${
                  message.type === 'user'
                    ? 'bg-sakura-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                }`}
              >
                {message.isImage ? (
                  <img src={message.content} alt="Generated" className="rounded" />
                ) : (
                  <div className="text-xs sm:text-sm">
                    <ReactMarkdown>{formatOutputForMarkdown(message.content)}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Error Message */}
        {error && (
          <div className="flex-none mb-2 sm:mb-3 p-2 sm:p-3 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs sm:text-sm">
            {error}
          </div>
        )}

        {/* Input Area */}
        <div className="flex-none relative">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="w-full min-h-[2.5rem] max-h-32 p-2 pr-10 text-xs sm:text-sm rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none"
            disabled={isLoading}
          />
          <button
            onClick={handleRunApp}
            disabled={isLoading || !inputValue.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Actions */}
        <div className="flex-none mt-2 sm:mt-3 grid grid-cols-2 gap-2">
          <button className="flex items-center justify-center px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-sakura-500 hover:bg-sakura-600 text-white transition-colors text-xs sm:text-sm">
            <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
            <span className="truncate">Run</span>
          </button>
          <button className="flex items-center justify-center px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors text-xs sm:text-sm">
            <Code className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
            <span className="truncate">Edit</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppWidget; 