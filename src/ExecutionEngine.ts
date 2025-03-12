import { OllamaClient } from './utils/OllamaClient';
import { Node, Edge } from 'reactflow';

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
 * Each node type is handled in its respective branch.
 */
async function executeNode(
  node: Node,
  context: ExecutionContext
): Promise<any> {
  const { nodeOutputs, ollamaClient } = context;

  switch (node.type) {
    case 'textInputNode': {
      // Returns the configured text.
      return node.data.config.text || '';
    }

    case 'textOutputNode': {
      // For a text output node, get the first input from connected nodes
      const inputValues = Object.values(nodeOutputs);
      // If we have any input, use the first one
      if (inputValues.length > 0) {
        const input = inputValues[0];
        return typeof input === 'string' ? input : JSON.stringify(input);
      }
      return 'No input received';
    }

    case 'markdownOutputNode': {
      // Similar to text output, but intended for markdown display
      const inputValues = Object.values(nodeOutputs);
      if (inputValues.length > 0) {
        const input = inputValues[0];
        return typeof input === 'string' ? input : JSON.stringify(input);
      }
      return 'No input received';
    }

    case 'textCombinerNode': {
      // Get the input text from connected nodes
      const inputValues = Object.values(nodeOutputs);
      let inputText = '';
      
      // Combine all inputs
      if (inputValues.length > 0) {
        const input = inputValues[0];
        inputText = typeof input === 'string' ? input : JSON.stringify(input);
      }
      
      // Combine with the additional text from the node config
      const additionalText = node.data.config.additionalText || '';
      return `${inputText}${additionalText}`;
    }

    case 'imageInputNode': {
      // First check for a runtime image, then fall back to the configured image
      return node.data.runtimeImage || node.data.config.image || null;
    }

    case 'llmPromptNode': {
      // Collect inputs from all connected nodes.
      let inputText = '';
      let images: string[] = [];
      let hasImage = false;

      // Process all outputs that have been passed to this node.
      Object.entries(nodeOutputs).forEach(([sourceId, output]) => {
        if (typeof output === 'string') {
          if (output.startsWith('data:image')) {
            // Handle base64 image strings
            hasImage = true;
            // Extract base64 content without the prefix
            images.push(output.split(',')[1]);
          } else if (output.trim() !== '') {
            // Handle text input
            inputText += output + '\n';
          }
        } else if (output && typeof output === 'object') {
          // Handle different image object formats
          if (output.base64) {
            hasImage = true;
            // For base64 data, ensure we don't have the data:image prefix
            const base64Data = output.base64.includes('data:image') 
              ? output.base64.split(',')[1] 
              : output.base64;
            images.push(base64Data);
          } else if (output.src) {
            hasImage = true;
            // If src contains base64 data with prefix, extract it
            const base64Data = output.src.includes('data:image') 
              ? output.src.split(',')[1] 
              : output.src;
            images.push(base64Data);
          } else if (output.data) {
            hasImage = true;
            // If data contains base64 data with prefix, extract it
            const base64Data = output.data.includes('data:image') 
              ? output.data.split(',')[1] 
              : output.data;
            images.push(base64Data);
          } else if (output.url) {
            // If it's a URL to an image, add it as text for now
            inputText += output.url + '\n';
          }
        }
      });

      // Fallback: if no text has been accumulated, use the first available input.
      if (!inputText && Object.values(nodeOutputs).length > 0 && !hasImage) {
        const firstValue = Object.values(nodeOutputs)[0];
        if (typeof firstValue === 'string') {
          inputText = firstValue;
        }
      }

      const systemPrompt = node.data.config.prompt || '';
      const model = node.data.config.model;
      if (!model) {
        return 'Error: No model selected';
      }

      try {
        let response;
        
        if (hasImage && images.length > 0) {
          // Use generate API for image inputs with simplified parameters schema
          console.log('Using multimodal generation with image');
          response = await ollamaClient.generateWithImages(
            model,
            inputText.trim(),
            images,
            { stream: false }  // Simplified schema without system and num_predict
          );
        } else {
          // Use chat API for text-only inputs
          console.log('Using chat API for text-only input');
          const messages = [
            { role: "system" as const, content: systemPrompt },
            { role: "user" as const, content: inputText.trim() }
          ];
          response = await ollamaClient.sendChat(
            model,
            messages,
            { num_predict: 1000 }
          );
        }
        
        // Extract response content regardless of API used
        if (response) {
          if (response.message) {
            return response.message.content;
          } else if (response.response) {
            return response.response;
          } else {
            return 'No response from Ollama';
          }
        } else {
          return 'No response from Ollama';
        }
      } catch (error) {
        console.error('LLM error:', error);
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    case 'conditionalNode': {
      // Gets the first available input text.
      const inputText = Object.values(nodeOutputs)[0] || '';
      try {
        const condition = node.data.config.condition || '';
        let result = false;

        // If the condition is of the form contains('substring')
        if (condition.includes('contains(')) {
          const match = condition.match(/contains\(['"](.+)['"]\)/);
          const searchTerm = match ? match[1] : '';
          if (searchTerm) {
            result = String(inputText).includes(searchTerm);
          }
        } else if (condition.trim()) {
          // Simple check - directly look for the condition text in the input
          result = String(inputText).includes(condition);
        }
        
        console.log(`Condition check result for "${condition}": ${result}`);
        return { result, output: inputText };
      } catch (error) {
        console.error('Condition error:', error);
        return { result: false, output: inputText, error: String(error) };
      }
    }

    case 'apiCallNode': {
      // Gets the first available input text.
      const inputText = Object.values(nodeOutputs)[0] || '';
      const method = node.data.config.method || 'GET';
      const endpoint = node.data.config.endpoint || '';
      if (!endpoint) {
        return JSON.stringify({
          input: inputText,
          output: 'Error: No API endpoint specified'
        });
      }
      try {
        const response = await fetch(endpoint, {
          method,
          headers: {
            'Content-Type': 'application/json'
          },
          body: method !== 'GET' && inputText ? JSON.stringify(inputText) : undefined
        });
        if (!response.ok) {
          // Clone the response to read its text without consuming the stream
          const errorText = await response.clone().text();
          return JSON.stringify({
            input: inputText,
            output: `API error: ${response.status} ${response.statusText}. ${errorText}`
          });
        }
        let apiResponse;
        try {
          // Clone the response before reading its body as JSON
          apiResponse = await response.clone().json();
        } catch {
          // Clone again if necessary to read as text
          apiResponse = await response.clone().text();
        }
        return JSON.stringify({
          input: inputText,
          output: apiResponse
        });
      } catch (error) {
        console.error('API error:', error);
        return JSON.stringify({
          input: inputText,
          output: `Error: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }

    case 'imageTextLlmNode': {
      // Get the image input
      let imageInput = null;
      // Get the text input
      let textInput = '';
      
      // Process all outputs that have been passed to this node.
      Object.entries(nodeOutputs).forEach(([sourceId, output]) => {
        if (typeof output === 'string') {
          if (output.startsWith('data:image')) {
            // Handle base64 image strings
            imageInput = output;
          } else if (output.trim() !== '') {
            // Handle text input
            textInput += output + '\n';
          }
        } else if (output && typeof output === 'object') {
          // Handle different image object formats
          if (output.base64) {
            imageInput = output.base64;
          } else if (output.src) {
            imageInput = output.src;
          } else if (output.data) {
            imageInput = output.data;
          } else if (output.url) {
            // If it's a URL to an image, add it as text for now
            textInput += output.url + '\n';
          }
        }
      });
      
      if (!imageInput) {
        return "No image provided to Image-Text LLM";
      }

      // Process image data - remove data URL prefix if present
      let processedImageData = imageInput;
      if (typeof imageInput === 'string' && imageInput.startsWith('data:image/')) {
        processedImageData = imageInput.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
      }

      const config = node.data.config || {};
      const model = config.model || node.data?.model;
      if (!model) {
        return "Error: No model selected. Please configure the node with a model.";
      }
      
      const systemPrompt = config.systemPrompt || node.data?.systemPrompt || '';
      const ollamaUrl = config.ollamaUrl || node.data?.ollamaUrl;
      if (!ollamaUrl) {
        return "Error: No Ollama URL configured. Please set the URL in the node settings.";
      }

      // Combine system prompt and user text if both exist
      const finalPrompt = systemPrompt 
        ? `${systemPrompt}\n\n${textInput || 'Describe this image:'}`
        : (textInput || 'Describe this image:');

      try {
        // Make sure we're using the correct URL by trimming any trailing slashes
        const baseUrl = ollamaUrl.endsWith('/') ? ollamaUrl.slice(0, -1) : ollamaUrl;
        
        // Use generate API for image inputs
        console.log('Using multimodal generation with image and text');
        console.log(`URL: ${baseUrl}/api/generate`);
        
        const response = await ollamaClient.generateWithImages(
          model,
          finalPrompt,
          [processedImageData],
          { stream: false },
          baseUrl  // Pass the baseUrl to the client
        );
        
        // Extract response content
        return response?.response || 'No response from Ollama';
      } catch (error) {
        console.error('Image-Text LLM error:', error);
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    }

    default: {
      return `Unsupported node type: ${node.type}`;
    }
  }
}

/**
 * Execute a text combiner node
 */
async function executeTextCombinerNode(node: any, inputs: any[], updateNodeOutput: (nodeId: string, output: any) => void): Promise<string> {
  const inputText = inputs[0] || '';
  const additionalText = node.data.config?.additionalText || '';
  
  // Combine the input text with the additional text
  const combinedText = `${inputText}${additionalText}`;
  
  // Update node output for UI updates (but this won't be saved to DB)
  updateNodeOutput(node.id, inputText); // Only for displaying in UI
  
  // Return the combined result
  return combinedText;
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
  const nodeConnections: { [nodeId: string]: { sourceId: string; sourceHandle: string }[] } = {};
  plan.edges.forEach((edge) => {
    if (!nodeConnections[edge.target]) {
      nodeConnections[edge.target] = [];
    }
    nodeConnections[edge.target].push({
      sourceId: edge.source,
      sourceHandle: edge.sourceHandle || 'default'
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
      const inputs: { [sourceId: string]: any } = {};
      if (nodeConnections[node.id]) {
        nodeConnections[node.id].forEach((conn) => {
          inputs[conn.sourceId] = nodeOutputs[conn.sourceId];
        });
      }
      
      try {
        const output = await executeNode(node, { ...context, nodeOutputs: inputs });
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
        else if (setNodeOutput) {
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
