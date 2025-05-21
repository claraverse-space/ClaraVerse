import React, { FC } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  NodeTypes,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  ReactFlowInstance
} from 'reactflow';
import 'reactflow/dist/style.css';
import { NodeMetadata } from '../appcreator_components/nodes/NodeRegistry';

interface FlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
  setReactFlowInstance: (instance: ReactFlowInstance) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  nodeTypes: NodeTypes;
  flowStyles: React.CSSProperties;
  isDark: boolean;
  reactFlowWrapper: React.RefObject<HTMLDivElement>;
  selectedTool: NodeMetadata | null;
  isDragging: boolean;
  isValidConnection?: (connection: Connection) => boolean;
  minimapStyle?: React.CSSProperties;
  minimapNodeColor?: (node: Node) => string;
  nodeStatuses: Record<string, 'running' | 'completed' | 'error'>;
}

function FlowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  setReactFlowInstance,
  onDrop,
  onDragOver,
  nodeTypes,
  flowStyles,
  isDark,
  reactFlowWrapper,
  selectedTool,
  isDragging,
  isValidConnection,
  minimapStyle,
  minimapNodeColor,
  ...props
}: FlowCanvasProps) {
  // Modify node status styling to use glow instead of animation
  const nodesWithStatus = nodes.map(node => ({
    ...node,
    className: `${node.className || ''} transition-shadow transition-border duration-300`,
    style: {
      ...node.style,
      boxShadow: props.nodeStatuses[node.id] === 'running'
        ? '0 0 12px 4px rgba(234, 179, 8, 0.3)' // Yellow glow for running
        : props.nodeStatuses[node.id] === 'completed'
        ? '0 0 12px 4px rgba(34, 197, 94, 0.3)' // Green glow for completed
        : props.nodeStatuses[node.id] === 'error'
        ? '0 0 12px 4px rgba(239, 68, 68, 0.3)' // Red glow for error
        : 'none',
      border: props.nodeStatuses[node.id]
        ? `2px solid ${
            props.nodeStatuses[node.id] === 'running'
              ? '#EAB308'
              : props.nodeStatuses[node.id] === 'completed'
              ? '#22C55E'
              : '#EF4444'
          }`
        : undefined,
      zIndex: props.nodeStatuses[node.id] ? 1000 : undefined
    }
  }));

  return (
    <div 
      ref={reactFlowWrapper}
      className="flex-1 h-full" 
      onDrop={onDrop} 
      onDragOver={onDragOver}
      style={{
        '--tw-translate-x': '0',
        '--tw-translate-y': '0',
      }}
    >
      <style>
        {`
          .noflow {
            pointer-events: none;
          }
          .noflow * {
            pointer-events: auto;
          }
          .react-flow__node.noflow {
            pointer-events: none !important;
          }
          .react-flow__node.noflow .nodrag {
            pointer-events: auto !important;
          }
        `}
      </style>
      <ReactFlow
        nodes={nodesWithStatus}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        style={flowStyles}
        fitView
        isValidConnection={isValidConnection}
      >
        <Background 
          color={isDark ? '#374151' : '#E5E7EB'} 
          gap={16} 
          size={1}
        />
        <Controls className={isDark ? 'dark-controls' : ''} />
        <MiniMap 
          style={minimapStyle || { backgroundColor: isDark ? '#374151' : '#F9FAFB' }}
          nodeStrokeWidth={3}
          nodeBorderRadius={2}
          nodeStrokeColor={isDark ? '#1F2937' : '#F9FAFB'}
          nodeColor={minimapNodeColor || ((_node) => isDark ? '#9ca3af' : '#fff')}
        />
      </ReactFlow>
      {isDragging && selectedTool && (
        <div className="pointer-events-none fixed p-2 rounded-md bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="flex items-center gap-2">
            <div className={`p-1 rounded-md ${selectedTool.color} text-white`}>
              {React.createElement(selectedTool.icon, { className: "w-4 h-4" })}
            </div>
            <span className="text-sm font-medium">{selectedTool.name}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(FlowCanvas);
