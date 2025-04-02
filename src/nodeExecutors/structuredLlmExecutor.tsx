import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';
import axios from 'axios';
import OpenAI from 'openai';
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

function inferZodSchema(data) {
  if (data === null) {
    return z.null();
  } else if (Array.isArray(data)) {
    if (data.length === 0) {
      // Empty array: allow any items
      return z.array(z.any());
    }
    // For simplicity, assume the array is homogeneous
    return z.array(inferZodSchema(data[0]));
  } else if (typeof data === "object") {
    const shape = {};
    for (const key in data) {
      if (Object.hasOwnProperty.call(data, key)) {
        shape[key] = inferZodSchema(data[key]);
      }
    }
    return z.object(shape);
  } else if (typeof data === "string") {
    return z.string();
  } else if (typeof data === "number") {
    return z.number();
  } else if (typeof data === "boolean") {
    return z.boolean();
  }
  // Fallback for any other types
  return z.any();
}

function inferJsonSchema(data) {
  if (data === null) {
    return { type: "null" };
  } else if (Array.isArray(data)) {
    if (data.length === 0) {
      // Empty array: allow any items
      return { type: "array", items: {} };
    }
    // For simplicity, assume the array is homogeneous
    return {
      type: "array",
      items: inferJsonSchema(data[0])
    };
  } else if (typeof data === "object") {
    const properties = {};
    const required = [];
    for (const key in data) {
      if (Object.hasOwnProperty.call(data, key)) {
        properties[key] = inferJsonSchema(data[key]);
        required.push(key);
      }
    }
    return {
      type: "object",
      properties,
      required
    };
  } else if (typeof data === "string") {
    return { type: "string" };
  } else if (typeof data === "number") {
    return { type: "number" };
  } else if (typeof data === "boolean") {
    return { type: "boolean" };
  }
  // Fallback for any other types
  return {};
}

const executeStructuredLLM = async (context: NodeExecutionContext): Promise<string> => {
  const { node, inputs, apiConfig } = context;
  
  try {
    console.log('Structured LLM node received inputs:', inputs);
    console.log('Structured LLM node config:', node.data.config);

    // Directly use prompt-input
    let textInput = inputs['prompt-input'];
    console.log('Initial textInput from prompt-input:', textInput);

    // If the input is falsy (empty string, null, undefined), check other sources
    if (!textInput) {
      const textInputKey = Object.keys(inputs).find(key => key.startsWith('text_input_'));
      if (textInputKey) {
        textInput = inputs[textInputKey];
        console.log(`Using backup input from ${textInputKey}:`, textInput);
      }
    }

    // If we still don't have input, return error
    if (!textInput) {
      console.log('No valid input found in:', inputs);
      return "No input provided to Structured LLM";
    }

    console.log('Using final textInput:', textInput);

    const config = node.data.config || {};
    const model = config.model || 'llama2';
    const systemPrompt = config.prompt || '';
    const ollamaUrl = config.ollamaUrl || 'http://localhost:11434';
    
    // Determine which API to use (from node config or from global context)
    const useOpenAI = apiConfig?.type === 'openai' || config.apiType === 'openai';
    
    console.log(`Executing Structured LLM with:
    - Model: ${model}
    - System Prompt: ${systemPrompt}
    - API Type: ${useOpenAI ? 'OpenAI' : 'Ollama'}
    - Input: ${textInput}`);

    // Parse or get the structured format
    let structuredFormat;
    try {
      // If structuredFormat is a string, try to parse it as JSON
      if (typeof config.structuredFormat === 'string') {
        structuredFormat = JSON.parse(config.structuredFormat);
      } else {
        structuredFormat = config.structuredFormat || {};
      }
    } catch (error) {
      console.error('Error parsing structuredFormat:', error);
      structuredFormat = {};
    }
    
    // Prepare messages array
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: textInput });
    
    let responseContent;
    
    if (useOpenAI) {
      // Use OpenAI SDK with dangerouslyAllowBrowser flag
      const openaiApiKey = apiConfig?.apiKey || config.apiKey || '';
      const openaiBaseUrl = apiConfig?.baseUrl || config.openaiUrl || undefined; // Use default if not provided
      
      const openai = new OpenAI({
        apiKey: openaiApiKey,
        baseURL: openaiBaseUrl,
        dangerouslyAllowBrowser: true // Allow running in browser
      });
      
      console.log('Sending OpenAI structured request');
      
      // Create Zod schema from the structured format
      const zodSchema = inferZodSchema(structuredFormat);
      
      try {
        // Try to use the beta.chat.completions.parse method with zodResponseFormat
        const response = await openai.beta.chat.completions.parse({
          model: model,
          messages: messages,
          response_format: zodResponseFormat(zodSchema, "structured_output")
        });
        
        console.log('Received OpenAI structured response with parse:', response);
        
        if (response.choices && response.choices[0] && response.choices[0].message.parsed) {
          return JSON.stringify(response.choices[0].message.parsed, null, 2);
        }
      } catch (parseError) {
        console.warn('Error using beta.chat.completions.parse, falling back to standard method:', parseError);
        
        // Fall back to standard chat completions
        const jsonSchema = inferJsonSchema(structuredFormat);
        
        const response = await openai.chat.completions.create({
          model: model,
          messages: messages,
          response_format: { type: "json_object", schema: jsonSchema }
        });
        
        console.log('Received OpenAI structured response:', response);
        
        if (response.choices && response.choices[0] && response.choices[0].message) {
          responseContent = response.choices[0].message.content;
        } else {
          return "No valid response from OpenAI";
        }
      }
    } else {
      // Use direct axios for Ollama
      console.log('Sending Ollama structured request to:', ollamaUrl);
      
      try {
        const jsonSchema = inferJsonSchema(structuredFormat);
        
        const response = await axios.post(`${ollamaUrl}/api/chat`, {
          model: model,
          messages: messages,
          format: "json",
          options: {
            json_schema: jsonSchema
          },
          stream: false
        });
        
        console.log('Received Ollama structured response:', response.data);
        
        if (response.data.message && response.data.message.content) {
          responseContent = response.data.message.content;
        } else {
          return "No valid response from Ollama";
        }
      } catch (ollamaError) {
        console.error('Error calling Ollama API:', ollamaError);
        return `Ollama API Error: ${ollamaError.message}`;
      }
    }
    
    // Process the response content if we have it (from fallback methods)
    if (responseContent) {
      try {
        // Ensure it's valid JSON by parsing and re-stringifying
        const content = responseContent.trim();
        const parsedJson = JSON.parse(content);
        return JSON.stringify(parsedJson, null, 2);
      } catch (e) {
        console.warn('Failed to parse JSON response:', e);
        // Try to extract JSON if wrapped in code blocks
        const jsonMatch = responseContent.match(/```(?:json)?([\s\S]*?)```/);
        if (jsonMatch) {
          try {
            const extractedJson = JSON.parse(jsonMatch[1].trim());
            return JSON.stringify(extractedJson, null, 2);
          } catch (extractError) {
            console.warn('Failed to extract JSON from code blocks:', extractError);
          }
        }
        return responseContent;
      }
    }
    
    return "No response content received";
    
  } catch (error) {
    console.error("Error in Structured LLM node execution:", error);
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
};

registerNodeExecutor('structuredLlmNode', {
  execute: executeStructuredLLM
});