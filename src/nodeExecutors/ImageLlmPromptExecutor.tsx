import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeImageLlmPrompt = async (context: NodeExecutionContext) => {
  const { node, inputs } = context;
  
  try {
    const imageData = inputs.image || inputs['image-in'];
    if (!imageData) {
      throw new Error("No image input provided to Image LLM node");
    }

    const config = node.data.config || {};
    const model = config.model || 'llava';
    const staticText = config.staticText || 'Describe this image:';
    const ollamaUrl = config.ollamaUrl || 'http://localhost:11434';

    console.log(`Executing Image LLM with model: ${model}, static text: ${staticText}`);
    
    // Using the /generate endpoint for image processing
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        prompt: staticText,
        images: [imageData.replace(/^data:image\/[a-zA-Z]+;base64,/, '')], // Remove data URL prefix if present
        stream: false
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${error}`);
    }

    const result = await response.json();
    return result.response || "No response from model";
  } catch (error) {
    console.error("Error in Image LLM node execution:", error);
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
};

registerNodeExecutor('imageLlmPromptNode', {
  execute: executeImageLlmPrompt
});
