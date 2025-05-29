import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft, Play, Loader, Check, ImageIcon, Send,
  Activity, FileText, Code, MessageSquare, Database, Globe,
  Sparkles, Zap, User, Settings, BarChart2 as Chart, Search, Bot, Brain,
  Command, Book, Layout, Compass, Download, RotateCw, AlertCircle
} from 'lucide-react';
import { Node } from 'reactflow';
import ReactMarkdown from 'react-markdown';

import { appStore } from '../services/AppStore';
import { executeFlow, generateExecutionPlan } from '../ExecutionEngine';
import { useTheme } from '../hooks/useTheme';
import { OllamaProvider } from '../context/OllamaContext';

import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { Buffer } from 'buffer';

// Create an icon mapping for dynamic access
const iconMap: Record<string, React.ElementType> = {
  Activity,
  FileText,
  Code,
  Image: ImageIcon,
  MessageSquare,
  Database,
  Globe,
  Sparkles,
  Zap,
  User,
  Settings,
  Chart,
  Search,
  Bot,
  Brain,
  Command,
  Book,
  Layout,
  Compass,
};

// Add this helper function at the top level
const arrayBufferToDataUrl = (buffer: ArrayBuffer): string => {
  const uint8Array = new Uint8Array(buffer);
  const base64 = Buffer.from(uint8Array).toString('base64');
  return `data:image/png;base64,${base64}`;
};

interface AppRunnerProps {
  appId: string;
  onBack: () => void;
}

interface InputState {
  [nodeId: string]: string | File | ArrayBuffer | null;
}

interface ChatMessage {
  id: string;
  content: any;
  type: 'user' | 'ai';
  timestamp: number;
  isImage?: boolean;
}

// Update the NodeData interface
interface NodeData {
  label?: string;
  config?: {
    placeholder?: string;
    isRequired?: boolean;
    description?: string;
    text?: string;
    imageBuffer?: ArrayBuffer;
  };
  runtimeImage?: string;
}

interface AppNode extends Node {
  type: string;
  data: NodeData;
  id: string;
}

interface ChatContext {
  userInput: string;
  botOutput: string;
}

