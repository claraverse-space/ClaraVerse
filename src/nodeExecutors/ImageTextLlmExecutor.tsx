import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';
import { OllamaClient } from '../utils/OllamaClient';

const executeImageTextLlm = async (context: NodeExecutionContext): Promise<string> => {
  const { node, inputs, ollamaClient, apiConfig } = context;

  try {
    // Get the image input and text input from the node inputs
    let imageInput: string | null = null;
    let textInput: string = '';

    // Process inputs and convert image buffer to base64 if needed
    Object.entries(inputs).forEach(([sourceId, output]) => {
      if (output instanceof ArrayBuffer || output instanceof Uint8Array) {
        // Convert buffer to base64
        const buffer = output instanceof ArrayBuffer ? new Uint8Array(output) : output;
        const base64 = Buffer.from(buffer).toString('base64');
        imageInput = `data:image/png;base64,${base64}`;
      } else if (typeof output === 'string') {
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

    // Extract configuration values from the node
    const config = node.data.config || {};
    const model = config.model || node.data?.model;
    if (!model) {
      return "Error: No model selected. Please configure the node with a model.";
    }
    
    const systemPrompt = config.systemPrompt || node.data?.systemPrompt || '';
    const ollamaUrl = config.ollamaUrl || node.data?.ollamaUrl;
    
    // Determine which API to use (from node config or from global context)
    const useOpenAI = apiConfig?.type === 'openai' || config.apiType === 'openai';
    
    if (!ollamaUrl && !ollamaClient && !useOpenAI) {
      return "Error: No API URL configured. Please set the URL in the node settings.";
    }

    // Combine system prompt and user text if both exist
    const finalPrompt = systemPrompt 
      ? `${systemPrompt}\n\n${textInput || 'Describe this image:'}`
      : (textInput || 'Describe this image:');

    // Use the provided ollamaClient or create a new one with the right configuration
    let client = ollamaClient;
    
    // If no client provided or we need to override the API type
    if (!client || (useOpenAI && client.getConfig().type !== 'openai')) {
      if (useOpenAI) {
        // Use OpenAI configuration
        client = new OllamaClient(
          apiConfig?.baseUrl || config.openaiUrl || 'https://api.openai.com/v1', 
          {
            apiKey: apiConfig?.apiKey || config.apiKey || '',
            type: 'openai'
          }
        );
        console.log('Using OpenAI for vision tasks with', model);
      } else {
        // Use Ollama configuration
        client = new OllamaClient(ollamaUrl, { type: 'ollama' });
        console.log('Using Ollama for vision tasks with', model);
      }
    }
    
    // Use generate API for image inputs with the appropriate client
    console.log('Using multimodal generation with image and text');
    
    const response = await client.generateWithImages(
      model,
      finalPrompt,
      [processedImageData],
      { stream: false }
    );
    
    // Extract and return the response content
    return response?.response || 'No response from model';
  } catch (error) {
    console.error('Error in Image-Text LLM node execution:', error);
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
};

registerNodeExecutor('imageTextLlmNode', {
  execute: executeImageTextLlm,
});
