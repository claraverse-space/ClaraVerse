import { OllamaClient } from './utils/OllamaClient';
import { Node, Edge } from 'reactflow';
// Add import for NodeExecutorRegistry
import { getNodeExecutor } from './nodeExecutors/NodeExecutorRegistry';

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
  outputs: {
    [handleId: string]: any;
  };
  type?: 'text' | 'image' | 'json';
  mimeType?: string;
}

export interface ExecutionContext {
  nodeOutputs: { [nodeId: string]: any };
  ollamaClient: OllamaClient;
  setNodeOutput?: (nodeId: string, output: any) => void;
}

/**
 * Generates an execution plan from the given nodes and edges.
 * If any node of type 'llmPromptNode' has a configured Ollama URL,
 * that URL is used in the plan configuration.
 */
export function generateExecutionPlan(nodes: Node[], edges: Edge[]): ExecutionPlan {
  const config: any = {
    ollama: { baseUrl: 'http://localhost:11434' }
  };

  // Look for LLM nodes to extract the Ollama base URL
  const llmNodes = nodes.filter((node) => node.type === 'llmPromptNode');
  if (llmNodes.length > 0 && llmNodes[0].data.config?.ollamaUrl) {
    config.ollama.baseUrl = llmNodes[0].data.config.ollamaUrl;
  }

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
  const { nodeOutputs, ollamaClient, setNodeOutput } = context;

  // First check if there's a registered executor for this node type
  const executor = getNodeExecutor(node.type);
  if (executor) {
    // Create a tracking function to know if the executor handled the output
    const trackingUpdateNodeOutput = setNodeOutput
      ? (nodeId: string, output: any) => {
          outputHandledNodes.add(nodeId); // Track that this node's output was handled
          setNodeOutput(nodeId, output);
        }
      : undefined;

    // Create NodeExecutionContext for the executor
    const executionContext = {
      node,
      inputs: nodeOutputs,
      ollamaClient,
      updateNodeOutput: trackingUpdateNodeOutput
    };
    
    try {
      return await executor.execute(executionContext);
    } catch (error) {
      console.error(`Error in node executor for ${node.type}:`, error);
      return `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
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
}


/**
 * Executes the flow based on the execution plan.
 * Processes nodes in an order such that a node is executed only when all its input dependencies have been resolved.
 */
export async function executeFlow(
  plan: ExecutionPlan,
  setNodeOutput?: (nodeId: string, output: any) => void
): Promise<Map<string, any>> {
  // Initialize the Ollama client using the baseUrl from the execution plan.
  const ollamaClient = new OllamaClient(plan.config.ollama.baseUrl);

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
    setNodeOutput
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
