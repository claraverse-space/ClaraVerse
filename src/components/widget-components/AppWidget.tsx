import React, { useState, useRef, useEffect } from 'react';
import { AppWindow, X, Send, Loader2, RefreshCw } from 'lucide-react';
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
    <div className="relative group">
      {/* Remove button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(id);
        }}
        className="absolute top-4 right-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors opacity-0 group-hover:opacity-100 z-10"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Main widget container */}
      <div 
        className={`
          glassmorphic transition-all relative overflow-hidden rounded-2xl animate-fadeIn
          ${isExpanded ? 'h-[500px]' : 'h-[300px]'}
          ${!isExpanded ? 'hover:ring-2 hover:ring-sakura-200 dark:hover:ring-sakura-800' : ''}
        `}
        onClick={() => !isExpanded && setIsExpanded(true)}
        onBlur={(e) => {
          // Only collapse if we're not clicking inside the widget
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsExpanded(false);
          }
        }}
        tabIndex={0} // Make the container focusable
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200/10 dark:border-gray-700/10">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-sakura-100 dark:bg-sakura-100/10 rounded-lg">
              <AppWindow className="w-5 h-5 text-sakura-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 dark:text-white truncate">
                {name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                {description}
              </p>
            </div>
            {isExpanded && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(false);
                }}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700/50"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Chat interface - always visible but with different heights */}
        <div className="flex flex-col h-[calc(100%-76px)]"> {/* Adjust height to account for header */}
          {/* Chat messages */}
          <div 
            className="flex-1 overflow-y-auto p-4 space-y-4"
            style={{ 
              height: isExpanded ? 'calc(100% - 64px)' : 'calc(100% - 48px)'
            }}
          >
            {messageHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
                <AppWindow className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-sm">Start a conversation with this app</p>
              </div>
            ) : (
              messageHistory.map(message => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-xl text-sm
                      ${message.type === 'user'
                        ? 'bg-sakura-500/10 text-sakura-600 dark:text-sakura-400'
                        : 'glassmorphic'
                      }
                    `}
                  >
                    {message.isImage ? (
                      <img 
                        src={message.content} 
                        alt="Generated" 
                        className="max-w-full rounded-lg"
                        style={{ maxHeight: '200px' }}
                      />
                    ) : message.type === 'user' ? (
                      <div className="whitespace-pre-wrap">{message.content}</div>
                    ) : (
                      <div className="prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown>{formatOutputForMarkdown(message.content)}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="glassmorphic p-3 rounded-xl flex items-center gap-2 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-sakura-500" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className={`
            p-4 border-t border-gray-200/10 dark:border-gray-700/10 
            bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm
            ${isExpanded ? '' : 'py-2'}
          `}>
            <div className="flex gap-2">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className={`
                  flex-1 p-2 rounded-xl border border-gray-200 dark:border-gray-700 
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-white 
                  resize-none focus:outline-none focus:ring-2 focus:ring-sakura-500
                  ${isExpanded ? '' : 'text-sm py-1'}
                `}
                rows={1}
                style={{ 
                  minHeight: isExpanded ? '40px' : '32px',
                  maxHeight: isExpanded ? '120px' : '32px'
                }}
              />
              <button
                onClick={handleRunApp}
                disabled={isLoading || !inputValue.trim()}
                className={`
                  rounded-xl transition-all flex items-center justify-center
                  ${isExpanded ? 'p-2 w-[40px]' : 'p-1.5 w-[32px]'}
                  ${isLoading || !inputValue.trim()
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-sakura-500 text-white hover:bg-sakura-600'
                  }
                `}
              >
                {isLoading ? (
                  <Loader2 className={`animate-spin ${isExpanded ? 'w-5 h-5' : 'w-4 h-4'}`} />
                ) : (
                  <Send className={isExpanded ? 'w-5 h-5' : 'w-4 h-4'} />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="absolute bottom-4 left-4 right-4 p-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default AppWidget; 