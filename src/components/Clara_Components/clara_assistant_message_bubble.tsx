/**
 * Clara Assistant Message Bubble Component
 * 
 * This component renders individual chat messages in the Clara assistant interface.
 * It handles both user and assistant messages, including file attachments, artifacts,
 * and various interaction features like copying, editing, and retrying messages.
 * 
 * Features:
 * - User and assistant message differentiation
 * - File attachment display
 * - Artifact rendering integration
 * - Message actions (copy, edit, retry)
 * - Streaming message support
 * - Responsive design
 * - Theme support
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  User, 
  Bot, 
  Copy, 
  Check, 
  Edit3, 
  RotateCcw, 
  FileText, 
  Image as ImageIcon,
  File,
  Code,
  Clock,
  AlertCircle,
  MessageSquare,
  Download,
  X,
  Eye,
  FileCode,
  FileImage,
  Volume2,
  VolumeX,
  Loader2
} from 'lucide-react';

// Import types and components
import { 
  ClaraMessage, 
  ClaraMessageBubbleProps,
  ClaraFileAttachment,
  ClaraArtifact
} from '../../types/clara_assistant_types';
import ClaraArtifactRenderer from './clara_assistant_artifact_renderer';
import MessageContentRenderer from './MessageContentRenderer';
import { ElectronAPI } from '../../types/electron';
import { copyToClipboard } from '../../utils/clipboard';
import { useSmoothScroll } from '../../hooks/useSmoothScroll';

// Import TTS service
import { claraTTSService } from '../../services/claraTTSService';

/**
 * Thinking content parser and utilities
 */
interface ThinkingContent {
  thinking: string;
  response: string;
  thinkingTimeSeconds?: number;
}

/**
 * Parse thinking content from message text
 */
const parseThinkingContent = (content: string): ThinkingContent => {
  const thinkingRegex = /<think>([\s\S]*?)<\/think>/;
  const partialThinkingRegex = /<think>([\s\S]*?)$/; // For streaming content that hasn't closed yet
  
  const match = content.match(thinkingRegex);
  
  if (match) {
    // Complete thinking block found
    const thinking = match[1].trim();
    const response = content.replace(thinkingRegex, '').trim();
    
    // Estimate thinking time based on content length (rough approximation)
    const wordsInThinking = thinking.split(/\s+/).filter(word => word.length > 0).length;
    const estimatedSeconds = Math.max(1, Math.floor(wordsInThinking / 50)); // ~50 words per second thinking
    
    return {
      thinking,
      response,
      thinkingTimeSeconds: estimatedSeconds
    };
  }
  
  // Check for partial thinking (streaming scenario)
  const partialMatch = content.match(partialThinkingRegex);
  if (partialMatch) {
    // Still streaming thinking content
    const thinking = partialMatch[1].trim();
    const wordsInThinking = thinking.split(/\s+/).filter(word => word.length > 0).length;
    const estimatedSeconds = Math.max(1, Math.floor(wordsInThinking / 50));
    
    // Get any content before the <think> tag
    const beforeThink = content.substring(0, content.indexOf('<think>')).trim();
    
    return {
      thinking,
      response: beforeThink, // Include any content that came before the thinking
      thinkingTimeSeconds: estimatedSeconds
    };
  }
  
  return {
    thinking: '',
    response: content,
    thinkingTimeSeconds: 0
  };
};

/**
 * Thinking display component
 */
