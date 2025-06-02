import React, { useCallback, useMemo, useEffect, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  OnConnect,
  NodeTypes,
  ReactFlowInstance,
  OnNodesChange,
  OnEdgesChange,
  NodeChange,
  EdgeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useAgentBuilder } from '../../../contexts/AgentBuilder/AgentBuilderContext';
import CustomNode from '../Nodes/CustomNode';

// Import all built-in node components
import InputNode from '../Nodes/InputNode';
import OutputNode from '../Nodes/OutputNode';
import JsonParseNode from '../Nodes/JsonParseNode';
import IfElseNode from '../Nodes/IfElseNode';
import LLMNode from '../Nodes/LLMNode';
import StructuredLLMNode from '../Nodes/StructuredLLMNode';
import ImageInputNode from '../Nodes/ImageInputNode';
import TextNode from '../Nodes/TextNode';
import MathNode from '../Nodes/MathNode';
import PDFInputNode from '../Nodes/PDFInputNode';
import APIRequestNode from '../Nodes/APIRequestNode';

// Debug: Log successful imports
console.log('Node imports loaded:', {
  InputNode: !!InputNode,
  OutputNode: !!OutputNode,
  JsonParseNode: !!JsonParseNode,
  IfElseNode: !!IfElseNode,
  LLMNode: !!LLMNode,
  StructuredLLMNode: !!StructuredLLMNode,
  ImageInputNode: !!ImageInputNode,
  TextNode: !!TextNode,
  MathNode: !!MathNode,
  PDFInputNode: !!PDFInputNode,
  APIRequestNode: !!APIRequestNode,
});

// Define base node types with proper imports - moved outside component to ensure immediate availability
const baseNodeTypes: NodeTypes = {
  'input': InputNode,
  'output': OutputNode,
  'json-parse': JsonParseNode,
  'if-else': IfElseNode,
  'llm': LLMNode,
  'structured-llm': StructuredLLMNode,
  'image-input': ImageInputNode,
  'pdf-input': PDFInputNode,
  'api-request': APIRequestNode,
  'text': TextNode,
  'math': MathNode,
};

// Debug: Log base node types immediately after definition
console.log('Base node types defined:', baseNodeTypes);

// Wrapper component for custom nodes that provides the node definition
const CustomNodeWrapper: React.FC<any> = (props) => {
  const { customNodes } = useAgentBuilder();
  const nodeDefinition = customNodes.find(def => def.type === props.type);
  
  if (!nodeDefinition) {
    console.error(`Custom node definition not found for type: ${props.type}`);
    return <div>Custom node definition not found</div>;
  }
  
  return <CustomNode {...props} nodeDefinition={nodeDefinition} />;
};

interface CanvasProps {
  className?: string;
}

