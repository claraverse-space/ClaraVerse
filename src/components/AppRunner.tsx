import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ArrowLeft, Play, Loader, Check, ImageIcon, Send,
  // Import all icon components that might be used by apps
  Activity, FileText, Code, MessageSquare, Database, Globe,
  Sparkles, Zap, User, Settings, BarChart2 as Chart, Search, Bot, Brain,
  Command, Book, Layout, Compass
} from 'lucide-react';
import { appStore } from '../services/AppStore';
import { executeFlow, generateExecutionPlan } from '../ExecutionEngine';
import { Node, Edge } from 'reactflow';
import { useTheme } from '../hooks/useTheme';
import ReactMarkdown from 'react-markdown';
import { OllamaProvider } from '../context/OllamaContext';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

// Create an icon mapping for dynamic access
const iconMap: Record<string, React.ElementType> = {
  Activity, FileText, Code, Image: ImageIcon, MessageSquare, Database, Globe,
  Sparkles, Zap, User, Settings, Chart, Search, Bot, Brain,
  Command, Book, Layout, Compass
};

interface AppRunnerProps {
  appId: string;
  onBack: () => void;
}

interface InputState {
  [nodeId: string]: string | File | null;
}

interface ChatMessage {
  id: string;
  content: any;
  type: 'user' | 'ai';
  timestamp: number;
  isImage?: boolean;
}

