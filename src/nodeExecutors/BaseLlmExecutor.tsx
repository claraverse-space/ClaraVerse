import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeLlmPrompt = async (context: NodeExecutionContext) => {
  const { node, inputs } = context;
  
  try {
    const textInput = inputs.text || inputs['text-in'] || '';
    if (!textInput) {
      return "No input provided to LLM";
    }

    const config = node.data.config || {};
    const model = config.model || 'llama2';
    const systemPrompt = config.prompt || '';
    const ollamaUrl = config.ollamaUrl || 'http://localhost:11434';

    console.log(`Executing LLM with model: ${model}, system prompt: ${systemPrompt}`);
    
    const response = await fetch(`${ollamaUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
          { role: 'user', content: textInput }
        ],
        stream: false
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${error}`);
    }

    const result = await response.json();
    return result.message?.content || "No response from model";
  } catch (error) {
    console.error("Error in LLM node execution:", error);
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
};

registerNodeExecutor('BaseLlmNode', {
  execute: executeLlmPrompt
});
