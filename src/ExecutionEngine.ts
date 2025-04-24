import { OllamaClient } from './utils/OllamaClient';
import { Node, Edge } from 'reactflow';
// Add import for NodeExecutorRegistry
import { getNodeExecutor } from './nodeExecutors/NodeExecutorRegistry';

const DEFAULT_LOCALHOST_URL = 'http://localhost:11434';
const DEFAULT_DOCKER_URL = 'http://host.docker.internal:11434';

export interface ExecutionPlan {
  nodes: Node[];
  edges: Edge[];
  config: {
    ollama?: {
      baseUrl: string;
    };
  };
}

export interface NodeOutput {
  nodeId: string;
  output: any;
  type?: 'text' | 'image' | 'json';
  isImage?: boolean;
  status?: 'running' | 'completed' | 'error';
}

export interface ExecutionContext {
  nodeOutputs: { [nodeId: string]: any };
  ollamaClient: OllamaClient;
  setNodeOutput?: (nodeId: string, output: any) => void;
  onMessage?: (output: NodeOutput) => void;  // Add this line
  updateUi?: (type: string, nodeId: string, data: any) => void;
  updateNodeStatus?: (nodeId: string, status: 'running' | 'completed' | 'error') => void;
  apiConfig: {
    type: 'ollama';
    baseUrl: string;
  };
}

/**
 * Tests connection to an Ollama instance
 */
