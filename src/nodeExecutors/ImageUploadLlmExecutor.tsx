import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeImageUploadLlm = async (context: NodeExecutionContext) => {
  const { node, updateNodeOutput } = context;
  
  try {
    // Get data from the node's config
    const config = node.data.config || {};
    const imageData = config.imageData;
    const staticText = config.staticText || 'Describe this image:';
    const model = config.model || 'llava';
    const ollamaUrl = config.ollamaUrl || 'http://localhost:11434';
    
    // Check if we have an image
    if (!imageData) {
      throw new Error("No image uploaded in the Image Upload LLM node");
    }
    
    console.log(`Executing ImageUploadLLM with model: ${model}`);
    
    // Process image data if needed
    let processedImageData = imageData;
    if (typeof imageData === 'string' && imageData.startsWith('data:image/')) {
      processedImageData = imageData.replace(/^data:image\/[a-zA-Z]+;base64,/, '');
    }
    
    // Send request to Ollama
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
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${errorText}`);
    }
    
    const result = await response.json();
    const responseText = result.response || "No response from model";
    
    // Update the node's output in the UI
    if (updateNodeOutput) {
      updateNodeOutput(node.id, responseText);
    }
    
    // Store the result in the node config
    config.resultText = responseText;
    
    return responseText;
  } catch (error) {
    const errorMessage = `Error: ${error instanceof Error ? error.message : String(error)}`;
    console.error("Error in ImageUploadLLM execution:", errorMessage);
    
    // Update the UI to show the error
    if (updateNodeOutput) {
      updateNodeOutput(node.id, errorMessage);
    }
    
    return errorMessage;
  }
};

registerNodeExecutor('imageUploadLlmNode', {
  execute: executeImageUploadLlm
});