const AppRunner: React.FC<AppRunnerProps> = ({ appId, onBack }) => {
  const { isDark } = useTheme();
  const [appData, setAppData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [inputState, setInputState] = useState<InputState>({});
  const [outputState, setOutputState] = useState<{[nodeId: string]: any}>({});
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const outputSectionRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [simpleInputValue, setSimpleInputValue] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activePage, setActivePage] = useState('apps');
  const [messageHistory, setMessageHistory] = useState<ChatMessage[]>([]);
  
  // Background gradient variants based on app color
  const gradientStyle = useMemo(() => {
    const color = appData?.color || '#3B82F6';
    return {
      background: `linear-gradient(135deg, ${color}10, ${isDark ? '#1f293780' : '#f9fafb80'})`,
    };
  }, [appData?.color, isDark]);

  // Auto-scroll to bottom when messages change - must be defined here, not conditionally
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messageHistory]);

  // Load app data
  useEffect(() => {
    const loadApp = async () => {
      try {
        setIsLoading(true);
        const app = await appStore.getApp(appId);
        if (app) {
          setAppData(app);
          
          // Initialize input state for input nodes
          const inputNodes = app.nodes.filter((node: Node) => 
            node.type === 'textInputNode' || node.type === 'imageInputNode'
          );
          
          const initialInputs = inputNodes.reduce((acc: InputState, node: Node) => {
            acc[node.id] = '';
            return acc;
          }, {});
          
          setInputState(initialInputs);
        } else {
          setError("App not found");
        }
      } catch (err) {
        setError("Failed to load app");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadApp();
  }, [appId]);

  // Analyze app structure to determine flow pattern
  const { inputNodes, outputNodes, processingNodes } = useMemo(() => {
    if (!appData) {
      return { inputNodes: [], outputNodes: [], processingNodes: [] };
    }
    
    const inputs = appData.nodes.filter((node: Node) => 
      node.type === 'textInputNode' || node.type === 'imageInputNode'
    );
    
    const outputs = appData.nodes.filter((node: Node) => 
      node.type === 'textOutputNode' || node.type === 'markdownOutputNode'
    );
    
    const processing = appData.nodes.filter((node: Node) => 
      !inputs.includes(node) && !outputs.includes(node)
    );
    
    return { 
      inputNodes: inputs, 
      outputNodes: outputs,
      processingNodes: processing
    };
  }, [appData]);
  
  const isSimpleApp = useMemo(() => {
    return inputNodes.length === 1 && 
           outputNodes.length >= 1 && 
           inputNodes[0].type === 'textInputNode';
  }, [inputNodes, outputNodes]);
  
  const isFormComplete = useMemo(() => {
    if (!inputNodes.length) return true;
    return Object.entries(inputState).every(([nodeId, value]) => {
      const node = inputNodes.find((n: Node) => n.id === nodeId);
      if (!node) return true;
      if (node.type === 'textInputNode') {
        return typeof value === 'string' && value.trim() !== '';
      }
      if (node.type === 'imageInputNode') {
        return value instanceof File;
      }
      return true;
    });
  }, [inputState, inputNodes]);

  // Scroll handling
  useEffect(() => {
    const handleScroll = () => {
      if (outputSectionRef.current) {
        setShowScrollTop(outputSectionRef.current.scrollTop > 300);
      }
    };
    
    const outputSection = outputSectionRef.current;
    if (outputSection) {
      outputSection.addEventListener('scroll', handleScroll);
      return () => {
        outputSection.removeEventListener('scroll', handleScroll);
      };
    }
  }, []);
  
  const scrollToTop = () => {
    outputSectionRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Handle input changes
  const handleInputChange = (nodeId: string, value: string | File | null) => {
    // Process value based on type
    let processedValue = value;
    
    // If this is a File object, just store the file object
    if (value instanceof File) {
      // Don't process file objects
    } else if (typeof value === 'string') {
      // For text inputs, preserve all spaces and line breaks
      processedValue = value;
    }
    
    setInputState(prev => ({
      ...prev,
      [nodeId]: processedValue
    }));
    
    console.log(`Updated input for node ${nodeId}:`, processedValue);
  };

  const handleImageUpload = (nodeId: string, file: File) => {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const imageData = event.target.result;
        
        // Update the app data nodes with the runtime image
        setAppData((prevAppData: any) => {
          const updatedNodes = prevAppData.nodes.map((node: Node) => {
            if (node.id === nodeId) {
              return {
                ...node,
                data: {
                  ...node.data,
                  runtimeImage: imageData
                }
              };
            }
            return node;
          });
          
          return {
            ...prevAppData,
            nodes: updatedNodes
          };
        });
        
        // Also update the input state for UI tracking
        setInputState(prev => ({
          ...prev,
          [nodeId]: file
        }));
        
        console.log(`Updated runtime image for node ${nodeId}`);
      }
    };
    
    reader.readAsDataURL(file);
  };

  // Handle simple input for chat-like interface
  const handleSimpleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setSimpleInputValue(e.target.value);
    
    // Also update the input node state
    if (inputNodes.length === 1) {
      handleInputChange(inputNodes[0].id, e.target.value);
    }
  };

  // Add a separate key down handler to ensure Enter key is processed properly
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent default to avoid newline in textarea
      
      if (!isRunning && simpleInputValue.trim() !== '') {
        console.log("Enter key pressed - running app with input:", simpleInputValue);
        runApp();
      }
      return false;
    }
  };

  // Run the app
  const runApp = async () => {
    setIsRunning(true);
    setError(null);
    setIsSuccess(false);
    
    try {
      // Create a message for user input
      const userInputs: any[] = [];
      
      // For simple input mode with single text node
      if (isSimpleApp && inputNodes.length === 1) {
        setInputState(prev => ({
          ...prev,
          [inputNodes[0].id]: simpleInputValue
        }));
        userInputs.push(simpleInputValue);
      } 
      // For more complex inputs, include all non-empty inputs
      else {
        inputNodes.forEach(node => {
          const input = inputState[node.id];
          if (input) {
            if (node.type === 'imageInputNode' && input instanceof File) {
              userInputs.push(`[Image: ${input.name}]`);
            } else if (typeof input === 'string' && input.trim() !== '') {
              userInputs.push(input);
            }
          }
        });
      }
      
      // Add user message to history
      const userMessageId = `user-${Date.now()}`;
      setMessageHistory(prev => [
        ...prev,
        {
          id: userMessageId,
          content: userInputs.length === 1 ? userInputs[0] : userInputs.join('\n'),
          type: 'user',
          timestamp: Date.now(),
          isImage: inputNodes.some(node => node.type === 'imageInputNode' && inputState[node.id] instanceof File)
        }
      ]);
      
      // Clone the app data to avoid modifying the original
      const appDataClone = JSON.parse(JSON.stringify(appData));
      
      // Update input node configurations with user input values
      appDataClone.nodes = appDataClone.nodes.map((node: Node) => {
        if (inputState[node.id] !== undefined) {
          if (node.type === 'textInputNode') {
            // Update text input config directly
            return {
              ...node,
              data: {
                ...node.data,
                config: {
                  ...node.data.config,
                  text: inputState[node.id]
                }
              }
            };
          } else if (node.type === 'imageInputNode') {
            // For image nodes, use either runtimeImage or config.image
            // We don't modify config.image at runtime, we use runtimeImage instead
            return {
              ...node,
              data: {
                ...node.data,
                // Preserve runtimeImage if it exists (it was set when user uploaded an image)
                runtimeImage: node.data.runtimeImage || node.data.config?.image
              }
            };
          }
        }
        return node;
      });
      
      // Update the app with the new input values temporarily
      await appStore.tempUpdateAppNodes(appId, appDataClone.nodes);
      
      // Generate execution plan and run it
      const plan = generateExecutionPlan(appDataClone.nodes, appDataClone.edges);
      
      // Custom callback to update UI and add to message history
      const updateNodeOutput = (nodeId: string, output: any) => {
        setOutputState(prev => ({
          ...prev, 
          [nodeId]: output
        }));
        
        // Only add outputs from output nodes to the message history
        const node = outputNodes.find(n => n.id === nodeId);
        if (node) {
          setMessageHistory(prev => [
            ...prev,
            {
              id: `ai-${Date.now()}-${nodeId}`,
              content: output,
              type: 'ai',
              timestamp: Date.now()
            }
          ]);
        }
      };
      
      // Run the flow
      await executeFlow(plan, updateNodeOutput);
      setIsSuccess(true);
      
      // Clear simple input after successful run
      if (isSimpleApp) {
        setSimpleInputValue('');
      }
    } catch (err) {
      console.error('Error running app:', err);
      setError(err instanceof Error ? err.message : "An error occurred while running the app");
      
      // Add error to message history
      setMessageHistory(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          content: err instanceof Error ? err.message : "An error occurred while running the app",
          type: 'ai',
          timestamp: Date.now()
        }
      ]);
    } finally {
      setIsRunning(false);
    }
  };

  // Format the output for markdown rendering
  const formatOutputForMarkdown = (output: any): string => {
    if (typeof output === 'string') return output;
    try {
      return JSON.stringify(output, null, 2);
    } catch (e) {
      return String(output);
    }
  };

  // Replace renderOutputs with chat-like message history display
  const renderOutputs = () => {
    if (messageHistory.length === 0 && !isRunning) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-opacity-20" style={{backgroundColor: appData?.color || '#3B82F6'}}>
            {React.createElement(iconMap[appData?.icon || 'Activity'], { 
              className: "w-8 h-8 m-4", 
              style: { color: appData?.color || '#3B82F6' } 
            })}
          </div>
          <h3 className="text-xl font-medium text-gray-900 dark:text-white">
            Send a message to start
          </h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md">
            {appData?.description || "Enter your information and run the app to get started."}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6 flex flex-col">
        {/* Message history */}
        {messageHistory.map((message, index) => {
          const isUserMessage = message.type === 'user';
          
          return (
            <div 
              key={message.id}
              className={`flex ${isUserMessage ? 'justify-end' : 'justify-start'} w-full mb-4`}
            >
              <div 
                className={`max-w-[85%] p-4 rounded-xl ${
                  isUserMessage 
                    ? 'bg-opacity-80 rounded-tr-none ml-auto' 
                    : 'bg-opacity-80 rounded-tl-none mr-auto'
                } ${
                  isUserMessage
                    ? isDark 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-blue-500 text-white'
                    : isDark 
                      ? 'bg-gray-800 text-white' 
                      : 'bg-white text-gray-900'
                } shadow-sm`}
                style={{
                  borderColor: isUserMessage ? appData?.color : undefined
                }}
              >
                {isUserMessage ? (
                  message.isImage ? (
                    <div className="prose dark:prose-invert max-w-none">
                      <p>{message.content}</p>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  )
                ) : (
                  <div className="prose dark:prose-invert prose-md max-w-none dark-mode-prose">
                    <ReactMarkdown>{formatOutputForMarkdown(message.content)}</ReactMarkdown>
                  </div>
                )}
                <div className={`text-xs ${isUserMessage ? 'text-blue-200 dark:text-blue-300' : 'text-gray-400 dark:text-gray-500'} mt-2 text-right`}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          );
        })}
        
        {/* Loading indicator for in-progress responses */}
        {isRunning && (
          <div className="flex justify-start w-full">
            <div className={`max-w-[85%] p-4 rounded-xl bg-opacity-80 rounded-tl-none ${
              isDark ? 'bg-gray-800' : 'bg-white'
            } shadow-sm flex items-center gap-2`}>
              <div className="animate-pulse">
                <Loader className="w-5 h-5 text-gray-500 dark:text-gray-400 animate-spin" />
              </div>
              <div className="text-gray-500 dark:text-gray-400">
                Processing...
              </div>
            </div>
          </div>
        )}
        
        {/* Error display */}
        {error && !isRunning && !messageHistory.some(m => m.content === error && m.type === 'ai') && (
          <div className="flex justify-start w-full">
            <div className="max-w-[85%] p-4 rounded-xl bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 shadow-sm">
              {error}
            </div>
          </div>
        )}
        
        {/* Success indicator */}
        {isSuccess && !isRunning && (
          <div className="flex justify-center my-2">
            <div className="px-4 py-2 rounded-full bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center space-x-2 shadow-sm text-sm">
              <Check className="w-4 h-4" />
              <span>Completed</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render all outputs in a unified markdown format
  const renderInputSection = () => {
    if (isSimpleApp) {
      return (
        <div className="glassmorphic rounded-xl p-3 shadow-lg">
          <div className="flex items-center gap-2">
            <textarea
              className="flex-1 p-2.5 border rounded-lg focus:ring-1 focus:ring-opacity-50 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 resize-none min-h-[40px] max-h-[120px] text-sm"
              style={{ 
                focusRing: appData?.color || '#3B82F6',
                borderRadius: '0.75rem'
              }}
              placeholder={inputNodes[0]?.data?.config?.placeholder || "Ask something..."}
              value={simpleInputValue}
              onChange={handleSimpleInputChange}
              onKeyDown={handleKeyDown}
            />
            <button
              disabled={isRunning || simpleInputValue.trim() === ''}
              onClick={runApp}
              className={`h-[40px] w-[40px] flex items-center justify-center rounded-lg shadow-sm ${
                isRunning || simpleInputValue.trim() === ''
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'text-white hover:opacity-90'
              } transition-colors`}
              style={{ 
                backgroundColor: isRunning || simpleInputValue.trim() === '' ? undefined : appData?.color || '#3B82F6'
              }}
            >
              {isRunning ? (
                <Loader className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Send className="w-4 h-4 text-white" />
              )}
            </button>
          </div>
        </div>
      );
    }

    // Check if we have both image and text inputs for a horizontal layout
    const hasImageInput = inputNodes.some(node => node.type === 'imageInputNode');
    const hasTextInput = inputNodes.some(node => node.type === 'textInputNode');
    const useHorizontalLayout = hasImageInput && hasTextInput;

    return (
      <div className="glassmorphic rounded-xl p-4 shadow-lg">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runApp();
          }}
        >
          <div className={`grid ${useHorizontalLayout ? 'grid-cols-1 md:grid-cols-7 gap-4' : 'grid-cols-1 gap-3'}`}>
            {inputNodes.map((node: Node) => {
              switch (node.type) {
                case 'textInputNode':
                  return (
                    <div key={node.id} className={useHorizontalLayout ? "md:col-span-5" : ""}>
                      {node.data.label && (
                        <label className="block mb-1 text-sm font-medium text-gray-900 dark:text-white">
                          {node.data.label}
                          {node.data.config?.isRequired && <span className="text-red-500 ml-1">*</span>}
                        </label>
                      )}
                      <div className="relative">
                        <textarea
                          className="w-full p-2.5 text-sm border rounded-lg focus:ring-1 focus:ring-opacity-50 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                          style={{ 
                            focusRing: appData?.color || '#3B82F6',
                            minHeight: useHorizontalLayout ? '120px' : '80px'
                          }}
                          placeholder={node.data.config?.placeholder || "Enter text here..."}
                          value={inputState[node.id] as string || ''}
                          onChange={(e) => handleInputChange(node.id, e.target.value)}
                        />
                      </div>
                      {node.data.config?.description && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{node.data.config.description}</p>
                      )}
                    </div>
                  );
                  
                case 'imageInputNode':
                  return (
                    <div key={node.id} className={useHorizontalLayout ? "md:col-span-2" : ""}>
                      {node.data.label && (
                        <label className="block mb-1 text-sm font-medium text-gray-900 dark:text-white">
                          {node.data.label}
                          {node.data.config?.isRequired && <span className="text-red-500 ml-1">*</span>}
                        </label>
                      )}
                      <div className="flex justify-center w-full h-full">
                        <label className={`
                          flex flex-col items-center justify-center w-full border border-dashed 
                          rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700
                          bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600
                          transition-all duration-200
                          ${useHorizontalLayout ? 'h-[120px]' : 'h-16'}
                        `}>
                          {inputState[node.id] instanceof File ? (
                            <div className={`flex ${useHorizontalLayout ? 'flex-col' : 'flex-row'} items-center justify-center h-full w-full p-2`}>
                              <div className={`${useHorizontalLayout ? 'w-16 h-16 mb-2' : 'w-10 h-10 mr-3'} shrink-0`}>
                                <img
                                  src={URL.createObjectURL(inputState[node.id] as File)}
                                  alt="Preview"
                                  className="w-full h-full object-cover rounded"
                                />
                              </div>
                              <div className={`${useHorizontalLayout ? 'text-center' : 'text-left'}`}>
                                <p className="text-xs text-gray-500 dark:text-gray-400 truncate max-w-[140px]">
                                  {(inputState[node.id] as File).name}
                                </p>
                                <p className="text-xs text-blue-500 dark:text-blue-400 font-medium mt-1">
                                  Click to replace
                                </p>
                              </div>
                            </div>
                          ) : node.data.runtimeImage ? (
                            <div className={`flex ${useHorizontalLayout ? 'flex-col' : 'flex-row'} items-center justify-center h-full w-full p-2`}>
                              <div className={`${useHorizontalLayout ? 'w-16 h-16 mb-2' : 'w-10 h-10 mr-3'} shrink-0`}>
                                <img
                                  src={node.data.runtimeImage}
                                  alt="Preview"
                                  className="w-full h-full object-cover rounded"
                                />
                              </div>
                              <div className={`${useHorizontalLayout ? 'text-center' : 'text-left'}`}>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  Image selected
                                </p>
                                <p className="text-xs text-blue-500 dark:text-blue-400 font-medium mt-1">
                                  Click to replace
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className={`flex flex-col items-center justify-center p-2 ${useHorizontalLayout ? 'py-4' : ''}`}>
                              <ImageIcon className={`${useHorizontalLayout ? 'w-8 h-8 mb-2' : 'w-5 h-5 mb-1'} text-gray-400`} />
                              <p className="text-xs text-center text-gray-500 dark:text-gray-400 px-2">
                                {useHorizontalLayout ? 'Click to upload an image' : 'Upload image'}
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
                      {node.data.config?.description && !useHorizontalLayout && (
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{node.data.config.description}</p>
                      )}
                    </div>
                  );
                  
                default:
                  return null;
              }
            })}
          </div>
          
          <div className="flex justify-end mt-4">
            <button
              type="submit"
              disabled={isRunning || !isFormComplete}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm shadow-sm ${
                isRunning || !isFormComplete
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'hover:opacity-90'
              } transition-colors`}
              style={{ 
                backgroundColor: isRunning || !isFormComplete ? undefined : appData?.color || '#3B82F6'
              }}
            >
              {isRunning ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-screen">
        <Sidebar activePage={activePage} onPageChange={onBack} />
        <div className="flex-1 flex flex-col">
          <Topbar userName={appData?.name || "App Runner"} />
          <div className="flex-1 flex items-center justify-center" style={gradientStyle}>
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2" style={{ borderColor: appData?.color || '#3B82F6' }}></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading app...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && !appData) {
    return (
      <div className="flex h-screen">
        <Sidebar activePage={activePage} onPageChange={onBack} />
        <div className="flex-1 flex flex-col">
          <Topbar userName="App Error" />
          <div className="flex-1 flex items-center justify-center" style={gradientStyle}>
            <div className="text-center glassmorphic p-8 rounded-xl">
              <div className="flex justify-center">
                <div className="bg-red-100 dark:bg-red-900/20 p-2 rounded-full">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
              <h2 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">{error}</h2>
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

  return (
    <OllamaProvider>
      <div className="flex h-screen">
        <Sidebar activePage={activePage} onPageChange={onBack} />
        <div className="flex-1 flex flex-col">
          <Topbar userName={appData?.name || "App Runner"} />
          <div className="flex-1 overflow-hidden flex flex-col" style={gradientStyle}>
            {/* App Info Bar */}
            <div className="glassmorphic m-4 p-4 rounded-xl flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center shadow-sm"
                  style={{ backgroundColor: appData?.color || '#3B82F6' }}
                >
                  {appData?.icon && (
                    React.createElement(iconMap[appData.icon] || Activity, { 
                      className: "w-6 h-6 text-white" 
                    })
                  )}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">{appData?.name}</h1>
                  <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-1">{appData?.description}</p>
                </div>
              </div>
              <button
                onClick={onBack}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/10 text-gray-700 dark:text-gray-300"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Back to Apps</span>
              </button>
            </div>
            
            {/* Output Section - Scrollable area */}
            <div 
              ref={outputSectionRef}
              className="flex-1 overflow-y-auto px-4 py-2 scroll-smooth"
            >
              <div className="container mx-auto max-w-4xl">
                {renderOutputs()}
                <div ref={messagesEndRef} />
              </div>
              
              {/* Scroll to top button */}
              {showScrollTop && (
                <button
                  onClick={scrollToTop}
                  className="fixed bottom-24 right-6 p-2 rounded-full shadow-lg z-10 opacity-90 hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: appData?.color || '#3B82F6' }}
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
              )}
            </div>
            
            {/* Input Section - Fixed at bottom */}
            <div className="p-4">
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
