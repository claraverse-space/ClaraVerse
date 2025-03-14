import { OllamaClient } from '../utils/OllamaClient';
import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';
import { z } from 'zod';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const executeStructuredLLM = async (context: NodeExecutionContext): Promise<string> => {
  const { node, inputs } = context;
  
  try {
    // Only use prompt-input as the text input.
    const textInput = inputs['prompt-input'] || inputs.text || '';
    
    if (!textInput) {
      return "No prompt input provided to Structured LLM";
    }

    const config = node.data.config || {};
    const model = config.model || 'llama3.1';
    const systemPrompt = config.prompt || '';
    // structuredFormat is a string from the UI; try to parse it into a JSON schema object.
    const structuredFormatStr = config.structuredFormat || '{}';
    const ollamaUrl = config.ollamaUrl || 'http://localhost:11434';

    console.log(`Executing Structured LLM with model: ${model}, system prompt: ${systemPrompt}`);

    // Use Zod to parse and validate the structured format as a JSON schema.
    const schemaDefinition = z.object({}).passthrough();
    let parsedFormat: object = {};
    try {
      // Convert simple format description to proper JSON schema:
      // e.g. user enters {"field": "description"} and we convert it.
      const rawFormat = JSON.parse(structuredFormatStr);
      const schema: {
        type: string;
        properties: { [key: string]: { type: string; description: string } };
        required: string[];
      } = {
        type: "object",
        properties: {},
        required: []
      };
      for (const [key, value] of Object.entries(rawFormat)) {
        schema.properties[key] = {
          type: "string",
          description: String(value)
        };
        schema.required.push(key);
      }
      parsedFormat = schema;
      schemaDefinition.parse(parsedFormat);
    } catch (error) {
      console.warn("Invalid structured format schema provided. Using empty schema instead.", error);
      parsedFormat = {
        type: "object",
        properties: {},
        required: []
      };
    }
    
    // Build a single prompt string. (No extra JSON context is provided.)
    const prompt = `${systemPrompt ? systemPrompt + "\n" : ""}${textInput}`;

    // Create a chat messages array.
    const messages: ChatMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });
    
    const client = new OllamaClient(ollamaUrl);
    const response = await client.sendStructuredChat(
      model,
      messages,
      parsedFormat,
      { stream: false }
    );
    
    return response.message?.content || "No response from model";
  } catch (error) {
    console.error("Error in Structured LLM node execution:", error);
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
};

registerNodeExecutor('structuredLlmNode', {
  execute: executeStructuredLLM,
});
