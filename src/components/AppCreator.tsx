import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  Grid,
  MousePointer,
  Activity,
  Settings,
  Type,
  FileText,
  Check,
  X,
  Sparkles,
  Image,
  ImagePlus,
  TextQuote,
  Video,
  Clock,
} from 'lucide-react';
import { addEdge, useNodesState, useEdgesState, Node, Connection } from 'reactflow';
import 'reactflow/dist/style.css';
import { useTheme } from '../hooks/useTheme';
import TopBar from './appcreator_components/TopBar';
import ToolsSidebar from './appcreator_components/ToolsSidebar';
import FlowCanvas from './appcreator_components/FlowCanvas';
import { getAllNodeTypes, getToolItems } from './appcreator_components/nodes/NodeRegistry';
import { executeFlow, generateExecutionPlan } from '../ExecutionEngine';
import DebugModal from './DebugModal';
import { OllamaProvider } from '../context/OllamaContext';
import { appStore } from '../services/AppStore';
import SaveAppModal from './appcreator_components/SaveAppModal';

// Helper to convert a tool ID (e.g., "api_call") to a node type key (e.g., "apiCallNode")
const convertToolIdToNodeType = (toolId: string): string => {
  const parts = toolId.split('_');
  const camelCase =
    parts[0] + parts.slice(1).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
  return camelCase + 'Node';
};

interface AppCreatorProps {
  onPageChange: (page: string) => void;
  appId?: string;
}

