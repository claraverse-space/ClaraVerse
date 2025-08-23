import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Copy, Check, MessageSquare, AlertCircle, FileText, ExternalLink, AlertTriangle, Upload, Loader2, Brain, History, Trash2, FileBarChart, Clock } from 'lucide-react';
import { claraNotebookService, NotebookCitation, ChatMessage as ServiceChatMessage, ChatHistoryResponse, QueryTemplate } from '../../services/claraNotebookService';
import DocumentUpload from './DocumentUpload';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'summary';
  content: string;
  timestamp: string;
  citations?: NotebookCitation[];
}

interface ProgressState {
  isActive: boolean;
  type: string;
  message: string;
  progress: number;
  details?: string;
}

interface NotebookChatProps {
  notebookId: string;
  documentCount: number;
  completedDocumentCount: number;
  onDocumentUpload?: (files: File[]) => void;
}

const NotebookChat: React.FC<NotebookChatProps> = ({ notebookId, documentCount, completedDocumentCount, onDocumentUpload }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isBackendHealthy, setIsBackendHealthy] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [progressState, setProgressState] = useState<ProgressState | null>(null);
  
  // New state for enhanced features
  const [chatHistory, setChatHistory] = useState<ServiceChatMessage[]>([]);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [templates, setTemplates] = useState<QueryTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<QueryTemplate | null>(null);
  const [useChatHistory, setUseChatHistory] = useState(true);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Subscribe to backend health changes
  useEffect(() => {
    const unsubscribe = claraNotebookService.onHealthChange(setIsBackendHealthy);
    return unsubscribe;
  }, []);

  // Listen for progress updates from Clara assistant
  useEffect(() => {
    let hideTimeout: NodeJS.Timeout | null = null;

    const handleProgressUpdate = (event: CustomEvent<ProgressState>) => {
      // Clear any existing timeout
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }

      setProgressState(event.detail);
      
      // Auto-hide progress after completion with longer delay
      if (event.detail.progress >= 100) {
        hideTimeout = setTimeout(() => {
          setProgressState(null);
        }, 3000);
      }
    };

    // Listen for progress events
    window.addEventListener('clara-progress-update', handleProgressUpdate as EventListener);

    // Also listen for console logs from Clara assistant and parse them
    const originalLog = console.log;
    console.log = (...args) => {
      originalLog.apply(console, args);
      
      // Check if this is a Clara progress log
      if (args.length > 0 && typeof args[0] === 'string' && args[0].includes('Setting new progressState')) {
        try {
          // Parse the progress object from the log
          const progressObj = args.find(arg => 
            typeof arg === 'object' && 
            arg !== null && 
            'isActive' in arg && 
            'message' in arg && 
            'progress' in arg
          );
          
          if (progressObj) {
            // Clear any existing timeout
            if (hideTimeout) {
              clearTimeout(hideTimeout);
              hideTimeout = null;
            }

            setProgressState(progressObj as ProgressState);
            
            // Auto-hide progress after completion with longer delay
            if (progressObj.progress >= 100) {
              hideTimeout = setTimeout(() => {
                setProgressState(null);
              }, 3000);
            }
          }
        } catch (error) {
          // Ignore parsing errors
        }
      }
    };

    return () => {
      window.removeEventListener('clara-progress-update', handleProgressUpdate as EventListener);
      console.log = originalLog;
      if (hideTimeout) {
        clearTimeout(hideTimeout);
      }
    };
  }, []);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [inputMessage]);

  // Load chat history and templates on mount
  useEffect(() => {
    if (isBackendHealthy) {
      loadChatHistory();
      loadQueryTemplates();
    }
  }, [isBackendHealthy, notebookId]);

  // Load chat history
  const loadChatHistory = async () => {
    try {
      const history = await claraNotebookService.getChatHistory(notebookId, 20);
      setChatHistory(history.messages);
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  // Load query templates
  const loadQueryTemplates = async () => {
    try {
      const templateList = await claraNotebookService.getQueryTemplates();
      setTemplates(templateList);
    } catch (error) {
      console.error('Failed to load query templates:', error);
    }
  };

  // Clear chat history
  const clearChatHistory = async () => {
    try {
      await claraNotebookService.clearChatHistory(notebookId);
      setChatHistory([]);
      setShowChatHistory(false);
    } catch (error) {
      console.error('Failed to clear chat history:', error);
    }
  };

  const handleClearChatHistory = async () => {
    try {
      await claraNotebookService.clearChatHistory(notebookId);
      setChatHistory([]);
      setShowChatHistory(false);
      // toast.success('Chat history cleared');
    } catch (error) {
      console.error('Failed to clear chat history:', error);
      // toast.error('Failed to clear chat history');
    }
  };

  const handleTemplateSelect = async (template: QueryTemplate) => {
    try {
      setInputMessage(template.question_template);
      setShowTemplates(false);
      setSelectedTemplate(template);
    } catch (error) {
      console.error('Failed to select template:', error);
    }
  };

  // Reset states when notebook changes
  useEffect(() => {
    setMessages([]);
    setChatHistory([]);
    setShowChatHistory(false);
    setShowTemplates(false);
    // Load chat history and templates for the new notebook
    if (useChatHistory) {
      loadChatHistory();
    }
    loadQueryTemplates();
  }, [notebookId, useChatHistory]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    if (!isBackendHealthy) {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: 'Sorry, the notebook backend is currently unavailable. Please check your connection and try again.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      return;
    }

    if (completedDocumentCount === 0) {
      const errorMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'assistant',
        content: documentCount > 0 
          ? 'Please wait for your documents to finish processing before asking questions.'
          : 'Please upload documents to your notebook before asking questions. I need content to search through and provide answers.',
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      setInputMessage('');
      return;
    }

    // Collapse summary when first question is asked
    // (removed - no more automatic summary generation)

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Use the enhanced chat API instead of regular query
      const response = await claraNotebookService.sendChatMessage(notebookId, {
        question: inputMessage.trim(),
        mode: 'hybrid',
        response_type: 'Multiple Paragraphs',
        top_k: 60,
        use_chat_history: useChatHistory
      });

      const assistantResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response.answer,
        timestamp: new Date().toISOString(),
        citations: response.citations
      };
      setMessages(prev => [...prev, assistantResponse]);

      // Reload chat history to get the updated conversation
      if (useChatHistory) {
        await loadChatHistory();
      }

    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `Sorry, I encountered an error while processing your request: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyToClipboard = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleDocumentUpload = async (files: File[]) => {
    setShowUploadModal(false);
    if (onDocumentUpload) {
      onDocumentUpload(files);
    }
  };



  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Progress indicator component
  const ProgressIndicator: React.FC<{ progress: ProgressState }> = ({ progress }) => {
    const circumference = 2 * Math.PI * 16; // radius = 16
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (progress.progress / 100) * circumference;

    return (
      <div className="fixed top-20 right-4 z-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 min-w-[200px] animate-in slide-in-from-right-2 duration-300">
        <div className="flex items-center gap-3">
          {/* Progress Ring */}
          <div className="relative w-10 h-10 flex-shrink-0">
            <svg className="w-10 h-10 transform -rotate-90" viewBox="0 0 36 36">
              {/* Background circle */}
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-gray-200 dark:text-gray-600"
              />
              {/* Progress circle */}
              <circle
                cx="18"
                cy="18"
                r="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="text-blue-500"
                style={{
                  transition: 'stroke-dashoffset 0.3s ease-in-out'
                }}
              />
            </svg>
            {/* Icon in center */}
            <div className="absolute inset-0 flex items-center justify-center">
              {progress.type === 'context_loading' ? (
                <Brain className="w-4 h-4 text-blue-500" />
              ) : (
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              )}
            </div>
          </div>

          {/* Progress text */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {progress.message}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {progress.progress}%
              {progress.details && (
                <div className="truncate mt-1">
                  {progress.details}
                </div>
              )}
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={() => setProgressState(null)}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0"
          >
            <Check className="w-3 h-3 text-gray-400" />
          </button>
        </div>
      </div>
    );
  };

  // Simple markdown-like formatting
  const formatMessage = (content: string) => {
    return content
      .split('\n')
      .map((line, index) => {
        // Headers
        if (line.startsWith('### ')) {
          return (
            <h3 key={index} className="text-lg font-semibold text-gray-900 dark:text-white mt-4 mb-2">
              {line.replace('### ', '')}
            </h3>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h2 key={index} className="text-xl font-semibold text-gray-900 dark:text-white mt-4 mb-2">
              {line.replace('## ', '')}
            </h2>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <h1 key={index} className="text-2xl font-bold text-gray-900 dark:text-white mt-4 mb-2">
              {line.replace('# ', '')}
            </h1>
          );
        }
        
        // Bold text
        if (line.includes('**')) {
          const parts = line.split('**');
          return (
            <p key={index} className="mb-2">
              {parts.map((part, partIndex) => 
                partIndex % 2 === 1 ? (
                  <strong key={partIndex} className="font-semibold text-gray-900 dark:text-white">
                    {part}
                  </strong>
                ) : (
                  <span key={partIndex}>{part}</span>
                )
              )}
            </p>
          );
        }
        
        // List items
        if (line.startsWith('- ')) {
          return (
            <li key={index} className="ml-4 mb-1 list-disc">
              {line.replace('- ', '')}
            </li>
          );
        }
        
        // Numbered lists
        if (line.match(/^\d+\. /)) {
          return (
            <li key={index} className="ml-4 mb-1 list-decimal">
              {line.replace(/^\d+\. /, '')}
            </li>
          );
        }
        
        // Empty lines
        if (line.trim() === '') {
          return <br key={index} />;
        }
        
        // Regular paragraphs
        return (
          <p key={index} className="mb-2">
            {line}
          </p>
        );
      });
  };

  const chatMessages = messages.filter(m => m.type !== 'summary');

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Enhanced Header with Controls */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">Chat with Your Documents</h3>
          <div className="flex items-center gap-2">
            {/* Chat History Toggle */}
            {useChatHistory && (
              <button
                onClick={() => setShowChatHistory(!showChatHistory)}
                className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                title="Toggle Chat History"
              >
                <History size={14} />
              </button>
            )}
            
            {/* Templates Button */}
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="Query Templates"
            >
              <FileBarChart size={14} />
            </button>

            {/* Chat History Enable/Disable */}
            <label className="flex items-center gap-1 text-xs text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={useChatHistory}
                onChange={(e) => setUseChatHistory(e.target.checked)}
                className="w-3 h-3 rounded"
              />
              History
            </label>

            {/* Clear Chat History */}
            {useChatHistory && chatHistory.length > 0 && (
              <button
                onClick={handleClearChatHistory}
                className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                title="Clear Chat History"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Chat History Panel */}
        {showChatHistory && useChatHistory && chatHistory.length > 0 && (
          <div className="mt-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="max-h-32 overflow-y-auto space-y-2 custom-scrollbar">
              {chatHistory.slice(-3).map((msg, index) => (
                <div key={index} className="text-xs text-gray-700 dark:text-gray-300 flex items-start gap-2 p-2 bg-white dark:bg-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 border border-gray-200 dark:border-gray-600">
                  <Clock size={12} className="mt-0.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-white">{msg.role === 'user' ? 'You' : 'AI'}:</span>
                  <span className="truncate text-gray-700 dark:text-gray-300">{msg.content.substring(0, 50)}...</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Templates Panel */}
        {showTemplates && templates.length > 0 && (
          <div className="mt-3 p-3 bg-gray-100 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar">
              {templates.slice(0, 6).map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  className="p-3 text-left bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-lg transition-all duration-200 transform hover:scale-[1.02] hover:shadow-md border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                >
                  <div className="font-medium text-gray-900 dark:text-white text-xs truncate mb-1">{template.name}</div>
                  <div className="text-gray-600 dark:text-gray-400 text-xs truncate leading-relaxed">{template.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Messages Area - Fixed height with scroll */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-0 custom-scrollbar">
        {chatMessages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm max-w-md">
              <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-6 shadow-lg border border-blue-200 dark:border-blue-700">
                <MessageSquare className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              {documentCount === 0 ? (
                <div>
                  <h3 className="text-gray-900 dark:text-white font-semibold text-lg mb-2">
                    Welcome to Your Knowledge Base
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
                    Upload documents to start chatting and ask questions about your content
                  </p>
                  <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                    <Upload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-blue-700 dark:text-blue-300 text-sm">Get started by uploading files</span>
                  </div>
                </div>
              ) : completedDocumentCount === 0 ? (
                <div>
                  <h3 className="text-gray-900 dark:text-white font-semibold text-lg mb-2">
                    Processing Your Documents
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-3 leading-relaxed">
                    Please wait while we analyze your documents
                  </p>
                  <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                    <span className="text-sm">Processing in progress...</span>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-gray-900 dark:text-white font-semibold text-lg mb-2">
                    Ready to Chat
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    Start a conversation about your documents
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {chatMessages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-4 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.type === 'assistant' && (
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-gray-700">
                <Bot className="w-5 h-5 text-white" />
              </div>
            )}
            
            <div className={`max-w-3xl ${message.type === 'user' ? 'order-1' : ''}`}>
              <div
                className={`rounded-2xl p-6 shadow-md transform transition-all duration-200 hover:shadow-lg border ${
                  message.type === 'user'
                    ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white ml-auto border-blue-500'
                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700'
                }`}
              >
                <div className={`prose-sm max-w-none break-words ${
                  message.type === 'user' 
                    ? 'prose-invert' 
                    : 'prose-gray dark:prose-invert'
                }`}>
                  {typeof formatMessage(message.content) === 'string' ? (
                    <p className={message.type === 'user' ? 'text-white' : 'text-gray-900 dark:text-white'}>{message.content}</p>
                  ) : (
                    <div className={message.type === 'user' ? 'text-white' : 'text-gray-900 dark:text-white'}>
                      {formatMessage(message.content)}
                    </div>
                  )}
                </div>
                
                {/* Citations section for assistant messages */}
                {message.type === 'assistant' && message.citations && message.citations.length > 0 && (
                  <div className="mt-3 pt-3 glassmorphic">
                    <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      Sources ({message.citations.length})
                    </h4>
                    <div className="space-y-1">
                      {message.citations.slice(0, 5).map((citation, index) => (
                        <div key={index} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                          <FileText className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate" title={citation.file_path}>
                            {citation.title}
                          </span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-50" />
                        </div>
                      ))}
                      {message.citations.length > 5 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          +{message.citations.length - 5} more sources
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-3 pt-2 glassmorphic">
                  <span className={`text-xs ${
                    message.type === 'user' 
                      ? 'text-gray-100' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {formatTime(message.timestamp)}
                  </span>
                  
                  {message.type === 'assistant' && (
                    <button
                      onClick={() => copyToClipboard(message.content, message.id)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      title="Copy message"
                    >
                      {copiedId === message.id ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {message.type === 'user' && (
              <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-green-500/25 ring-2 ring-white/10">
                <User className="w-5 h-5 text-white" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-4 justify-start">
            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/25 ring-2 ring-white/10">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-white/10 backdrop-blur-sm glassmorphic rounded-2xl p-6 shadow-xl shadow-black/20 border border-white/20">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full animate-bounce shadow-lg"></div>
                <div className="w-3 h-3 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full animate-bounce shadow-lg" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-3 h-3 bg-gradient-to-r from-pink-400 to-red-500 rounded-full animate-bounce shadow-lg" style={{ animationDelay: '0.4s' }}></div>
                <span className="text-white/70 text-sm ml-2">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Backend Status Warning */}
      {(!isBackendHealthy || completedDocumentCount === 0) && (
        <div className="flex-shrink-0 px-6 py-4 bg-gradient-to-r from-red-500/20 to-orange-500/20 backdrop-blur-sm border-t border-red-400/20 shadow-lg">
          <div className="flex items-center text-white">
            <div className="flex-shrink-0 w-8 h-8 bg-red-500/20 rounded-full flex items-center justify-center mr-3 shadow-lg">
              <AlertTriangle className="w-4 h-4 text-red-300" />
            </div>
            <div className="flex-1">
              <span className="text-sm font-medium">
                {!isBackendHealthy 
                  ? "Backend unavailable - Chat functionality is limited"
                  : completedDocumentCount === 0 && documentCount > 0
                    ? `Processing ${documentCount} document${documentCount !== 1 ? 's' : ''} - Chat will be available once complete`
                    : documentCount === 0 
                      ? "Upload documents to enable chat functionality"
                      : ""
                }
              </span>
              {completedDocumentCount === 0 && documentCount > 0 && (
                <p className="text-xs text-white/70 mt-1">
                  Don't worry, this runs in the background - You can access other features meanwhile
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="flex-shrink-0 p-6 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-sm">
        <div className="max-w-4xl mx-auto">
          <div className="relative bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 hover:border-gray-300 dark:hover:border-gray-500 group">
            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                !isBackendHealthy 
                  ? "Backend unavailable..." 
                  : completedDocumentCount === 0 && documentCount > 0
                    ? "Processing documents..."
                    : documentCount === 0 
                      ? "Upload documents to start chatting..."
                      : "Ask me anything about your documents..."
              }
              disabled={!isBackendHealthy || isLoading || completedDocumentCount === 0}
              className="w-full p-6 pr-20 bg-transparent text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed rounded-3xl text-base leading-relaxed group-hover:placeholder-gray-600 dark:group-hover:placeholder-gray-300 transition-all duration-200"
              style={{ minHeight: '72px', maxHeight: '200px' }}
            />
            
            {/* Action Buttons */}
            <div className="absolute right-4 bottom-4 flex items-center gap-3">
              {/* Send Button */}
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading || !isBackendHealthy || completedDocumentCount === 0}
                className={`p-4 rounded-2xl transition-all duration-200 transform border ${
                  inputMessage.trim() && !isLoading && isBackendHealthy && completedDocumentCount > 0
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-xl hover:scale-105 border-blue-500'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed border-gray-300 dark:border-gray-600'
                }`}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Helper Text */}
          <div className="flex items-center justify-between mt-4 px-3">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Press Enter to send, Shift+Enter for new line
            </p>
            {isBackendHealthy && completedDocumentCount > 0 && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full shadow-sm animate-pulse"></div>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                  {completedDocumentCount} of {documentCount} documents ready
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Document Upload Modal */}
      {showUploadModal && (
        <DocumentUpload
          onClose={() => setShowUploadModal(false)}
          onUpload={handleDocumentUpload}
        />
      )}

      {/* Progress Indicator */}
      {progressState && progressState.isActive && (
        <ProgressIndicator progress={progressState} />
      )}
    </div>
  );
};

export default NotebookChat; 