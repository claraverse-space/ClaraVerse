import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeImageTextLlm = async (context: NodeExecutionContext): Promise<string> => {
  const { node, inputs, ollamaClient } = context;

  try {
    // Get the image input and text input from the node inputs
    let imageInput: string | null = null;
    let textInput: string = '';

    // Process all outputs that have been passed to this node
    Object.entries(inputs).forEach(([sourceId, output]) => {
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

    // Process image data – remove data URL prefix if present
    let processedImageData = imageInput;
    if (typeof imageInput === 'string') {
      // Strip off any data URL prefix to get pure base64
      if (imageInput.includes('base64,')) {
        processedImageData = imageInput.split('base64,')[1];
      } else if (imageInput.startsWith('data:')) {
        // Alternative handling for other data URL formats
        processedImageData = imageInput.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
      }
      
      // Ensure we have clean base64 without any whitespace
      processedImageData = processedImageData.trim();
    }

    // Log the first few characters for debugging
    console.log(`Processed image data (first 20 chars): ${processedImageData.substring(0, 20)}...`);

    // Extract configuration values from the node
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

    // Ensure the base URL has no trailing slash
    const baseUrl = ollamaUrl.endsWith('/') ? ollamaUrl.slice(0, -1) : ollamaUrl;
    
    // Use generate API for image inputs
    console.log('Using multimodal generation with image and text');
    console.log(`URL: ${baseUrl}/api/generate`);
    
    const response = await ollamaClient.generateWithImages(
      model,
      finalPrompt,
      [processedImageData],
      { stream: false },
      baseUrl  // Pass the base URL to the client
    );
    
    // Extract and return the response content
    return response?.response || 'No response from Ollama';
  } catch (error) {
    console.error('Error in Image-Text LLM node execution:', error);
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
};

registerNodeExecutor('imageTextLlmNode', {
  execute: executeImageTextLlm,
});
