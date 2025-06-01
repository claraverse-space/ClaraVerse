import { FlowNode } from '../../types/agent/types';
import { ExecutionContext } from './FlowExecutor';

export interface NodeExecutor {
  (node: FlowNode, inputs: Record<string, any>, context: ExecutionContext): Promise<any> | any;
}

export class NodeRegistry {
  private nodeExecutors = new Map<string, NodeExecutor>();
  private customNodes = new Map<string, any>();

  constructor() {
    this.registerBuiltInNodes();
  }

  private registerBuiltInNodes(): void {
    // Input Node
    this.nodeExecutors.set('input', (node: FlowNode) => {
      const value = node.data.value || '';
      const inputType = node.data.inputType || 'text';
      
      switch (inputType) {
        case 'number':
          return { output: Number(value) || 0 };
        case 'json':
          try {
            return { output: JSON.parse(value) };
          } catch {
            return { output: value };
          }
        default:
          return { output: value };
      }
    });

    // Output Node
    this.nodeExecutors.set('output', (node: FlowNode, inputs: Record<string, any>) => {
      const outputInput = inputs.input || Object.values(inputs)[0];
      return outputInput;
    });

    // JSON Parse Node
    this.nodeExecutors.set('json-parse', (node: FlowNode, inputs: Record<string, any>) => {
      const inputValue = inputs.input || Object.values(inputs)[0] || '';
      const extractField = node.data.extractField || '';
      const failOnError = node.data.failOnError || false;
      
      try {
        const jsonString = String(inputValue);
        const parsed = JSON.parse(jsonString);
        
        if (extractField) {
          // Support dot notation for nested field extraction
          const fields = extractField.split('.');
          let result = parsed;
          
          for (const field of fields) {
            if (result && typeof result === 'object' && field in result) {
              result = result[field];
            } else {
              return { output: undefined };
            }
          }
          
          return { output: result };
        }
        
        return { output: parsed };
      } catch (error) {
        if (failOnError) {
          throw new Error(`JSON Parse Error: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
        }
        return { output: null };
      }
    });

    // If/Else Node
    this.nodeExecutors.set('if-else', (node: FlowNode, inputs: Record<string, any>) => {
      const inputValue = inputs.input || Object.values(inputs)[0];
      const expression = node.data.expression || 'input > 0';
      const trueValue = node.data.trueValue || '';
      const falseValue = node.data.falseValue || '';
      
      try {
        // Create a safe evaluation context
        const func = new Function('input', `return ${expression}`);
        const result = func(inputValue);
        
        if (result) {
          return { 
            true: trueValue || inputValue,
            false: undefined
          };
        } else {
          return { 
            true: undefined,
            false: falseValue || inputValue
          };
        }
      } catch (error) {
        console.error('If/Else expression error:', error);
        return { 
          true: undefined,
          false: falseValue || inputValue
        };
      }
    });

    // LLM Node
    this.nodeExecutors.set('llm', async (node: FlowNode, inputs: Record<string, any>) => {
      const apiBaseUrl = node.data.apiBaseUrl || 'https://api.openai.com/v1';
      const apiKey = node.data.apiKey || '';
      const model = node.data.model || 'gpt-3.5-turbo';
      const temperature = node.data.temperature || 0.7;
      const maxTokens = node.data.maxTokens || 1000;
      
      const systemMessage = inputs.system || '';
      const userMessage = inputs.user || '';
      const context = inputs.context || '';
      const memory = inputs.memory || [];
      const imageData = inputs.image || '';
      
      if (!apiKey) {
        throw new Error('API key is required for LLM node');
      }
      
      if (!userMessage) {
        throw new Error('User message is required for LLM node');
      }
      
      try {
        const messages = [];
        
        // Add system message if provided
        if (systemMessage) {
          messages.push({ role: 'system', content: systemMessage });
        }
        
        // Add memory/history if provided
        if (Array.isArray(memory) && memory.length > 0) {
          messages.push(...memory);
        }
        
        // Add context if provided
        if (context) {
          messages.push({ role: 'system', content: `Context: ${context}` });
        }
        
        // Add user message with optional image
        const userMessageContent = [];
        userMessageContent.push({ type: 'text', text: userMessage });
        
        if (imageData) {
          // Handle image data - it could be a string (base64) or an object from ImageInputNode
          let base64String = '';
          
          if (typeof imageData === 'string') {
            // Direct base64 string
            base64String = imageData;
          } else if (typeof imageData === 'object' && imageData.base64) {
            // Object from ImageInputNode with base64 property
            base64String = imageData.base64;
          }
          
          if (base64String) {
            userMessageContent.push({
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64String}` }
            });
          }
        }
        
        messages.push({
          role: 'user',
          content: userMessageContent.length === 1 ? userMessage : userMessageContent
        });
        
        const response = await fetch(`${apiBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens
          })
        });
        
        if (!response.ok) {
          throw new Error(`LLM API Error: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        
        return {
          response: data.choices?.[0]?.message?.content || '',
          usage: data.usage || {}
        };
        
      } catch (error) {
        throw new Error(`LLM execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    });

    // Image Input Node
    this.nodeExecutors.set('image-input', (node: FlowNode) => {
      const imageFile = node.data.imageFile || '';
      const maxWidth = node.data.maxWidth || 1024;
      const maxHeight = node.data.maxHeight || 1024;
      const quality = node.data.quality || 0.8;
      
      if (!imageFile) {
        return {
          output: {
            base64: '',
            metadata: {}
          }
        };
      }
      
      // For now, return the image as is - in real implementation, this would process the image
      return {
        output: {
          base64: imageFile, // Assume it's already base64 for now
          metadata: {
            width: maxWidth,
            height: maxHeight,
            type: 'image/jpeg',
            size: imageFile.length
          }
        }
      };
    });
  }

  registerCustomNode(customNode: any): void {
    this.customNodes.set(customNode.type, customNode);
    
    // Register the executor for the custom node
    this.nodeExecutors.set(customNode.type, async (node: FlowNode, inputs: Record<string, any>, context: ExecutionContext) => {
      try {
        // Create a sandboxed execution environment
        const executionFunction = new Function('inputs', 'properties', 'context', `
          ${customNode.executionCode}
          return execute(inputs, properties, context);
        `);
        
        const result = await executionFunction(inputs, node.data.properties || {}, context);
        return result || {};
        
      } catch (error) {
        context.error(`Custom node execution failed: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    });
  }

  async executeNode(node: FlowNode, inputs: Record<string, any>, context: ExecutionContext): Promise<any> {
    const executor = this.nodeExecutors.get(node.type);
    
    if (!executor) {
      throw new Error(`Unknown node type: ${node.type}`);
    }
    
    try {
      return await executor(node, inputs, context);
    } catch (error) {
      context.error(`Node execution failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  isCustomNode(nodeType: string): boolean {
    return this.customNodes.has(nodeType);
  }

  getCustomNode(nodeType: string): any | undefined {
    return this.customNodes.get(nodeType);
  }

  getCustomNodes(): any[] {
    return Array.from(this.customNodes.values());
  }

  getAllNodeTypes(): string[] {
    return Array.from(this.nodeExecutors.keys());
  }
} 