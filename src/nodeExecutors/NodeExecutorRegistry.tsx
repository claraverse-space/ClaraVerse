import { Node } from 'reactflow';

export interface NodeExecutionContext {
  inputs: Record<string, any>;
  node: Node;
  updateNodeOutput?: (nodeId: string, output: any) => void;
}

export interface NodeExecutor {
  execute: (context: NodeExecutionContext) => Promise<any>;
}

// Registry to store executor functions by node type
const executorRegistry: Record<string, NodeExecutor> = {};

// Register an executor for a node type
export const registerNodeExecutor = (nodeType: string, executor: NodeExecutor) => {
  executorRegistry[nodeType] = executor;
  console.log(`Registered executor for node type: ${nodeType}`);
};

// Get an executor for a node type
export const getNodeExecutor = (nodeType: string): NodeExecutor | undefined => {
  return executorRegistry[nodeType];
};

// Check if a node type has a registered executor
export const hasNodeExecutor = (nodeType: string): boolean => {
  return !!executorRegistry[nodeType];
};
