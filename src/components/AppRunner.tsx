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
  const [simpleInputValue, setSimpleInputValue] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [activePage, setActivePage] = useState('apps');
  
  // Background gradient variants based on app color
  const gradientStyle = useMemo(() => {
    const color = appData?.color || '#3B82F6';
    return {
      background: `linear-gradient(135deg, ${color}10, ${isDark ? '#1f293780' : '#f9fafb80'})`,
    };
  }, [appData?.color, isDark]);

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
    
    // If this is a File object and intended for image handling, convert to base64
    if (value instanceof File) {
      // Don't convert to base64 here, just store the file object
      // The executor will handle the file correctly
    } else if (typeof value === 'string') {
      // For text inputs, ensure we're storing a clean string
      processedValue = value.trim();
    }
    
    setInputState(prev => ({
      ...prev,
      [nodeId]: processedValue
    }));
    
    // Log to verify what's being stored
    console.log(`Updated input for node ${nodeId}:`, processedValue);
  };

// Add this function after the handleInputChange function
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
      // For simple input mode, make sure we sync the values
      if (isSimpleApp && inputNodes.length === 1) {
        setInputState(prev => ({
          ...prev,
          [inputNodes[0].id]: simpleInputValue
        }));
      }
      
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
      
      // Callback to update UI when nodes produce output
      const updateNodeOutput = (nodeId: string, output: any) => {
        setOutputState(prev => ({
          ...prev,
          [nodeId]: output
        }));
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

  // Render all outputs in a unified markdown format
  const renderOutputs = () => {
    if (Object.keys(outputState).length === 0 && !isRunning) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-opacity-20" style={{backgroundColor: appData?.color || '#3B82F6'}}>
            {React.createElement(iconMap[appData?.icon || 'Activity'], { 
              className: "w-8 h-8 m-4", 
              style: { color: appData?.color || '#3B82F6' } 
            })}
          </div>
          <h3 className="text-xl font-medium text-gray-900 dark:text-white">
            Run this app to see results
          </h3>
          <p className="text-gray-600 dark:text-gray-400 max-w-md">
            {appData?.description || "Enter your information and run the app to get started."}
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {isRunning && (
          <div className="flex items-center justify-center py-8 animate-pulse">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{backgroundColor: appData?.color || '#3B82F6'}}>
              <Loader className="w-6 h-6 text-white animate-spin" />
            </div>
            <p className="ml-3 text-gray-600 dark:text-gray-400">Processing your request...</p>
          </div>
        )}
        {outputNodes.map((node: Node) => {
          const output = outputState[node.id];
          if (!output && !isRunning) return null;
          
          return (
            <div 
              key={node.id}
              className="glassmorphic rounded-xl p-6 transition-all duration-300 shadow-lg markdown-wrapper"
              style={{
                borderLeft: `4px solid ${appData?.color || '#3B82F6'}`
              }}
            >
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                {node.data.label || "Result"}
              </h3>
              <div className="prose dark:prose-invert prose-md max-w-none dark-mode-prose">
                {isRunning && !output ? (
                  <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Generating response...</span>
                  </div>
                ) : (
                  <ReactMarkdown>{formatOutputForMarkdown(output)}</ReactMarkdown>
                )}
              </div>
            </div>
          );
        })}
        {isSuccess && (
          <div className="flex items-center justify-center py-2">
            <div className="px-4 py-2 rounded-full bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center space-x-2 shadow-sm">
              <Check className="w-4 h-4" />
              <span className="text-sm font-medium">Completed successfully</span>
            </div>
          </div>
        )}
        {error && (
          <div className="glassmorphic rounded-xl p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-800 text-red-700 dark:text-red-400">
            <p>{error}</p>
          </div>
        )}
      </div>
    );
  };

  // Render simple chat-like interface or full form based on app structure
  const renderInputSection = () => {
    if (isSimpleApp) {
      return (
        <div className="glassmorphic rounded-xl p-3 shadow-lg">
          <div className="flex items-center gap-2">
            <textarea
              className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-opacity-50 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 resize-none min-h-[48px] max-h-[120px] overflow-y-auto"
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
              className={`h-[48px] w-[48px] flex items-center justify-center rounded-lg shadow-sm ${
                isRunning || simpleInputValue.trim() === ''
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'text-white hover:opacity-90'
              } transition-colors`}
              style={{ 
                backgroundColor: isRunning || simpleInputValue.trim() === '' ? undefined : appData?.color || '#3B82F6'
              }}
            >
              {isRunning ? (
                <Loader className="w-5 h-5 animate-spin text-white" />
              ) : (
                <Send className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="glassmorphic rounded-xl p-6 shadow-lg">
        <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
          {inputNodes.length > 0 ? "Enter Your Information" : "Run the App"}
        </h2>
        
        <form
          onSubmit={(e) => {
            e.preventDefault();
            runApp();
          }}
        >
          {inputNodes.map((node: Node) => {
            switch (node.type) {
              case 'textInputNode':
                return (
                  <div key={node.id} className="mb-6">
                    <label className="block mb-2 font-medium text-gray-900 dark:text-white">
                      {node.data.label || "Text Input"}
                      {node.data.config?.isRequired && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <div className="relative">
                      <textarea
                        className="w-full p-4 border rounded-lg focus:ring-2 focus:ring-opacity-50 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                        style={{ 
                          focusRing: appData?.color || '#3B82F6'
                        }}
                        rows={4}
                        placeholder={node.data.config?.placeholder || "Enter text here..."}
                        value={inputState[node.id] as string || ''}
                        onChange={(e) => handleInputChange(node.id, e.target.value)}
                      />
                    </div>
                    {node.data.config?.description && (
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{node.data.config.description}</p>
                    )}
                  </div>
                );
                
              case 'imageInputNode':
                return (
                  <div key={node.id} className="mb-6">
                    <label className="block mb-2 font-medium text-gray-900 dark:text-white">
                      {node.data.label || "Image Input"}
                      {node.data.config?.isRequired && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <div className="flex items-center justify-center w-full">
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                        {inputState[node.id] instanceof File ? (
                          <div className="flex flex-col items-center justify-center py-2">
                            <div className="relative w-16 h-16 mb-2">
                              <img
                                src={URL.createObjectURL(inputState[node.id] as File)}
                                alt="Preview"
                                className="w-full h-full object-cover rounded"
                              />
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {(inputState[node.id] as File).name}
                            </p>
                          </div>
                        ) : node.data.runtimeImage ? (
                          <div className="flex flex-col items-center justify-center py-2">
                            <div className="relative w-16 h-16 mb-2">
                              <img
                                src={node.data.runtimeImage}
                                alt="Preview"
                                className="w-full h-full object-cover rounded"
                              />
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Current image
                            </p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-2">
                            <ImageIcon className="w-8 h-8 mb-2 text-gray-500 dark:text-gray-400" />
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              Click to upload image
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
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{node.data.config.description}</p>
                    )}
                  </div>
                );
                
              default:
                return null;
            }
          })}
          <div className="flex justify-end mt-6">
            <button
              type="submit"
              disabled={isRunning || !isFormComplete}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-white ${
                isRunning || !isFormComplete
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
              } transition-colors`}
              style={{ 
                backgroundColor: isRunning || !isFormComplete ? undefined : appData?.color || '#3B82F6'
              }}
            >
              {isRunning ? (
                <>
                  <Loader className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run
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
