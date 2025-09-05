import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare, Send, Bot, User, Copy, Check,
  AlertTriangle, Upload, Loader2
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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

interface ProgressState {
  isActive: boolean;
  progress: number;
  details?: string;
}

interface NotebookChatProps {
  messages?: ChatMessage[];
  onSendMessage?: (message: string) => void;
  isLoading?: boolean;
  notebookId: string;
  documentCount?: number;
  completedDocumentCount?: number;
  isBackendHealthy?: boolean;
  onDocumentUpload?: (files: File[]) => void;
}

const NotebookChat: React.FC<NotebookChatProps> = ({
  messages,
  onSendMessage = () => {},
  isLoading = false,
  notebookId,
  documentCount = 0,
  completedDocumentCount = 0,
  isBackendHealthy = true,
  onDocumentUpload
}) => {
  const [inputMessage, setInputMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(messages || []);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [progressState, setProgressState] = useState<ProgressState | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync messages from props
  useEffect(() => {
    setChatMessages(messages || []);
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isLoading]);

  // Format message content with markdown support
  const formatMessage = (content: string) => {
    return (
      <ReactMarkdown
        className="markdown-content"
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom components for Clara styling
          p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
          h1: ({ children }) => <h1 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold mb-2 text-gray-900 dark:text-white">{children}</h3>,
          h4: ({ children }) => <h4 className="text-sm font-semibold mb-2 text-gray-900 dark:text-white">{children}</h4>,
          h5: ({ children }) => <h5 className="text-sm font-medium mb-2 text-gray-900 dark:text-white">{children}</h5>,
          h6: ({ children }) => <h6 className="text-xs font-medium mb-2 text-gray-900 dark:text-white">{children}</h6>,
          ul: ({ children }) => <ul className="list-disc pl-6 mb-3 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 mb-3 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-gray-900 dark:text-white">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          code: ({ children, className }) => {
            const isInline = !className;
            return isInline ? (
              <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-900 dark:text-gray-100">
                {children}
              </code>
            ) : (
              <code className={`block p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-mono overflow-x-auto text-gray-900 dark:text-gray-100 ${className}`}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="mb-3 overflow-x-auto">{children}</pre>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-sakura-300 dark:border-sakura-600 pl-4 mb-3 italic text-gray-700 dark:text-gray-300">
              {children}
            </blockquote>
          ),
          a: ({ children, href }) => (
            <a 
              href={href} 
              className="text-sakura-600 dark:text-sakura-400 hover:text-sakura-700 dark:hover:text-sakura-300 underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          // Table components with Clara styling
          table: ({ children }) => (
            <div className="mb-4 overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden shadow-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50 dark:bg-gray-700">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-900 dark:text-gray-100 uppercase tracking-wider border-b border-gray-200 dark:border-gray-600">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-600">
              {children}
            </td>
          ),
          // Task list support
          input: ({ checked, type, ...props }) => {
            if (type === 'checkbox') {
              return (
                <input 
                  type="checkbox" 
                  checked={checked} 
                  readOnly 
                  className="mr-2 rounded text-sakura-500 focus:ring-sakura-500"
                  {...props}
                />
              );
            }
            return <input type={type} {...props} />;
          },
          // Horizontal rule
          hr: () => <hr className="my-4 border-gray-300 dark:border-gray-600" />,
          // Delete/strikethrough text
          del: ({ children }) => <del className="line-through text-gray-500 dark:text-gray-400">{children}</del>,
        }}
      >
        {content}
      </ReactMarkdown>
    );
  };

  // Format timestamp
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Handle copy message
  const handleCopyMessage = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy message:', error);
    }
  };

  // Handle send message
  const handleSendMessage = () => {
    if (!inputMessage.trim() || isLoading) return;
    
    onSendMessage(inputMessage.trim());
    setInputMessage('');
    
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle textarea auto-resize
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    
    // Auto-resize
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  // Handle document upload
  const handleDocumentUpload = async (files: File[]) => {
    if (onDocumentUpload) {
      await onDocumentUpload(files);
    }
    setShowUploadModal(false);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* Messages Area - Clara Style */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0 custom-scrollbar relative z-10">
        {(!chatMessages || chatMessages.length === 0) && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center glassmorphic bg-white/60 dark:bg-gray-800/60 backdrop-blur-xl rounded-3xl border border-white/30 dark:border-gray-700/30 shadow-2xl p-10 max-w-lg">
              <div className="w-20 h-20 bg-gradient-to-br from-sakura-500 via-pink-500 to-sakura-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl ring-4 ring-white/20">
                <MessageSquare className="w-10 h-10 text-white drop-shadow-lg" />
              </div>
              {documentCount === 0 ? (
                <div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-4">
                    No documents yet
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                    Upload documents to start building your knowledge base and ask Clara questions about them.
                  </p>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="glassmorphic bg-gradient-to-r from-sakura-500 to-pink-500 hover:from-sakura-600 hover:to-pink-600 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl border border-white/20 flex items-center gap-2 mx-auto"
                  >
                    <Upload className="w-5 h-5" />
                    Upload Documents
                  </button>
                </div>
              ) : completedDocumentCount === 0 ? (
                <div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-4">
                    Processing documents...
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                    Your documents are being processed. You can start chatting once processing is complete.
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-sakura-500" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      Processing {documentCount} document{documentCount !== 1 ? 's' : ''}...
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 bg-clip-text text-transparent mb-4">
                    Ready to chat!
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                    Ask Clara anything about your {completedDocumentCount} processed document{completedDocumentCount !== 1 ? 's' : ''}.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Clara-style Messages */}
        {(chatMessages || []).map((message) => {
          const isUser = message.type === 'user';
          
          return (
            <div
              key={message.id}
              className={`flex gap-4 mb-8 group ${isUser ? 'flex-row-reverse' : ''}`}
            >
              {/* Avatar - Clara Style */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                isUser 
                  ? 'bg-sakura-500' 
                  : 'bg-sakura-400 dark:bg-sakura-500'
              }`}>
                {isUser ? (
                  <User className="w-5 h-5 text-white" />
                ) : (
                  <Bot className="w-5 h-5 text-white drop-shadow-sm" />
                )}
              </div>

              {/* Message Content Container */}
              <div className={`flex-1 ${isUser ? 'max-w-2xl ml-auto items-end' : 'max-w-4xl'}`}>
                {/* Header with name and timestamp */}
                <div className={`flex items-center gap-2 mb-3 ${isUser ? 'justify-end' : ''}`}>
                  <span className="text-[15px] font-semibold text-gray-900 dark:text-white">
                    {isUser ? 'You' : 'Clara'}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatTime(message.timestamp)}
                  </span>
                  
                  {/* Copy button */}
                  <button
                    onClick={() => handleCopyMessage(message.content, message.id)}
                    className={`opacity-0 group-hover:opacity-100 p-1 rounded-md transition-all duration-200 ${
                      copiedId === message.id
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                    title="Copy message"
                  >
                    {copiedId === message.id ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {/* Message Bubble - Clara Style */}
                <div className={`glassmorphic rounded-2xl px-5 py-4 ${
                  isUser 
                    ? 'bg-gradient-to-br from-sakura-50/80 to-pink-50/80 dark:from-sakura-900/30 dark:to-pink-900/30 border-sakura-200/50 dark:border-sakura-700/50 shadow-sakura-100/50 dark:shadow-sakura-900/20' 
                    : 'bg-white/60 dark:bg-gray-800/60'
                } backdrop-blur-sm`}>
                  
                  {/* Message Content */}
                  <div className={`prose prose-base max-w-none break-words text-base ${
                    isUser 
                      ? 'prose-gray dark:prose-gray text-gray-900 dark:text-gray-100' 
                      : 'prose-gray dark:prose-invert text-gray-900 dark:text-gray-100'
                  }`}>
                    <div className="leading-relaxed text-base">
                      {formatMessage(message.content)}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          );
        })}

        {/* Loading indicator - Clara Style */}
        {isLoading && (
          <div className="flex gap-4 mb-8">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm bg-sakura-400 dark:bg-sakura-500">
              <Bot className="w-5 h-5 text-white drop-shadow-sm" />
            </div>
            <div className="flex-1 max-w-4xl">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[15px] font-semibold text-gray-900 dark:text-white">Clara</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">typing...</span>
              </div>
              <div className="glassmorphic rounded-2xl px-5 py-4 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-sakura-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-sakura-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-sakura-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400">Clara is thinking...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Clara Style */}
      <div className="flex-shrink-0 px-4 pb-4">
        <div className="glassmorphic rounded-xl px-4 py-3 bg-white/60 dark:bg-gray-900/40 backdrop-blur-md shadow-lg transition-all duration-300">
          {/* Backend health warning */}
          {!isBackendHealthy && (
            <div className="mb-3 glassmorphic bg-red-50/90 dark:bg-red-900/40 border border-red-200/50 dark:border-red-700/30 rounded-lg p-3 backdrop-blur-xl shadow-md">
              <div className="flex items-center">
                <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Notebook backend is not available. Please check your connection.
                </p>
              </div>
            </div>
          )}

          {/* Main Input Container - Clara Style */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
              placeholder={
                !isBackendHealthy 
                  ? "Backend not available..." 
                  : completedDocumentCount === 0 
                    ? "Upload and process documents first..."
                    : "Ask Clara about your documents..."
              }
              disabled={isLoading || !isBackendHealthy || completedDocumentCount === 0}
              className="w-full border-0 outline-none focus:outline-none focus:ring-0 resize-none bg-transparent text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 pr-12 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                height: 'auto',
                minHeight: '20px',
                maxHeight: '100px',
                overflowY: 'auto',
                padding: '4px 48px 4px 0',
                borderRadius: '0'
              }}
            />
            
            {/* Send Button - Clara Style */}
            <div className="absolute right-0 bottom-2 flex items-center gap-2">
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isLoading || !isBackendHealthy || completedDocumentCount === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sakura-500 text-white hover:bg-sakura-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                title="Send message (Enter)"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Send</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <DocumentUpload 
          onClose={() => setShowUploadModal(false)}
          onUpload={handleDocumentUpload}
        />
      )}
    </div>
  );
};

export default NotebookChat;
