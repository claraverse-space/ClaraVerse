import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { ArrowLeft, Save, Play, Grid, MousePointer, Activity, Settings, Type, FileText, Check, X, Edit, Sparkles, Image, ImagePlus, TextQuote } from 'lucide-react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  addEdge, 
  useNodesState, 
  useEdgesState,
  Node,
  Edge, 
  Connection
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useTheme } from '../hooks/useTheme';
import TopBar from './appcreator_components/TopBar';
import ToolsSidebar from './appcreator_components/ToolsSidebar';
import FlowCanvas from './appcreator_components/FlowCanvas';
import { getAllNodeTypes } from './appcreator_components/nodes/NodeRegistry';
import { executeFlow, generateExecutionPlan } from '../ExecutionEngine';
import DebugModal from './DebugModal';
import { OllamaProvider } from '../context/OllamaContext';
import { appStore } from '../services/AppStore';
import SaveAppModal from './appcreator_components/SaveAppModal';
import ToolSidebar from './appcreator_components/ToolSidebar';

interface AppCreatorProps {
  onPageChange: (page: string) => void;
  appId?: string;
}

export interface ToolItem {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  lightColor: string;
  darkColor: string;
  category: 'input' | 'process' | 'output' | 'function';
  inputs?: string[];
  outputs?: string[];
}

const toolItems: ToolItem[] = [
  {
    id: 'text_input',
    name: 'Text Input',
    description: 'Accept text input from users',
    icon: MousePointer,
    color: 'bg-blue-500',
    bgColor: 'bg-blue-100',
    lightColor: '#3B82F6',
    darkColor: '#60A5FA',
    category: 'input',
    outputs: ['text']
  },
  {
    id: 'llm_prompt',
    name: 'LLM Prompt',
    description: 'Process text with an LLM',
    icon: Activity,
    color: 'bg-purple-500',
    bgColor: 'bg-purple-100',
    lightColor: '#8B5CF6',
    darkColor: '#A78BFA',
    category: 'process',
    inputs: ['text'],
    outputs: ['text']
  },
  {
    id: 'conditional',
    name: 'Conditional',
    description: 'Branch logic based on conditions',
    icon: Grid,
    color: 'bg-yellow-500',
    bgColor: 'bg-yellow-100',
    lightColor: '#F59E0B',
    darkColor: '#FBBF24',
    category: 'function',
    inputs: ['text'],
    outputs: ['text']
  },
  {
    id: 'text_output',
    name: 'Text Output',
    description: 'Display text to users',
    icon: MousePointer,
    color: 'bg-green-500',
    bgColor: 'bg-green-100',
    lightColor: '#10B981',
    darkColor: '#34D399',
    category: 'output',
    inputs: ['text']
  },
  {
    id: 'image_input',
    name: 'Image Input',
    description: 'Accept image uploads',
    icon: Image,
    color: 'bg-pink-500',
    bgColor: 'bg-pink-100',
    lightColor: '#EC4899',
    darkColor: '#F472B6',
    category: 'input',
    outputs: ['image']
  },
  {
    id: 'api_call',
    name: 'API Call',
    description: 'Make external API requests',
    icon: Settings,
    color: 'bg-red-500',
    bgColor: 'bg-red-100',
    lightColor: '#EF4444',
    darkColor: '#F87171',
    category: 'function',
    inputs: ['text'],
    outputs: ['text']
  },
  {
    id: 'text_combiner',
    name: 'Text Combiner',
    description: 'Combine input text with additional text',
    icon: Type,
    color: 'bg-indigo-500',
    bgColor: 'bg-indigo-100',
    lightColor: '#6366F1',
    darkColor: '#818CF8',
    category: 'function',
    inputs: ['text'],
    outputs: ['text']
  },
  {
    id: 'image_text_llm',
    name: 'Image + Text LLM',
    description: 'Process image and text with a vision model',
    icon: ImagePlus,
    color: 'bg-violet-500',
    bgColor: 'bg-violet-100',
    lightColor: '#8B5CF6',
    darkColor: '#7C3AED',
    category: 'function',
    inputs: ['image', 'text'],
    outputs: ['text']
  },
  {
    id: 'static_text',
    name: 'Static Text',
    description: 'Fixed text content that does not change',
    icon: TextQuote,
    color: 'bg-red-500',
    bgColor: 'bg-red-100',
    lightColor: '#F87171',
    darkColor: '#DC2626',
    category: 'input',
    outputs: ['text']
  }
];

