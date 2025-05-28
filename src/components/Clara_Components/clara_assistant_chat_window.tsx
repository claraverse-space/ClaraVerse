/**
 * Clara Assistant Chat Window Component
 * 
 * This component serves as the main chat interface for the Clara assistant.
 * It displays the conversation history, handles message rendering, and manages
 * the chat window state including scrolling, loading states, and empty states.
 * 
 * Features:
 * - Message history display
 * - Auto-scrolling to new messages
 * - Loading states and indicators
 * - Empty state with welcome message
 * - Virtualization support for large conversations
 * - Message interaction handling
 * - Session management
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { 
  MessageCircle, 
  Sparkles, 
  FileText, 
  Image as ImageIcon, 
  Code,
  Search,
  Bot,
  ArrowDown,
  RefreshCw,
  Loader2,
  Brain,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';

// Import types and components
import { 
  ClaraMessage, 
  ClaraChatWindowProps,
  ClaraProcessingState
} from '../../types/clara_assistant_types';
import ClaraMessageBubble from './clara_assistant_message_bubble';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';

/**
 * Welcome screen component displayed when there are no messages
 */
const WelcomeScreen: React.FC<{
  userName?: string;
  onStartChat?: () => void;
}> = ({ userName, onStartChat }) => {
  const suggestions = [
    {
      icon: FileText,
      title: "Analyze Documents",
      description: "Upload PDFs, docs, or text files for analysis",
      action: "Upload a document and ask me about it"
    },
    {
      icon: ImageIcon,
      title: "Image Understanding",
      description: "Upload images for description and analysis",
      action: "Share an image and I'll describe what I see"
    },
    {
      icon: Code,
      title: "Code Assistance",
      description: "Get help with programming and debugging",
      action: "Show me some code you'd like help with"
    },
    {
      icon: Search,
      title: "Research & Analysis",
      description: "Ask complex questions and get detailed answers",
      action: "Ask me anything you'd like to research"
    }
  ];

  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="max-w-2xl text-center">
        {/* Hero Section */}
        <div className="mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 via-pink-500 to-sakura-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            {/* support dark mode and light mode */}
            <Bot className="w-10 h-10 dark:text-white text-gray-500" />
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
            Welcome{userName ? ` back, ${userName}` : ''} to Clara! 
            <Sparkles className="inline-block w-6 h-6 ml-2 text-sakura-500" />
          </h1>
          
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
            Your intelligent assistant for documents, images, code, and more.
            Just upload files and start asking questions!
          </p>

          {/* Feature highlights */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium">
              Multi-modal AI
            </span>
            <span className="px-3 py-1 bg-sakura-100 dark:bg-sakura-900/30 text-sakura-700 dark:text-sakura-300 rounded-full text-sm font-medium">
              Document Analysis
            </span>
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
              Image Understanding
            </span>
            <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium">
              Code Assistant
            </span>
          </div>
        </div>

        {/* Suggestions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => onStartChat?.()}
              className="p-4 bg-white/50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-all hover:shadow-md group text-left"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg group-hover:scale-110 transition-transform">
                  <suggestion.icon className="w-5 h-5 dark:text-white text-gray-500" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                    {suggestion.title}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                    {suggestion.description}
                  </p>
                  <p className="text-xs text-sakura-600 dark:text-sakura-400 font-medium">
                    "{suggestion.action}"
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Quick start tips */}
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <p className="mb-2">
            💡 <strong>Pro tip:</strong> You can drag and drop files directly into the chat!
          </p>
          <p>
            🔄 Clara automatically detects file types and uses the best AI models for each task.
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Loading screen component displayed when Clara is initializing
 */
const LoadingScreen: React.FC<{
  userName?: string;
}> = ({ userName }) => {
  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="max-w-md text-center">
        {/* Loading Animation */}
        <div className="w-20 h-20 bg-gradient-to-br from-purple-500 via-pink-500 to-sakura-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-pulse">
          <Bot className="w-10 h-10 text-white" />
        </div>
        
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          Initializing Clara...
        </h2>
        
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {userName ? `Welcome back, ${userName}! ` : ''}
          Setting up your AI assistant and loading your chat history.
        </p>

        {/* Loading Steps */}
        <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-sakura-500 rounded-full animate-bounce"></div>
            <span>Loading chat sessions...</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <span>Initializing AI models...</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            <span>Preparing workspace...</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-6 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div className="bg-gradient-to-r from-purple-500 to-sakura-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
        </div>
      </div>
    </div>
  );
};

/**
 * Scroll to bottom button
 */
const ScrollToBottomButton: React.FC<{
  onClick: () => void;
  show: boolean;
}> = ({ onClick, show }) => {
  if (!show) return null;

  return (
    <div className="absolute bottom-4 right-4 z-10">
      <button
        onClick={onClick}
        className="p-3 bg-sakura-500 hover:bg-sakura-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all"
        title="Scroll to bottom"
      >
        <ArrowDown className="w-5 h-5" />
      </button>
    </div>
  );
};

/**
 * Loading indicator for when Clara is processing
 */
const ProcessingIndicator: React.FC<{
  processingState: ClaraProcessingState;
  message?: string;
}> = ({ processingState, message }) => {
  if (processingState === 'idle') return null;

  const getIndicatorContent = () => {
    switch (processingState) {
      case 'processing':
        return {
          icon: <RefreshCw className="w-5 h-5 animate-spin" />,
          text: message || 'Clara is thinking...',
          bgColor: 'bg-blue-500'
        };
      case 'success':
        return {
          icon: <Bot className="w-5 h-5" />,
          text: 'Response generated!',
          bgColor: 'bg-green-500'
        };
      case 'error':
        return {
          icon: <Bot className="w-5 h-5" />,
          text: message || 'Something went wrong',
          bgColor: 'bg-red-500'
        };
      default:
        return null;
    }
  };

  const content = getIndicatorContent();
  if (!content) return null;

  return (
    <div className="flex justify-center mb-4">
      <div className={`flex items-center gap-2 px-4 py-2 ${content.bgColor} text-white rounded-full text-sm`}>
        {content.icon}
        <span>{content.text}</span>
      </div>
    </div>
  );
};

/**
 * Main Clara Chat Window Component
 */
const ClaraChatWindow: React.FC<ClaraChatWindowProps> = ({
  messages,
  userName,
  isLoading = false,
  isInitializing = false,
  onRetryMessage,
  onCopyMessage,
  onEditMessage
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [processingState, setProcessingState] = useState<ClaraProcessingState>('idle');

  // Use the smooth scroll hook for better streaming behavior
  const { scrollToElementDebounced, scrollToElementImmediate } = useSmoothScroll({
    debounceMs: 150,
    behavior: 'smooth',
    block: 'end'
  });

  // Auto-scroll to bottom when new messages arrive (if user is near bottom)
  const scrollToBottom = useCallback((force = false) => {
    if (!messagesEndRef.current) return;
    
    if (force || isNearBottom) {
      scrollToElementImmediate(messagesEndRef.current);
    }
  }, [isNearBottom, scrollToElementImmediate]);

  // Effect to handle auto-scrolling - improved for streaming
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    const isStreaming = lastMessage?.metadata?.isStreaming;
    
    if (isStreaming) {
      // During streaming, use shorter debounce for better responsiveness
      if (messagesEndRef.current) {
        scrollToElementDebounced(messagesEndRef.current, 250);
      }
    } else {
      // For new messages or when streaming ends, scroll immediately
      scrollToBottom();
    }
  }, [messages.length, scrollToBottom, scrollToElementDebounced]);

  // Additional effect to handle streaming content updates with moderate debounce
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.metadata?.isStreaming && lastMessage.content && messagesEndRef.current) {
      // Use moderate debounce for content updates during streaming
      scrollToElementDebounced(messagesEndRef.current, 300);
    }
  }, [messages[messages.length - 1]?.content, scrollToElementDebounced]);

  // Handle scroll events to show/hide scroll button
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const nearBottom = scrollHeight - scrollTop - clientHeight < 100;
    
    setIsNearBottom(nearBottom);
    setShowScrollButton(!nearBottom && messages.length > 0);
  }, [messages.length]);

  // Set up scroll listener
  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll);
      return () => scrollElement.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  // Update processing state based on loading and messages
  useEffect(() => {
    if (isLoading) {
      setProcessingState('processing');
    } else {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.metadata?.error) {
        setProcessingState('error');
        setTimeout(() => setProcessingState('idle'), 3000);
      } else if (lastMessage && lastMessage.role === 'assistant') {
        setProcessingState('success');
        setTimeout(() => setProcessingState('idle'), 2000);
      } else {
        setProcessingState('idle');
      }
    }
  }, [isLoading, messages]);

  // Handle message interactions
  const handleCopyMessage = useCallback((content: string) => {
    onCopyMessage?.(content);
    // Could show a toast notification here
  }, [onCopyMessage]);

  const handleRetryMessage = useCallback((messageId: string) => {
    onRetryMessage?.(messageId);
  }, [onRetryMessage]);

  const handleEditMessage = useCallback((messageId: string, newContent: string) => {
    onEditMessage?.(messageId, newContent);
  }, [onEditMessage]);

  // Force scroll to bottom
  const forceScrollToBottom = useCallback(() => {
    scrollToBottom(true);
  }, [scrollToBottom]);

  return (
    <div 
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-6 relative"
      style={{ scrollBehavior: 'smooth' }}
    >
      <div className="max-w-4xl mx-auto">
        {/* Loading screen when Clara is initializing */}
        {isInitializing ? (
          <LoadingScreen userName={userName} />
        ) : /* Welcome screen when no messages */ messages.length === 0 ? (
          <WelcomeScreen userName={userName} />
        ) : (
          <div className="space-y-5">
            {/* Message list */}
            {messages.map((message) => (
              <ClaraMessageBubble
                key={message.id}
                message={message}
                userName={userName}
                isEditable={message.role === 'user'}
                onCopy={handleCopyMessage}
                onRetry={handleRetryMessage}
                onEdit={handleEditMessage}
              />
            ))}
            
            {/* Processing indicator */}
            <ProcessingIndicator 
              processingState={processingState}
              message={
                processingState === 'processing' 
                  ? 'Model is loading - the first response will take a bit...' 
                  : undefined
              }
            />
            
            {/* Invisible element to track end of messages */}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      <ScrollToBottomButton 
        show={showScrollButton}
        onClick={forceScrollToBottom}
      />
    </div>
  );
};

export default ClaraChatWindow; 