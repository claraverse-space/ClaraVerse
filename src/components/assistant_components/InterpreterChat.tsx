import React, { useEffect, useRef, useState } from 'react';
import { useInterpreter } from '../../contexts/InterpreterContext';
import { User, Bot, Copy, Check, ArrowDown, RefreshCw, Square, Brain, ChevronDown, ChevronUp, ScrollText } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Components } from 'react-markdown';
import { InterpreterMessage } from '../../utils/InterpreterClient';
import { AssistantHeader } from '../assistant_components';
import InterpreterSidebar from '../interpreter_components/InterpreterSidebar';
import { FileInfo } from '../../utils/InterpreterClient';
import ChatInput from '../assistant_components/ChatInput';
import ToastNotification from '../gallery_components/ToastNotification';

// Thinking block component to show/hide system thinking content
const ThinkingBlock: React.FC<{ content: string }> = ({ content }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Regex to capture thinking content
  const thinkingMatch = content.match(/<think>([\s\S]*?)<\/think>/);
  const thinkingContent = thinkingMatch ? thinkingMatch[1].trim() : '';

  if (!thinkingContent) return null;

  return (
    <div className="mb-2">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
      >
        <Brain className="w-4 h-4" />
        <span>Thinking Process</span>
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {isExpanded && (
        <div className="mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded text-sm text-gray-600 dark:text-gray-300">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{thinkingContent}</ReactMarkdown>
        </div>
      )}
    </div>
  );
};

// Code block component with copy functionality
const CodeBlock: React.FC<{ language: string; value: string }> = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="relative group">
      <div className="absolute right-2 top-2 z-10">
        <button
          onClick={handleCopy}
          className="p-1.5 bg-gray-700 text-gray-300 hover:bg-gray-600 rounded-md transition-colors"
          aria-label="Copy code"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        customStyle={{ margin: 0 }}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
};

