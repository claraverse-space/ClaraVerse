import React, { useEffect, useRef, useState } from 'react';
import { useInterpreter } from '../../contexts/InterpreterContext';
import { User, Bot, Copy, Check, ArrowDown, RefreshCw, Square, Brain, ChevronDown, ChevronUp, ScrollText, Maximize2, Minimize2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Components } from 'react-markdown';
import { InterpreterMessage } from '../../utils/InterpreterClient';
import { AssistantHeader } from '../assistant_components';
import InterpreterSidebar from '../interpreter_components/InterpreterSidebar';
import { FileInfo } from '../../utils/InterpreterClient';
import ToastNotification from '../gallery_components/ToastNotification';

// Message type mapping for tile display
const messageTypeMap: { [key: string]: string } = {
  'code': 'Code Output',
  'console': 'Console Output',
  'image': 'Image Output',
  'error': 'Error Message',
  'text': 'Response'
};

// Tile component for each message type
const MessageTile: React.FC<{
  message: InterpreterMessage;
  isExpanded: boolean;
  onToggleExpand: () => void;
  autoScroll: boolean;
}> = ({ message, isExpanded, onToggleExpand, autoScroll }) => {
  const tileRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [expandedThink, setExpandedThink] = useState<{ [key: string]: boolean }>({});

  // Handle auto-scrolling when content changes
  useEffect(() => {
    if (autoScroll && tileRef.current) {
      tileRef.current.scrollTop = tileRef.current.scrollHeight;
    }
  }, [message.content, autoScroll]);

  useEffect(() => {
    if (tileRef.current) {
      setIsOverflowing(
        tileRef.current.scrollHeight > tileRef.current.clientHeight ||
        tileRef.current.scrollWidth > tileRef.current.clientWidth
      );
    }
  }, [message]);

  const renderContent = () => {
    switch (message.type) {
      case 'code':
        return (
          <SyntaxHighlighter
            language={message.format as string || 'text'}
            style={oneDark}
            customStyle={{ margin: 0, borderRadius: '0.5rem' }}
          >
            {typeof message.content === 'string' ? message.content : message.content.code}
          </SyntaxHighlighter>
        );
      case 'console':
        return (
          <pre className="whitespace-pre-wrap font-mono text-sm p-4 rounded bg-black/20 backdrop-blur-sm text-gray-800 dark:text-gray-100 font-[Menlo,Monaco,'Courier_New',monospace]" style={{ fontFamily: "Menlo, Monaco, 'Courier New', monospace" }}>
            {message.content as string}
          </pre>
        );
      case 'image':
        return (
          <img
            src={`data:image/${message.format?.includes('png') ? 'png' : 'jpeg'};base64,${message.content}`}
            alt="Generated content"
            className="max-w-full h-auto rounded-md"
          />
        );
      default:
        const content = typeof message.content === 'string' ? message.content : JSON.stringify(message.content);
        const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
        let lastIndex = 0;
        const parts: React.ReactNode[] = [];
        let match;
        let partIdx = 0;

        // Check if the entire content is a think block
        const isFullThinkBlock = content.trim().startsWith('<think>') && content.trim().endsWith('</think>');
        
        if (isFullThinkBlock) {
          const thinkContent = content.replace(/<\/?think>/g, '').trim();
          return (
            <div>
              <button
                className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
                onClick={() => setExpandedThink(exp => ({ ...exp, 'full': !exp['full'] }))}
              >
                {expandedThink['full'] ? 'Hide thinking...' : 'Show thinking...'}
              </button>
              {expandedThink['full'] && (
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded p-2">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {thinkContent}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          );
        }

        // Process content with multiple think blocks
        while ((match = thinkRegex.exec(content)) !== null) {
          // Text before the think block
          if (match.index > lastIndex) {
            parts.push(
              <ReactMarkdown key={`text-${partIdx}`} remarkPlugins={[remarkGfm]}>
                {content.slice(lastIndex, match.index)}
              </ReactMarkdown>
            );
            partIdx++;
          }
          
          // The think block itself
          const thinkIndex = partIdx;
          parts.push(
            <span key={`think-${partIdx}`} style={{ display: 'inline-block', marginLeft: 4, marginRight: 4 }}>
              <button
                className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
                onClick={() => setExpandedThink(exp => ({ ...exp, [thinkIndex]: !exp[thinkIndex] }))}
              >
                {expandedThink[thinkIndex] ? 'Hide thinking...' : 'Show thinking...'}
              </button>
              {expandedThink[thinkIndex] && (
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded p-2">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {match[1].trim()}
                  </ReactMarkdown>
                </div>
              )}
            </span>
          );
          partIdx++;
          lastIndex = match.index + match[0].length;
        }

        // Any text after the last think block
        if (lastIndex < content.length) {
          parts.push(
            <ReactMarkdown key={`text-${partIdx}`} remarkPlugins={[remarkGfm]}>
              {content.slice(lastIndex)}
            </ReactMarkdown>
          );
        }

        return <div className="prose dark:prose-invert max-w-none">{parts}</div>;
    }
  };

  return (
    <div
      className={`relative rounded-xl overflow-hidden transition-all duration-300 ease-in-out
        ${isExpanded ? 'col-span-2 row-span-2' : 'col-span-1 row-span-1'}
        bg-white/10 dark:bg-gray-800/10 backdrop-blur-md
        border border-white/20 dark:border-gray-700/20
        shadow-lg hover:shadow-xl`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/10 dark:border-gray-700/10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-sakura-500"></div>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-100">
            {messageTypeMap[message.type] || 'Output'}
          </span>
        </div>
        <button
          onClick={onToggleExpand}
          className="p-1 hover:bg-white/10 dark:hover:bg-gray-700/10 rounded-full transition-colors"
        >
          {isExpanded ? (
            <Minimize2 className="w-4 h-4 text-gray-700 dark:text-gray-200" />
          ) : (
            <Maximize2 className="w-4 h-4 text-gray-700 dark:text-gray-200" />
          )}
        </button>
      </div>

      {/* Content */}
      <div
        ref={tileRef}
        className={`p-4 overflow-auto text-gray-800 dark:text-gray-100 ${isExpanded ? 'max-h-[calc(100vh-300px)]' : 'max-h-[300px]'}`}
      >
        {renderContent()}
      </div>

      {/* Scroll indicator */}
      {isOverflowing && !isExpanded && (
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white/30 dark:from-gray-800/30 to-transparent pointer-events-none" />
      )}
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

  const [expandedTiles, setExpandedTiles] = useState<{ [key: number]: boolean }>({});
  const [autoScroll, setAutoScroll] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: string; show: boolean }>({
    message: '',
    type: '',
    show: false
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [newFiles, setNewFiles] = useState<FileInfo[]>([]);
  const [initialFiles, setInitialFiles] = useState<Set<string>>(new Set());
  const [isFirstMessageLoading, setIsFirstMessageLoading] = useState(false);

  // Track first message loading state
  useEffect(() => {
    if (isExecuting && messages.length === 1) {
      setIsFirstMessageLoading(true);
    } else if (!isExecuting || messages.length > 1) {
      setIsFirstMessageLoading(false);
    }
  }, [isExecuting, messages.length]);

  // Track execution state changes
  useEffect(() => {
    const handleExecutionStateChange = async () => {
      if (isExecuting) {
        // Auto-close sidebar when execution starts
        setIsSidebarOpen(false);
      } else {
        // When execution stops, check for new files and only open sidebar if there are new ones
        await refreshNewFiles();
        const currentFiles = await interpreterClient?.listFiles();
        if (currentFiles) {
          const newFilesList = currentFiles.filter(file => !initialFiles.has(file.id));
          if (newFilesList.length > 0) {
            setIsSidebarOpen(true);
          }
        }
      }
    };

    handleExecutionStateChange();
  }, [isExecuting, interpreterClient, initialFiles]);

  // Initialize initial files on component mount
  useEffect(() => {
    const loadInitialFiles = async () => {
      try {
        const files = await interpreterClient?.listFiles();
        if (files) {
          setInitialFiles(new Set(files.map(file => file.id)));
        }
      } catch (error) {
        console.error('Error loading initial files:', error);
      }
    };
    loadInitialFiles();
  }, [interpreterClient]);

  // Function to refresh and check for new files
  const refreshNewFiles = async () => {
    try {
      const currentFiles = await interpreterClient?.listFiles();
      if (currentFiles) {
        const newFilesList = currentFiles.filter(file => !initialFiles.has(file.id));
        setNewFiles(newFilesList);
      }
    } catch (error) {
      console.error('Error refreshing files:', error);
    }
  };

  // Show toast notification
  const showToast = (message: string, type: string) => {
    setToast({ message, type, show: true });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 2000);
  };

  // Handle auto-scroll toggle
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

  // Filter out empty messages and group by type
  const validMessages = messages.filter(msg => msg.content && msg.content !== '');

  return (
    <div className="flex flex-col h-screen fixed inset-0 bg-gradient-to-br from-white to-sakura-100 dark:from-gray-900 dark:to-sakura-900/10">
      <AssistantHeader
        connectionStatus="connected"
        onPageChange={onPageChange}
        onNavigateHome={onNavigateHome}
        onOpenSettings={onOpenSettings}
        onOpenKnowledgeBase={onOpenKnowledgeBase}
        onOpenTools={() => setIsSidebarOpen(!isSidebarOpen)}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Main content area */}
        <div className="flex-1 flex flex-col p-4 overflow-hidden">
          {/* Loading message */}
          {isFirstMessageLoading && (
            <div className="mb-4 mx-auto max-w-3xl w-full">
              <div className="bg-white/20 dark:bg-gray-800/20 backdrop-blur-sm rounded-xl p-4 border border-white/20 dark:border-gray-700/20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-sakura-100 dark:bg-sakura-900/40 flex items-center justify-center">
                    <Bot className="w-5 h-5 text-sakura-500" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-800 dark:text-gray-100">Clara is starting, please wait...</span>
                    <div className="w-2 h-2 rounded-full bg-sakura-500 animate-pulse"></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* User input display at top */}
          {validMessages.length > 0 && validMessages[0].role === 'user' && (
            <div className="mb-4 mx-auto max-w-3xl w-full">
              <div className="bg-white/20 dark:bg-gray-800/20 backdrop-blur-sm rounded-xl p-4 border border-white/20 dark:border-gray-700/20">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-200/50 dark:bg-gray-700/50 flex items-center justify-center">
                    <User className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                  </div>
                  <div className="flex-1 text-gray-800 dark:text-gray-100">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {validMessages[0].content as string}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tiled message grid */}
          <div className="flex-1 overflow-auto">
            <div className="grid grid-cols-2 gap-4 p-4 auto-rows-min">
              {validMessages.slice(1).map((message, index) => (
                <MessageTile
                  key={`${message.role}-${message.type}-${index}`}
                  message={message}
                  isExpanded={expandedTiles[index] || false}
                  onToggleExpand={() => setExpandedTiles(prev => ({
                    ...prev,
                    [index]: !prev[index]
                  }))}
                  autoScroll={autoScroll}
                />
              ))}
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
                  : 'bg-gray-300/50 backdrop-blur-sm text-gray-700 dark:text-gray-200 hover:bg-gray-400/50 hover:shadow-xl hover:scale-105'
                }`}
              aria-label="Toggle auto-scroll"
            >
              <ScrollText className="w-5 h-5" />
              {/* Enhanced Tooltip */}
              <div className="absolute right-full mr-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="bg-gray-900/90 backdrop-blur-sm text-white px-3 py-1.5 rounded text-sm whitespace-nowrap">
                  {autoScroll ? "Auto-scroll enabled" : "Auto-scroll disabled"}
                </div>
              </div>
            </button>

            {/* Stop execution button */}
            {isExecuting && (
              <button
                onClick={stopExecution}
                className="p-2 rounded-full bg-red-500/50 backdrop-blur-sm text-white hover:bg-red-600/50 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
                aria-label="Stop execution"
              >
                <Square className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <InterpreterSidebar
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          newFiles={newFiles}
        />
      </div>

      {/* Toast notification */}
      {toast.show && (
        <ToastNotification
          message={toast.message}
          type={toast.type}
        />
      )}
    </div>
  );
};

export default InterpreterChat; 