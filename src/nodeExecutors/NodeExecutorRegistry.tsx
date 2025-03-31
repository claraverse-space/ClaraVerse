import { Node } from 'reactflow';
import { OllamaClient } from '../utils/OllamaClient';

// Define the context that will be passed to node executors
export interface NodeExecutionContext {
  node: Node;
  inputs: { [key: string]: any };
  ollamaClient: OllamaClient;
  apiConfig: {
    type: 'ollama' | 'openai';
    baseUrl: string;
    apiKey?: string;
  };
  updateNodeOutput?: (nodeId: string, output: any) => void;
}

// Define the interface for node executors
export interface NodeExecutor {
  execute: (context: NodeExecutionContext) => Promise<any>;
  uploadFile?: (file: File, collectionName: string) => Promise<string>;
}

// Registry to store node executors
const nodeExecutorRegistry: Map<string, NodeExecutor> = new Map();

// Register a node executor
export function registerNodeExecutor(nodeType: string, executor: NodeExecutor): void {
  nodeExecutorRegistry.set(nodeType, executor);
}

// Get a registered node executor
export function getNodeExecutor(nodeType: string): NodeExecutor | undefined {
  return nodeExecutorRegistry.get(nodeType);
}

// Check if an executor exists for a specific node type
export function hasNodeExecutor(nodeType: string): boolean {
  return nodeExecutorRegistry.has(nodeType);
}
