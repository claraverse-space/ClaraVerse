import React, { useState, useRef } from 'react';
import { SendHorizontal, PlusCircle, Image as ImageIcon, XCircle, StopCircle, Database, Send, Paperclip, Mic, Loader2, Plus, X, Square, File } from 'lucide-react';

interface ChatInputProps {
  input: string;
  setInput: (input: string) => void;
  handleSend: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  isDisabled: boolean;
  isProcessing: boolean;
  onNewChat: () => void;
  onImageUpload?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  images: Array<{ id: string; preview: string }>;
  onRemoveImage: (id: string) => void;
  handleStopStreaming: () => void;
  ragEnabled?: boolean;
  onToggleRag?: (enabled: boolean) => void;
  onTemporaryDocUpload?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  temporaryDocs?: Array<{ id: string; name: string }>;
  onRemoveTemporaryDoc?: (id: string) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  handleSend,
  handleKeyDown,
  isDisabled,
  isProcessing,
  onNewChat,
  onImageUpload,
  images,
  onRemoveImage,
  handleStopStreaming,
  ragEnabled = false,
  onToggleRag,
  onTemporaryDocUpload,
  temporaryDocs = [],
  onRemoveTemporaryDoc,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tempDocInputRef = useRef<HTMLInputElement>(null);

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="p-6 flex justify-center">
      <div className="max-w-3xl w-full">
        {/* Main Input Container */}
        <div className="glassmorphic rounded-xl p-4">
          {/* Images Preview */}
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {images.map((image) => (
                <div 
                  key={image.id} 
                  className="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
                >
                  <img 
                    src={image.preview} 
                    alt="Uploaded" 
                    className="w-full h-full object-cover"
                  />
                  <button
                    onClick={() => onRemoveImage(image.id)}
                    className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Temporary Documents Preview */}
          {temporaryDocs.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              {temporaryDocs.map((doc) => (
                <div 
                  key={doc.id} 
                  className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <File className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{doc.name}</span>
                  <button
                    onClick={() => onRemoveTemporaryDoc?.(doc.id)}
                    className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full"
                  >
                    <X className="w-3 h-3 text-red-500" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Field */}
          <div className="mb-4">
            <textarea
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything..."
              className="w-full bg-transparent border-0 outline-none focus:outline-none focus:ring-0 resize-none text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500"
              style={{
                height: 'auto',
                minHeight: '24px',
                maxHeight: '250px',
                overflowY: 'auto'
              }}
              disabled={isProcessing && !input}
            />
          </div>

          {/* Bottom Actions */}
          <div className="flex justify-between items-center">
            {/* Left Side Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={onNewChat}
                className="group p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5 text-gray-600 dark:text-gray-400 transition-colors relative"
                title="New Chat"
              >
                <Plus className="w-5 h-5" />
                <span className="absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  New Chat
                </span>
              </button>
              <button 
                className="group p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5 text-gray-600 dark:text-gray-400 transition-colors relative"
                onClick={handleImageClick}
                disabled={isProcessing}
              >
                <ImageIcon className="w-5 h-5" />
                <span className="absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  Add Image
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={onImageUpload}
                className="hidden"
              />
              <button
                onClick={() => tempDocInputRef.current?.click()}
                className="group p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5 text-gray-600 dark:text-gray-400 transition-colors relative"
                title="Add Temporary Document"
              >
                <File className="w-5 h-5" />
                <div className="absolute left-0 -top-12 px-3 py-2 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal w-64 text-center">
                  Add temporary document for this chat only
                </div>
              </button>
              <input
                ref={tempDocInputRef}
                type="file"
                accept=".pdf,.txt,.md,.csv"
                multiple
                onChange={onTemporaryDocUpload}
                className="hidden"
              />
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-2">
              {/* Only show RAG toggle if there are no temporary docs */}
              {(!temporaryDocs || temporaryDocs.length === 0) && (
                <button
                  onClick={() => onToggleRag?.(!ragEnabled)}
                  className={`group p-2 rounded-lg transition-colors ${
                    ragEnabled 
                      ? 'bg-sakura-500 text-white hover:bg-sakura-600' 
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                  title={ragEnabled ? 'RAG Enabled' : 'RAG Disabled'}
                >
                  <Database className="w-5 h-5" />
                  <div className="absolute right-0 -top-12 px-3 py-2 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal w-64 text-center">
                    Temporarily enable knowledge base for Clara. Keeping it on may make responses biased.
                  </div>
                </button>
              )}
              {/* Show indicator when using temporary docs */}
              {temporaryDocs && temporaryDocs.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-sakura-500 text-white rounded-lg">
                  <Database className="w-4 h-4" />
                  <span className="text-sm">Using Temporary Docs</span>
                </div>
              )}
              {isProcessing ? (
                <button
                  onClick={handleStopStreaming}
                  className="p-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors flex items-center gap-1"
                  title="Stop generating"
                >
                  <Square className="w-4 h-4" fill="white" />
                  <Loader2 className="w-4 h-4 animate-spin" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={isDisabled}
                  className="p-2 rounded-lg bg-sakura-500 text-white hover:bg-sakura-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInput;