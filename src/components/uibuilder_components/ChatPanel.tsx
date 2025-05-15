import React, { useRef, useEffect, useState } from 'react';
import { Wand2, MessageSquare, Layout, Network } from 'lucide-react';
import { OllamaModelSelector, OpenAIModelSelector } from './ui_builder_libraries';
import { OllamaModel } from './ui_builder_libraries/OllamaTypes';
import { OpenAIModel } from './ui_builder_libraries/OpenAITypes';
import { Message } from './ui_builder_libraries/ProjectTypes';
import { db } from '../../db';

interface ChatPanelProps {
  messages: Message[];
  mode: 'chat' | 'design';
  onModeChange: (mode: 'chat' | 'design') => void;
  selectedModel: OllamaModel | OpenAIModel | null;
  onModelSelect: (model: OllamaModel | OpenAIModel) => void;
  apiType?: 'ollama' | 'openai';
  onRestoreCheckpoint?: (code: { html: string; css: string; js: string; find?: string; replace?: string }) => void;
  isGenerating?: boolean;
  isProcessing?: boolean;
  processingProgress?: number;
  streamStats?: { charCount: number; lineCount: number };
  lastStreamingMessageIndex?: number;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ 
  messages, 
  mode, 
  onModeChange, 
  selectedModel,
  onModelSelect,
  apiType = 'ollama',
  onRestoreCheckpoint,
  isGenerating = false,
  isProcessing = false,
  processingProgress = 0,
  streamStats = { charCount: 0, lineCount: 0 },
  lastStreamingMessageIndex
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [apiConfig, setApiConfig] = useState<{
    openai_api_key?: string;
    openai_base_url?: string;
  }>({});
  const [expandedMessages, setExpandedMessages] = useState<{ [key: number]: boolean }>({});
  const [expandedThink, setExpandedThink] = useState<{ [key: string]: boolean }>({});

