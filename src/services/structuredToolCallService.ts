/**
 * Structured Tool Call Service
 * 
 * This service provides structured tool calling capabilities for models that don't support 
 * standard OpenAI-style tool calling. It uses structured text generation to simulate tool calls.
 */

import { ClaraMessage, ClaraAIConfig, ClaraFileAttachment } from '../types/clara_assistant_types';
import { Tool } from '../db';
import { defaultTools, executeTool } from '../utils/claraTools';
import { db } from '../db';
import { claraMCPService } from './claraMCPService';
import { claraMemoryService } from './claraMemoryService';

/**
 * Structured tool call result
 */
interface StructuredToolCall {
  toolName: string;
  arguments: Record<string, any>;
  reasoning: string;
}

/**
 * Structured tool execution result
 */
interface StructuredToolResult {
  toolName: string;
  success: boolean;
  result?: any;
  error?: string;
  reasoning?: string;
}

/**
 * Structured tool calling response
 */
interface StructuredToolResponse {
  content: string;
  toolCalls: StructuredToolCall[];
  needsToolExecution: boolean;
  reasoning: string;
}

/**
 * Service for handling structured tool calling with unsupported models
 */
export class StructuredToolCallService {
  private static instance: StructuredToolCallService;
  
  private constructor() {}
  
  public static getInstance(): StructuredToolCallService {
    if (!StructuredToolCallService.instance) {
      StructuredToolCallService.instance = new StructuredToolCallService();
    }
    return StructuredToolCallService.instance;
  }

  /**
   * Generate structured tool calling prompt
   */
  public generateStructuredToolPrompt(
    userMessage: string,
    tools: Tool[],
    config: ClaraAIConfig,
    conversationHistory?: ClaraMessage[],
    memoryContext?: string
  ): string {
    const toolsDescription = this.formatToolsForPrompt(tools);
    
    // Check if the task appears to be already completed based on memory context
    const hasCompletedTask = this.isTaskAlreadyCompleted(userMessage, memoryContext);
    
    let systemPrompt = `You are Clara, an AI assistant with structured tool calling capabilities.

**STRUCTURED TOOL CALLING MODE**

You can use tools by generating structured responses. When you need to use tools, respond in this exact format:

\`\`\`json
{
  "reasoning": "Explain why you need to use tools and what you plan to accomplish",
  "toolCalls": [
    {
      "toolName": "exact_tool_name",
      "arguments": {
        "param1": "value1",
        "param2": "value2"
      },
      "reasoning": "Why this specific tool call is needed"
    }
  ],
  "needsToolExecution": true
}
\`\`\`

**AVAILABLE TOOLS:**
${toolsDescription}

**IMPORTANT RULES:**
1. Only use tools when absolutely necessary to fulfill the user's request
2. Use exact tool names from the available tools list
3. Provide clear reasoning for each tool call
4. If no tools are needed, respond normally without the JSON structure
5. After tool execution, I will provide you with the results to incorporate into your final response
6. **CRITICAL**: Use the exact parameter names and types shown in the tool descriptions
7. If a tool has no required parameters, use an empty object {} for arguments`;

    // Add specific instruction if task appears completed
    if (hasCompletedTask) {
      systemPrompt += `
8. **TASK COMPLETION CHECK**: Based on the memory context, it appears this request has already been fulfilled. Do NOT execute the same tools again. Instead, provide a natural response based on the previous results.`;
    }

    systemPrompt += `

**CONVERSATION CONTEXT:**
${this.formatConversationHistory(conversationHistory)}

${memoryContext ? `**MEMORY CONTEXT:**\n${memoryContext}\n` : ''}

**USER REQUEST:**
${userMessage}

Please analyze the request and respond appropriately. If tools are needed, use the structured format above.`;

    // Add additional guidance if task is completed
    if (hasCompletedTask) {
      systemPrompt += `

**IMPORTANT**: The memory context shows this request has already been processed successfully. Do not execute tools again - simply provide a helpful response based on the previous results.`;
    }

    return systemPrompt;
  }

  /**
   * Check if a task appears to be already completed based on memory context
   */
  private isTaskAlreadyCompleted(userMessage: string, memoryContext?: string): boolean {
    if (!memoryContext) {
      return false;
    }

    // Check if memory context contains successful tool execution and follow-up response
    const hasSuccessfulToolExecution = memoryContext.includes('✅ Success') && 
                                     memoryContext.includes('follow_up_response');
    
    // Check if the user message appears to be asking for the same thing that was already done
    const commonCompletionPatterns = [
      'list the files',
      'show me the files',
      'what files are',
      'directory contents',
      'folder contents'
    ];
    
    const requestLooksComplete = commonCompletionPatterns.some(pattern => 
      userMessage.toLowerCase().includes(pattern.toLowerCase())
    ) && hasSuccessfulToolExecution;

    return requestLooksComplete;
  }