const ThinkingDisplay: React.FC<{
  thinking: string;
  thinkingTime?: number;
  isStreaming?: boolean;
  isComplete?: boolean;
}> = ({ thinking, thinkingTime, isStreaming = false, isComplete = true }) => {
  // If streaming, always expanded; otherwise, default to collapsed
  const [isExpanded, setIsExpanded] = useState(isStreaming && !isComplete);
  const [copied, setCopied] = useState(false);
  const { copyToClipboard } = useCopyWithToast();

  // When streaming state changes, force expanded if streaming, collapse if complete
  useEffect(() => {
    if (isStreaming && !isComplete) {
      setIsExpanded(true);
    } else if (!isStreaming && isComplete) {
      setIsExpanded(false);
    }
  }, [isStreaming, isComplete]);

  const handleCopy = async () => {
    await copyToClipboard(thinking);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!thinking) return null;

  const getStatusText = () => {
    if (isStreaming && !isComplete) {
      return "thinking...";
    }
    return `${thinkingTime || 'a few'} sec${(thinkingTime || 0) !== 1 ? 's' : ''}`;
  };

  const getStatusColor = () => {
    if (isStreaming && !isComplete) {
      return "text-blue-500 dark:text-blue-400";
    }
    return "text-blue-700 dark:text-blue-300";
  };

  return (
    <div className="mb-5 border-l-4 border-blue-400 dark:border-blue-500 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg">
      <button
        onClick={() => {
          if (!(isStreaming && !isComplete)) setIsExpanded(!isExpanded);
        }}
        className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-blue-100/50 dark:hover:bg-blue-800/30 transition-colors rounded-lg"
        disabled={isStreaming && !isComplete}
        style={isStreaming && !isComplete ? { cursor: 'default', opacity: 1 } : {}}
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 bg-blue-500 rounded-full ${isStreaming && !isComplete ? 'animate-pulse' : ''}`}></div>
          <span className={`text-[14px] font-medium ${getStatusColor()}`}>
            <span className="text-xs text-gray-500 dark:text-gray-400">
            {getStatusText() === "thinking..." ? "Clara is  " : "Thought for "} {getStatusText()} {"herself"}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded && thinking && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              className="p-1 hover:bg-blue-200 dark:hover:bg-blue-700 rounded transition-colors"
              title="Copy thinking content"
            >
              {copied ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : (
                <Copy className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              )}
            </button>
          )}
          {/* Only show expand/collapse arrow if not streaming */}
          {!(isStreaming && !isComplete) && (
            <div className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          )}
        </div>
      </button>
      {isExpanded && (
        <div className="px-4 pb-4">
          <div className="bg-white/70 dark:bg-gray-800/70 rounded-md p-4 text-[14px] text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono leading-relaxed border border-blue-200 dark:border-blue-800">
            {thinking}
            {isStreaming && !isComplete && (
              <span className="inline-block w-2 h-4 bg-blue-500 ml-1 animate-pulse"></span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * File attachment display component
 */
const FileAttachmentDisplay: React.FC<{ 
  attachment: ClaraFileAttachment;
  onPreview?: (attachment: ClaraFileAttachment) => void;
}> = ({ attachment, onPreview }) => {
  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image': return ImageIcon;
      case 'pdf': return FileText;
      case 'code': return Code;
      default: return File;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getStatusColor = () => {
    if (attachment.processed === false) return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20';
    if (attachment.processed === true) return 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20';
    return 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-900/20';
  };

  const IconComponent = getFileIcon(attachment.type);

  return (
    <div 
      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer hover:shadow-sm transition-all ${getStatusColor()}`}
      onClick={() => onPreview?.(attachment)}
    >
      <IconComponent className="w-4 h-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
      
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
          {attachment.name}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{formatFileSize(attachment.size)}</span>
          <span>•</span>
          <span className="capitalize">{attachment.type}</span>
          {attachment.processed !== undefined && (
            <>
              <span>•</span>
              <span className={`${
                attachment.processed === true 
                  ? 'text-green-600 dark:text-green-400' 
                  : attachment.processed === false
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-yellow-600 dark:text-yellow-400'
              }`}>
                {attachment.processed === true ? 'Processed' : 
                 attachment.processed === false ? 'Failed' : 'Processing...'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Processing result indicator */}
      {attachment.processingResult && (
        <div className="flex-shrink-0">
          {attachment.processingResult.success ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-500" />
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Streaming indicator for messages being generated
 */
const StreamingIndicator: React.FC = () => {
  return (
    <div className="flex items-center gap-2 mt-2 text-gray-500 dark:text-gray-400">
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <span className="text-xs">I am thinking...</span>
    </div>
  );
};

/**
 * Message metadata display
 */
const MessageMetadata: React.FC<{ 
  message: ClaraMessage;
  showFullMetadata?: boolean;
}> = ({ message, showFullMetadata = false }) => {
  if (!message.metadata) return null;

  return (
    <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
      {message.metadata.model && (
        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-gray-600 dark:text-gray-400">
          {message.metadata.model}
        </span>
      )}
      
      {message.metadata.tokens && (
        <span className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          {message.metadata.tokens} tokens
        </span>
      )}
      
      {message.metadata.processingTime && (
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {message.metadata.processingTime}ms
        </span>
      )}

      {showFullMetadata && message.metadata.toolsUsed && message.metadata.toolsUsed.length > 0 && (
        <span className="flex items-center gap-1">
          Tools: {message.metadata.toolsUsed.join(', ')}
        </span>
      )}

      {message.metadata.error && (
        <span className="flex items-center gap-1 text-red-500 dark:text-red-400">
          <AlertCircle className="w-3 h-3" />
          Error
        </span>
      )}
    </div>
  );
};

/**
 * Add a universal copy-to-clipboard util in this file
 */
const useCopyWithToast = () => {
  const [toast, setToast] = useState<{ msg: string; type?: 'success' | 'error' } | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 1500);
  }, []);

  const copyToClipboardWithToast = useCallback(async (text: string) => {
    const success = await copyToClipboard(text);
    if (success) {
      showToast('Copied!');
    } else {
      showToast('Could not copy', 'error');
    }
    return success;
  }, [showToast]);

  // Toast JSX
  const Toast = toast ? (
    <div className={`fixed bottom-6 right-6 z-50 px-4 py-2 rounded shadow-lg text-white transition-all ${toast.type === 'error' ? 'bg-red-500' : 'bg-sakura-500'}`}
      style={{ minWidth: 100, textAlign: 'center' }}>
      {toast.msg}
    </div>
  ) : null;

  return { copyToClipboard: copyToClipboardWithToast, Toast };
};

/**
 * Message actions (copy, edit, retry, etc.)
 */
const MessageActions: React.FC<{
  message: ClaraMessage;
  isEditable?: boolean;
  onCopy?: (content: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
  onRetry?: (messageId: string) => void;
  // TTS props
  isTTSHealthy?: boolean;
  isTTSPlaying?: boolean;
  isTTSLoading?: boolean;
  onTTSToggle?: () => void;
}> = ({ 
  message, 
  isEditable = false, 
  onCopy, 
  onEdit, 
  onRetry,
  isTTSHealthy = false,
  isTTSPlaying = false,
  isTTSLoading = false,
  onTTSToggle
}) => {
  const [copied, setCopied] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const { copyToClipboard } = useCopyWithToast();

  const handleCopy = async () => {
    await copyToClipboard(message.content);
    setCopied(true);
    onCopy?.(message.content);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRetry = () => {
    onRetry?.(message.id);
  };

  const handleEdit = () => {
    const newContent = prompt('Edit message:', message.content);
    if (newContent && newContent !== message.content) {
      onEdit?.(message.id, newContent);
    }
  };

  return (
    <div 
      className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* TTS button (for assistant messages) */}
      {message.role === 'assistant' && isTTSHealthy && onTTSToggle && !message.metadata?.isStreaming && (
        <button
          onClick={onTTSToggle}
          disabled={isTTSLoading}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
          title={isTTSPlaying ? "Stop speaking" : "Read aloud"}
        >
          {isTTSLoading ? (
            <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
          ) : isTTSPlaying ? (
            <VolumeX className="w-4 h-4 text-blue-500" />
          ) : (
            <Volume2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          )}
        </button>
      )}

      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
        title="Copy message"
      >
        {copied ? (
          <Check className="w-4 h-4 text-green-500" />
        ) : (
          <Copy className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        )}
      </button>

      {/* Edit button (for user messages) */}
      {isEditable && onEdit && (
        <button
          onClick={handleEdit}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          title="Edit message"
        >
          <Edit3 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>
      )}

      {/* Retry button (for failed assistant messages) */}
      {message.role === 'assistant' && onRetry && (
        <button
          onClick={handleRetry}
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          title="Retry generation"
        >
          <RotateCcw className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>
      )}
    </div>
  );
};

/**
 * Parse display metadata from message content
 */
const parseDisplayMetadata = (content: string) => {
  const metaMatch = content.match(/^\[DISPLAY_META:(.*?)\]\n\n/);
  if (metaMatch) {
    try {
      const metadata = JSON.parse(metaMatch[1]);
      const cleanContent = content.replace(/^\[DISPLAY_META:.*?\]\n\n/, '');
      return {
        originalMessage: metadata.originalMessage,
        displayAttachments: metadata.displayAttachments,
        cleanContent
      };
    } catch (error) {
      console.error('Failed to parse display metadata:', error);
    }
  }
  return null;
};

/**
 * Clean attachment display component for user messages
 */
const CleanAttachmentDisplay: React.FC<{ 
  attachments: Array<{
    id: string;
    name: string;
    type: string;
    size: number;
    processed: boolean;
  }>;
  onViewDetail?: (attachmentId: string) => void;
}> = ({ attachments, onViewDetail }) => {
  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image': return ImageIcon;
      case 'pdf': return FileText;
      case 'code': return Code;
      default: return File;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  return (
    <div className="mb-3 space-y-2">
      {attachments.map((attachment) => {
        const IconComponent = getFileIcon(attachment.type);
        return (
          <div 
            key={attachment.id}
            className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600"
          >
            <IconComponent className="w-4 h-4 text-gray-600 dark:text-gray-400 flex-shrink-0" />
            
            <div className="flex-1 min-w-0">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                <span className="font-medium">Attached doc:</span> {attachment.name}
              </span>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {formatFileSize(attachment.size)} • {attachment.type}
                {attachment.processed && (
                  <span className="text-green-600 dark:text-green-400 ml-1">• Processed</span>
                )}
              </div>
            </div>

            <button
              onClick={() => onViewDetail?.(attachment.id)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
            >
              (view detail)
            </button>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Main Clara Message Bubble Component
 */
const ClaraMessageBubble: React.FC<ClaraMessageBubbleProps> = ({
  message,
  userName = 'You',
  isEditable = false,
  onCopy,
  onRetry,
  onEdit
}) => {
  const [showFullMetadata, setShowFullMetadata] = useState(false);
  const [expandedArtifacts, setExpandedArtifacts] = useState<Record<string, boolean>>({});
  const [selectedAttachment, setSelectedAttachment] = useState<{
    attachment: any;
    content: string;
  } | null>(null);
  const messageRef = useRef<HTMLDivElement>(null);
  const { Toast } = useCopyWithToast();
  
  // TTS state
  const [isTTSHealthy, setIsTTSHealthy] = useState(false);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const [isTTSLoading, setIsTTSLoading] = useState(false);
  
  // Use the smooth scroll hook for better streaming behavior
  const { scrollToElementDebounced, scrollToElementImmediate } = useSmoothScroll({
    debounceMs: 150,
    behavior: 'smooth',
    block: 'end',
    adaptiveScrolling: true
  });

  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isAssistant = message.role === 'assistant';

  // Parse display metadata for user messages with attached files
  const displayMeta = isUser ? parseDisplayMetadata(message.content) : null;
  const actualContent = displayMeta?.originalMessage || message.content;
  const displayAttachments = displayMeta?.displayAttachments || [];

  // Parse thinking content for assistant messages
  const thinkingContent = isAssistant ? parseThinkingContent(actualContent) : null;
  const hasThinking = thinkingContent && thinkingContent.thinking;
  const responseContent = hasThinking ? thinkingContent.response : actualContent;
  
  // Determine if thinking is complete or still streaming
  const isThinkingComplete = !!(hasThinking && thinkingContent.response.length > 0);
  const isThinkingStreaming = !!(hasThinking && message.metadata?.isStreaming && !isThinkingComplete);

  // Extract the full content that was sent to AI (including extracted text)
  const getExtractedContentForAttachment = (attachmentId: string): string => {
    if (!displayMeta?.cleanContent) return '';
    
    // Parse the content to find the extracted text for this specific attachment
    const contentSections = displayMeta.cleanContent.split('--- Content from ');
    for (const section of contentSections) {
      if (section.includes(attachmentId) || displayAttachments.some((att: any) => att.name && section.includes(att.name))) {
        const match = section.match(/--- Content from (.+?) ---\n([\s\S]*?)\n--- End of .+? ---/);
        if (match) {
          return match[2].trim();
        }
      }
    }
    
    // Fallback: try to find content by attachment name
    const attachment = displayAttachments.find((att: any) => att.id === attachmentId);
    if (attachment?.name) {
      const nameMatch = displayMeta.cleanContent.match(
        new RegExp(`--- Content from ${attachment.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} ---\\n([\\s\\S]*?)\\n--- End of ${attachment.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} ---`)
      );
      if (nameMatch) {
        return nameMatch[1].trim();
      }
    }
    
    return '';
  };

  // Subscribe to TTS health status
  useEffect(() => {
    const unsubscribe = claraTTSService.onHealthChange((isHealthy) => {
      setIsTTSHealthy(isHealthy);
    });
    
    return unsubscribe;
  }, []);

  // TTS functionality
  const handleTTSToggle = useCallback(async () => {
    if (!isAssistant || !responseContent.trim()) return;
    
    if (isTTSPlaying) {
      // Stop current playback
      claraTTSService.stopPlayback();
      setIsTTSPlaying(false);
      return;
    }
    
    try {
      setIsTTSLoading(true);
      
      // Clean the content for TTS (remove markdown, etc.)
      const cleanContent = responseContent
        .replace(/```[\s\S]*?```/g, '[code block]') // Replace code blocks
        .replace(/`([^`]+)`/g, '$1') // Remove inline code backticks
        .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold markdown
        .replace(/\*([^*]+)\*/g, '$1') // Remove italic markdown
        .replace(/#{1,6}\s+/g, '') // Remove headers
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Replace links with text
        .replace(/\n{3,}/g, '\n\n') // Reduce multiple newlines
        .trim();
      
      if (!cleanContent) {
        console.warn('No content to synthesize');
        return;
      }
      
      setIsTTSPlaying(true);
      
      await claraTTSService.synthesizeAndPlay({
        text: cleanContent,
        engine: 'kokoro',
        voice: 'af_sarah',
        speed: 1.0,
        language: 'en'
      });
      
    } catch (error) {
      console.error('TTS playback error:', error);
      // Don't show error to user for TTS failures, just log it
    } finally {
      setIsTTSLoading(false);
      setIsTTSPlaying(false);
    }
  }, [isAssistant, responseContent, isTTSPlaying]);

  // Stop TTS when component unmounts or message changes
  useEffect(() => {
    return () => {
      if (isTTSPlaying) {
        claraTTSService.stopPlayback();
      }
    };
  }, []);

  // Stop TTS when message content changes (for streaming)
  useEffect(() => {
    if (message.metadata?.isStreaming && isTTSPlaying) {
      claraTTSService.stopPlayback();
      setIsTTSPlaying(false);
    }
  }, [message.content, message.metadata?.isStreaming, isTTSPlaying]);

  // Improved auto-scroll effect for streaming messages with better responsiveness
  useEffect(() => {
    if (!messageRef.current || message.role !== 'assistant') return;
    
    const isStreaming = message.metadata?.isStreaming;
    const contentLength = message.content.length;
    
    if (isStreaming) {
      if (contentLength < 20) {
        // Scroll immediately when streaming starts
        scrollToElementImmediate(messageRef.current);
      } else {
        // Use adaptive debounced scroll during streaming
        scrollToElementDebounced(messageRef.current, 150);
      }
    } else if (contentLength > 0) {
      // Scroll immediately when streaming completes
      setTimeout(() => {
        if (messageRef.current) {
          scrollToElementImmediate(messageRef.current);
        }
      }, 50);
    }
  }, [message.metadata?.isStreaming, message.content.length, message.role, scrollToElementDebounced, scrollToElementImmediate]);

  const handleArtifactToggle = (artifactId: string) => {
    setExpandedArtifacts(prev => ({
      ...prev,
      [artifactId]: !prev[artifactId]
    }));
  };

  const handleFilePreview = (attachment: ClaraFileAttachment) => {
    // Implementation for file preview modal
    console.log('Preview file:', attachment);
  };

  // System message rendering
  if (isSystem) {
    return (
      <div className="flex justify-center my-4">
        <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full text-sm text-gray-600 dark:text-gray-400 max-w-lg text-center">
          {message.content}
        </div>
      </div>
    );
  }

  // Main message bubble rendering
  return (
    <div 
      ref={messageRef}
      className={`flex gap-4 mb-8 group ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
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
      <div className={`flex-1 max-w-4xl ${isUser ? 'items-end' : ''}`}>
        {/* Header with name and timestamp */}
        <div className={`flex items-center gap-2 mb-3 ${isUser ? 'justify-end' : ''}`}>
          <span className="text-[15px] font-semibold text-gray-900 dark:text-white">
            {isUser ? userName : 'Clara'}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {message.timestamp.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
          
          {/* Message actions */}
          <MessageActions
            message={message}
            isEditable={isEditable && isUser}
            onCopy={onCopy}
            onEdit={onEdit}
            onRetry={onRetry}
            isTTSHealthy={isTTSHealthy}
            isTTSPlaying={isTTSPlaying}
            isTTSLoading={isTTSLoading}
            onTTSToggle={handleTTSToggle}
          />
        </div>

        {/* Message Bubble */}
        <div className={`glassmorphic rounded-2xl px-5 py-4 ${
          isUser 
            ? 'bg-gradient-to-br from-sakura-50/80 to-pink-50/80 dark:from-sakura-900/30 dark:to-pink-900/30 border-sakura-200/50 dark:border-sakura-700/50 shadow-sakura-100/50 dark:shadow-sakura-900/20' 
            : 'bg-white/60 dark:bg-gray-800/60 border-gray-200/30 dark:border-gray-700/30'
        } ${message.metadata?.error ? 'border-red-300 dark:border-red-700' : ''} backdrop-blur-sm`}>
          
          {/* File Attachments */}
          {isUser && displayAttachments.length > 0 ? (
            // Clean display for user messages with display metadata
            <CleanAttachmentDisplay
              attachments={displayAttachments}
              onViewDetail={(attachmentId) => {
                const attachment = displayAttachments.find((att: any) => att.id === attachmentId);
                const extractedContent = getExtractedContentForAttachment(attachmentId);
                
                if (attachment) {
                  setSelectedAttachment({
                    attachment,
                    content: extractedContent
                  });
                }
              }}
            />
          ) : message.attachments && message.attachments.length > 0 ? (
            // Traditional display for assistant messages or messages without display metadata
            <div className="mb-3 space-y-2">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                Attachments ({message.attachments.length})
              </div>
              {message.attachments.map((attachment) => (
                <FileAttachmentDisplay
                  key={attachment.id}
                  attachment={attachment}
                  onPreview={handleFilePreview}
                />
              ))}
            </div>
          ) : null}

          {/* Message Text Content */}
          {/* Show thinking content for assistant messages */}
          {isAssistant && hasThinking && (
            <ThinkingDisplay
              thinking={thinkingContent.thinking}
              thinkingTime={thinkingContent.thinkingTimeSeconds}
              isStreaming={isThinkingStreaming}
              isComplete={isThinkingComplete}
            />
          )}

          {/* Show response content */}
          {responseContent && (
            <MessageContentRenderer
              content={responseContent}
            />
          )}

          {/* Error display */}
          {message.metadata?.error && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Error occurred</span>
              </div>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                {message.metadata.error}
              </p>
            </div>
          )}

          {/* Streaming indicator */}
          {message.metadata?.isStreaming && <StreamingIndicator />}

          {/* Artifacts */}
          {message.artifacts && message.artifacts.length > 0 && (
            <div className="mt-4 space-y-3">
              <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Generated Content ({message.artifacts.length})
              </div>
              {message.artifacts.map((artifact) => (
                <ClaraArtifactRenderer
                  key={artifact.id}
                  artifact={artifact}
                  isExpanded={expandedArtifacts[artifact.id] || false}
                  onToggleExpanded={handleArtifactToggle}
                  onCopy={onCopy}
                />
              ))}
            </div>
          )}
        </div>

        {/* Message Metadata */}
        <MessageMetadata 
          message={message} 
          showFullMetadata={showFullMetadata}
        />

        {/* Expandable metadata toggle */}
        {message.metadata && Object.keys(message.metadata).length > 0 && (
          <button
            onClick={() => setShowFullMetadata(!showFullMetadata)}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 mt-1 transition-colors"
          >
            {showFullMetadata ? 'Less details' : 'More details'}
          </button>
        )}
      </div>

      {/* Attachment Detail Modal */}
      {selectedAttachment && (
        <AttachmentDetailModal
          attachment={selectedAttachment.attachment}
          extractedContent={selectedAttachment.content}
          isOpen={!!selectedAttachment}
          onClose={() => setSelectedAttachment(null)}
        />
      )}
      {Toast}
    </div>
  );
};

/**
 * Attachment Detail Modal
 */
const AttachmentDetailModal: React.FC<{
  attachment: {
    id: string;
    name: string;
    type: string;
    size: number;
    processed: boolean;
  };
  extractedContent?: string;
  isOpen: boolean;
  onClose: () => void;
}> = ({ attachment, extractedContent, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const { copyToClipboard } = useCopyWithToast();

  const handleCopy = async () => {
    if (extractedContent) {
      await copyToClipboard(extractedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image': return FileImage;
      case 'pdf': return FileText;
      case 'code': return FileCode;
      default: return File;
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  if (!isOpen) return null;

  const IconComponent = getFileIcon(attachment.type);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <IconComponent className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {attachment.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatFileSize(attachment.size)} • {attachment.type} • {attachment.processed ? 'Processed' : 'Not processed'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {extractedContent && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Content'}
              </button>
            )}
            
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {extractedContent ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Eye className="w-4 h-4" />
                <span>Extracted Content</span>
              </div>
              
              <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-mono overflow-x-auto">
                  {extractedContent}
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Content Available
              </h4>
              <p className="text-gray-600 dark:text-gray-400">
                {attachment.processed 
                  ? 'This file was processed but no text content was extracted.'
                  : 'This file has not been processed yet.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClaraMessageBubble; 