import { Node, Edge } from 'reactflow';
import { getNodeExecutor, hasNodeExecutor } from './nodeExecutors/NodeExecutorRegistry';

interface OllamaClient {
  // Add any required properties and methods here
  // This is a basic example, adjust according to your actual Ollama client implementation
  baseUrl: string;
  generate?: (options: any) => Promise<any>;
}

interface ExecutionPlan {
  nodes: Record<string, any>;
  edges: Record<string, any>;
  nodeInputs: Record<string, any>;
  executionOrder: string[];
}

export const generateExecutionPlan = (nodes: Node[], edges: Edge[]): ExecutionPlan => {
  const nodeMap: Record<string, any> = {};
  const edgeMap: Record<string, any> = {};
  const nodeInputs: Record<string, any> = {};
  const visited: Record<string, boolean> = {};
  const executionOrder: string[] = [];

  // Build node and edge maps for quick lookup
  nodes.forEach(node => {
    nodeMap[node.id] = node;
    nodeInputs[node.id] = {};
  });

  edges.forEach(edge => {
    if (!edgeMap[edge.target]) {
      edgeMap[edge.target] = [];
    }
    edgeMap[edge.target].push(edge);
  });

  // Helper function for depth-first traversal
  const visit = (nodeId: string) => {
    if (visited[nodeId]) return;
    visited[nodeId] = true;

    // Visit all parents first
    edges
      .filter(edge => edge.target === nodeId)
      .forEach(edge => {
        visit(edge.source);
      });

    // Add node to execution order after all dependencies are resolved
    executionOrder.push(nodeId);
  };

  // Start traversal from nodes without outgoing edges (terminal nodes)
  const terminalNodes = nodes.filter(
    node => !edges.some(edge => edge.source === node.id)
  );

  // If there are no terminal nodes, start from any node
  if (terminalNodes.length > 0) {
    terminalNodes.forEach(node => visit(node.id));
  } else if (nodes.length > 0) {
    visit(nodes[0].id);
  }

  // If not all nodes were visited, visit remaining nodes
  nodes.forEach(node => {
    if (!visited[node.id]) {
      visit(node.id);
    }
  });

  return {
    nodes: nodeMap,
    edges: edgeMap,
    nodeInputs,
    executionOrder
  };
};

export const executeFlow = async (
  plan: ExecutionPlan,
  updateNodeOutput: (nodeId: string, output: any) => void,
  ollamaClient: OllamaClient
) => {
  console.log('Executing flow with plan:', plan);

  // Map to store the output of each node
  const nodeOutputs: Record<string, any> = {};

  // Execute nodes in order
  for (const nodeId of plan.executionOrder) {
    const node = plan.nodes[nodeId];
    
    try {
      console.log(`Executing node: ${nodeId}, original type: "${node.type}"`);
      
      // Get all inputs for this node
      if (plan.edges[nodeId]) {
        for (const edge of plan.edges[nodeId]) {
          const sourceNodeId = edge.source;
          const sourceOutput = nodeOutputs[sourceNodeId];
          
          // Handle different input types based on source handle
          if (edge.sourceHandle) {
            plan.nodeInputs[nodeId][edge.sourceHandle] = sourceOutput;
          } else {
            plan.nodeInputs[nodeId][edge.targetHandle || 'default'] = sourceOutput;
          }
        }
      }
      
      // Debug: Log current registered executor keys (hardcoded known types)
      console.log("Known executor types: ", [
        "textInputNode",
        "imageInputNode",
        "llmPromptNode",
        "imageLlmPromptNode",
        "textOutputNode",
        "conditionalNode",
        "apiCallNode",
        "textCombinerNode",
        "markdownOutputNode",
        "staticTextNode", // Ensure this is included
        "imageTextLlmNode" 
      ]);
      
      // Normalize node type: if not found, try lowercasing the first letter.
      let nodeType = node.type;
      if (!hasNodeExecutor(nodeType)) {
        const normalizedType = node.type.charAt(0).toLowerCase() + node.type.slice(1);
        console.log(`Normalized node type from "${node.type}" to "${normalizedType}"`);
        nodeType = normalizedType;
      } else {
        console.log(`Executor found for node type "${node.type}" without normalization`);
      }
      
      if (hasNodeExecutor(nodeType)) {
        const executor = getNodeExecutor(nodeType);
        if (!executor) {
          throw new Error(`Executor registered but not found for node type: ${nodeType}`);
        }
        
        const result = await executor.execute({
          node,
          inputs: plan.nodeInputs[nodeId],
          updateNodeOutput,
          ollamaClient
        });
        
        nodeOutputs[nodeId] = result;
        console.log(`Node ${nodeId} executed successfully with result:`, result);
      } else {
        // Special case for imageLlmPromptNode - try to handle it directly if the registry failed
        if (node.type === 'ImageLlmPromptNode' || node.type === 'imageLlmPromptNode') {
          console.warn('No executor found for ImageLlmPromptNode; using fallback execution');
          const result = await handleImageLlmPromptFallback(node, plan.nodeInputs[nodeId], updateNodeOutput);
          nodeOutputs[nodeId] = result;
        } else {
          throw new Error(`No executor found for node type: ${node.type}`);
        }
      }
    } catch (error) {
      console.error(`Error executing node ${nodeId}:`, error);
      nodeOutputs[nodeId] = `Error: ${error instanceof Error ? error.message : String(error)}`;
      
      // Make sure output nodes get updated even on error
      if (node.type === 'textOutputNode' || node.type === 'markdownOutputNode') {
        updateNodeOutput(node.id, `Error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  return nodeOutputs;
};

// Fallback handler for ImageLlmPromptNode in case registration fails
async function handleImageLlmPromptFallback(node: any, inputs: any, updateNodeOutput: any) {
  try {
    // Log what we're receiving
    console.log('Fallback handling for Image LLM with inputs:', inputs);
    
    const imageData = inputs.image || inputs['image-in'] || Object.values(inputs)[0];
    if (!imageData) {
      throw new Error("No image input provided to Image LLM node");
    }

    const config = node.data.config || {};
    const model = config.model || node.data?.model;
    if (!model) {
      throw new Error("No model selected for Image LLM node");
    }
    
    const staticText = config.staticText || node.data?.staticText || 'Describe this image:';
    const ollamaUrl = config.ollamaUrl || node.data?.ollamaUrl;
    if (!ollamaUrl) {
      throw new Error("No Ollama URL configured for Image LLM node");
    }

    console.log(`Fallback Image LLM with model: ${model}`);
    console.log(`Using URL: ${ollamaUrl}`);
    
    // Process image data
    let processedImageData = imageData;
    if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
      processedImageData = imageData.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
    }
    
    // Make sure we're using the correct URL by trimming any trailing slashes
    const baseUrl = ollamaUrl.endsWith('/') ? ollamaUrl.slice(0, -1) : ollamaUrl;
    
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: staticText,
        images: [processedImageData],
        stream: false
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${error}`);
    }

    const result = await response.json();
    console.log('Fallback Image LLM response:', result);
    return result.response || "No response from model";
  } catch (error) {
    console.error("Error in Image LLM fallback execution:", error);
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}