const AppRunner: React.FC<AppRunnerProps> = ({ appId, onBack }) => {
  const { isDark } = useTheme();
  const [appData, setAppData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [inputState, setInputState] = useState<InputState>({});
  const [outputState, setOutputState] = useState<{ [nodeId: string]: any }>({});
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [simpleInputValue, setSimpleInputValue] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activePage, setActivePage] = useState('apps');
  const [messageHistory, setMessageHistory] = useState<ChatMessage[]>([]);
  const [chainEnabled, setChainEnabled] = useState(false);
  const [showChainWarning, setShowChainWarning] = useState(false);

  // Refs for scrolling
  const outputSectionRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Dynamically generate a background gradient for the container
  const gradientStyle = useMemo(() => {
    const color = appData?.color || '#3B82F6';
    return {
      background: `linear-gradient(135deg, ${color}10, ${
        isDark ? '#1f293780' : '#f9fafb80'
      })`,
    };
  }, [appData?.color, isDark]);

  // Scroll to bottom whenever messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messageHistory]);

  // Load the app data when component mounts
  useEffect(() => {
    const loadApp = async () => {
      try {
        setIsLoading(true);
        const app = await appStore.getApp(appId);
        if (app) {
          setAppData(app);

          // Initialize input state for text/image input nodes
          const inputNodes = app.nodes.filter(
            (node: AppNode) =>
              node.type === 'textInputNode' || node.type === 'imageInputNode'
          );

          const initialInputs = inputNodes.reduce((acc: InputState, node: AppNode) => {
            acc[node.id] = '';
            return acc;
          }, {});

          setInputState(initialInputs);
        } else {
          setError('App not found');
        }
      } catch (err) {
        setError('Failed to load app');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    loadApp();
  }, [appId]);

  // Update the type annotations for the node parameters
  const { inputNodes, outputNodes, processingNodes } = useMemo(() => {
    if (!appData) {
      return {
        inputNodes: [] as AppNode[],
        outputNodes: [] as AppNode[],
        processingNodes: [] as AppNode[],
      };
    }

    const inputs = (appData.nodes as AppNode[]).filter(
      (node) => node.type === 'textInputNode' || node.type === 'imageInputNode'
    );
    const outputs = (appData.nodes as AppNode[]).filter(
      (node) => 
        node.type === 'textOutputNode' || 
        node.type === 'markdownOutputNode' ||
        node.type === 'imageOutputNode'
    );
    const processing = (appData.nodes as AppNode[]).filter(
      (node) => !inputs.includes(node) && !outputs.includes(node)
    );

    return {
      inputNodes: inputs,
      outputNodes: outputs,
      processingNodes: processing,
    };
  }, [appData]);

  // Determine if this is a "simple" app (one text input, one or more outputs)
  const isSimpleApp = useMemo(() => {
    return (
      inputNodes.length === 1 &&
      outputNodes.length >= 1 &&
      inputNodes[0].type === 'textInputNode'
    );
  }, [inputNodes, outputNodes]);

  // Update isFormComplete check to handle ArrayBuffer inputs
  const isFormComplete = useMemo(() => {
    if (!inputNodes.length) return true;
    return Object.entries(inputState).every(([nodeId, value]) => {
      const node = inputNodes.find((n: AppNode) => n.id === nodeId);
      if (!node) return true;
      if (node.type === 'textInputNode') {
        return typeof value === 'string' && value.trim() !== '';
      }
      if (node.type === 'imageInputNode') {
        return value instanceof ArrayBuffer || 
               value instanceof File || 
               (typeof value === 'string' && value.startsWith('data:image'));
      }
      return true;
    });
  }, [inputState, inputNodes]);

  // Show/hide "scroll to top" button
  useEffect(() => {
    const handleScroll = () => {
      if (outputSectionRef.current) {
        setShowScrollTop(outputSectionRef.current.scrollTop > 300);
      }
    };
    const outputSection = outputSectionRef.current;
    outputSection?.addEventListener('scroll', handleScroll);

    return () => outputSection?.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    outputSectionRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle input changes for text or image
  const handleInputChange = (nodeId: string, value: string | File | null) => {
    setInputState((prev) => ({
      ...prev,
      [nodeId]: value,
    }));
  };

  const handleImageUpload = (nodeId: string, file: File) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const arrayBuffer = event.target.result as ArrayBuffer;
        setInputState(prev => ({
          ...prev,
          [nodeId]: arrayBuffer
        }));

        // Convert ArrayBuffer to DataURL for preview
        const previewUrl = arrayBufferToDataUrl(arrayBuffer);

        setAppData((prevAppData: any) => ({
          ...prevAppData,
          nodes: prevAppData.nodes.map((node: AppNode) => {
            if (node.id === nodeId) {
              return {
                ...node,
                data: {
                  ...node.data,
                  runtimeImage: previewUrl,  // Use converted DataURL for preview
                  config: {
                    ...node.data.config,
                    imageBuffer: arrayBuffer
                  }
                }
              };
            }
            return node;
          })
        }));
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // For simple chat-like apps
  const handleSimpleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setSimpleInputValue(e.target.value);

    if (inputNodes.length === 1) {
      handleInputChange(inputNodes[0].id, e.target.value);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isRunning && simpleInputValue.trim() !== '') {
        runApp();
      }
    }
  };

  // Get the previous chat context
  const getPreviousContext = (): ChatContext | null => {
    if (messageHistory.length < 2) return null;
    
    // Get the last user message and bot response
    const lastMessages = messageHistory.slice(-2);
    const userMessage = lastMessages.find(m => m.type === 'user');
    const botMessage = lastMessages.find(m => m.type === 'ai');
    
    if (!userMessage || !botMessage) return null;
    
    return {
      userInput: userMessage.content,
      botOutput: botMessage.content
    };
  };

  // Format the input with context
  const formatInputWithContext = (currentInput: string): string => {
    const context = getPreviousContext();
    if (!context) return currentInput;
    
    return `Previous Chat:

User input: "${context.userInput}"
Bot's output: "${context.botOutput}"

Current request: ${currentInput}`;
  };

  // Main "Run App" function
  const runApp = async () => {
    setIsRunning(true);
    setError(null);
    setIsSuccess(false);

    try {
      // Gather user inputs
      const userInputs: any[] = [];

      // For a single text input app
      if (isSimpleApp && inputNodes.length === 1) {
        const formattedInput = chainEnabled ? formatInputWithContext(simpleInputValue) : simpleInputValue;
        setInputState((prev) => ({
          ...prev,
          [inputNodes[0].id]: formattedInput,
        }));
        // Only add the original input to message history
        userInputs.push(simpleInputValue);
      } else {
        // Collect all non-empty inputs
        inputNodes.forEach((node) => {
          const inputVal = inputState[node.id];
          if (inputVal) {
            if (node.type === 'imageInputNode' && inputVal instanceof File) {
              userInputs.push(`[Image: ${inputVal.name}]`);
            } else if (typeof inputVal === 'string' && inputVal.trim() !== '') {
              userInputs.push(inputVal);
            }
          }
        });
      }

      // Add user message to chat history
      setMessageHistory((prev) => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          content: userInputs.length === 1 ? userInputs[0] : userInputs.join('\n'),
          type: 'user',
          timestamp: Date.now(),
          isImage: inputNodes.some(
            (node) => node.type === 'imageInputNode' && inputState[node.id] instanceof File
          ),
        },
      ]);

      // Clone app data to inject runtime inputs
      const appDataClone = JSON.parse(JSON.stringify(appData));

      // Update input node configs
      appDataClone.nodes = appDataClone.nodes.map((node: AppNode) => {
        if (inputState[node.id] !== undefined) {
          if (node.type === 'textInputNode') {
            return {
              ...node,
              data: {
                ...node.data,
                config: {
                  ...node.data.config,
                  text: inputState[node.id],
                },
              },
            };
          } else if (node.type === 'imageInputNode') {
            // For image nodes, use the stored buffer from the node's config
            const originalNode = appData.nodes.find((n: AppNode) => n.id === node.id);
            return {
              ...node,
              data: {
                ...node.data,
                config: {
                  ...node.data.config,
                  imageBuffer: originalNode?.data?.config?.imageBuffer
                }
              }
            };
          }
        }
        return node;
      });

      // Update app store temporarily
      await appStore.tempUpdateAppNodes(appId, appDataClone.nodes);

      // Generate execution plan & run
      const plan = generateExecutionPlan(appDataClone.nodes, appDataClone.edges);

      // Callback to capture node outputs
      const updateNodeOutput = (nodeId: string, output: any) => {
        setOutputState((prev) => ({ ...prev, [nodeId]: output }));

        // Find the node to determine its type
        const node = appData.nodes.find((n: AppNode) => n.id === nodeId);
        if (node) {
          // Only add to message history if it's an output node
          if (node.type === 'imageOutputNode' || node.type === 'textOutputNode' || node.type === 'markdownOutputNode') {
            const isImage = node.type === 'imageOutputNode' || 
                          (typeof output === 'string' && output.startsWith('data:image'));
            console.log(`Adding output to message history for ${node.type}:`, { nodeId, output });
            setMessageHistory((prev) => [
              ...prev,
              {
                id: `ai-${Date.now()}-${nodeId}`,
                content: output,
                type: 'ai',
                timestamp: Date.now(),
                isImage
              },
            ]);
          }
        }
      };

      // Execute the flow
      await executeFlow(plan, updateNodeOutput);
      setIsSuccess(true);

      // Clear input if it's a simple app
      if (isSimpleApp) {
        setSimpleInputValue('');
      }
    } catch (err) {
      console.error('Error running app:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'An error occurred while running the app';
      setError(errorMessage);

      setMessageHistory((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          content: errorMessage,
          type: 'ai',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  // Helper to format output for Markdown
  const formatOutputForMarkdown = (output: any): string => {
    if (typeof output === 'string') return output;
    try {
      return JSON.stringify(output, null, 2);
    } catch {
      return String(output);
    }
  };

  // Modified renderOutputs function
  const renderOutputs = () => {
    if (messageHistory.length === 0 && !isRunning) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-3xl blur-xl animate-pulse"></div>
            <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 flex items-center justify-center backdrop-blur-sm border border-white/20">
              <MessageSquare className="w-10 h-10 text-blue-500" />
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 bg-clip-text text-transparent">
              Ready to get started?
            </h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-md text-base leading-relaxed">
              {appData?.description ||
                'Enter your information and run the app to see the magic happen.'}
            </p>
          </div>
          {/* Add some visual interest with floating elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-blue-400/30 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
            <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-purple-400/30 rounded-full animate-bounce" style={{ animationDelay: '1s' }}></div>
            <div className="absolute bottom-1/3 left-1/3 w-1.5 h-1.5 bg-pink-400/30 rounded-full animate-bounce" style={{ animationDelay: '2s' }}></div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4 flex flex-col">
        {messageHistory.map((message, index) => {
          const isUserMessage = message.type === 'user';
          const isImageContent = typeof message.content === 'string' && 
            (message.content.startsWith('data:image') || message.isImage);
          const isFirst = index === 0;
          const isConsecutive = index > 0 && messageHistory[index - 1].type === message.type;
          
          return (
            <div
              key={message.id}
              className={`flex ${
                isUserMessage ? 'justify-end' : 'justify-start'
              } ${isFirst ? 'animate-in slide-in-from-bottom-4 duration-500' : ''}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] relative text-sm leading-relaxed group
                  ${isUserMessage ? 'ml-auto' : 'mr-auto'}
                  ${!isConsecutive ? 'mt-4' : 'mt-1'}
                `}
              >
                {/* Message bubble with improved styling */}
                <div
                  className={`p-4 rounded-2xl shadow-sm relative backdrop-blur-sm transition-all duration-200 hover:shadow-md
                    ${isUserMessage ? 'rounded-tr-md' : 'rounded-tl-md'}
                    ${
                      isUserMessage
                        ? isDark
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-500/20'
                          : 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-blue-500/20'
                        : isDark
                        ? 'bg-gray-800/90 text-gray-100 border border-gray-700/50 shadow-gray-900/20'
                        : 'bg-white text-gray-800 border border-gray-200/50 shadow-gray-200/50'
                    }
                  `}
                >
                  {isImageContent ? (
                    <div className="space-y-3">
                      <div className="relative overflow-hidden rounded-xl">
                        <img 
                          src={message.content} 
                          alt="Generated" 
                          className="max-w-full transition-transform duration-200 hover:scale-105"
                          style={{ maxHeight: '400px' }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-200"></div>
                      </div>
                      <button
                        onClick={() => {
                          const link = document.createElement('a');
                          link.href = message.content;
                          link.download = `generated-${Date.now()}.png`;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                        className={`w-full px-4 py-2 text-xs rounded-xl flex items-center justify-center gap-2 transition-all duration-200 hover:scale-105 active:scale-95
                          ${isUserMessage 
                            ? 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-sm'
                            : isDark
                              ? 'bg-gray-700/50 hover:bg-gray-700/70 text-gray-200'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                      >
                        <Download className="w-3 h-3" />
                        Download Image
                      </button>
                    </div>
                  ) : isUserMessage ? (
                    <div className="whitespace-pre-wrap font-medium">
                      {message.content ? message.content : "Input Received"}
                    </div>
                  ) : (
                    <div className="prose prose-sm dark:prose-invert max-w-none text-current [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      <ReactMarkdown>{formatOutputForMarkdown(message.content)}</ReactMarkdown>
                    </div>
                  )}
                  
                  {/* Timestamp with better styling */}
                  <div
                    className={`text-xs mt-3 opacity-70 transition-opacity group-hover:opacity-100
                      ${isUserMessage ? 'text-right' : 'text-left'}
                    `}
                  >
                    {new Date(message.timestamp).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>

                {/* Avatar for AI messages */}
                {!isUserMessage && !isConsecutive && (
                  <div className="flex items-center gap-2 mt-2 ml-1">
                    <div className={`w-6 h-6 rounded-full bg-gradient-to-br flex items-center justify-center text-xs font-medium
                      ${isDark ? 'from-gray-600 to-gray-700 text-gray-300' : 'from-gray-200 to-gray-300 text-gray-600'}
                    `}>
                      <Bot className="w-3 h-3" />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                      {appData?.name || 'Assistant'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Enhanced loading indicator */}
        {isRunning && (
          <div className="flex justify-start w-full animate-in slide-in-from-bottom-2 duration-300">
            <div
              className={`max-w-[85%] p-4 rounded-2xl rounded-tl-md flex items-center gap-3 shadow-sm text-sm backdrop-blur-sm
                ${isDark ? 'bg-gray-800/90 text-gray-300 border border-gray-700/50' : 'bg-white text-gray-600 border border-gray-200/50'}
              `}
            >
              <div className="relative">
                <div className="w-5 h-5 border-2 border-current border-r-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-0 w-5 h-5 border border-current border-l-transparent rounded-full animate-ping opacity-20"></div>
              </div>
              <div className="flex flex-col">
                <span className="font-medium">Processing your request...</span>
                <span className="text-xs opacity-60">This may take a moment</span>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced error display */}
        {error && !isRunning && (
          <div className="flex justify-start w-full animate-in slide-in-from-bottom-2 duration-300">
            <div className="max-w-[85%] p-4 rounded-2xl rounded-tl-md bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border border-red-200 dark:border-red-800/30 shadow-sm text-sm backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertCircle className="w-3 h-3 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <div className="font-medium text-red-700 dark:text-red-400 mb-1">Error occurred</div>
                  <div className="text-red-600 dark:text-red-300">{error}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Enhanced success indicator */}
        {isSuccess && !isRunning && (
          <div className="flex justify-center my-6 animate-in zoom-in-95 duration-500">
            <div className="px-6 py-3 rounded-full bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 text-green-700 dark:text-green-400 flex items-center space-x-3 shadow-sm text-sm border border-green-200 dark:border-green-800/30 backdrop-blur-sm">
              <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-3 h-3" />
              </div>
              <span className="font-medium">Task completed successfully!</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render text & image inputs
  const renderInputSection = () => {
    if (isSimpleApp) {
      // Check if any input node is an image type
      const hasImageInput = inputNodes.some(node => node.type === 'imageInputNode');
      const previousContext = getPreviousContext();
      const canEnableChain = !hasImageInput && previousContext !== null;

      return (
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl blur-xl"></div>
          <div className="bg-white/80 dark:bg-gray-800/80 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-4 shadow-xl backdrop-blur-xl relative">
            {showChainWarning && (
              <div className="absolute bottom-full mb-3 left-0 right-0 p-4 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/50 dark:to-amber-900/50 border border-yellow-200 dark:border-yellow-800/50 rounded-xl text-sm text-yellow-800 dark:text-yellow-200 backdrop-blur-sm shadow-lg animate-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-semibold mb-2">Chain Mode Enabled</p>
                    <p className="text-xs opacity-90 leading-relaxed">This will include previous chat context in your request. For complex apps, this might lead to unexpected behavior or reduced performance.</p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <div className="relative">
                  <textarea
                    className="w-full p-4 pr-12 border rounded-xl focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 
                    bg-white/70 dark:bg-gray-800/70 text-gray-900 dark:text-white 
                    border-gray-200/50 dark:border-gray-700/50 resize-none min-h-[52px] max-h-[120px] 
                    text-sm transition-all backdrop-blur-sm placeholder:text-gray-500 dark:placeholder:text-gray-400
                    hover:bg-white/80 dark:hover:bg-gray-800/80 focus:bg-white dark:focus:bg-gray-800"
                    placeholder={
                      inputNodes[0]?.data?.config?.placeholder || 'Ask something...'
                    }
                    value={simpleInputValue}
                    onChange={handleSimpleInputChange}
                    onKeyDown={handleKeyDown}
                  />
                  {/* Character count indicator for long inputs */}
                  {simpleInputValue.length > 100 && (
                    <div className="absolute bottom-2 right-3 text-xs text-gray-400 dark:text-gray-500">
                      {simpleInputValue.length}
                    </div>
                  )}
                </div>
              </div>
              
              {canEnableChain && (
                <button
                  onClick={() => {
                    setChainEnabled(!chainEnabled);
                    setShowChainWarning(!showChainWarning);
                  }}
                  className={`h-[52px] w-[52px] flex items-center justify-center rounded-xl shadow-sm transition-all duration-200 group
                    border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm
                    ${
                      chainEnabled
                        ? isDark
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                          : 'bg-blue-50 text-blue-500 border-blue-200'
                        : 'bg-white/70 dark:bg-gray-800/70 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
                    }
                    hover:bg-opacity-90 hover:shadow-md active:scale-95 hover:scale-105
                  `}
                  title={chainEnabled ? 'Disable chain mode' : 'Enable chain mode'}
                >
                  <RotateCw className={`w-5 h-5 transition-all duration-300 ${chainEnabled ? 'rotate-180' : 'group-hover:rotate-12'}`} />
                </button>
              )}
              
              <button
                disabled={isRunning || simpleInputValue.trim() === ''}
                onClick={runApp}
                className={`h-[52px] w-[52px] flex items-center justify-center rounded-xl shadow-sm transition-all duration-200 group relative overflow-hidden
                  ${
                    isRunning || simpleInputValue.trim() === ''
                      ? 'bg-gray-400/50 cursor-not-allowed backdrop-blur-sm border border-gray-300/50'
                      : isDark
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-blue-500/20 hover:shadow-blue-500/30'
                        : 'bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-blue-500/20 hover:shadow-blue-500/30'
                  }
                  ${!(isRunning || simpleInputValue.trim() === '') ? 'hover:shadow-lg active:scale-95 hover:scale-105' : ''}
                `}
              >
                {/* Animated background for active state */}
                {!(isRunning || simpleInputValue.trim() === '') && (
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                )}
                {isRunning ? (
                  <div className="w-5 h-5 relative">
                    <div className="absolute inset-0 rounded-full border-2 border-white border-r-transparent animate-spin" />
                    <div className="absolute inset-0 rounded-full border border-white/30 border-l-transparent animate-ping" />
                  </div>
                ) : (
                  <Send className="w-5 h-5 text-white relative z-10 transition-transform group-hover:translate-x-0.5" />
                )}
              </button>
            </div>
            
            {chainEnabled && previousContext && (
              <div className="mt-4 p-3 bg-gradient-to-r from-gray-50/80 to-gray-100/80 dark:from-gray-900/50 dark:to-gray-800/50 rounded-xl border border-gray-200/50 dark:border-gray-700/50 text-xs backdrop-blur-sm animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <RotateCw className="w-2 h-2 text-blue-500" />
                  </div>
                  <span className="text-gray-600 dark:text-gray-400 font-medium">Previous context will be included:</span>
                </div>
                <div className="space-y-2 pl-6 border-l-2 border-gray-300/50 dark:border-gray-600/50">
                  <div className="text-gray-700 dark:text-gray-300">
                    <span className="font-medium text-gray-500 dark:text-gray-400">You:</span> {previousContext.userInput}
                  </div>
                  <div className="text-gray-700 dark:text-gray-300">
                    <span className="font-medium text-gray-500 dark:text-gray-400">Assistant:</span> {previousContext.botOutput.substring(0, 100)}{previousContext.botOutput.length > 100 ? '...' : ''}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    // If both text and image inputs, consider a horizontal layout
    const hasImageInput = inputNodes.some((node: AppNode) => node.type === 'imageInputNode');
    const hasTextInput = inputNodes.some((node: AppNode) => node.type === 'textInputNode');
    const useHorizontalLayout = hasImageInput && hasTextInput;

    return (
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-2xl blur-xl"></div>
        <div className="bg-white/80 dark:bg-gray-800/80 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl p-5 shadow-xl backdrop-blur-xl relative">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runApp();
            }}
          >
            <div
              className={`grid gap-5 ${
                useHorizontalLayout ? 'grid-cols-1 lg:grid-cols-7' : 'grid-cols-1'
              }`}
            >
              {inputNodes.map((node: AppNode) => {
                if (node.type === 'textInputNode') {
                  return (
                    <div
                      key={node.id}
                      className={useHorizontalLayout ? 'lg:col-span-5' : ''}
                    >
                      {node.data.label && (
                        <label className="block mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                          {node.data.label}
                          {node.data.config?.isRequired && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </label>
                      )}
                      <div className="relative">
                        <textarea
                          className="w-full p-4 border rounded-xl focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 
                          bg-white/70 dark:bg-gray-800/70 text-gray-900 dark:text-white 
                          border-gray-200/50 dark:border-gray-700/50 backdrop-blur-sm transition-all duration-200
                          hover:bg-white/80 dark:hover:bg-gray-800/80 focus:bg-white dark:focus:bg-gray-800
                          placeholder:text-gray-500 dark:placeholder:text-gray-400"
                          style={{ minHeight: useHorizontalLayout ? '140px' : '100px' }}
                          placeholder={node.data.config?.placeholder || 'Enter text...'}
                          value={(inputState[node.id] as string) || ''}
                          onChange={(e) => handleInputChange(node.id, e.target.value)}
                        />
                        {/* Character count for longer inputs */}
                        {((inputState[node.id] as string) || '').length > 50 && (
                          <div className="absolute bottom-3 right-3 text-xs text-gray-400 dark:text-gray-500 bg-white/80 dark:bg-gray-800/80 px-2 py-1 rounded-md backdrop-blur-sm">
                            {((inputState[node.id] as string) || '').length}
                          </div>
                        )}
                      </div>
                      {node.data.config?.description && (
                        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                          {node.data.config.description}
                        </p>
                      )}
                    </div>
                  );
                }
                if (node.type === 'imageInputNode') {
                  const hasImage = inputState[node.id] instanceof File || node.data.runtimeImage;
                  return (
                    <div
                      key={node.id}
                      className={useHorizontalLayout ? 'lg:col-span-2' : ''}
                    >
                      {node.data.label && (
                        <label className="block mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                          {node.data.label}
                          {node.data.config?.isRequired && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </label>
                      )}
                      <div className="flex justify-center w-full h-full">
                        <label
                          className={`
                            flex flex-col items-center justify-center w-full border-2 border-dashed rounded-xl cursor-pointer
                            transition-all duration-200 group relative overflow-hidden backdrop-blur-sm
                            ${
                              hasImage
                                ? 'border-blue-300 dark:border-blue-600/50 bg-blue-50/50 dark:bg-blue-900/20'
                                : 'border-gray-300 dark:border-gray-600/50 hover:border-blue-400 dark:hover:border-blue-500/50'
                            }
                            bg-white/70 dark:bg-gray-800/70 hover:bg-white/80 dark:hover:bg-gray-800/80
                            ${
                              useHorizontalLayout
                                ? 'h-[140px]'
                                : 'h-20'
                            }
                            hover:shadow-md hover:scale-[1.02] active:scale-[0.98]
                          `}
                        >
                          {/* Animated background gradient */}
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                          
                          {inputState[node.id] instanceof File ? (
                            <div
                              className={`flex items-center justify-center p-3 w-full h-full relative z-10 ${
                                useHorizontalLayout
                                  ? 'flex-col'
                                  : 'flex-row'
                              }`}
                            >
                              <div
                                className={`shrink-0 relative ${
                                  useHorizontalLayout
                                    ? 'w-16 h-16 mb-3'
                                    : 'w-12 h-12 mr-3'
                                }`}
                              >
                                <img
                                  src={URL.createObjectURL(
                                    inputState[node.id] as File
                                  )}
                                  alt="Preview"
                                  className="w-full h-full object-cover rounded-lg shadow-sm"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-lg"></div>
                              </div>
                              <div className="text-center">
                                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium truncate max-w-[120px]">
                                  {(inputState[node.id] as File).name}
                                </p>
                                <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-1 flex items-center justify-center gap-1">
                                  <ImageIcon className="w-3 h-3" />
                                  Click to replace
                                </p>
                              </div>
                            </div>
                          ) : node.data.runtimeImage ? (
                            <div
                              className={`flex items-center justify-center p-3 w-full h-full relative z-10 ${
                                useHorizontalLayout
                                  ? 'flex-col'
                                  : 'flex-row'
                              }`}
                            >
                              <div
                                className={`shrink-0 relative ${
                                  useHorizontalLayout
                                    ? 'w-16 h-16 mb-3'
                                    : 'w-12 h-12 mr-3'
                                }`}
                              >
                                <img
                                  src={node.data.runtimeImage}
                                  alt="Preview"
                                  className="w-full h-full object-cover rounded-lg shadow-sm"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent rounded-lg"></div>
                              </div>
                              <div className="text-center">
                                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                                  Image selected
                                </p>
                                <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-1 flex items-center justify-center gap-1">
                                  <ImageIcon className="w-3 h-3" />
                                  Click to replace
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`flex flex-col items-center justify-center p-4 relative z-10 ${
                                useHorizontalLayout ? 'py-8' : ''
                              }`}
                            >
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-200">
                                <ImageIcon className="w-5 h-5 text-blue-500" />
                              </div>
                              <p className="text-sm text-gray-600 dark:text-gray-400 text-center font-medium">
                                Drop an image here
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-500 text-center mt-1">
                                or click to browse
                              </p>
                            </div>
                          )}
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleImageUpload(node.id, e.target.files[0]);
                              }
                            }}
                          />
                        </label>
                      </div>
                      {node.data.config?.description && (
                        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                          {node.data.config.description}
                        </p>
                      )}
                    </div>
                  );
                }
                return null;
              })}
            </div>

            <div className={`${!hasTextInput ? 'flex justify-center' : 'flex justify-end'} mt-6`}>
              <button
                type="submit"
                disabled={isRunning || !isFormComplete}
                className={`flex items-center gap-3 px-8 py-3 rounded-xl text-sm font-medium shadow-sm transition-all duration-200 group relative overflow-hidden
                  ${!hasTextInput ? 'w-full max-w-[220px]' : ''}
                  ${
                    isRunning || !isFormComplete
                      ? 'bg-gray-400/50 text-white cursor-not-allowed backdrop-blur-sm border border-gray-300/50'
                      : isDark
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-blue-500/20 hover:shadow-blue-500/30'
                        : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-blue-500/20 hover:shadow-blue-500/30'
                  }
                  ${!(isRunning || !isFormComplete) ? 'hover:shadow-lg active:scale-95 hover:scale-105' : ''}
                `}
              >
                {/* Animated background shimmer */}
                {!(isRunning || !isFormComplete) && (
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                )}
                {isRunning ? (
                  <>
                    <div className="w-5 h-5 relative">
                      <div className="absolute inset-0 rounded-full border-2 border-white border-r-transparent animate-spin" />
                      <div className="absolute inset-0 rounded-full border border-white/30 border-l-transparent animate-ping" />
                    </div>
                    <span className="relative z-10">Processing...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 relative z-10 transition-transform group-hover:translate-x-1" />
                    <span className="relative z-10">{!hasTextInput ? 'Generate' : 'Send Message'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Loading screen
  if (isLoading) {
    return (
      <div className="flex h-screen">
        <Sidebar activePage={activePage} onPageChange={onBack} />
        <div className="flex-1 flex flex-col">
          <Topbar userName={appData?.name || 'App Runner'} />
          <div
            className="flex-1 flex items-center justify-center"
            style={gradientStyle}
          >
            <div className="flex flex-col items-center">
              <div
                className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2"
                style={{ borderColor: appData?.color || '#3B82F6' }}
              />
              <p className="mt-4 text-gray-600 dark:text-gray-400">
                Loading app...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error screen for app load issues
  if (error && !appData) {
    return (
      <div className="flex h-screen">
        <Sidebar activePage={activePage} onPageChange={onBack} />
        <div className="flex-1 flex flex-col">
          <Topbar userName="App Error" />
          <div
            className="flex-1 flex items-center justify-center"
            style={gradientStyle}
          >
            <div className="text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-8 rounded-xl shadow-md">
              <div className="flex justify-center">
                <div className="bg-red-100 dark:bg-red-900/20 p-2 rounded-full">
                  <svg
                    className="w-8 h-8 text-red-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
              </div>
              <h2 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">
                {error}
              </h2>
              <button
                onClick={onBack}
                className="mt-6 px-4 py-2 text-white rounded-md hover:opacity-90 transition-colors"
                style={{ backgroundColor: appData?.color || '#3B82F6' }}
              >
                Back to Apps
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main UI
  return (
    <OllamaProvider>
      <div className="flex h-screen">
        <Sidebar activePage={activePage} onPageChange={onBack} />
        <div className="flex-1 flex flex-col">
          <Topbar userName={appData?.name || 'App Runner'} />
          <div className="flex-1 overflow-hidden flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
            {/* Header / Info Section */}
            <div className="bg-white/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 m-4 p-5 rounded-2xl flex items-center justify-between shadow-lg backdrop-blur-xl relative overflow-hidden">
              {/* Animated background pattern */}
              <div className="absolute inset-0 opacity-30">
                <div 
                  className="absolute inset-0 bg-gradient-to-r opacity-10" 
                  style={{ background: `linear-gradient(135deg, ${appData?.color || '#3B82F6'}20, transparent 50%, ${appData?.color || '#3B82F6'}10)` }}
                ></div>
              </div>
              
              <div className="flex items-center gap-4 relative z-10">
                <div className="relative group">
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center shadow-md bg-gradient-to-br transition-transform group-hover:scale-105 duration-200"
                    style={{ 
                      background: `linear-gradient(135deg, ${appData?.color || '#3B82F6'}, ${appData?.color || '#3B82F6'}cc)`
                    }}
                  >
                    {appData?.icon &&
                      React.createElement(iconMap[appData.icon] || Activity, {
                        className: 'w-7 h-7 text-white drop-shadow-sm',
                      })}
                  </div>
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {appData?.name}
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-1 max-w-md">
                    {appData?.description}
                  </p>
                </div>
              </div>
              <button
                onClick={onBack}
                className="flex items-center gap-3 px-5 py-2.5 rounded-xl text-gray-700 dark:text-gray-300
                  hover:bg-white/70 dark:hover:bg-gray-700/50 transition-all duration-200 backdrop-blur-sm
                  border border-gray-200/50 dark:border-gray-600/50 hover:shadow-md active:scale-95 group relative z-10"
              >
                <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
                <span className="font-medium">Back to Apps</span>
              </button>
            </div>

            {/* Main Output Section */}
            <div
              ref={outputSectionRef}
              className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth"
            >
              <div className="container mx-auto max-w-4xl">
                {renderOutputs()}
                <div ref={messagesEndRef} />
              </div>

              {/* Enhanced scroll-to-top button */}
              {showScrollTop && (
                <button
                  onClick={scrollToTop}
                  className="fixed bottom-28 right-6 p-4 rounded-2xl shadow-xl z-20 group
                  opacity-90 hover:opacity-100 transition-all duration-300 hover:shadow-2xl active:scale-95 hover:scale-105
                  bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-300 backdrop-blur-xl
                  border border-gray-200/50 dark:border-gray-700/50"
                >
                  <div className="relative">
                    <svg
                      className="w-5 h-5 transition-transform group-hover:-translate-y-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                    {/* Subtle glow effect */}
                    <div 
                      className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-md"
                      style={{ background: appData?.color || '#3B82F6' }}
                    ></div>
                  </div>
                </button>
              )}
            </div>

            {/* Input Section */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50 backdrop-blur-sm">
              <div className="container mx-auto max-w-4xl">
                {renderInputSection()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </OllamaProvider>
  );
};

export default AppRunner;