const AppCreator: React.FC<AppCreatorProps> = ({ onPageChange, appId }) => {
  const { isDark } = useTheme();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedTool, setSelectedTool] = useState<ToolItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
  const [executionJson, setExecutionJson] = useState<any>(null);
  const [appName, setAppName] = useState('New App');
  const [appDescription, setAppDescription] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentAppId, setCurrentAppId] = useState<string | undefined>(appId);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [appIcon, setAppIcon] = useState('Activity');
  const [appColor, setAppColor] = useState('#3B82F6');
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
    visible: boolean;
  }>({ type: 'success', message: '', visible: false });
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  useEffect(() => {
    if (appId) {
      // We're editing an existing app
      loadApp(appId);
    } else {
      // We're creating a new app - reset everything
      resetAppState();
    }
  }, [appId]);

  const resetAppState = () => {
    setNodes([]);
    setEdges([]);
    setAppName('New App');
    setAppDescription('');
    setAppIcon('Activity');
    setAppColor('#3B82F6');
    setCurrentAppId(undefined);
  };

  const loadApp = async (id: string) => {
    try {
      const app = await appStore.getApp(id);
      if (app) {
        setAppName(app.name);
        setAppDescription(app.description);
        setAppIcon(app.icon || 'Activity');
        setAppColor(app.color || '#3B82F6');
        // Restore tool icon components on loaded nodes
        const restoredNodes = app.nodes.map((node: Node) => {
          if (node.data && node.data.tool) {
            const toolDefinition = toolItems.find(t => t.id === node.data.tool.id);
            if (toolDefinition) {
              node.data.tool.icon = toolDefinition.icon;
            }
          }
          return node;
        });
        setNodes(restoredNodes);
        setEdges(app.edges);
        setCurrentAppId(id);
      }
    } catch (error) {
      console.error('Error loading app:', error);
    }
  };

  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({ 
      ...params, 
      animated: true, 
      type: 'smoothstep',
      style: { 
        stroke: isDark ? '#EC4899' : '#F472B6',
        strokeWidth: 2 
      }
    }, eds));
  }, [setEdges, isDark]);

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const toolId = event.dataTransfer.getData('application/reactflow');
      
      if (!toolId) return;

      const tool = toolItems.find(t => t.id === toolId);
      if (!tool) return;

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      let nodeType: string;
      switch(toolId) {
        case 'text_input': 
          nodeType = 'textInputNode'; 
          break;
        case 'image_input': 
          nodeType = 'imageInputNode'; 
          break;
        case 'llm_prompt': 
          nodeType = 'llmPromptNode'; 
          break;
        case 'text_output': 
          nodeType = 'textOutputNode'; 
          break;
        case 'conditional': 
          nodeType = 'conditionalNode'; 
          break;
        case 'api_call': 
          nodeType = 'apiCallNode'; 
          break;
        case 'text_combiner': 
          nodeType = 'textCombinerNode'; 
          break;
        case 'image_text_llm': 
          nodeType = 'imageTextLlmNode';
          break;
        case 'static_text': 
          nodeType = 'staticTextNode';
          break;
        default: 
          nodeType = 'textInputNode';
      }

      const newNode: Node = {
        id: `${toolId}_${Date.now()}`,
        type: nodeType,
        position,
        data: { 
          label: tool.name,
          labelStyle: { color: isDark ? '#fff' : '#000' },
          tool: tool,
          inputs: tool.inputs || [], 
          outputs: tool.outputs || [],
          config: {}
        }
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes, isDark]
  );

  const onDragStart = (event: React.DragEvent<HTMLDivElement>, tool: ToolItem) => {
    event.dataTransfer.setData('application/reactflow', tool.id);
    event.dataTransfer.effectAllowed = 'move';
    setSelectedTool(tool);
    setIsDragging(true);
  };

  const onDragEnd = () => {
    setSelectedTool(null);
    setIsDragging(false);
  };

  const renderToolItem = (tool: ToolItem) => {
    const Icon = tool.icon;
    return (
      <div
        key={tool.id}
        draggable
        onDragStart={(e) => onDragStart(e, tool)}
        onDragEnd={onDragEnd}
        className={`flex items-center gap-3 p-3 rounded-lg ${isDark ? 'bg-gray-800 shadow-sm border-gray-700' : 'bg-white shadow-sm border-gray-200'} border cursor-grab transition-all hover:shadow-md`}
      >
        <div className={`p-2 rounded-lg ${tool.color} text-white`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h4 className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>{tool.name}</h4>
          <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{tool.description}</p>
        </div>
      </div>
    );
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message, visible: true });
    // Auto-hide notification after 3 seconds
    setTimeout(() => {
      setNotification(prev => ({ ...prev, visible: false }));
    }, 3000);
  };

  const internalSaveApp = async (name: string, description: string, icon: string, color: string) => {
    try {
      // Process nodes to ensure all configurations are properly captured
      const processedNodes = nodes.map((node) => {
        const processedNode = { ...node };
        if (node.type === 'llmPromptNode') {
          console.log('Saving LLM node configuration:', node.data.config);
          processedNode.data = {
            ...node.data,
            config: {
              ...node.data.config,
              prompt: node.data.config.prompt || '',
              model: node.data.config.model || '',
              ollamaUrl: node.data.config.ollamaUrl || ''
            }
          };
        } else if (node.type === 'imageTextLlmNode') {
          console.log('Saving ImageTextLLM node configuration:', node.data.config);
          processedNode.data = {
            ...node.data,
            config: {
              ...node.data.config,
              systemPrompt: node.data.config.systemPrompt || '',
              model: node.data.config.model || '',
              ollamaUrl: node.data.config.ollamaUrl || ''
            },
            // Also save at root level for compatibility
            model: node.data.config.model || '',
            ollamaUrl: node.data.config.ollamaUrl || ''
          };
        } else if (node.type === 'textCombinerNode') {
          processedNode.data = {
            ...node.data,
            config: {
              ...node.data.config,
              // Only store the additionalText configuration
              additionalText: node.data.config.additionalText || '',
              // Don't persist dynamic data like inputText or combinedText
            }
          };
        } else if (node.type === 'conditionalNode') {
          processedNode.data = {
            ...node.data,
            config: {
              ...node.data.config,
              condition: node.data.config.condition || '',
              inputText: node.data.config.inputText || ''
            }
          };
        } else if (node.type === 'textOutputNode' || node.type === 'markdownOutputNode') {
          // Clean up any runtime-only output data before saving
          processedNode.data = {
            ...node.data,
            config: {
              ...node.data.config,
              outputText: ''  // Don't persist output data
            }
          };
        }
        return processedNode;
      });

      let id = currentAppId;
      
      // If there is no current app ID, create one
      if (!id) {
        id = await appStore.createApp(name, description);
        setCurrentAppId(id);
        // Also update localStorage so we're now editing this app
        localStorage.setItem('current_app_id', id);
      }
      
      // Update state with new values
      setAppName(name);
      setAppDescription(description);
      setAppIcon(icon);
      setAppColor(color);
      
      await appStore.updateApp(id, { 
        name, 
        description, 
        icon, 
        color,  
        nodes: processedNodes, 
        edges 
      });
      
      console.log(`App "${name}" saved with ${processedNodes.length} nodes and ${edges.length} edges`);
      
      // Show success notification
      showNotification('success', `App "${name}" saved successfully!`);
    } catch (error) {
      console.error('Error saving app:', error);
      showNotification('error', `Error saving app: ${error instanceof Error ? error.message : String(error)}`);
    }
    setShowSaveModal(false);
  };

  const handleOpenSaveModal = () => {
    setShowSaveModal(true);
  };

  const handleCloseSaveModal = () => {
    setShowSaveModal(false);
  };

  const handleTestApp = async () => {
    setIsExecuting(true);
    try {
      const plan = generateExecutionPlan(nodes, edges);
      const updateNodeOutput = (nodeId: string, output: any) => {
        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === nodeId) {
              if (node.type === 'textOutputNode' || node.type === 'markdownOutputNode') {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    config: {
                      ...node.data.config,
                      outputText: typeof output === 'string' ? output : JSON.stringify(output)
                    }
                  }
                };
              } else if (node.type === 'textCombinerNode') {
                // Store temporarily for UI display but don't persist to database
                // Mark it as a temporary state value with a clear name
                return {
                  ...node,
                  data: {
                    ...node.data,
                    config: {
                      ...node.data.config,
                      tempInputText: typeof output === 'string' ? output : JSON.stringify(output),
                      // Note: We use tempInputText to clearly indicate this shouldn't be persisted
                    }
                  }
                };
              } else if (node.type === 'conditionalNode') {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    config: {
                      ...node.data.config,
                      inputText: typeof output === 'string' ? output : JSON.stringify(output)
                    }
                  }
                };
              }
            }
            return node;
          })
        );
      };
      await executeFlow(plan, updateNodeOutput);
      console.log('App execution completed successfully');
    } catch (error) {
      console.error('Error executing app:', error);
      alert(`Error executing app: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const nodeStyle = (node: Node) => {
    if (node.id === selectedNodeId) {
      return {
        boxShadow: isDark
          ? '0 0 0 2px #EC4899, 0 0 10px 2px rgba(236, 72, 153, 0.5)'
          : '0 0 0 2px #F472B6, 0 0 10px 2px rgba(244, 114, 182, 0.5)',
        zIndex: 1000
      };
    }
    return {};
  };

  const flowStyles = useMemo(() => ({
    background: isDark ? '#1F2937' : '#F9FAFB'
  }), [isDark]);

  const minimapStyle = useMemo(() => ({
    backgroundColor: isDark ? '#374151' : '#F9FAFB',
    maskColor: isDark ? 'rgba(55, 65, 81, 0.7)' : 'rgba(249, 250, 251, 0.7)',
    nodeBorderRadius: 2
  }), [isDark]);

  const minimapNodeColor = useMemo(() => (node: Node) => {
    return isDark ? '#9ca3af' : '#fff';
  }, [isDark]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const nodeTypes = useMemo(() => getAllNodeTypes(), []);

  const isValidConnection = useCallback((connection: Connection) => {
    const sourceNode = nodes.find(node => node.id === connection.source);
    const targetNode = nodes.find(node => node.id === connection.target);
    
    if (!sourceNode || !targetNode) return false;
    const sourceType = sourceNode.data.tool.outputs;
    const targetType = targetNode.data.tool.inputs;
    if (!sourceType || !targetType) return false;
    return sourceType.some((type: string) => targetType.includes(type));
  }, [nodes]);

  const handleDebug = () => {
    const plan = generateExecutionPlan(nodes, edges);
    setExecutionJson(plan);
    setDebugOpen(true);
  };

  const closeDebug = () => {
    setDebugOpen(false);
  };

  // Add this effect to ensure the toolItems array is processed correctly
  useEffect(() => {
    console.log("Tool items initialized:", toolItems);
    
    // Make sure ImagePlus is imported
    if (!toolItems.some(tool => tool.id === 'image_text_llm')) {
      console.warn("Image Text LLM tool not found in toolItems!");
    }
  }, []);

  return (
    <OllamaProvider>
      <div className="flex flex-col h-screen">
        <TopBar 
          onPageChange={onPageChange}
          handleOpenSaveModal={handleOpenSaveModal}
          handleTestApp={handleTestApp}
          handleDebug={handleDebug}
          appName={appName}
          setAppName={setAppName}
          isExecuting={isExecuting}
          appId={currentAppId}  // Pass the current app ID
        />
        <div className="flex flex-1 overflow-hidden">
          <ToolsSidebar
            toolItems={toolItems}
            isDark={isDark}
            selectedTool={selectedTool}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
          <FlowCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            reactFlowInstance={reactFlowInstance}
            setReactFlowInstance={setReactFlowInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            nodeTypes={nodeTypes}
            flowStyles={flowStyles}
            isDark={isDark}
            reactFlowWrapper={reactFlowWrapper}
            selectedTool={selectedTool}
            isDragging={isDragging}
            isValidConnection={isValidConnection}
            minimapStyle={minimapStyle}
            minimapNodeColor={minimapNodeColor}
            nodeStyle={nodeStyle}
          />
        </div>
        
        {/* Notification toast */}
        {notification.visible && (
          <div 
            className={`fixed bottom-6 right-6 py-3 px-4 rounded-lg shadow-lg flex items-center gap-3 transition-all duration-300 transform ${
              notification.type === 'success' 
                ? 'bg-green-500 text-white' 
                : 'bg-red-500 text-white'
            }`}
          >
            {notification.type === 'success' ? (
              <Check className="h-5 w-5" />
            ) : (
              <X className="h-5 w-5" />
            )}
            <p className="font-medium">{notification.message}</p>
            <button 
              onClick={() => setNotification(prev => ({ ...prev, visible: false }))} 
              className="ml-2 opacity-70 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        
        {debugOpen && executionJson && (
          <DebugModal jsonData={executionJson} onClose={closeDebug} />
        )}
        {showSaveModal && (
          <SaveAppModal
            initialName={appName}
            initialDescription={appDescription}
            onSave={internalSaveApp}
            onCancel={handleCloseSaveModal}
          />
        )}
      </div>
    </OllamaProvider>
  );
};

export default AppCreator;