  /**
   * Parse structured tool response from model
   */
  public parseStructuredResponse(response: string): StructuredToolResponse {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/```json\s*\n([\s\S]*?)\n```/);
    
    if (!jsonMatch) {
      // No structured format found, treat as regular response
      return {
        content: response,
        toolCalls: [],
        needsToolExecution: false,
        reasoning: ''
      };
    }

    try {
      const parsed = JSON.parse(jsonMatch[1]);
      
      // Validate the structure
      if (!parsed.toolCalls || !Array.isArray(parsed.toolCalls)) {
        return {
          content: response,
          toolCalls: [],
          needsToolExecution: false,
          reasoning: parsed.reasoning || ''
        };
      }

      // Validate each tool call
      const validToolCalls: StructuredToolCall[] = [];
      for (const toolCall of parsed.toolCalls) {
        if (toolCall.toolName && typeof toolCall.toolName === 'string') {
          validToolCalls.push({
            toolName: toolCall.toolName,
            arguments: toolCall.arguments || {},
            reasoning: toolCall.reasoning || ''
          });
        }
      }

      return {
        content: response.replace(jsonMatch[0], '').trim(),
        toolCalls: validToolCalls,
        needsToolExecution: parsed.needsToolExecution === true,
        reasoning: parsed.reasoning || ''
      };

    } catch (error) {
      console.warn('Failed to parse structured tool response:', error);
      return {
        content: response,
        toolCalls: [],
        needsToolExecution: false,
        reasoning: ''
      };
    }
  }

  /**
   * Execute structured tool calls
   */
  public async executeStructuredToolCalls(
    toolCalls: StructuredToolCall[],
    onProgress?: (message: string) => void
  ): Promise<StructuredToolResult[]> {
    const results: StructuredToolResult[] = [];

    for (const toolCall of toolCalls) {
      try {
        if (onProgress) {
          onProgress(`🔧 Executing ${toolCall.toolName}...`);
        }

        const result = await this.executeStructuredTool(toolCall);
        results.push(result);

        if (onProgress) {
          const status = result.success ? '✅' : '❌';
          onProgress(`${status} ${toolCall.toolName} ${result.success ? 'completed' : 'failed'}`);
        }

      } catch (error) {
        results.push({
          toolName: toolCall.toolName,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          reasoning: toolCall.reasoning
        });

        if (onProgress) {
          onProgress(`❌ ${toolCall.toolName} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    return results;
  }

  /**
   * Execute a single structured tool call
   */
  private async executeStructuredTool(toolCall: StructuredToolCall): Promise<StructuredToolResult> {
    const { toolName, arguments: args, reasoning } = toolCall;

    console.log(`🔧 Executing structured tool: ${toolName} with args:`, args);

    // Check if it's an MCP tool
    if (toolName.startsWith('mcp_')) {
      try {
        // Special handling for tools with dummy parameters
        let processedArgs = args;
        
        // Handle tools that have dummy parameters (like mcp_python-tools_open and mcp_python-tools_ls)
        if (toolName === 'mcp_python-tools_open' || toolName === 'mcp_python-tools_ls') {
          // These tools expect a random_string parameter as a dummy
          processedArgs = { random_string: 'dummy' };
          console.log(`🔧 Using dummy parameters for ${toolName}:`, processedArgs);
        }

        const mcpToolCall = {
          callId: `structured_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          server: toolName.split('_')[1],
          name: toolName.split('_').slice(2).join('_'),
          arguments: processedArgs
        };

        console.log(`📡 Sending MCP tool call:`, mcpToolCall);
        const mcpResult = await claraMCPService.executeToolCall(mcpToolCall);
        console.log(`📥 MCP tool result:`, mcpResult);
        
        return {
          toolName,
          success: mcpResult.success,
          result: mcpResult.content,
          error: mcpResult.error,
          reasoning
        };

      } catch (error) {
        console.error(`❌ MCP tool execution error for ${toolName}:`, error);
        return {
          toolName,
          success: false,
          error: error instanceof Error ? error.message : 'MCP tool execution failed',
          reasoning
        };
      }
    }

    // Check Clara default tools
    const claraTool = defaultTools.find(tool => tool.name === toolName || tool.id === toolName);
    if (claraTool) {
      try {
        console.log(`🛠️ Executing Clara tool: ${claraTool.name}`);
        const result = await executeTool(claraTool.id, args);
        console.log(`✅ Clara tool result:`, result);
        
        return {
          toolName,
          success: result.success,
          result: result.result,
          error: result.error,
          reasoning
        };
      } catch (error) {
        console.error(`❌ Clara tool execution error for ${toolName}:`, error);
        return {
          toolName,
          success: false,
          error: error instanceof Error ? error.message : 'Clara tool execution failed',
          reasoning
        };
      }
    }

    // Check database tools
    const dbTools = await db.getEnabledTools();
    const dbTool = dbTools.find(tool => tool.name === toolName);
    
    if (dbTool) {
      try {
        console.log(`🗄️ Executing database tool: ${dbTool.name}`);
        const funcBody = `return (async () => {
          ${dbTool.implementation}
          return await implementation(args);
        })();`;
        const testFunc = new Function('args', funcBody);
        const result = await testFunc(args);
        console.log(`✅ Database tool result:`, result);
        
        return {
          toolName,
          success: true,
          result,
          reasoning
        };
      } catch (error) {
        console.error(`❌ Database tool execution error for ${toolName}:`, error);
        return {
          toolName,
          success: false,
          error: error instanceof Error ? error.message : 'Tool execution failed',
          reasoning
        };
      }
    }

    // Tool not found
    console.error(`❌ Tool not found: ${toolName}`);
    return {
      toolName,
      success: false,
      error: `Tool '${toolName}' not found`,
      reasoning
    };
  }

  /**
   * Generate follow-up prompt with tool results
   */
  public generateFollowUpPrompt(
    originalMessage: string,
    toolResults: StructuredToolResult[],
    reasoning: string
  ): string {
    const resultsText = toolResults.map(result => {
      if (result.success) {
        const resultText = typeof result.result === 'string' 
          ? result.result 
          : JSON.stringify(result.result, null, 2);
        return `✅ ${result.toolName}: ${resultText}`;
      } else {
        return `❌ ${result.toolName}: ${result.error || 'Failed'}`;
      }
    }).join('\n\n');

    return `**TOOL EXECUTION RESULTS**

Original request: ${originalMessage}

Your reasoning: ${reasoning}

Tool execution results:
${resultsText}

**INSTRUCTIONS:**
Based on the tool execution results above, please provide a comprehensive response to the user's original request. Incorporate the tool results naturally into your response. Do not use the structured JSON format in your response - just provide a natural, helpful answer based on the results.

If any tools failed, acknowledge the failures and provide alternative suggestions or partial results where possible.`;
  }

  /**
   * Format tools for prompt
   */
  private formatToolsForPrompt(tools: Tool[]): string {
    if (tools.length === 0) {
      return 'No tools available';
    }

    return tools.map(tool => {
      const requiredParams = tool.parameters.filter(p => p.required);
      const optionalParams = tool.parameters.filter(p => !p.required);
      
      let paramsText = '';
      if (requiredParams.length > 0 || optionalParams.length > 0) {
        const requiredText = requiredParams.map(p => `${p.name}: ${p.type}`);
        const optionalText = optionalParams.map(p => `${p.name}?: ${p.type}`);
        const allParams = [...requiredText, ...optionalText];
        paramsText = `\n  Parameters: ${allParams.join(', ')}`;
      } else {
        paramsText = '\n  Parameters: (no parameters required - use empty object {})';
      }
      
      return `• ${tool.name}: ${tool.description}${paramsText}`;
    }).join('\n');
  }

  /**
   * Format conversation history for context
   */
  private formatConversationHistory(history?: ClaraMessage[]): string {
    if (!history || history.length === 0) {
      return 'No previous conversation context';
    }

    // Take last 5 messages for context
    const recentHistory = history.slice(-5);
    
    return recentHistory.map(msg => {
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      return `${role}: ${msg.content}`;
    }).join('\n');
  }

  /**
   * Check if a model supports structured tool calling
   */
  public supportsStructuredCalling(modelName: string): boolean {
    // This can be extended to check specific models
    // For now, assume most models can handle structured text generation
    return true;
  }

  /**
   * Get structured calling capabilities info
   */
  public getCapabilitiesInfo(): string {
    return `Structured Tool Calling enables tool usage with models that don't support standard OpenAI tool calling. 
    
How it works:
• Uses structured text generation to simulate tool calls
• Model generates JSON-formatted tool requests
• Tools are executed and results fed back to the model
• Compatible with most text generation models
• Maintains conversation context and reasoning

This is ideal for local models, older models, or specialized models that don't have built-in tool calling support.`;
  }

  /**
   * Validate tool availability for structured calling
   */
  public async validateToolsForStructuredCalling(tools: Tool[]): Promise<{
    supported: Tool[];
    unsupported: Tool[];
    warnings: string[];
  }> {
    const supported: Tool[] = [];
    const unsupported: Tool[] = [];
    const warnings: string[] = [];

    for (const tool of tools) {
      // Most tools should work with structured calling
      if (tool.implementation === 'mcp') {
        // MCP tools need special handling
        if (claraMCPService.isReady()) {
          supported.push(tool);
        } else {
          unsupported.push(tool);
          warnings.push(`MCP tool ${tool.name} requires MCP service to be running`);
        }
      } else {
        supported.push(tool);
      }
    }

    return { supported, unsupported, warnings };
  }
}

// Export singleton instance
export const structuredToolCallService = StructuredToolCallService.getInstance(); 