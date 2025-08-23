import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Send, Bot, User, Copy, Check, Clock, History, FileText, ExternalLink,
  AlertTriangle, Upload, FileBarChart, Trash2
} from 'lucide-react';
import DocumentUpload from './DocumentUpload';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  role?: 'user' | 'assistant'; // Add role property for compatibility
  citations?: Array<{
    file_path: string;
    title: string;
    content?: string;
  }>;
}

interface QueryTemplate {
  id: string;
  name: string;
  query: string;
  description: string;
}

interface ProgressState {
  isActive: boolean;
  message: string;
  progress: number;
  details?: string;
}

interface NotebookChatProps {
  messages: ChatMessage[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
  notebookId: string;
  documentCount: number;
  completedDocumentCount: number;
  isBackendHealthy: boolean;
}

const NotebookChat: React.FC<NotebookChatProps> = ({
  messages,
  onSendMessage,
  isLoading,
  notebookId,
  documentCount = 0,
  completedDocumentCount = 0,
  isBackendHealthy = true
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(messages);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [progressState, setProgressState] = useState<ProgressState | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [useChatHistory, setUseChatHistory] = useState(false);
  const [showChatHistory, setShowChatHistory] = useState(false);
  const [templates, setTemplates] = useState<QueryTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Progress tracking effect
  useEffect(() => {
    let hideTimeout: NodeJS.Timeout | null = null;
    
    const originalLog = console.log;
    console.log = (...args) => {
      originalLog(...args);
      
      const message = args.join(' ');
      if (message.includes('progress:')) {
        try {
          const progressMatch = message.match(/progress:\s*({.*})/);
          if (progressMatch) {
            const progressObj = JSON.parse(progressMatch[1]);
            
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

    const handleProgressUpdate = (event: CustomEvent) => {
      const progressObj = event.detail;
      if (progressObj) {
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
    };

    window.addEventListener('clara-progress-update', handleProgressUpdate as EventListener);

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
      const response = await fetch(`/api/notebooks/${notebookId}/chat-history`);
      if (response.ok) {
        const history = await response.json();
        setChatHistory(history);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  // Load query templates
  const loadQueryTemplates = async () => {
    try {
      const response = await fetch('/api/query-templates');
      if (response.ok) {
        const templatesData = await response.json();
        setTemplates(templatesData);
      }
    } catch (error) {
      console.error('Failed to load query templates:', error);
    }
  };

  // Clear chat history
  const handleClearChatHistory = async () => {
    try {
      const response = await fetch(`/api/notebooks/${notebookId}/chat-history`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setChatHistory([]);
      }
    } catch (error) {
      console.error('Failed to clear chat history:', error);
    }
  };

  // Handle template selection
  const handleTemplateSelect = (template: QueryTemplate) => {
    setInputMessage(template.query);
    setShowTemplates(false);
  };

  // Update chat messages when props change
  useEffect(() => {
    setChatMessages(messages);
  }, [messages]);

  const handleSendMessage = () => {
    if (inputMessage.trim() && !isLoading && isBackendHealthy && completedDocumentCount > 0) {
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        type: 'user',
        content: inputMessage.trim(),
        timestamp: new Date()
      };
      
      // Add user message immediately
      setChatMessages(prev => [...prev, userMessage]);
      
      // Save to chat history if enabled
      if (useChatHistory) {
        setChatHistory(prev => [...prev, userMessage]);
      }
      
      onSendMessage(inputMessage.trim());
      setInputMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatMessage = (content: string) => {
    // Split by code blocks and regular text
    const parts = content.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        // Code block
        const code = part.slice(3, -3);
        const lines = code.split('\n');
        const language = lines[0]?.trim() || '';
        const codeContent = language ? lines.slice(1).join('\n') : code;
        
        return (
          <div key={index} className="my-4">
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 uppercase tracking-wide">{language || 'code'}</span>
                <button
                  onClick={() => copyToClipboard(codeContent, `code-${index}`)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <pre className="text-gray-100 text-sm leading-relaxed">
                <code>{codeContent}</code>
              </pre>
            </div>
          </div>
        );
      } else {
        // Regular text with basic markdown
        return (
          <div key={index}>
            {part.split('\n').map((line, lineIndex) => {
              if (line.trim() === '') return <br key={lineIndex} />;
              
              // Handle bold text
              const boldFormatted = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
              // Handle italic text
              const italicFormatted = boldFormatted.replace(/\*(.*?)\*/g, '<em>$1</em>');
              // Handle inline code
              const codeFormatted = italicFormatted.replace(/`([^`]+)`/g, '<code class="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-sm">$1</code>');
              
              return (
                <p key={lineIndex} className="mb-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: codeFormatted }} />
              );
            })}
          </div>
        );
      }
    });
  };

  const handleDocumentUpload = (files: File[]) => {
    // Handle document upload logic here
    console.log('Uploading documents:', files.map(f => f.name));
    setShowUploadModal(false);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* Background Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.02] dark:opacity-[0.01] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, #4f46e5 0%, transparent 50%), 
                           radial-gradient(circle at 75% 75%, #06b6d4 0%, transparent 50%)`,
          backgroundSize: '80px 80px'
        }}
      />

      {/* Enhanced Header with Controls */}
      <div className="flex-shrink-0 glassmorphic bg-white/60 dark:bg-gray-900/40 backdrop-blur-xl border-b border-white/20 dark:border-gray-800/30 p-4 shadow-lg relative z-10">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">
            Chat
          </h3>
          <div className="flex items-center gap-2">
            {/* Chat History Toggle */}
            {useChatHistory && (
              <button
                onClick={() => setShowChatHistory(!showChatHistory)}
                className="p-2 glassmorphic bg-white/60 dark:bg-gray-800/60 hover:bg-white/80 dark:hover:bg-gray-800/80 rounded-xl transition-all duration-200 border border-white/30 dark:border-gray-700/30 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white shadow-lg"
                title="Toggle Chat History"
              >
                <History size={16} />
              </button>
            )}
            
            {/* Templates Button */}
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="p-2 glassmorphic bg-white/60 dark:bg-gray-800/60 hover:bg-white/80 dark:hover:bg-gray-800/80 rounded-xl transition-all duration-200 border border-white/30 dark:border-gray-700/30 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white shadow-lg"
              title="Query Templates"
            >
              <FileBarChart size={16} />
            </button>

            {/* Chat History Enable/Disable */}
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 glassmorphic bg-white/50 dark:bg-gray-800/50 px-3 py-2 rounded-xl border border-white/30 dark:border-gray-700/30 cursor-pointer hover:bg-white/70 dark:hover:bg-gray-800/70 transition-all">
              <input
                type="checkbox"
                checked={useChatHistory}
                onChange={(e) => setUseChatHistory(e.target.checked)}
                className="w-4 h-4 rounded accent-blue-500"
              />
              <span className="font-medium">History</span>
            </label>

            {/* Clear Chat History */}
            {useChatHistory && chatHistory.length > 0 && (
              <button
                onClick={handleClearChatHistory}
                className="p-2 glassmorphic bg-red-50/80 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-xl transition-all duration-200 border border-red-200/50 dark:border-red-700/30 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 shadow-lg"
                title="Clear Chat History"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Chat History Panel */}
        {showChatHistory && useChatHistory && chatHistory.length > 0 && (
          <div className="mt-4 glassmorphic bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl border border-white/30 dark:border-gray-700/30 shadow-xl p-4 animate-in slide-in-from-top-2 fade-in-0">
            <div className="max-h-32 overflow-y-auto space-y-2 custom-scrollbar">
              {chatHistory.slice(-3).map((msg, index) => (
                <div key={index} className="text-sm glassmorphic bg-white/50 dark:bg-gray-700/50 p-3 rounded-xl border border-white/20 dark:border-gray-600/20 hover:bg-white/70 dark:hover:bg-gray-700/70 transition-all duration-200 group">
                  <div className="flex items-start gap-3">
                    <Clock size={14} className="mt-0.5 flex-shrink-0 text-gray-500 dark:text-gray-400" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900 dark:text-white">{msg.role === 'user' ? 'You' : 'AI'}:</span>
                      </div>
                      <span className="text-gray-700 dark:text-gray-300 line-clamp-2">{msg.content.substring(0, 100)}...</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Templates Panel */}
        {showTemplates && templates.length > 0 && (
          <div className="mt-4 glassmorphic bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-2xl border border-white/30 dark:border-gray-700/30 shadow-xl p-4 animate-in slide-in-from-top-2 fade-in-0">
            <div className="grid grid-cols-2 gap-3 max-h-40 overflow-y-auto custom-scrollbar">
              {templates.slice(0, 6).map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleTemplateSelect(template)}
                  className="p-4 text-left glassmorphic bg-white/50 dark:bg-gray-700/50 hover:bg-white/70 dark:hover:bg-gray-700/70 rounded-xl transition-all duration-300 border border-white/20 dark:border-gray-600/20 hover:border-gray-300/50 dark:hover:border-gray-500/50 hover:scale-[1.02] hover:shadow-lg group"
                >
                  <div className="font-semibold text-gray-900 dark:text-white text-sm mb-2 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{template.name}</div>
                  <div className="text-gray-600 dark:text-gray-400 text-xs line-clamp-2 leading-relaxed">{template.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Messages Area - Clara Style */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 min-h-0 custom-scrollbar relative z-10">
        {chatMessages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center glassmorphic bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-3xl border border-white/30 dark:border-gray-700/30 shadow-2xl p-10 max-w-lg">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl ring-4 ring-white/20">
                <MessageSquare className="w-10 h-10 text-white" />
              </div>
              {documentCount === 0 ? (
                <div>
                  <h3 className="text-gray-900 dark:text-white font-bold text-xl mb-4">
                    Welcome to Your Knowledge Base
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                    Upload documents to start chatting and ask questions about your content
                  </p>
                  <div className="inline-flex items-center gap-3 glassmorphic bg-blue-50/80 dark:bg-blue-900/30 px-6 py-3 rounded-2xl border border-blue-200/50 dark:border-blue-700/30">
                    <Upload className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <span className="text-blue-700 dark:text-blue-300 font-semibold">Get started by uploading files</span>
                  </div>
                </div>
              ) : completedDocumentCount === 0 ? (
                <div>
                  <h3 className="text-gray-900 dark:text-white font-bold text-xl mb-4">
                    Processing Your Documents
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                    Please wait while we analyze your documents
                  </p>
                  <div className="flex items-center justify-center gap-3 glassmorphic bg-yellow-50/80 dark:bg-yellow-900/30 px-6 py-3 rounded-2xl border border-yellow-200/50 dark:border-yellow-700/30">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse shadow-lg"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse shadow-lg" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse shadow-lg" style={{ animationDelay: '0.4s' }}></div>
                    <span className="text-yellow-700 dark:text-yellow-300 font-semibold">Processing in progress...</span>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-gray-900 dark:text-white font-bold text-xl mb-4">
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
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl ring-4 ring-white/10 backdrop-blur-sm">
                <Bot className="w-6 h-6 text-white" />
              </div>
            )}
            
            <div className={`max-w-2xl ${message.type === 'user' ? 'order-1' : ''}`}>
              <div
                className={`glassmorphic backdrop-blur-xl rounded-3xl p-6 shadow-2xl transition-all duration-300 hover:shadow-3xl border ${
                  message.type === 'user'
                    ? 'bg-gradient-to-br from-blue-500/90 to-purple-600/90 text-white ml-auto border-blue-400/30 shadow-blue-500/20'
                    : 'bg-white/70 dark:bg-gray-800/70 text-gray-900 dark:text-white border-white/30 dark:border-gray-700/30'
                }`}
              >
                <div className={`prose-sm max-w-none break-words ${
                  message.type === 'user' 
                    ? 'prose-invert' 
                    : 'prose-gray dark:prose-invert'
                }`}>
                  {typeof formatMessage(message.content) === 'string' ? (
                    <p className={`leading-relaxed ${message.type === 'user' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{message.content}</p>
                  ) : (
                    <div className={`leading-relaxed ${message.type === 'user' ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                      {formatMessage(message.content)}
                    </div>
                  )}
                </div>
                
                {/* Citations section for assistant messages */}
                {message.type === 'assistant' && message.citations && message.citations.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/20 dark:border-gray-700/30">
                    <h4 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Sources ({message.citations.length})
                    </h4>
                    <div className="space-y-2">
                      {message.citations.slice(0, 5).map((citation, index) => (
                        <div key={index} className="flex items-center gap-3 glassmorphic bg-white/50 dark:bg-gray-700/50 p-3 rounded-xl border border-white/20 dark:border-gray-600/20 text-sm hover:bg-white/70 dark:hover:bg-gray-700/70 transition-all">
                          <FileText className="w-4 h-4 flex-shrink-0 text-blue-500" />
                          <span className="truncate font-medium text-gray-800 dark:text-gray-200" title={citation.file_path}>
                            {citation.title}
                          </span>
                          <ExternalLink className="w-4 h-4 flex-shrink-0 opacity-50" />
                        </div>
                      ))}
                      {message.citations.length > 5 && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 font-medium glassmorphic bg-white/40 dark:bg-gray-700/40 p-2 rounded-lg border border-white/20 dark:border-gray-600/20 text-center">
                          +{message.citations.length - 5} more sources
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/20 dark:border-gray-700/30">
                  <span className={`text-xs font-medium ${
                    message.type === 'user' 
                      ? 'text-white/70' 
                      : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {formatTime(message.timestamp)}
                  </span>
                  
                  {message.type === 'assistant' && (
                    <button
                      onClick={() => copyToClipboard(message.content, message.id)}
                      className="glassmorphic bg-white/50 dark:bg-gray-700/50 hover:bg-white/70 dark:hover:bg-gray-700/70 p-2 rounded-lg border border-white/20 dark:border-gray-600/20 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all shadow-lg"
                      title="Copy message"
                    >
                      {copiedId === message.id ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {message.type === 'user' && (
              <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center shadow-2xl ring-4 ring-white/10 backdrop-blur-sm">
                <User className="w-6 h-6 text-white" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-4 justify-start">
            <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl ring-4 ring-white/10 backdrop-blur-sm">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div className="glassmorphic bg-white/70 dark:bg-gray-800/70 backdrop-blur-xl rounded-3xl p-6 shadow-2xl border border-white/30 dark:border-gray-700/30">
              <div className="flex items-center space-x-4">
                <div className="w-3 h-3 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full animate-bounce shadow-lg"></div>
                <div className="w-3 h-3 bg-gradient-to-r from-purple-400 to-pink-500 rounded-full animate-bounce shadow-lg" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-3 h-3 bg-gradient-to-r from-pink-400 to-red-500 rounded-full animate-bounce shadow-lg" style={{ animationDelay: '0.4s' }}></div>
                <span className="text-gray-700 dark:text-gray-300 font-medium ml-2">AI is thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Backend Status Warning */}
      {(!isBackendHealthy || completedDocumentCount === 0) && (
        <div className="flex-shrink-0 px-6 py-3 glassmorphic bg-red-50/80 dark:bg-red-900/30 backdrop-blur-xl border-t border-red-200/50 dark:border-red-700/30 shadow-lg relative z-10">
          <div className="flex items-center">
            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center mr-4 shadow-lg">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <span className="text-sm font-semibold text-red-800 dark:text-red-200">
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
                <p className="text-xs text-red-700 dark:text-red-300 mt-1 font-medium">
                  Don't worry, this runs in the background - You can access other features meanwhile
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Clara-Style Input Area - Compact & Elegant */}
      <div className="flex-shrink-0 p-6 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="glassmorphic bg-white/70 dark:bg-gray-900/50 backdrop-blur-2xl border border-white/30 dark:border-gray-700/30 rounded-2xl shadow-2xl transition-all duration-300 hover:shadow-3xl hover:border-gray-300/50 dark:hover:border-gray-600/50 group relative">
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
              className="w-full p-4 pr-16 bg-transparent text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl leading-relaxed group-hover:placeholder-gray-500 dark:group-hover:placeholder-gray-400 transition-all duration-200"
              style={{ minHeight: '56px', maxHeight: '120px' }}
            />
            
            {/* Send Button */}
            <div className="absolute right-2 bottom-2">
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading || !isBackendHealthy || completedDocumentCount === 0}
                className={`p-3 rounded-xl transition-all duration-300 transform glassmorphic border shadow-lg ${
                  inputMessage.trim() && !isLoading && isBackendHealthy && completedDocumentCount > 0
                    ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 hover:shadow-xl hover:scale-105 border-blue-400/30'
                    : 'bg-gray-200/60 dark:bg-gray-700/60 text-gray-400 dark:text-gray-500 cursor-not-allowed border-gray-300/30 dark:border-gray-600/30'
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Helper Text - Compact */}
          <div className="flex items-center justify-between mt-3 px-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              Press Enter to send, Shift+Enter for new line
            </p>
            {isBackendHealthy && completedDocumentCount > 0 && (
              <div className="flex items-center gap-2 glassmorphic bg-emerald-50/80 dark:bg-emerald-900/30 px-3 py-1 rounded-xl border border-emerald-200/50 dark:border-emerald-700/30">
                <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-sm animate-pulse"></div>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
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
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="glassmorphic bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border border-white/30 dark:border-gray-700/30 min-w-80">
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 dark:text-white">{progressState.message}</p>
                {progressState.details && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{progressState.details}</p>
                )}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progressState.progress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-right">{progressState.progress}%</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotebookChat;