const AppCreator: React.FC<AppCreatorProps> = ({ onPageChange, appId }) => {
  const { isDark } = useTheme();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedTool, setSelectedTool] = useState<any>(null);
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
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string; visible: boolean; }>({
    type: 'success',
    message: '',
    visible: false,
  });

  // Sidebar resizing state
  const [sidebarWidth, setSidebarWidth] = useState(300);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // Instead of hardcoding toolItems, get them dynamically from node metadata
  const toolItems = useMemo(() => getToolItems(), []);

  // Use a ref to store the nodeTypes so they remain stable across renders
  const nodeTypesRef = useRef(getAllNodeTypes());
  const nodeTypes = nodeTypesRef.current;

  useEffect(() => {
    if (appId) {
      loadApp(appId);
    } else {
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
        const restoredNodes = app.nodes.map((node: Node) => {
          if (node.data && node.data.tool) {
            // Restore tool icon from dynamic toolItems
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

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            animated: true,
            type: 'smoothstep',
            style: {
              stroke: isDark ? '#EC4899' : '#F472B6',
              strokeWidth: 2,
            },
          },
          eds
        )
      );
    },
    [setEdges, isDark]
  );

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // onDrop handler uses the helper to compute the node type dynamically
  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      if (!reactFlowWrapper.current || !reactFlowInstance) return;

      const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
      const toolId = event.dataTransfer.getData('application/reactflow');
      if (!toolId) return;

      // Find the tool metadata by ID
      const tool = toolItems.find((t) => t.id === toolId);
      if (!tool) return;

      const position = reactFlowInstance.project({
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      });

      const nodeType = convertToolIdToNodeType(toolId);

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
          config: {},
        },
      };

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes, isDark, toolItems]
  );

  const onDragStart = (event: React.DragEvent<HTMLDivElement>, tool: any) => {
    event.dataTransfer.setData('application/reactflow', tool.id);
    event.dataTransfer.effectAllowed = 'move';
    setSelectedTool(tool);
    setIsDragging(true);
  };

  const onDragEnd = () => {
    setSelectedTool(null);
    setIsDragging(false);
  };

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message, visible: true });
    setTimeout(() => {
      setNotification((prev) => ({ ...prev, visible: false }));
    }, 3000);
  };

  const internalSaveApp = async (
    name: string,
    description: string,
    icon: string,
    color: string,
    customIconUrl?: string
  ) => {
    try {
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
              ollamaUrl: node.data.config.ollamaUrl || '',
            },
          };
        } else if (node.type === 'imageTextLlmNode') {
          console.log('Saving ImageTextLLM node configuration:', node.data.config);
          processedNode.data = {
            ...node.data,
            config: {
              ...node.data.config,
              systemPrompt: node.data.config.systemPrompt || '',
              model: node.data.config.model || '',
              ollamaUrl: node.data.config.ollamaUrl || '',
            },
          };
        } else if (node.type === 'textOutputNode' || node.type === 'markdownOutputNode') {
          processedNode.data = {
            ...node.data,
            config: {
              ...node.data.config,
              outputText: '',
            },
          };
        } else if (node.type === 'conditionalNode') {
          processedNode.data = {
            ...node.data,
            config: {
              ...node.data.config,
              condition: node.data.config.condition || '',
              inputText: node.data.config.inputText || '',
            },
          };
        } else if (node.type === 'getClipboardTextNode') {
          processedNode.data = {
            ...node.data,
            config: {
              ...node.data.config,
              inputText: node.data.config.inputText || '',
            },
          };
        } else if (node.type === 'concatTextNode') {
          processedNode.data = {
            ...node.data,
            config: {
              ...node.data.config,
              outputText: '',
              topFirst: node.data.config.topFirst !== undefined ? node.data.config.topFirst : true,
            },
          };
        }
        return processedNode;
      });

      let id = currentAppId;
      if (!id) {
        id = await appStore.createApp(name, description);
        setCurrentAppId(id);
        localStorage.setItem('current_app_id', id);
      }
      setAppIcon(icon);
      setAppColor(color);

      await appStore.updateApp(id, {
        name,
        description,
        icon,
        color,
        nodes: processedNodes,
        edges,
      });

      console.log(`App "${name}" saved with ${processedNodes.length} nodes and ${edges.length} edges`);
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
                      outputText: typeof output === 'string' ? output : JSON.stringify(output),
                    },
                  },
                };
              } else if (node.type === 'textCombinerNode') {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    config: {
                      ...node.data.config,
                      tempInputText: typeof output === 'string' ? output : JSON.stringify(output),
                    },
                  },
                };
              } else if (node.type === 'conditionalNode') {
                return {
                  ...node,
                  data: {
                    ...node.data,
                    config: {
                      ...node.data.config,
                      inputText: typeof output === 'string' ? output : JSON.stringify(output),
                    },
                  },
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
        zIndex: 1000,
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

  const isValidConnection = useCallback(
    (connection: Connection) => {
      const sourceNode = nodes.find((node) => node.id === connection.source);
      const targetNode = nodes.find((node) => node.id === connection.target);
      if (!sourceNode || !targetNode) return false;
      const sourceType = sourceNode.data.tool.outputs;
      const targetType = targetNode.data.tool.inputs;
      if (!sourceType || !targetType) return false;
      return sourceType.some((type: string) => targetType.includes(type));
    },
    [nodes]
  );

  const handleDebug = () => {
    const plan = generateExecutionPlan(nodes, edges);
    setExecutionJson(plan);
    setDebugOpen(true);
  };

  const closeDebug = () => {
    setDebugOpen(false);
  };

  // Resizable sidebar drag handler
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = startWidth + (e.clientX - startX);
      if (newWidth > 200 && newWidth < 500) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    console.log('Tool items initialized:', toolItems);
    if (!toolItems.some((tool) => tool.id === 'image_text_llm')) {
      console.warn('Image Text LLM tool not found in toolItems!');
    }
  }, [toolItems]);

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
          appId={currentAppId}
        />
        <div className="flex flex-1 overflow-hidden">
          <div
            ref={sidebarRef}
            style={{ width: sidebarWidth }}
            className="relative flex-shrink-0 border-r border-gray-200 dark:border-gray-700"
          >
            <ToolsSidebar
              toolItems={toolItems}
              isDark={isDark}
              selectedTool={selectedTool}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
            <div onMouseDown={handleMouseDown} className="absolute right-0 top-0 h-full w-2 cursor-ew-resize z-10" />
          </div>
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
        {notification.visible && (
          <div
            className={`fixed bottom-6 right-6 py-3 px-4 rounded-lg shadow-lg flex items-center gap-3 transition-all duration-300 transform ${
              notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
            }`}
          >
            {notification.type === 'success' ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
            <p className="font-medium">{notification.message}</p>
            <button onClick={() => setNotification((prev) => ({ ...prev, visible: false }))} className="ml-2 opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {debugOpen && executionJson && <DebugModal jsonData={executionJson} onClose={closeDebug} />}
        {showSaveModal && (
          <SaveAppModal
            initialName={appName}
            initialDescription={appDescription}
            initialIcon={appIcon}
            initialColor={appColor}
            onSave={internalSaveApp}
            onCancel={handleCloseSaveModal}
          />
        )}
      </div>
    </OllamaProvider>
  );
};

export default AppCreator;