const CanvasContent: React.FC<CanvasProps> = ({ className = '' }) => {
  const {
    nodes,
    connections,
    canvas,
    customNodes,
    executionResults,
    addNode,
    updateNode,
    deleteNode,
    addConnection,
    deleteConnection,
    updateCanvas,
    selectNodes,
    clearSelection,
  } = useAgentBuilder();

  // Create dynamic node types that include custom nodes - use useState for immediate initialization
  const [nodeTypes, setNodeTypes] = useState<NodeTypes>(() => {
    const dynamicNodeTypes = { ...baseNodeTypes };
    
    console.log('Base node types registered:', Object.keys(baseNodeTypes));
    console.log('Base node type details:', baseNodeTypes);
    
    console.log('Initial dynamic node types available:', Object.keys(dynamicNodeTypes));
    console.log('Initial nodeTypes object:', dynamicNodeTypes);
    return dynamicNodeTypes;
  });

  // Update nodeTypes when customNodes change
  useEffect(() => {
    const dynamicNodeTypes = { ...baseNodeTypes };
    
    // Add all custom nodes to the nodeTypes
    customNodes.forEach(customNodeDef => {
      dynamicNodeTypes[customNodeDef.type] = CustomNodeWrapper;
      console.log(`Registered custom node type: ${customNodeDef.type}`);
    });
    
    console.log('Updated dynamic node types available:', Object.keys(dynamicNodeTypes));
    console.log('Updated nodeTypes object:', dynamicNodeTypes);
    setNodeTypes(dynamicNodeTypes);
  }, [customNodes]);

  // Convert our internal format to ReactFlow format
  const initialNodes: Node[] = useMemo(() => {
    return nodes.map(node => {
      // Get execution result for this node
      const executionResult = executionResults[node.id];
      
      // For output nodes, pass the execution result as inputValue
      const nodeData: any = {
        ...node.data,
        label: node.name,
        inputs: node.inputs,
        outputs: node.outputs,
        onUpdate: (updates: any) => updateNode(node.id, updates),
        onDelete: () => deleteNode(node.id),
      };

      // Add execution results to node data based on node type
      if (node.type === 'output' && executionResult !== undefined) {
        nodeData.inputValue = executionResult;
      }

      return {
        id: node.id,
        type: node.type,
        position: node.position,
        data: nodeData,
        selected: canvas.selection.nodeIds.includes(node.id),
        draggable: true,
      };
    });
  }, [nodes, canvas.selection.nodeIds, executionResults, updateNode, deleteNode]);

  // Convert our internal connections to ReactFlow edges
  const initialEdges: Edge[] = useMemo(() => {
    return connections.map(connection => ({
      id: connection.id,
      source: connection.sourceNodeId,
      target: connection.targetNodeId,
      sourceHandle: connection.sourcePortId,
      targetHandle: connection.targetPortId,
      type: 'default',
      animated: false,
    }));
  }, []);

  // Use ReactFlow's internal state management
  const [reactFlowNodes, setReactFlowNodes, onNodesChange] = useNodesState(initialNodes);
  const [reactFlowEdges, setReactFlowEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync our context state to ReactFlow state when it changes
  useEffect(() => {
    const newNodes: Node[] = nodes.map(node => {
      // Get execution result for this node
      const executionResult = executionResults[node.id];
      
      const nodeData: any = {
        ...node.data,
        label: node.name,
        inputs: node.inputs,
        outputs: node.outputs,
        onUpdate: (updates: any) => updateNode(node.id, updates),
        onDelete: () => deleteNode(node.id),
      };

      // Add execution results to node data based on node type
      if (node.type === 'output' && executionResult !== undefined) {
        nodeData.inputValue = executionResult;
      }

      return {
        id: node.id,
        type: node.type,
        position: node.position,
        data: nodeData,
        selected: canvas.selection.nodeIds.includes(node.id),
        draggable: true,
      };
    });

    // Only update if there are actual changes to prevent infinite loops
    const hasChanges = 
      newNodes.length !== reactFlowNodes.length ||
      newNodes.some((node, index) => {
        const existing = reactFlowNodes[index];
        return !existing || 
               node.id !== existing.id || 
               node.position.x !== existing.position.x || 
               node.position.y !== existing.position.y ||
               node.selected !== existing.selected ||
               JSON.stringify(node.data) !== JSON.stringify(existing.data);
      });

    if (hasChanges) {
      setReactFlowNodes(newNodes);
    }
  }, [nodes, canvas.selection.nodeIds, executionResults, updateNode, deleteNode, reactFlowNodes, setReactFlowNodes]);

  // Sync connections to ReactFlow edges
  useEffect(() => {
    const newEdges: Edge[] = connections.map(connection => ({
      id: connection.id,
      source: connection.sourceNodeId,
      target: connection.targetNodeId,
      sourceHandle: connection.sourcePortId,
      targetHandle: connection.targetPortId,
      type: 'default',
      animated: false,
    }));

    // Only update if there are actual changes
    const hasChanges = 
      newEdges.length !== reactFlowEdges.length ||
      newEdges.some((edge, index) => {
        const existing = reactFlowEdges[index];
        return !existing || edge.id !== existing.id;
      });

    if (hasChanges) {
      setReactFlowEdges(newEdges);
    }
  }, [connections, reactFlowEdges, setReactFlowEdges]);

  // Handle ReactFlow node changes and sync back to context
  const handleNodesChange: OnNodesChange = useCallback((changes: NodeChange[]) => {
    onNodesChange(changes);
    
    changes.forEach((change) => {
      if (change.type === 'position' && 'position' in change && change.position) {
        // Update node position in our context
        updateNode(change.id, {
          position: change.position
        });
      } else if (change.type === 'select' && 'selected' in change) {
        // Handle selection changes
        const allSelectedNodes = changes
          .filter((c): c is typeof change => c.type === 'select' && 'selected' in c && c.selected)
          .map(c => c.id);
        
        selectNodes(allSelectedNodes);
      }
    });
  }, [onNodesChange, updateNode, selectNodes]);

  // Handle ReactFlow edge changes and sync back to context
  const handleEdgesChange: OnEdgesChange = useCallback((changes: EdgeChange[]) => {
    onEdgesChange(changes);
    
    changes.forEach((change) => {
      if (change.type === 'remove') {
        deleteConnection(change.id);
      }
    });
  }, [onEdgesChange, deleteConnection]);

  // Handle new connections
  const onConnect: OnConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target && connection.sourceHandle && connection.targetHandle) {
      addConnection(
        connection.source,
        connection.sourceHandle,
        connection.target,
        connection.targetHandle
      );
    }
  }, [addConnection]);

  // Handle canvas click to clear selection
  const onPaneClick = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // Handle viewport changes
  const onMove = useCallback((_: any, viewport: { x: number; y: number; zoom: number }) => {
    updateCanvas({
      viewport: {
        x: viewport.x,
        y: viewport.y,
        zoom: viewport.zoom,
      }
    });
  }, [updateCanvas]);

  // Handle drag over for node dropping
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle node drop from palette
  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();

    const nodeType = event.dataTransfer.getData('application/reactflow');
    if (!nodeType) return;

    const reactFlowBounds = (event.target as Element).closest('.react-flow')?.getBoundingClientRect();
    if (!reactFlowBounds) return;

    const position = {
      x: event.clientX - reactFlowBounds.left - canvas.viewport.x,
      y: event.clientY - reactFlowBounds.top - canvas.viewport.y,
    };

    // Adjust for zoom
    position.x = position.x / canvas.viewport.zoom;
    position.y = position.y / canvas.viewport.zoom;

    addNode(nodeType, position);
  }, [addNode, canvas.viewport]);

  // Debug: Log nodeTypes being passed to ReactFlow whenever nodeTypes changes
  useEffect(() => {
    console.log('ReactFlow nodeTypes being passed:', Object.keys(nodeTypes));
  }, [nodeTypes]);

  // Category-based colors
  const getCategoryColor = (node: Node): string => {
    const nodeType = node.type;
    switch (nodeType) {
      case 'input':
      case 'output':
        return '#10b981';
      case 'json-parse': return '#3b82f6';
      case 'api-request': return '#10b981';
      case 'if-else': return '#84cc16';
      case 'llm': return '#ec4899';
      case 'structured-llm': return '#8b5cf6';
      case 'image-input': return '#f59e0b';
      case 'pdf-input': return '#3b82f6';
      case 'text': return '#84cc16';
      case 'math': return '#ec4899';
      default: return '#6b7280';
    }
  };

  return (
    <div className={`w-full h-full ${className}`}>
      <ReactFlow
        nodes={reactFlowNodes}
        edges={reactFlowEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onMove={onMove}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        defaultViewport={canvas.viewport}
        nodesDraggable={true}
        nodesConnectable={true}
        elementsSelectable={true}
        panOnDrag={true}
        selectNodesOnDrag={false}
        attributionPosition="bottom-left"
        className="bg-gray-50 dark:bg-gray-900"
        fitView={false}
        minZoom={0.1}
        maxZoom={3}
        deleteKeyCode={['Delete', 'Backspace']}
        multiSelectionKeyCode={['Meta', 'Ctrl']}
        zoomOnDoubleClick={false}
        key={`reactflow-${nodes.length}-${connections.length}`}
      >
        <Background 
          color="#e5e7eb" 
          gap={20} 
          size={1}
          className="dark:opacity-20"
        />
        <Controls 
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
        />
        <MiniMap 
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          nodeColor={getCategoryColor}
        />
      </ReactFlow>
    </div>
  );
};

const Canvas: React.FC<CanvasProps> = (props) => {
  return (
    <ReactFlowProvider>
      <CanvasContent {...props} />
    </ReactFlowProvider>
  );
};

export default Canvas; 