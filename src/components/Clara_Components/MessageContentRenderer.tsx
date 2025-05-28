/**
 * Message Content Renderer Component
 * 
 * Enhanced content renderer for Clara messages that supports:
 * - Markdown rendering with syntax highlighting
 * - HTML code detection and preview
 * - Code block syntax highlighting
 * - Interactive elements
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Eye, EyeOff, ExternalLink, Code2 } from 'lucide-react';
import { copyToClipboard } from '../../utils/clipboard';

interface MessageContentRendererProps {
  content: string;
  className?: string;
  isDark?: boolean;
}

interface CodeBlockProps {
  children: string;
  className?: string;
  language?: string;
  isInline?: boolean;
  isDark?: boolean;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ children, className, language, isInline = false, isDark = false }) => {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  
  // Extract language from className (format: "language-javascript")
  const lang = language || className?.replace('language-', '') || 'text';
  
  // Check if this is HTML content that could be previewed
  const isHtmlContent = lang === 'html' || lang === 'xml' || 
    (children.trim().startsWith('<') && children.trim().endsWith('>'));
  
  const handleCopy = async () => {
    const success = await copyToClipboard(children);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const handleTogglePreview = () => {
    setShowPreview(!showPreview);
  };
  
  const createPreviewHtml = () => {
    if (!isHtmlContent) return '';
    
    // Basic sanitization and enhancement for preview
    let html = children.trim();
    
    // Add basic styling if not present
    if (!html.includes('<style') && !html.includes('style=')) {
      html = `
        <style>
          body { 
            font-family: system-ui, -apple-system, sans-serif; 
            margin: 20px; 
            line-height: 1.6; 
          }
          * { box-sizing: border-box; }
        </style>
        ${html}
      `;
    }
    
    return html;
  };

  // For inline code, render simply
  if (isInline) {
    return (
      <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded text-sm font-mono">
        {children}
      </code>
    );
  }

  return (
    <div className="relative group my-4" ref={previewRef}>
      {/* Code block header */}
      <div className="flex items-center justify-between bg-gray-50/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-t-lg text-sm backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4" />
          <span className="font-medium capitalize">{lang}</span>
          {isHtmlContent && (
            <span className="text-xs bg-blue-500/20 dark:bg-blue-400/20 text-blue-700 dark:text-blue-300 px-2 py-1 rounded border border-blue-300/30 dark:border-blue-500/30">
              HTML Preview Available
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {isHtmlContent && (
            <button
              onClick={handleTogglePreview}
              className="flex items-center gap-1 px-2 py-1 hover:bg-gray-200/70 dark:hover:bg-gray-600/50 rounded transition-colors"
              title={showPreview ? 'Show code' : 'Show preview'}
            >
              {showPreview ? <Code2 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              <span className="text-xs">{showPreview ? 'Code' : 'Preview'}</span>
            </button>
          )}
          
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 hover:bg-gray-200/70 dark:hover:bg-gray-600/50 rounded transition-colors"
            title="Copy code"
          >
            <Copy className="w-4 h-4" />
            <span className="text-xs">{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Content area - either code or preview */}
      <div className="relative">
        {showPreview && isHtmlContent ? (
          /* HTML Preview */
          <div className="bg-white dark:bg-gray-900 rounded-b-lg overflow-hidden border border-gray-300 dark:border-gray-600 border-t-0">
            <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700">
              <ExternalLink className="w-4 h-4" />
              Live Preview
            </div>
            <iframe
              srcDoc={createPreviewHtml()}
              className="w-full h-96 border-0"
              title="HTML Preview"
              sandbox="allow-scripts allow-same-origin"
              style={{ minHeight: '300px' }}
            />
          </div>
        ) : (
          /* Code block */
          <SyntaxHighlighter
            style={isDark ? oneDark : oneLight}
            language={lang}
            customStyle={{
              margin: 0,
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              borderBottomLeftRadius: '0.5rem',
              borderBottomRightRadius: '0.5rem',
              backgroundColor: isDark ? 'rgba(31, 41, 55, 0.9)' : 'rgba(249, 250, 251, 0.9)',
            }}
            codeTagProps={{
              style: {
                fontSize: '14px',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
              }
            }}
          >
            {children}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  );
};

const MessageContentRenderer: React.FC<MessageContentRendererProps> = ({ 
  content, 
  className = '',
  isDark = false 
}) => {
  const [darkMode, setDarkMode] = useState(isDark);

  // Update dark mode detection
  useEffect(() => {
    const updateDarkMode = () => {
      setDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    updateDarkMode();
    
    // Listen for theme changes
    const observer = new MutationObserver(updateDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    });
    
    return () => observer.disconnect();
  }, []);

  // Check if content looks like it might be Markdown
  const hasMarkdownFeatures = useMemo(() => {
    const markdownPatterns = [
      /^#{1,6}\s/m,     // Headers
      /\*\*.*?\*\*/,    // Bold
      /\*.*?\*/,        // Italic
      /`.*?`/,          // Inline code
      /```[\s\S]*?```/, // Code blocks
      /^\s*[-*+]\s/m,   // Lists
      /^\s*\d+\.\s/m,   // Numbered lists
      /\[.*?\]\(.*?\)/, // Links
      /!\[.*?\]\(.*?\)/ // Images
    ];
    
    return markdownPatterns.some(pattern => pattern.test(content));
  }, [content]);

  // If content doesn't appear to be Markdown, render as plain text
  if (!hasMarkdownFeatures) {
    return (
      <div className={`prose prose-base dark:prose-invert max-w-none ${className}`}>
        <div className="whitespace-pre-wrap text-gray-800 dark:text-gray-200 leading-relaxed text-[15px]">
          {content}
        </div>
      </div>
    );
  }

  // Render as Markdown
  return (
    <div className={`prose prose-base dark:prose-invert max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          // Custom code block renderer
          code: ({ node, inline, className, children, ...props }: any) => {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            
            return (
              <CodeBlock
                language={language}
                className={className}
                isInline={inline}
                isDark={darkMode}
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </CodeBlock>
            );
          },
          
          // Enhanced link renderer
          a: ({ href, children, ...props }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 underline decoration-blue-400 underline-offset-2"
              {...props}
            >
              {children}
            </a>
          ),
          
          // Enhanced table renderer
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border border-gray-200 dark:border-gray-700 rounded-lg" {...props}>
                {children}
              </table>
            </div>
          ),
          
          // Enhanced blockquote renderer
          blockquote: ({ children, ...props }) => (
            <blockquote 
              className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-blue-50 dark:bg-blue-900/20 rounded-r-lg italic text-gray-700 dark:text-gray-300"
              {...props}
            >
              {children}
            </blockquote>
          ),

          // Enhanced ordered list renderer
          ol: ({ children, ...props }) => (
            <ol 
              className="list-decimal list-outside ml-6 mb-4 space-y-1 text-gray-800 dark:text-gray-200"
              {...props}
            >
              {children}
            </ol>
          ),

          // Enhanced unordered list renderer
          ul: ({ children, ...props }) => (
            <ul 
              className="list-disc list-outside ml-6 mb-4 space-y-1 text-gray-800 dark:text-gray-200"
              {...props}
            >
              {children}
            </ul>
          ),

          // Enhanced list item renderer
          li: ({ children, ...props }) => (
            <li 
              className="pl-2 leading-relaxed text-gray-800 dark:text-gray-200"
              {...props}
            >
              {children}
            </li>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MessageContentRenderer; 