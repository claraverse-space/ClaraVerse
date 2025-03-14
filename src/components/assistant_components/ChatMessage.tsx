import React, { useEffect, useState } from 'react';
import {
  User,
  Bot,
  ChevronDown,
  ChevronUp,
  Brain,
  Copy,
  Check,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Message } from '../../db';
import { db } from '../../db';

interface ChatMessageProps {
  message: Message;
  showTokens: boolean;
}

// Custom hook to get the window width
const useWindowWidth = () => {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return width;
};

interface ThinkingBlockProps {
  content: string;
}

const ThinkingBlock: React.FC<ThinkingBlockProps> = ({ content }) => {
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

const ImageGallery: React.FC<{ images: string[] }> = ({ images }) => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!images || images.length === 0) return null;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex flex-wrap gap-2">
        {images.map((image, index) => (
          <div
            key={index}
            className="relative group cursor-pointer"
            onClick={() => setSelectedImage(image)}
          >
            <img
              src={image}
              alt={`Uploaded ${index + 1}`}
              className="w-32 h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-700 hover:border-sakura-500 dark:hover:border-sakura-500 transition-colors"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
              <ImageIcon className="w-6 h-6 text-white" />
            </div>
          </div>
        ))}
      </div>

      {selectedImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] mx-2">
            <img
              src={selectedImage}
              alt="Full size preview"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-2 right-2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const ChatMessage: React.FC<ChatMessageProps> = ({ message, showTokens }) => {
  const [userName, setUserName] = useState<string>('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const windowWidth = useWindowWidth();

  useEffect(() => {
    const loadUserName = async () => {
      const personalInfo = await db.getPersonalInfo();
      if (personalInfo?.name) {
        setUserName(personalInfo.name);
      }
    };
    loadUserName();
  }, []);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCopyMessage = () => {
    // For assistant messages, strip out <think> blocks from the copied text
    const contentToCopy =
      message.role === 'assistant' && message.content.includes('<think>')
        ? message.content.split('</think>').pop()?.trim() || message.content
        : message.content;

    navigator.clipboard.writeText(contentToCopy);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const isAssistant = message.role === 'assistant';
  const hasThinkingBlock = isAssistant && message.content.includes('<think>');
  const messageContent = hasThinkingBlock
    ? message.content.split('</think>').pop()?.trim() || message.content
    : message.content;

  // Determine max width based on window size (e.g., 80% of window width with a maximum cap)
  const computedMaxWidth = Math.min(windowWidth * 1.8, 900); // 600px is the cap

  return (
    <div className={`flex ${isAssistant ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`rounded p-3 shadow-sm relative group ${
          isAssistant
            ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
            : 'bg-sakura-500 text-white'
        }`}
        style={{ maxWidth: computedMaxWidth }}
      >
        {/* Header (Icon + Name) */}
        <div className="flex items-center gap-1 mb-1">
          {isAssistant ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
          <span className="text-md font-semibold">
            {isAssistant ? 'Clara' : userName || 'You'}
          </span>
        </div>

        {/* Thinking Block */}
        {hasThinkingBlock && <ThinkingBlock content={message.content} />}

        {/* Message Content */}
        <div className="prose dark:prose-invert max-w-none prose-base">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code: ({ node, className, children, ...props }) => {
                const match = /language-(\w+)/.exec(className || '');
                const codeText = String(children).replace(/\n$/, '');
                if ( match) {
                  return (
                    <div className="relative my-2">
                      <pre 
                        className="p-4 rounded-md bg-[#1E1E1E] text-[#e5e7eb]"
                        style={{ margin: 0, fontSize: '0.9rem' }}
                      >
                        <code className="language-plaintext font-mono">{codeText}</code>
                      </pre>
                      <button
                        onClick={() => handleCopyCode(codeText)}
                        className="absolute top-1 right-1 p-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Copy code"
                      >
                        {copiedCode === codeText ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  );
                }
                return (
                  <code
                    className="font-mono bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-gray-800 dark:text-gray-200"
                    {...props}
                  >
                    {children}
                  </code>
                );
              },
              a: ({ node, children, href, ...props }) => (
                <a
                  href={href}
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                  target="_blank"
                  rel="noopener noreferrer"
                  {...props}
                >
                  {children}
                </a>
              ),
              ul: ({ node, children, ...props }) => (
                <ul className="list-disc pl-4 my-1 space-y-1" {...props}>
                  {children}
                </ul>
              ),
              ol: ({ node, children, ...props }) => (
                <ol className="list-decimal pl-4 my-1 space-y-1" {...props}>
                  {children}
                </ol>
              ),
              p: ({ node, children, ...props }) => (
                <p className="my-1 leading-snug" {...props}>
                  {children}
                </p>
              ),
              blockquote: ({ node, children, ...props }) => (
                <blockquote
                  className="border-l-4 border-gray-300 dark:border-gray-600 pl-2 my-1 italic"
                  {...props}
                >
                  {children}
                </blockquote>
              ),
              table: ({ node, children, ...props }) => (
                <div className="overflow-x-auto my-1">
                  <table
                    className="min-w-full divide-y divide-gray-300 dark:divide-gray-600"
                    {...props}
                  >
                    {children}
                  </table>
                </div>
              ),
              th: ({ node, children, ...props }) => (
                <th
                  className="px-2 py-1 text-left text-xs font-semibold bg-gray-100 dark:bg-gray-900"
                  {...props}
                >
                  {children}
                </th>
              ),
              td: ({ node, children, ...props }) => (
                <td className="px-2 py-1 text-xs" {...props}>
                  {children}
                </td>
              ),
            }}
          >
            {messageContent}
          </ReactMarkdown>
        </div>

        {/* Images */}
        {message.images && message.images.length > 0 && <ImageGallery images={message.images} />}

        {/* Footer (timestamp, tokens, copy button) */}
        <div className="flex items-center justify-between mt-1 text-xs">
          <div className="flex items-center gap-2 opacity-70">
            <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
            {showTokens && <span>{message.tokens} tokens</span>}
          </div>
          <button
            onClick={handleCopyMessage}
            className="p-1 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Copy message"
          >
            {copiedMessage ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatMessage;