// Single message component
const InterpreterMessageItem: React.FC<{ message: InterpreterMessage }> = ({ message }) => {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const isSystem = message.role === 'system' || message.role === 'computer';
  
  // Filter out thinking content from display, but keep it for ThinkingBlock
  let displayContent = '';
  let hasThinking = false;
  
  if (typeof message.content === 'string') {
    hasThinking = message.content.includes('<think>');
    displayContent = message.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  } else if (message.content && typeof message.content === 'object') {
    displayContent = JSON.stringify(message.content);
  }

  const markdownComponents: Components = {
    code({ className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const isInlineCode = !match;
      
      if (!isInlineCode && match) {
        return (
          <CodeBlock 
            language={match[1]}
            value={String(children).replace(/\n$/, '')}
          />
        );
      }
      
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
  };

  return (
    <div className={`mb-6 ${isUser ? 'pl-10' : 'pr-10'}`}>
      <div className="flex items-start gap-4">
        {/* Avatar for non-user messages */}
        {!isUser && (
          <div className="flex-shrink-0 mt-1">
            <div className="w-8 h-8 rounded-full bg-sakura-100 dark:bg-sakura-100/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-sakura-500" />
            </div>
          </div>
        )}

        {/* Message content */}
        <div className={`flex-1 ${isUser ? 'flex justify-end' : ''}`}>
          <div className={`
            px-4 py-3 rounded-lg
            ${isUser ? 'bg-sakura-500 text-white' : isSystem ? 'bg-gray-700 text-white' : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 shadow-sm'}
            max-w-[800px] w-full break-words
          `}>
            {hasThinking && <ThinkingBlock content={message.content as string} />}
            
            {message.type === 'code' ? (
              <CodeBlock 
                language={message.format as string || 'text'} 
                value={typeof message.content === 'string' ? message.content : message.content.code}
              />
            ) : message.type === 'console' ? (
              <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-900 text-gray-100 p-4 rounded">
                {message.content as string}
              </pre>
            ) : message.type === 'image' && message.format?.includes('base64') ? (
              <img 
                src={`data:image/${message.format.includes('png') ? 'png' : 'jpeg'};base64,${message.content}`} 
                alt="Generated content" 
                className="max-w-full rounded-md"
              />
            ) : (
              <div className="prose dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                  {displayContent}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </div>

        {/* Avatar for user messages */}
        {isUser && (
          <div className="flex-shrink-0 mt-1">
            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
              <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const InterpreterChat: React.FC = () => {
  const { 
    messages, 
    isExecuting, 
    stopExecution,
    sendMessage,
    onPageChange,
    onNavigateHome,
    onOpenSettings,
    onOpenKnowledgeBase,
    onOpenTools,
    interpreterClient
  } = useInterpreter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [prevMessagesLength, setPrevMessagesLength] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('connected');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [newFiles, setNewFiles] = useState<FileInfo[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [files, setFiles] = useState<FileInfo[]>([]);
  const chatInputRef = useRef<any>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: string; show: boolean }>({
    message: '',
    type: '',
    show: false
  });

  // Function to handle file selection from sidebar
  const handleFileSelect = (file: FileInfo) => {
    if (chatInputRef.current?.handleFileSelect) {
      chatInputRef.current.handleFileSelect(file);
    }
  };

  // Function to show toast notification
  const showToast = (message: string, type: string) => {
    setToast({ message, type, show: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 2000);
  };

  // Handle auto-scroll toggle with toast notification
  const handleAutoScrollToggle = () => {
    setAutoScroll(prev => {
      const newState = !prev;
      showToast(
        newState ? "Auto-scroll enabled" : "Auto-scroll disabled",
        newState ? "success" : "info"
      );
      return newState;
    });
  };

  // Simplify scroll behavior - only scroll when auto-scroll is enabled
  useEffect(() => {
    if ((messages.length !== prevMessagesLength || isExecuting) && autoScroll) {
      setPrevMessagesLength(messages.length);
      setTimeout(() => {
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 50);
    }
  }, [messages, prevMessagesLength, isExecuting, autoScroll]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Show/hide scroll button and track scroll position
  useEffect(() => {
    const handleScroll = () => {
      if (!chatContainerRef.current) return;
      
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const bottomThreshold = 100;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < bottomThreshold;
      
      setShowScrollButton(!isNearBottom);
    };

    const container = chatContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Auto-scroll when execution state changes and auto-scroll is enabled
  useEffect(() => {
    if (isExecuting && autoScroll) {
      setTimeout(() => {
        scrollToBottom();
      }, 50);
    }
  }, [isExecuting, autoScroll]);

  // Empty state when no messages
  const renderEmptyState = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-sakura-100 dark:bg-sakura-100/10 flex items-center justify-center mb-4">
        <Bot className="w-8 h-8 text-sakura-500" />
      </div>
      <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
        Start Using the Code Interpreter
      </h2>
      <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
        Ask the interpreter to analyze data, create visualizations, or run custom code to help you.
      </p>
    </div>
  );

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    try {
      // Get all selected files from the chatInputRef
      const selectedFiles = chatInputRef.current?.selectedManagerFiles || [];
      
      // Create message with file paths if there are selected files
      let messageToSend = inputValue;
      if (selectedFiles.length > 0) {
        const filePaths = selectedFiles.map((file: any) => file.path).join('\n');
        messageToSend = `${filePaths}\n\n${inputValue}`;
      }

      // Send message and get response
      await sendMessage(messageToSend);
      setInputValue('');
      
      // Check for new files
      const currentFiles = await interpreterClient.listFiles();
      const previousFileIds = new Set(files.map((f: FileInfo) => f.id));
      const detectedNewFiles = currentFiles.filter(file => !previousFileIds.has(file.id));
      
      setFiles(currentFiles);
      setNewFiles(detectedNewFiles);
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="flex flex-col h-screen fixed inset-0">
      <AssistantHeader 
        connectionStatus={connectionStatus}
        onPageChange={onPageChange}
        onNavigateHome={onNavigateHome}
        onOpenSettings={onOpenSettings}
        onOpenKnowledgeBase={onOpenKnowledgeBase}
        onOpenTools={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      {/* Chat Container - Fixed height, scrollable */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto scroll-smooth bg-white dark:bg-black"
        style={{ 
          height: "calc(100vh - 160px)",
          overflow: "hidden auto",
          paddingBottom: "200px"
        }}
      >
        <div className="w-[75%] max-w-[1200px] mx-auto py-4">
          {messages.length === 0 ? (
            renderEmptyState()
          ) : (
            <>
              {messages.map((message, index) => (
                <InterpreterMessageItem 
                  key={`${message.role}-${message.type}-${index}`}
                  message={message}
                />
              ))}
              {isExecuting && (
                <div className="flex items-center gap-2 text-sakura-500 mt-2 px-4 ml-12">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Interpreter is working...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Fixed position buttons */}
      <div className="fixed right-8 top-1/2 -translate-y-1/2 flex flex-col gap-2 items-end">
        {/* Auto-scroll toggle button */}
        <button
          onClick={handleAutoScrollToggle}
          className={`group relative p-2 rounded-full shadow-lg transition-all duration-200 z-20 cursor-pointer 
            ${autoScroll 
              ? 'bg-sakura-500 text-white hover:bg-sakura-600 hover:shadow-xl hover:scale-105' 
              : 'bg-gray-300 text-gray-600 hover:bg-gray-400 hover:shadow-xl hover:scale-105'
            }`}
          aria-label="Toggle auto-scroll"
        >
          <ScrollText className="w-5 h-5" />
          {/* Enhanced Tooltip */}
          <div className="absolute top-0 right-full mr-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-2">
              {autoScroll ? (
                <>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Auto-scroll is ON
                  </span>
                  <span className="text-gray-400 text-xs">(Click to disable)</span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                    Auto-scroll is OFF
                  </span>
                  <span className="text-gray-400 text-xs">(Click to enable)</span>
                </>
              )}
            </div>
            {/* Tooltip Arrow */}
            <div className="absolute left-full top-1/2 -translate-y-1/2 w-2 h-2 -ml-1 rotate-45 bg-gray-900"></div>
          </div>
        </button>

        {/* Scroll to bottom button */}
        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="group relative p-2 bg-sakura-500 text-white rounded-full shadow-lg hover:bg-sakura-600 hover:shadow-xl hover:scale-105 transition-all duration-200 z-20"
            aria-label="Scroll to bottom"
          >
            <ArrowDown className="w-5 h-5" />
            {/* Tooltip */}
            <div className="absolute top-0 right-full mr-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg whitespace-nowrap">
                Scroll to bottom
              </div>
              <div className="absolute left-full top-1/2 -translate-y-1/2 w-2 h-2 -ml-1 rotate-45 bg-gray-900"></div>
            </div>
          </button>
        )}

        {/* Stop execution button */}
        {isExecuting && (
          <button
            onClick={stopExecution}
            className="group relative p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 hover:shadow-xl hover:scale-105 transition-all duration-200 z-20"
            aria-label="Stop execution"
          >
            <Square className="w-5 h-5" />
            {/* Tooltip */}
            <div className="absolute top-0 right-full mr-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg whitespace-nowrap">
                Stop execution
              </div>
              <div className="absolute left-full top-1/2 -translate-y-1/2 w-2 h-2 -ml-1 rotate-45 bg-gray-900"></div>
            </div>
          </button>
        )}
      </div>

      {/* Toast Notification */}
      {toast.show && (
        <ToastNotification 
          message={toast.message} 
          type={toast.type} 
        />
      )}

      {/* Interpreter Sidebar */}
      <InterpreterSidebar 
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        newFiles={newFiles}
        onFileSelect={handleFileSelect}
      />

      {/* Chat Input */}
      <ChatInput
        ref={chatInputRef}
        input={inputValue}
        setInput={setInputValue}
        handleSend={handleSend}
        isProcessing={isExecuting}
      />
    </div>
  );
};

export default InterpreterChat; 