import { OllamaClient } from '../utils/OllamaClient';
import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';
import { z } from 'zod';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const executeStructuredLLM = async (context: NodeExecutionContext): Promise<string> => {
  const { node, inputs, ollamaClient, apiConfig } = context;
  
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

    // Determine which API to use (from node config or from global context)
    const useOpenAI = apiConfig?.type === 'openai' || config.apiType === 'openai';
    
    console.log(`Executing Structured LLM with model: ${model}, system prompt: ${systemPrompt}, API type: ${useOpenAI ? 'OpenAI' : 'Ollama'}`);

    // Use Zod to parse and validate the structured format as a JSON schema.
    const schemaDefinition = z.object({}).passthrough();
    let parsedFormat: object = {};
    
    try {
      // First check if it's a valid JSON
      const rawFormat = JSON.parse(structuredFormatStr);
      
      // If already in schema format, use it directly
      if (rawFormat.type === 'object' && rawFormat.properties) {
        parsedFormat = rawFormat;
      } else {
        // Convert simple format description to proper JSON schema
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
      }
      
      // Validate with Zod
      schemaDefinition.parse(parsedFormat);
    } catch (error) {
      console.warn("Invalid structured format schema provided. Using empty schema instead.", error);
      parsedFormat = {
        type: "object",
        properties: {},
        required: []
      };
    }
    
    // Create a chat messages array.
    const messages: ChatMessage[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: textInput });
    
    // Use the provided ollamaClient from context if available
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
      } else {
        // Use Ollama configuration
        client = new OllamaClient(ollamaUrl, { type: 'ollama' });
      }
    }
    
    // Send the structured chat request
    const response = await client.sendStructuredChat(
      model,
      messages,
      parsedFormat,
      { stream: false }
    );
    
    // For OpenAI, try to normalize the output to ensure it's valid JSON
    if (useOpenAI && typeof response.message?.content === 'string') {
      try {
        const content = response.message.content.trim();
        // Extract JSON part if surrounded by backticks
        const jsonMatch = content.match(/```(?:json)?([\s\S]*?)```/);
        const jsonStr = jsonMatch ? jsonMatch[1].trim() : content;
        
        // Parse and re-stringify to ensure valid JSON format
        const parsed = JSON.parse(jsonStr);
        return JSON.stringify(parsed, null, 2);
      } catch (e) {
        console.warn('Failed to parse OpenAI JSON response:', e);
        // Return the original response if parsing fails
        return response.message?.content || "No response from model";
      }
    }
    
    return response.message?.content || "No response from model";
  } catch (error) {
    console.error("Error in Structured LLM node execution:", error);
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
};

registerNodeExecutor('structuredLlmNode', {
  execute: executeStructuredLLM,
});