async function testOllamaConnection(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    
    const response = await fetch(`${url}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn(`Failed to connect to Ollama at ${url}:`, error);
    return false;
  }
}

/**
 * Generates an execution plan from the given nodes and edges.
 * If any node of type 'baseLlmNode' has a configured Ollama URL,
 * that URL is used in the plan configuration.
 */
export function generateExecutionPlan(nodes: Node[], edges: Edge[]): ExecutionPlan {
  // Look for LLM nodes to extract the Ollama base URL
  const llmNodes = nodes.filter((node) => node.type === 'baseLlmNode');
  const configuredUrl = llmNodes.length > 0 ? llmNodes[0].data.config?.ollamaUrl : null;

  const config: any = {
    ollama: { baseUrl: configuredUrl || DEFAULT_LOCALHOST_URL }
  };

  return { nodes, edges, config };
}

/**
 * Finds nodes that are ready to execute – those with no incoming edges or whose source nodes have already been processed.
 */
function findReadyNodes(
  remainingNodes: Node[],
  processedNodeIds: Set<string>,
  edges: Edge[]
): Node[] {
  return remainingNodes.filter((node) => {
    const incomingEdges = edges.filter((edge) => edge.target === node.id);
    return (
      incomingEdges.length === 0 ||
      incomingEdges.every((edge) => processedNodeIds.has(edge.source))
    );
  });
}

/**
 * Executes a single node given the execution context.
 * Each node type should have a registered executor. The switch statement
 * below should only be used as a fallback for node types without executors.
 */
async function executeNode(
  node: Node,
  context: ExecutionContext,
  outputHandledNodes: Set<string>
): Promise<any> {
  const { nodeOutputs, ollamaClient, setNodeOutput, updateUi, updateNodeStatus, apiConfig } = context;

  // Update node status to running
  if (updateNodeStatus) {
    updateNodeStatus(node.id, 'running');
  }

  try {
    const executor = getNodeExecutor(node.type);
    if (executor) {
      const trackingUpdateNodeOutput = setNodeOutput
        ? (nodeId: string, output: any) => {
            outputHandledNodes.add(nodeId);
            setNodeOutput(nodeId, output);
            
            if (updateUi) {
              const isImage = typeof output === 'string' && output.startsWith('data:image');
              updateUi(isImage ? 'image' : 'text', nodeId, output);
            }
          }
        : undefined;

      const result = await executor.execute({
        node,
        inputs: nodeOutputs,
        ollamaClient,
        updateNodeOutput: trackingUpdateNodeOutput,
        apiConfig
      });

      // Update node status to completed
      if (updateNodeStatus) {
        updateNodeStatus(node.id, 'completed');
      }

      return result;
    }

    // Fall back to basic handling for node types without registered executors
    // This is a temporary fallback - ideally all node types should have registered executors
    console.warn(`No registered executor found for node type: ${node.type}`);
    
    // Simple fallback implementation for basic node types
    if (node.type === 'textInputNode') {
      return node.data.config?.text || '';
    } 
    else if (node.type === 'staticTextNode') {
      return node.data.config?.staticText || '';
    }
    else if (node.type === 'textOutputNode' || node.type === 'markdownOutputNode') {
      const inputValue = Object.values(nodeOutputs)[0];
      return inputValue !== undefined 
        ? (typeof inputValue === 'string' ? inputValue : JSON.stringify(inputValue)) 
        : 'No input received';
    }
    
    // Log unhandled node types and return a message
    return `Unhandled node type: ${node.type} - Please implement a proper executor for this node type`;
  } catch (error) {
    // Update node status to error
    if (updateNodeStatus) {
      updateNodeStatus(node.id, 'error');
    }
    throw error;
  }
}

/**
 * Executes the flow based on the execution plan.
 * Processes nodes in an order such that a node is executed only when all its input dependencies have been resolved.
 */
export async function executeFlow(
  plan: ExecutionPlan,
  setNodeOutput?: (nodeId: string, output: any) => void,
  updateUi?: (type: string, nodeId: string, data: any) => void,
  updateNodeStatus?: (nodeId: string, status: 'running' | 'completed' | 'error') => void
): Promise<Map<string, any>> {
  // Test connection and determine the correct URL
  let baseUrl: string;
  
  // Get configured URL or use default
  if (plan.config.ollama?.baseUrl) {
    baseUrl = plan.config.ollama.baseUrl;
  } else {
    baseUrl = DEFAULT_LOCALHOST_URL;
  }
  
  // If using default URL, test connection and potentially use fallback
  if (baseUrl === DEFAULT_LOCALHOST_URL) {
    const localhostWorks = await testOllamaConnection(DEFAULT_LOCALHOST_URL);
    if (!localhostWorks) {
      console.log('Falling back to host.docker.internal');
      baseUrl = DEFAULT_DOCKER_URL;
    }
  }

  // Initialize the Ollama client using the determined baseUrl
  const ollamaClient = new OllamaClient(baseUrl);

  // Create API config
  const apiConfig = {
    type: 'ollama' as const,
    baseUrl: baseUrl,
  };

  // Storage for node outputs.
  const nodeOutputs: { [nodeId: string]: any } = {};
  const processedNodeIds = new Set<string>();

  // Build a map of node connections.
  const nodeConnections: { [nodeId: string]: { sourceId: string; sourceHandle: string; targetHandle: string }[] } = {};
  plan.edges.forEach((edge) => {
    if (!nodeConnections[edge.target]) {
      nodeConnections[edge.target] = [];
    }
    nodeConnections[edge.target].push({
      sourceId: edge.source,
      sourceHandle: edge.sourceHandle || 'default',
      targetHandle: edge.targetHandle || 'default'
    });
  });

  // Build a map of outgoing connections keyed by source node and handle
  const outgoingConnections: { [nodeId: string]: { [handleId: string]: string[] } } = {};
  plan.edges.forEach((edge) => {
    const sourceId = edge.source;
    const sourceHandle = edge.sourceHandle || 'default';
    const targetId = edge.target;
    
    if (!outgoingConnections[sourceId]) {
      outgoingConnections[sourceId] = {};
    }
    
    if (!outgoingConnections[sourceId][sourceHandle]) {
      outgoingConnections[sourceId][sourceHandle] = [];
    }
    
    outgoingConnections[sourceId][sourceHandle].push(targetId);
  });

  // Copy of nodes to track what remains.
  let remainingNodes = [...plan.nodes];

  // Set to track nodes that have already handled their own output
  const outputHandledNodes = new Set<string>();

  // Execution context.
  const context: ExecutionContext = {
    nodeOutputs,
    ollamaClient,
    setNodeOutput,
    updateUi,
    updateNodeStatus,
    apiConfig
  };

  // Process nodes until none remain.
  while (remainingNodes.length > 0) {
    const readyNodes = findReadyNodes(remainingNodes, processedNodeIds, plan.edges);
    if (readyNodes.length === 0) {
      console.error('Execution deadlock - some nodes could not be processed');
      break;
    }

    for (const node of readyNodes) {
      // Gather inputs from connected source nodes.
      const inputs: { [key: string]: any } = {};
      if (nodeConnections[node.id]) {
        nodeConnections[node.id].forEach((conn) => {
          // Store by both source ID and target handle for flexibility
          inputs[conn.sourceId] = nodeOutputs[conn.sourceId];
          // Additionally store by target handle ID for nodes that need it (like concatTextNode)
          if (conn.targetHandle) {
            inputs[conn.targetHandle] = nodeOutputs[conn.sourceId];
          }
        });
      }
      
      try {
        const output = await executeNode(node, { ...context, nodeOutputs: inputs }, outputHandledNodes);
        nodeOutputs[node.id] = output;
        processedNodeIds.add(node.id);
        
        // Special handling for conditional nodes
        if (node.type === 'conditionalNode') {
          // Forward the input to the appropriate output handle based on the condition result
          if (output && typeof output === 'object' && 'result' in output) {
            const handleId = output.result ? 'true-out' : 'false-out';
            const targetNodeIds = outgoingConnections[node.id]?.[handleId] || [];
            
            // For each target connected to the appropriate output handle
            for (const targetId of targetNodeIds) {
              if (setNodeOutput) {
                // Pass the input text to the next node based on the condition result
                setNodeOutput(targetId, output.output || '');
              }
            }
          }
        } 
        // Only call setNodeOutput if:
        // 1. It's not a conditional node OR it doesn't have the expected format AND
        // 2. The node hasn't already handled its own output through an executor
        else if (setNodeOutput && !outputHandledNodes.has(node.id)) {
          setNodeOutput(node.id, output);
        }
      } catch (error) {
        processedNodeIds.add(node.id);
        nodeOutputs[node.id] = `Error: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`Error executing node ${node.id}:`, error);
      }
    }
    // Remove processed nodes from the remaining list.
    remainingNodes = remainingNodes.filter((node) => !processedNodeIds.has(node.id));
  }
  
  return new Map(Object.entries(nodeOutputs));
}
