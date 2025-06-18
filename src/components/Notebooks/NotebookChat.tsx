import React, { useState, useRef, useEffect } from 'react';
import { Send, User, Bot, Copy, Check, MessageSquare, AlertCircle, FileText, ExternalLink, ChevronDown, ChevronUp, BookOpen } from 'lucide-react';
import { claraNotebookService, NotebookCitation } from '../../services/claraNotebookService';

interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'summary';
  content: string;
  timestamp: string;
  citations?: NotebookCitation[];
}

interface NotebookChatProps {
  notebookId: string;
  documentCount: number;
  completedDocumentCount: number;
}

const NotebookChat: React.FC<NotebookChatProps> = ({ notebookId, documentCount, completedDocumentCount }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isBackendHealthy, setIsBackendHealthy] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isSummaryCollapsed, setIsSummaryCollapsed] = useState(false);
  const [summaryGenerated, setSummaryGenerated] = useState(false);
  const [showSkeletonLoading, setShowSkeletonLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Subscribe to backend health changes
  useEffect(() => {
    const unsubscribe = claraNotebookService.onHealthChange(setIsBackendHealthy);
    return unsubscribe;
  }, []);

  // Generate summary when notebook changes or backend becomes healthy
  useEffect(() => {
    if (isBackendHealthy && !summaryGenerated && documentCount > 0 && completedDocumentCount === documentCount) {
      generateDocumentSummary();
    }
  }, [notebookId, isBackendHealthy, summaryGenerated, documentCount, completedDocumentCount]);

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

  const generateDocumentSummary = async () => {
    if (!isBackendHealthy || isGeneratingSummary || summaryGenerated || documentCount === 0 || completedDocumentCount !== documentCount) return;

    setIsGeneratingSummary(true);
    setShowSkeletonLoading(true);
    setSummaryGenerated(true);

    try {
      // Start skeleton loading immediately
      const skeletonPromise = new Promise(resolve => 
        setTimeout(resolve, 2500) // Show skeleton for 2.5 seconds
      );
      
      // Start API request
      const summaryPromise = claraNotebookService.generateSummary(notebookId);
      
      // Wait for both skeleton time AND API response
      const [, response] = await Promise.all([skeletonPromise, summaryPromise]);
      
      const summaryMessage: ChatMessage = {
        id: 'summary-' + Date.now().toString(),
        type: 'summary',
        content: response.answer,
        timestamp: new Date().toISOString(),
        citations: response.citations
      };

      setMessages([summaryMessage]);
    } catch (error) {
      console.error('Error generating summary:', error);
      // If summary generation fails, we'll just start with no summary
      // The user can still use regular chat
    } finally {
      // Ensure skeleton shows for minimum time even if API is very fast
      setTimeout(() => {
        setShowSkeletonLoading(false);
        setIsGeneratingSummary(false);
      }, 100); // Small delay to ensure smooth transition
    }
  };

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
    if (!isSummaryCollapsed && messages.some(m => m.type === 'summary')) {
      setIsSummaryCollapsed(true);
    }

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
      // Query the notebook using the claraNotebookService
      const response = await claraNotebookService.queryNotebook(notebookId, {
        question: inputMessage.trim(),
        mode: 'hybrid',
        response_type: 'Multiple Paragraphs',
        top_k: 60
      });

      const assistantResponse: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response.answer,
        timestamp: new Date().toISOString(),
        citations: response.citations
      };
      setMessages(prev => [...prev, assistantResponse]);

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

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
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

  const summaryMessage = messages.find(m => m.type === 'summary');
  const chatMessages = messages.filter(m => m.type !== 'summary');

  return (
    <div className="h-full flex flex-col">
      {/* Summary Section */}
      {(summaryMessage || isGeneratingSummary) && (
        <div className={`flex-shrink-0 border-b border-gray-200 dark:border-gray-700 ${isSummaryCollapsed ? 'bg-gray-50 dark:bg-gray-800/50' : 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20'}`}>
          <div className="p-4">
            <button
              onClick={() => setIsSummaryCollapsed(!isSummaryCollapsed)}
              className="flex items-center justify-between w-full text-left group"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Document Summary
                </h3>
                {summaryMessage?.citations && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full">
                    {summaryMessage.citations.length} sources
                  </span>
                )}
              </div>
              <div className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300">
                {isSummaryCollapsed ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronUp className="w-4 h-4" />
                )}
              </div>
            </button>
            
            {!isSummaryCollapsed && (
              <div className="mt-3">
                {(isGeneratingSummary || showSkeletonLoading) ? (
                  <div className="glassmorphic-card rounded-lg p-4 border border-white/30 dark:border-gray-700/50">
                    {/* Skeleton Loading for Summary */}
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2 mb-3">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">Generating summary of your documents...</span>
                      </div>
                      
                      {/* Skeleton text lines */}
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-full skeleton-shimmer"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-11/12 skeleton-shimmer"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-4/5 skeleton-shimmer"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-full skeleton-shimmer"></div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-3/4 skeleton-shimmer"></div>
                      </div>
                      
                      {/* Skeleton citations */}
                      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <div className="flex items-center gap-1 mb-2">
                          <div className="w-3 h-3 bg-gray-200 dark:bg-gray-600 rounded skeleton-shimmer"></div>
                          <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-16 skeleton-shimmer"></div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="h-6 bg-gray-200 dark:bg-gray-600 rounded-full w-20 skeleton-shimmer"></div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <style dangerouslySetInnerHTML={{
                      __html: `
                        .skeleton-shimmer {
                          position: relative;
                          overflow: hidden;
                        }
                        
                        .skeleton-shimmer::after {
                          content: '';
                          position: absolute;
                          top: 0;
                          left: 0;
                          width: 100%;
                          height: 100%;
                          background: linear-gradient(90deg, 
                            transparent 0%, 
                            rgba(255, 255, 255, 0.4) 50%, 
                            transparent 100%
                          );
                          animation: shimmer 1.5s infinite;
                          transform: translateX(-100%);
                        }
                        
                        .dark .skeleton-shimmer::after {
                          background: linear-gradient(90deg, 
                            transparent 0%, 
                            rgba(255, 255, 255, 0.1) 50%, 
                            transparent 100%
                          );
                        }
                        
                        @keyframes shimmer {
                          0% {
                            transform: translateX(-100%);
                          }
                          100% {
                            transform: translateX(100%);
                          }
                        }
                      `
                    }} />
                  </div>
                ) : summaryMessage ? (
                  <div className="glassmorphic-card rounded-lg p-4 border border-white/30 dark:border-gray-700/50">
                    <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300 max-h-48 overflow-y-auto">
                      {typeof formatMessage(summaryMessage.content) === 'string' ? (
                        <p>{summaryMessage.content}</p>
                      ) : (
                        formatMessage(summaryMessage.content)
                      )}
                    </div>
                    
                    {/* Citations for summary */}
                    {summaryMessage.citations && summaryMessage.citations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          Sources ({summaryMessage.citations.length})
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {summaryMessage.citations.slice(0, 8).map((citation, index) => (
                            <div key={index} className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-600 rounded-full text-xs text-gray-700 dark:text-gray-300">
                              <FileText className="w-3 h-3" />
                              <span className="truncate max-w-24" title={citation.title}>
                                {citation.title}
                              </span>
                            </div>
                          ))}
                          {summaryMessage.citations.length > 8 && (
                            <div className="inline-flex items-center px-2 py-1 bg-gray-100 dark:bg-gray-600 rounded-full text-xs text-gray-500 dark:text-gray-400">
                              +{summaryMessage.citations.length - 8} more
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages Area - Fixed height with scroll */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {chatMessages.length === 0 && !isGeneratingSummary && !showSkeletonLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              {documentCount === 0 ? (
                <div>
                  <p className="text-gray-500 dark:text-gray-400 mb-2">
                    No documents uploaded yet
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Upload documents to start chatting and ask questions about your content
                  </p>
                </div>
              ) : completedDocumentCount === 0 ? (
                <div>
                  <p className="text-gray-500 dark:text-gray-400 mb-2">
                    Documents are being processed
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Please wait for processing to complete before starting a conversation
                  </p>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">
                  {summaryMessage ? 'Ask questions about your documents' : 'Start a conversation about your documents'}
                </p>
              )}
            </div>
          </div>
        )}

        {chatMessages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.type === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}
            
            <div className={`max-w-3xl ${message.type === 'user' ? 'order-1' : ''}`}>
              <div
                className={`rounded-lg p-4 ${
                  message.type === 'user'
                    ? 'bg-gray-600 text-white ml-auto'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
              >
                <div className="prose prose-sm max-w-none break-words">
                  {typeof formatMessage(message.content) === 'string' ? (
                    <p>{message.content}</p>
                  ) : (
                    formatMessage(message.content)
                  )}
                </div>
                
                {/* Citations section for assistant messages */}
                {message.type === 'assistant' && message.citations && message.citations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
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
                
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                  <span                   className={`text-xs ${
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
              <div className="flex-shrink-0 w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Backend Status Warning */}
      {(!isBackendHealthy || completedDocumentCount === 0) && (
        <div className="flex-shrink-0 px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-t border-yellow-200 dark:border-yellow-800">
          <div className="flex items-center text-yellow-800 dark:text-yellow-200">
            <AlertCircle className="w-4 h-4 mr-2" />
            <span className="text-sm">
              {!isBackendHealthy 
                ? "Backend unavailable - Chat functionality is limited"
                : documentCount === 0 
                  ? "Upload documents to enable chat functionality"
                  : completedDocumentCount === 0
                    ? `Processing ${documentCount} document${documentCount !== 1 ? 's' : ''} - Chat will be available once processing completes`
                    : ""
              }
            </span>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                !isBackendHealthy 
                  ? "Backend unavailable..." 
                  : documentCount === 0 
                    ? "Upload documents to start chatting..."
                    : completedDocumentCount === 0
                      ? "Processing documents..."
                      : "Ask about your documents..."
              }
              disabled={!isBackendHealthy || isLoading || completedDocumentCount === 0}
              className="w-full p-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading || !isBackendHealthy || completedDocumentCount === 0}
              className="absolute right-2 bottom-2 p-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};

export default NotebookChat; 