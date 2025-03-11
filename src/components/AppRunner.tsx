import React, { useState, useEffect, useMemo } from 'react';
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
  
  // Background gradient variants based on app color
  const gradientStyle = useMemo(() => {
    const color = appData?.color || '#3B82F6';
    return {
      background: `linear-gradient(135deg, ${color}15, ${color}05)`,
    };
  }, [appData?.color]);

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

  // Handle input changes
  const handleInputChange = (nodeId: string, value: string | File | null) => {
    setInputState(prev => ({
      ...prev,
      [nodeId]: value
    }));
  };

  // Run the app
  const runApp = async () => {
    setIsRunning(true);
    setError(null);
    setIsSuccess(false);
    setOutputState({});
    
    try {
      // Build a new version of nodes with the input values set
      const nodesWithInputs = appData.nodes.map((node: Node) => {
        if (inputState[node.id] !== undefined) {
          return {
            ...node,
            data: {
              ...node.data,
              config: {
                ...node.data.config,
                // Set appropriate config based on node type
                ...(node.type === 'textInputNode' ? { inputText: inputState[node.id] } : {}),
                ...(node.type === 'imageInputNode' ? { imageData: inputState[node.id] } : {})
              }
            }
          };
        }
        return node;
      });
      
      // Generate execution plan and run it
      const plan = generateExecutionPlan(nodesWithInputs, appData.edges);
      
      // Callback to update UI when nodes produce output
      const updateNodeOutput = (nodeId: string, output: any) => {
        setOutputState(prev => ({
          ...prev,
          [nodeId]: output
        }));
      };
      
      await executeFlow(plan, updateNodeOutput);
      setIsSuccess(true);
    } catch (err) {
      console.error('Error running app:', err);
      setError(err instanceof Error ? err.message : "An error occurred while running the app");
    } finally {
      setIsRunning(false);
    }
  };

  // Render input component for a node
  const renderInputComponent = (node: Node) => {
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
                className="w-full p-4 border rounded-lg focus:ring-2 focus:ring-sakura-300 focus:border-sakura-300 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
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
                      handleInputChange(node.id, e.target.files[0]);
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
  };

  // Render output component for a node
  const renderOutputComponent = (node: Node) => {
    const output = outputState[node.id] || node.data.config?.outputText;
    
    if (!output && !isRunning) return null;
    
    switch (node.type) {
      case 'textOutputNode':
        return (
          <div key={node.id} className="mb-6 p-6 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">
              {node.data.label || "Output"}
            </h3>
            {isRunning && !output ? (
              <div className="flex items-center text-gray-500 dark:text-gray-400">
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                {output || "No output available"}
              </div>
            )}
          </div>
        );
        
      case 'markdownOutputNode':
        return (
          <div key={node.id} className="mb-6 p-6 border rounded-lg bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">
              {node.data.label || "Markdown Output"}
            </h3>
            {isRunning && !output ? (
              <div className="flex items-center text-gray-500 dark:text-gray-400">
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </div>
            ) : (
              <div className="prose dark:prose-invert max-w-none">
                <ReactMarkdown>{output || "No output available"}</ReactMarkdown>
              </div>
            )}
          </div>
        );
        
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sakura-500"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading app...</p>
        </div>
      </div>
    );
  }

  if (error && !appData) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
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
            className="mt-6 px-4 py-2 bg-sakura-500 text-white rounded-md hover:bg-sakura-600 transition-colors"
          >
            Back to Apps
          </button>
        </div>
      </div>
    );
  }

  return (
    <OllamaProvider>
      <div className="min-h-screen" style={gradientStyle}>
        {/* Header */}
        <header className="glassmorphic shadow-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <button 
                  onClick={onBack}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">{appData?.name}</h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{appData?.description}</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <div 
                  className="w-8 h-8 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: appData?.color || '#3B82F6' }}
                >
                  {appData?.icon && (
                    // Use the icon map instead of require
                    (iconMap[appData.icon] ? 
                      React.createElement(iconMap[appData.icon], { className: 'w-5 h-5 text-white' }) : 
                      <Activity className="w-5 h-5 text-white" />)
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>
        
        <main className="container mx-auto px-4 py-8 max-w-4xl">
          {/* Input Form */}
          {inputNodes.length > 0 && (
            <section className="mb-8">
              <div className="glassmorphic rounded-xl p-6">
                <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
                  {inputNodes.length === 1 
                    ? "Enter Your Information" 
                    : "Enter Your Information"}
                </h2>
                
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    runApp();
                  }}
                >
                  {inputNodes.map(renderInputComponent)}
                  
                  <div className="flex justify-end mt-6">
                    <button
                      type="submit"
                      disabled={isRunning || !isFormComplete}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-white ${
                        isRunning || !isFormComplete
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-sakura-500 hover:bg-sakura-600'
                      }`}
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
            </section>
          )}
          
          {/* Error Message */}
          {error && (
            <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
              <p>{error}</p>
            </div>
          )}
          
          {/* Success Message */}
          {isSuccess && (
            <div className="mb-8 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-400 flex items-center gap-2">
              <Check className="w-5 h-5" />
              <p>Successfully processed your request</p>
            </div>
          )}
          
          {/* Output Results */}
          {outputNodes.length > 0 && (Object.keys(outputState).length > 0 || isRunning) && (
            <section>
              <div className="glassmorphic rounded-xl p-6">
                <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">
                  Results
                </h2>
                
                {outputNodes.map(renderOutputComponent)}
              </div>
            </section>
          )}
          
          {/* Simple chat-like interface for single input + single output */}
          {inputNodes.length === 1 && outputNodes.length === 1 && inputNodes[0].type === 'textInputNode' && (
            <section className="mt-8">
              <div className="glassmorphic rounded-xl p-2">
                <div className="flex items-end gap-2">
                  <textarea
                    className="flex-1 p-3 border rounded-lg focus:ring-2 focus:ring-sakura-300 focus:border-sakura-300 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600"
                    rows={1}
                    placeholder={inputNodes[0].data.config?.placeholder || "Type a message..."}
                    value={inputState[inputNodes[0].id] as string || ''}
                    onChange={(e) => handleInputChange(inputNodes[0].id, e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (!isRunning && (inputState[inputNodes[0].id] as string || '').trim() !== '') {
                          runApp();
                        }
                      }
                    }}
                  />
                  <button
                    disabled={isRunning || !isFormComplete}
                    onClick={runApp}
                    className={`p-3 rounded-lg ${
                      isRunning || !isFormComplete
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-sakura-500 hover:bg-sakura-600'
                    } text-white`}
                  >
                    {isRunning ? (
                      <Loader className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </OllamaProvider>
  );
};

export default AppRunner;
