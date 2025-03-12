import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeImageTextLlm = async (context: NodeExecutionContext) => {
  const { node, inputs, updateNodeOutput } = context;
  
  try {
    // Get image input
    const imageInput = inputs.image || inputs['image-in'] || '';
    if (!imageInput) {
      return "No image provided to Image-Text LLM";
    }

    // Get text input (prompt)
    const textInput = inputs.text || inputs['text-in'] || inputs['prompt'] || '';
    
    // Process image data - remove data URL prefix if present
    let processedImageData = imageInput;
    if (typeof imageInput === 'string' && imageInput.startsWith('data:image/')) {
      processedImageData = imageInput.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
    }

    // Get configuration data from all possible locations with detailed logging
    console.log('Node structure for debugging:', {
      id: node.id,
      type: node.type,
      configExists: !!node.data?.config,
      ollamaUrlInConfig: node.data?.config?.ollamaUrl,
      ollamaUrlDirect: node.data?.ollamaUrl
    });
    
    // Get configuration from the node
    const config = node.data?.config || {};
    
    // Get model name - NEVER use a hardcoded fallback model
    const model = config.model || node.data?.model;
    if (!model) {
      console.error('No model specified in node configuration');
      return "Error: No model selected. Please configure the node with a model.";
    }
    
    // Get system prompt
    const systemPrompt = config.systemPrompt || node.data?.systemPrompt || '';
    
    // Get URL - NEVER use a hardcoded fallback URL
    const ollamaUrl = config.ollamaUrl || node.data?.ollamaUrl;
    if (!ollamaUrl) {
      console.error('No Ollama URL specified in node configuration');
      return "Error: No Ollama URL configured. Please set the URL in the node settings.";
    }

    console.log(`EXECUTING Image-Text LLM`);
    console.log(`MODEL: ${model}`);
    console.log(`URL: ${ollamaUrl}`);
    
    // Make sure we're using the correct URL by trimming any trailing slashes
    const baseUrl = ollamaUrl.endsWith('/') ? ollamaUrl.slice(0, -1) : ollamaUrl;
    
    // Combine system prompt and user text if both exist
    const finalPrompt = systemPrompt 
      ? `${systemPrompt}\n\n${textInput || 'Describe this image:'}`
      : (textInput || 'Describe this image:');
    
    console.log(`Making API request to ${baseUrl}/api/generate`);
    
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: finalPrompt,
        images: [processedImageData],
        stream: false
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${error}`);
    }

    const result = await response.json();
    const output = result.response || "No response from model";
    
    if (updateNodeOutput) {
      updateNodeOutput(node.id, output);
    }
    
    return output;
  } catch (error) {
    console.error("Error in Image-Text LLM node execution:", error);
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
};

registerNodeExecutor('imageTextLlmNode', {
  execute: executeImageTextLlm
});
