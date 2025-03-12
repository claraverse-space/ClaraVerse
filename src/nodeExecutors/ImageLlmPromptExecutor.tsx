import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

// Export the function so we can import it elsewhere for direct registration
export const executeImageLlmPrompt = async (context: NodeExecutionContext) => {
  const { node, inputs } = context;
  
  console.log('[ImageLlmPromptExecutor] Received inputs:', inputs);
  console.log('[ImageLlmPromptExecutor] Node details:', { id: node.id, type: node.type });
  
  try {
    // Determine image data from any input field
    const imageData = inputs.image || inputs['image-in'] || Object.values(inputs)[0];
    
    if (!imageData) {
      console.error('[ImageLlmPromptExecutor] No image input found:', inputs);
      throw new Error("No image input provided to Image LLM node");
    }
    
    console.log('[ImageLlmPromptExecutor] Found image data. Snippet:',
      typeof imageData === 'string' ? imageData.substring(0, 50) + '...' : 'non-string data'
    );
    
    const config = node.data.config || {};
    const model = config.model || 'llava';
    const staticText = config.staticText || 'Describe this image:';
    const ollamaUrl = config.ollamaUrl || 'http://localhost:11434';
    
    console.log(`[ImageLlmPromptExecutor] Executing with model: ${model}, prompt: "${staticText}"`);
    
    // Process image data if needed
    let processedImageData = imageData;
    if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
      processedImageData = imageData.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
      console.log('[ImageLlmPromptExecutor] Processed image data to remove data URL prefix.');
    }
    
    console.log(`[ImageLlmPromptExecutor] Sending request to ${ollamaUrl}/api/generate`);
    const response = await fetch(`${ollamaUrl}/api/generate`, {
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
    
    console.log('[ImageLlmPromptExecutor] Response status:', response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ImageLlmPromptExecutor] API error response:', errorText);
      throw new Error(`Ollama API error: ${errorText}`);
    }
    
    const result = await response.json();
    console.log('[ImageLlmPromptExecutor] API response received:', result);
    return result.response || "No response from model";
  } catch (error) {
    console.error("[ImageLlmPromptExecutor] Error executing Image LLM node:", error);
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
};

console.log('[ImageLlmPromptExecutor] Registering imageLlmPromptNode executor');
registerNodeExecutor('imageLlmPromptNode', {
  execute: executeImageLlmPrompt
});
console.log('[ImageLlmPromptExecutor] Registered imageLlmPromptNode executor');