  // Load API config
  useEffect(() => {
    const loadApiConfig = async () => {
      const config = await db.getAPIConfig();
      console.log('ChatPanel: Loading API config:', config);
      if (config) {
        setApiConfig({
          openai_api_key: config.openai_api_key || '',
          openai_base_url: config.openai_base_url || 'https://api.openai.com/v1'
        });
      }
    };

    console.log('ChatPanel: Current API type:', apiType);
    loadApiConfig();
  }, [apiType]);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (messagesEndRef.current && messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      // Immediately scroll to bottom with no animation for better performance
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  // Handle model selection based on API type
  const handleModelSelect = (model: OllamaModel | OpenAIModel) => {
    console.log('ChatPanel: Model selected:', model);
    console.log('ChatPanel: Current API type:', apiType);
    onModelSelect(model);
  };

  // Filter messages based on mode for isolation
  const filteredMessages = React.useMemo(() => {
    if (mode === 'chat') {
      // Only show messages that are not design code responses (i.e., not valid JSON with html/css/js)
      return messages.filter(msg => {
        if (msg.sender !== 'ai') return true;
        try {
          const parsed = JSON.parse(msg.content);
          return !(
            parsed && typeof parsed === 'object' && (parsed.html || parsed.css || parsed.js)
          );
        } catch {
          return true;
        }
      });
    } else if (mode === 'design') {
      // Only show messages that are design code requests/responses (user or AI with code JSON)
      return messages.filter((msg, idx) => {
        if (msg.sender === 'user') return true;
        if (msg.sender === 'ai') {
          try {
            const parsed = JSON.parse(msg.content);
            // Show if html/css/js (normal design response)
            if (parsed && typeof parsed === 'object' && (parsed.html || parsed.css || parsed.js)) return true;
            // Also show if targeted edit response
            if (parsed && typeof parsed === 'object' && parsed.target && parsed.find !== undefined && parsed.replace !== undefined) return true;
            return false;
          } catch {
            return false;
          }
        }
        return false;
      });
    }
    return messages;
  }, [messages, mode]);

  // Processing indicator component with real-time stats
  const ProcessingIndicator = () => (
    <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-50 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-3 flex flex-col">
      <div className="flex items-center mb-1">
        <div className="w-48 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-sakura-500 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${processingProgress}%` }}
          ></div>
        </div>
        <div className="ml-3 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
          {processingProgress < 100 ? 'Processing request...' : 'Generating response...'}
        </div>
      </div>
      
      {processingProgress >= 100 && streamStats.charCount > 0 && (
        <div className="flex items-center justify-between mt-1 text-xs text-gray-600 dark:text-gray-300">
          <div className="flex items-center gap-2">
            <span>Generated:</span>
            <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{streamStats.charCount} chars</span>
            <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{streamStats.lineCount} lines</span>
          </div>
          <div className="ml-2 text-xs text-gray-500">
            {Math.round(streamStats.charCount / 5)} tokens
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className={"h-full flex flex-col overflow-hidden " +
      "bg-gray-50 dark:bg-gray-900/90 transition-colors duration-200"}>
      {isProcessing && <ProcessingIndicator />}
      {/* Chat Mode Selector - Fixed height header */}
      <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 p-2 px-4 h-12 flex-shrink-0">
        <div className="flex gap-2">
          <button 
            onClick={() => onModeChange('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              mode === 'chat' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>
          <button 
            onClick={() => onModeChange('design')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              mode === 'design' 
                ? 'bg-sakura-500 text-white' 
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <Layout className="w-3.5 h-3.5" />
            <span>Design</span>
          </button>
        </div>
        <div className="flex items-center">
          <Network className="w-3.5 h-3.5 mr-1 text-gray-500" />
          <div className="text-xs font-medium text-gray-700 dark:text-gray-300 w-40">
            {apiType === 'ollama' ? (
              <OllamaModelSelector
                onModelSelect={handleModelSelect as (model: OllamaModel) => void}
                selectedModelId={selectedModel?.name}
                compact={true}
              />
            ) : (
              <OpenAIModelSelector
                key={`openai-selector-${apiConfig.openai_api_key}`}
                onModelSelect={handleModelSelect as (model: OpenAIModel) => void}
                selectedModelId={(selectedModel as OpenAIModel)?.id}
                apiKey={apiConfig.openai_api_key}
                baseUrl={apiConfig.openai_base_url}
                compact={true}
              />
            )}
          </div>
        </div>
      </div>
      
      {/* Messages Section - Scrollable area */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4"
        style={{ 
          height: "calc(100% - 48px)",
          minHeight: 0,
          overflowAnchor: "none" // Prevents browser from automatically managing scroll position
        }}
      >
        {filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400 p-6">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              {mode === 'design' ? (
                <Layout className="w-8 h-8 text-sakura-400 dark:text-sakura-500" />
              ) : (
                <MessageSquare className="w-8 h-8 text-blue-400 dark:text-blue-500" />
              )}
            </div>
            <p className="text-sm font-medium mb-2">No messages yet</p>
            <p className="text-xs max-w-md leading-relaxed">
              {mode === 'design' 
                ? "Describe UI elements you want to create, like 'create a form with name and email fields'" 
                : "Ask any question to start a conversation"}
            </p>
          </div>
        ) : (
          // Fixed container for messages with gap between them
          <div className="flex flex-col gap-4">
            {filteredMessages.map((message, index) => {
              // Minimized code output for design mode AI messages
              const isDesignAI = mode === 'design' && message.sender === 'ai';
              // Detect 'think' block in chat mode
              const isThinkBlock = mode === 'chat' && typeof message.content === 'string' && message.content.trim().startsWith('<think>') && message.content.trim().endsWith('</think>');
              let codeSummary = null;
              let codeJson: any = null;
              let isJson = false;
              let codeCharCount = 0;
              let codeError = null;
              if (isDesignAI) {
                try {
                  codeJson = JSON.parse(message.content);
                  if (codeJson && typeof codeJson === 'object' && (codeJson.html || codeJson.css || codeJson.js)) {
                    isJson = true;
                    codeCharCount =
                      (codeJson.html?.length || 0) +
                      (codeJson.css?.length || 0) +
                      (codeJson.js?.length || 0);
                  }
                } catch (e) {
                  codeError = e;
                }
              }
              const showCode = !!expandedMessages[index];
              
              // Calculate if this is the message being streamed right now
              const isStreamingMessage = message.sender === 'ai' && index === lastStreamingMessageIndex && (isGenerating || isProcessing);
              
              return (
                <div
                  key={index}
                  className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.sender === 'ai' && (
                    <div className="w-8 h-8 rounded-full bg-sakura-100 dark:bg-sakura-900/40 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                      <Wand2 className="w-4 h-4 text-sakura-500" />
                    </div>
                  )}
                  {(() => {
                    let bubbleClass = 'max-w-[85%] p-3 rounded-xl shadow-sm transition-colors duration-200 ';
                    if (message.sender === 'user') {
                      bubbleClass += 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-tr-md';
                    } else {
                      bubbleClass += 'bg-white dark:bg-gray-800/90 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700/60 rounded-tl-md';
                    }
                    if (isStreamingMessage) {
                      bubbleClass += ' border-2 border-blue-400 dark:border-blue-500 shadow-lg';
                    }
                    return (
                      <div className={bubbleClass}>
                        {(() => {
                          if (isThinkBlock) {
                            // If the whole message is a think block, handle as before
                            return (
                              <div>
                                <button
                                  className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
                                  onClick={() => setExpandedThink(exp => ({ ...exp, [index]: !exp[index] }))}
                                >
                                  {expandedThink[index] ? 'Hide thinking...' : 'Show thinking...'}
                                </button>
                                {expandedThink[index] && (
                                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded p-2">
                                    {message.content.replace(/<\/?think>/g, '').trim()}
                                  </div>
                                )}
                              </div>
                            );
                          } else if (mode === 'chat' && typeof message.content === 'string' && message.content.includes('<think>') && message.content.includes('</think>')) {
                            // If message contains a think block and other text, split and render
                            const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
                            let lastIndex = 0;
                            const parts: React.ReactNode[] = [];
                            let match;
                            let partIdx = 0;
                            while ((match = thinkRegex.exec(message.content)) !== null) {
                              // Text before the think block
                              if (match.index > lastIndex) {
                                parts.push(
                                  <span key={`text-${partIdx}`}>{message.content.slice(lastIndex, match.index)}</span>
                                );
                                partIdx++;
                              }
                              // The think block itself
                              const thinkIndex = partIdx;
                              parts.push(
                                <span key={`think-${partIdx}`}
                                  style={{ display: 'inline-block', marginLeft: 4, marginRight: 4 }}
                                >
                                  <button
                                    className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 underline"
                                    onClick={() => setExpandedThink(exp => ({ ...exp, [`${index}-${thinkIndex}`]: !exp[`${index}-${thinkIndex}`] }))}
                                  >
                                    {expandedThink[`${index}-${thinkIndex}`] ? 'Hide thinking...' : 'Show thinking...'}
                                  </button>
                                  {expandedThink[`${index}-${thinkIndex}`] && (
                                    <span className="ml-1 text-xs text-gray-500 dark:text-gray-300 bg-gray-50 dark:bg-gray-900 rounded p-1">
                                      {match[1].trim()}
                                    </span>
                                  )}
                                </span>
                              );
                              partIdx++;
                              lastIndex = match.index + match[0].length;
                            }
                            // Any text after the last think block
                            if (lastIndex < message.content.length) {
                              parts.push(
                                <span key={`text-${partIdx}`}>{message.content.slice(lastIndex)}</span>
                              );
                            }
                            return <span className="text-sm whitespace-pre-wrap leading-relaxed">{parts}</span>;
                          } else if (isDesignAI) {
                            // Design AI message with JSON code (targeted or not)
                            let isTargetedEditJson = false;
                            let targetedEditJson: any = null;
                            try {
                              targetedEditJson = JSON.parse(message.content);
                              isTargetedEditJson = targetedEditJson && typeof targetedEditJson === 'object' && targetedEditJson.target && targetedEditJson.find !== undefined && targetedEditJson.replace !== undefined;
                            } catch {}
                            if (isTargetedEditJson) {
                              // Targeted edit response: show checkpoint/restore and show/hide code, and status
                              const showCode = !!expandedMessages[index];
                              const status = (message as any).status;
                              return (
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={
                                      'font-medium ' +
                                      (status === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')
                                    }>
                                      {status === 'success' ? 'Targeted edit applied' : 'Failed to apply targeted edit'}
                                    </span>
                                    <span className="font-medium text-sakura-600">Target: {targetedEditJson.target.toUpperCase()}</span>
                                    {status === 'success' && onRestoreCheckpoint && (
                                      <button
                                        className="ml-2 px-2 py-1 text-xs rounded bg-sakura-500 hover:bg-sakura-600 text-white transition-colors"
                                        onClick={() => {
                                          // Only restore the targeted code, and pass find/replace for correct logic
                                          if (targetedEditJson.target === 'html') onRestoreCheckpoint({ html: targetedEditJson.replace, css: '', js: '', find: targetedEditJson.find, replace: targetedEditJson.replace });
                                          if (targetedEditJson.target === 'css') onRestoreCheckpoint({ html: '', css: targetedEditJson.replace, js: '', find: targetedEditJson.find, replace: targetedEditJson.replace });
                                          if (targetedEditJson.target === 'js') onRestoreCheckpoint({ html: '', css: '', js: targetedEditJson.replace, find: targetedEditJson.find, replace: targetedEditJson.replace });
                                        }}
                                      >
                                        Restore Checkpoint
                                      </button>
                                    )}
                                    <button
                                      className="ml-2 px-2 py-1 text-xs rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
                                      onClick={() => setExpandedMessages(exp => ({ ...exp, [index]: !exp[index] }))}
                                    >
                                      {showCode ? 'Hide code' : 'Show code'}
                                    </button>
                                  </div>
                                  {status === 'fail' && (
                                    <div className="text-xs text-red-600 dark:text-red-400 mb-2">The code to find was not found. No changes were made.</div>
                                  )}
                                  {showCode && (
                                    <div className="mt-2 text-xs bg-gray-100 dark:bg-gray-900/80 rounded p-2 overflow-x-auto border border-gray-200 dark:border-gray-700/60">
                                      <pre className="mb-1 text-gray-800 dark:text-gray-100"><b>Find:</b>\n{targetedEditJson.find || ''}</pre>
                                      <pre className="mb-1 text-gray-800 dark:text-gray-100"><b>Replace:</b>\n{targetedEditJson.replace || ''}</pre>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            // Design AI message with JSON code
                            return (
                              <>
                                {isGenerating && (index === lastStreamingMessageIndex) && !isJson ? (
                                  <div className="flex flex-col gap-2">
                                    <div className={`flex items-center gap-2 text-sakura-500 ${isProcessing ? 'animate-pulse' : ''}`}>
                                      <span>{isProcessing && processingProgress < 100 ? 'Processing request...' : 'AI is generating code'}</span>
                                      <span className="inline-block w-2 h-2 rounded-full bg-sakura-400 animate-bounce" style={{ animationDelay: '0s' }}></span>
                                      <span className="inline-block w-2 h-2 rounded-full bg-sakura-400 animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                                      <span className="inline-block w-2 h-2 rounded-full bg-sakura-400 animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                                    </div>
                                    
                                    {processingProgress >= 100 && (
                                      <div className="flex items-center flex-wrap gap-2 mt-1 text-xs text-gray-600 dark:text-gray-300">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-mono bg-sakura-100 dark:bg-sakura-900/40 px-1.5 py-0.5 rounded text-sakura-700 dark:text-sakura-300">
                                            {streamStats.charCount} chars
                                          </span>
                                          <span className="font-mono bg-sakura-100 dark:bg-sakura-900/40 px-1.5 py-0.5 rounded text-sakura-700 dark:text-sakura-300">
                                            {streamStats.lineCount} lines
                                          </span>
                                          <span className="font-mono bg-sakura-100 dark:bg-sakura-900/40 px-1.5 py-0.5 rounded text-sakura-700 dark:text-sakura-300">
                                            ~{Math.round(streamStats.charCount / 5)} tokens
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : isJson ? (
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium text-sakura-600">AI generated code: {codeCharCount.toLocaleString()} characters.</span>
                                      {onRestoreCheckpoint && (
                                        <button
                                          className="ml-2 px-2 py-1 text-xs rounded bg-sakura-500 hover:bg-sakura-600 text-white transition-colors"
                                          onClick={() => onRestoreCheckpoint({
                                            html: codeJson.html || '',
                                            css: codeJson.css || '',
                                            js: codeJson.js || ''
                                          })}
                                        >
                                          Restore Checkpoint
                                        </button>
                                      )}
                                      <button
                                        className="ml-2 px-2 py-1 text-xs rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 transition-colors"
                                        onClick={() => setExpandedMessages(exp => ({ ...exp, [index]: !exp[index] }))}
                                      >
                                        {showCode ? 'Hide code' : 'Show code'}
                                      </button>
                                    </div>
                                    {showCode && (
                                      <div className="mt-2 text-xs bg-gray-100 dark:bg-gray-900/80 rounded p-2 overflow-x-auto border border-gray-200 dark:border-gray-700/60">
                                        <pre className="mb-1 text-gray-800 dark:text-gray-100"><b>HTML:</b>\n{codeJson.html || ''}</pre>
                                        <pre className="mb-1 text-gray-800 dark:text-gray-100"><b>CSS:</b>\n{codeJson.css || ''}</pre>
                                        <pre className="text-gray-800 dark:text-gray-100"><b>JS:</b>\n{codeJson.js || ''}</pre>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-red-500">{codeError ? 'Invalid code response' : message.content}</span>
                                )}
                              </>
                            );
                          } else {
                            // Chat mode - regular message or streaming message
                            if (isStreamingMessage) {
                              return (
                                <div className="flex flex-col gap-2">
                                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                    {message.content || (isProcessing && processingProgress < 100 ? 'Processing your request...' : '')}
                                  </p>
                                  
                                  {processingProgress >= 100 && streamStats.charCount > 0 && (
                                    <div className="flex items-center flex-wrap gap-2 mt-1 text-xs text-gray-600 dark:text-gray-300 border-t border-gray-200 dark:border-gray-700 pt-2">
                                      <div className="flex items-center gap-1.5">
                                        <span>Generated:</span>
                                        <span className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded text-blue-700 dark:text-blue-300">
                                          {streamStats.charCount} chars
                                        </span>
                                        <span className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded text-blue-700 dark:text-blue-300">
                                          {streamStats.lineCount} lines
                                        </span>
                                        <span className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded text-blue-700 dark:text-blue-300">
                                          ~{Math.round(streamStats.charCount / 5)} tokens
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>;
                          }
                        })()}
                        {/* Only show timestamp if present */}
                        {(typeof (message as any).timestamp === 'string' || typeof (message as any).timestamp === 'number') && (
                          <div className="text-xs mt-1 text-right opacity-80 text-gray-200 dark:text-gray-400">
                            {new Date((message as any).timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  {message.sender === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center ml-2 flex-shrink-0 mt-1">
                      <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              );
            })}
            {/* This element is used for scrolling to the bottom */}
            <div ref={messagesEndRef} className="h-1" />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPanel; 