import React from 'react';
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
import { ToolItem } from '../AppCreator';

interface FlowCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
  reactFlowInstance: ReactFlowInstance | null;
  setReactFlowInstance: (instance: ReactFlowInstance) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  nodeTypes: NodeTypes;
  flowStyles: React.CSSProperties;
  isDark: boolean;
  reactFlowWrapper: React.RefObject<HTMLDivElement>;
  selectedTool: ToolItem | null;
  isDragging: boolean;
  isValidConnection?: (connection: Connection) => boolean;
  minimapStyle?: React.CSSProperties;
  minimapNodeColor?: (node: Node) => string;
  nodeStyle?: (node: Node) => React.CSSProperties;
}

const FlowCanvas: React.FC<FlowCanvasProps> = ({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  reactFlowInstance,
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
  nodeStyle
}) => {
  return (
    <div 
      ref={reactFlowWrapper}
      className="flex-1 h-full" 
      onDrop={onDrop} 
      onDragOver={onDragOver}
    >
      <ReactFlow
        nodes={nodes}
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
          nodeColor={minimapNodeColor || ((node) => isDark ? '#9ca3af' : '#fff')}
        />
      </ReactFlow>
      {isDragging && selectedTool && (
        <div className="pointer-events-none fixed p-2 rounded-md bg-white dark:bg-gray-800 shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="flex items-center gap-2">
            <div className={`p-1 rounded-md ${selectedTool.color} text-white`}>
              {React.createElement(selectedTool.icon, { className: "w-4 h-4" })}
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {selectedTool.name}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(FlowCanvas);
