import React, { useEffect, useRef, useState } from 'react';
import { useInterpreter } from '../../contexts/InterpreterContext';
import { User, Bot, Copy, Check, ArrowDown, RefreshCw, Square, Brain, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Components } from 'react-markdown';
import { InterpreterMessage, FileInfo } from '../../utils/InterpreterClient';
import { AssistantHeader } from '../assistant_components';
import InterpreterSidebar from '../interpreter_components/InterpreterSidebar';
import ChatInput from '../assistant_components/ChatInput';

interface ChatInputRef {
  handleFileSelect: (file: FileInfo) => void;
  selectedManagerFiles: Array<{id: string; name: string; path: string}>;
}

const InterpreterChat: React.FC = () => {
  const { sendMessage, interpreterClient } = useInterpreter();
  const chatInputRef = useRef<ChatInputRef>(null);
  const [inputValue, setInputValue] = React.useState('');
  const [files, setFiles] = React.useState<FileInfo[]>([]);
  const [newFiles, setNewFiles] = React.useState<FileInfo[]>([]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    try {
      await sendMessage(inputValue);
      setInputValue('');
      // Check for new files
      const currentFiles = await interpreterClient.listFiles();
      const previousFileIds = new Set(files.map(f => f.id));
      const detectedNewFiles = currentFiles.filter(file => !previousFileIds.has(file.id));
      setFiles(currentFiles);
      setNewFiles(detectedNewFiles);
      // Clear selected files after sending
      if (chatInputRef.current) {
        chatInputRef.current.selectedManagerFiles = [];
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="flex h-screen">
      <InterpreterSidebar 
        isOpen={true}
        onToggle={() => {}}
        newFiles={newFiles}
        onFileSelect={(file) => {
          console.log('Sidebar file selected:', file);
          if (chatInputRef.current?.handleFileSelect) {
            chatInputRef.current.handleFileSelect(file);
          }
        }}
      />
      <div className="flex-1">
        <ChatInput
          ref={chatInputRef}
          input={inputValue}
          setInput={setInputValue}
          handleSend={handleSend}
          handleKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          isDisabled={false}
        />
      </div>
    </div>
  );
};

export default InterpreterChat; 