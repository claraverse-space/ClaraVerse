import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { ArrowLeft, Save, Play, Grid, MousePointer, Activity, Settings, Type, FileText } from 'lucide-react';
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
import TextInputNode from './appcreator_components/nodes/TextInputNode';
import ImageInputNode from './appcreator_components/nodes/ImageInputNode';
import LLMPromptNode from './appcreator_components/nodes/LLMPromptNode';
import TextOutputNode from './appcreator_components/nodes/TextOutputNode';
import ConditionalNode from './appcreator_components/nodes/ConditionalNode';
import ApiCallNode from './appcreator_components/nodes/ApiCallNode';
import TextCombinerNode from './appcreator_components/nodes/TextCombinerNode';
import MarkdownOutputNode from './appcreator_components/nodes/MarkdownOutputNode';
import { executeFlow, generateExecutionPlan } from '../ExecutionEngine';
import DebugModal from './DebugModal';
import { OllamaProvider } from '../context/OllamaContext';
import { appStore } from '../services/AppStore';
import SaveAppModal from './appcreator_components/SaveAppModal';

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
    inputs: ['text', 'image'],
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
    icon: MousePointer,
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
    id: 'markdown_output',
    name: 'Markdown Output',
    description: 'Display formatted markdown text',
    icon: FileText,
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-100',
    lightColor: '#10B981',
    darkColor: '#34D399',
    category: 'output',
    inputs: ['text']
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
  
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  useEffect(() => {
    if (appId) {
      loadApp(appId);
    }
  }, [appId]);

  const loadApp = async (id: string) => {
    try {
      const app = await appStore.getApp(id);
      if (app) {
        setAppName(app.name);
        setAppDescription(app.description);
        setAppIcon(app.icon || 'Activity');
        setAppColor(app.color || '#3B82F6');
        setNodes(app.nodes);
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

      let nodeType;
      switch(toolId) {
        case 'text_input': nodeType = 'textInputNode'; break;
        case 'image_input': nodeType = 'imageInputNode'; break;
        case 'llm_prompt': nodeType = 'llmPromptNode'; break;
        case 'text_output': nodeType = 'textOutputNode'; break;
        case 'conditional': nodeType = 'conditionalNode'; break;
        case 'api_call': nodeType = 'apiCallNode'; break;
        case 'text_combiner': nodeType = 'textCombinerNode'; break;
        case 'markdown_output': nodeType = 'markdownOutputNode'; break;
        default: nodeType = 'textInputNode';
      }

      const newNode: Node = {
        id: `${toolId}_${Date.now()}`,
        type: nodeType,
        position,
        data: { 
          label: tool.name,
          // Added labelStyle so the node title appears white in dark mode (dark text in light mode)
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
          <h4 className={`text-sm font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>{tool.name}</h4>
          <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{tool.description}</p>
        </div>
      </div>
    );
  };

  const internalSaveApp = async (name: string, description: string, icon: string, color: string) => {
    try {
      let id = currentAppId;
      
      // Pre-save processing - ensure all configurations are properly captured
      // This is especially important for nodes with complex configurations like LLM nodes
      const processedNodes = nodes.map(node => {
        // Clone the node to avoid reference issues
        const processedNode = {...node};
        
        // Special handling for LLM nodes to ensure the prompts are saved
        if (node.type === 'llmPromptNode') {
          console.log('Saving LLM node configuration:', node.data.config);
          // Make sure sensitive or complex data is properly stored
          if (node.data.config && node.data.config.prompt) {
            processedNode.data = {
              ...node.data,
              config: {
                ...node.data.config,
                // Ensure the prompt is properly stored
                prompt: node.data.config.prompt,
                model: node.data.config.model || '',
                ollamaUrl: node.data.config.ollamaUrl || ''
              }
            };
          }
        }
        // Special handling for TextCombiner nodes
        else if (node.type === 'textCombinerNode') {
          processedNode.data = {
            ...node.data,
            config: {
              ...node.data.config,
              additionalText: node.data.config.additionalText || '',
              combinedText: node.data.config.combinedText || ''
            }
          };
        }
        // Special handling for Conditional nodes
        else if (node.type === 'conditionalNode') {
          processedNode.data = {
            ...node.data,
            config: {
              ...node.data.config,
              condition: node.data.config.condition || '',
              inputText: node.data.config.inputText || ''
            }
          };
        }
        
        return processedNode;
      });
      
      if (!id) {
        id = await appStore.createApp(name, description);
        setCurrentAppId(id);
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
      alert(`App "${name}" saved successfully!`);
    } catch (error) {
      console.error('Error saving app:', error);
      alert(`Error saving app: ${error instanceof Error ? error.message : String(error)}`);
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
                // Handle both regular text output and markdown output
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
              } 
              else if (node.type === 'textCombinerNode') {
                // Store the input text for text combiner nodes
                return {
                  ...node,
                  data: {
                    ...node.data,
                    config: {
                      ...node.data.config,
                      inputText: typeof output === 'string' ? output : JSON.stringify(output),
                    }
                  }
                };
              }
              else if (node.type === 'conditionalNode') {
                // Store the input text for conditional nodes
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
    background: isDark ? '#1F2937' : '#F9FAFB',
  }), [isDark]);
  
  const minimapStyle = useMemo(() => ({
    backgroundColor: isDark ? '#374151' : '#F9FAFB',
    maskColor: isDark ? 'rgba(55, 65, 81, 0.7)' : 'rgba(249, 250, 251, 0.7)',
    nodeBorderRadius: 2,
  }), [isDark]);

  const minimapNodeColor = useMemo(() => (node: Node) => {
    return isDark ? '#9ca3af' : '#fff';
  }, [isDark]);

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const nodeTypes = useMemo(() => ({
    textInputNode: TextInputNode,
    textOutputNode: TextOutputNode,
    llmPromptNode: LLMPromptNode,
    imageInputNode: ImageInputNode,
    conditionalNode: ConditionalNode,
    apiCallNode: ApiCallNode,
    textCombinerNode: TextCombinerNode,
    markdownOutputNode: MarkdownOutputNode,
  }), []);

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

  return (
    <OllamaProvider>
      <div className="flex flex-col h-screen">
        <TopBar 
          onPageChange={onPageChange} 
          handleOpenSaveModal={handleOpenSaveModal} // pass open modal handler
          handleTestApp={handleTestApp}
          handleDebug={handleDebug}
          appName={appName}
          setAppName={setAppName}
          isExecuting={isExecuting}
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
