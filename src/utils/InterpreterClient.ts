export type MessageRole = 'user' | 'assistant' | 'computer' | 'system';
export type MessageType = 'message' | 'code' | 'image' | 'console' | 'file' | 'confirmation' | 'command' | 'error';
export type MessageFormat = 'output' | 'path' | 'base64.png' | 'base64.jpeg' | 'python' | 'javascript' | 'shell' | 'html' | 'active_line' | 'execution' | 'text';

export interface InterpreterMessage {
  role: MessageRole;
  type: MessageType;
  format?: MessageFormat;
  content: string | { code: string; language: string };
  recipient?: 'user' | 'assistant';
  activeLine?: string | null;
  start?: boolean;
  end?: boolean;
}

export interface StreamingChunk extends InterpreterMessage {
  start?: boolean;
  end?: boolean;
}

export interface ModelConfig {
  visionModel: string;
  toolModel: string;
  ragModel: string;
}

export interface ModelSelectionConfig extends ModelConfig {
  mode: 'auto' | 'manual' | 'smart';
}

export interface ChatOptions {
  auto_run?: boolean;
  offline?: boolean;
  model?: string;
  api_base?: string;
}

export interface FileInfo {
  id: string;
  name: string;
  size: number;
  created: string;
  type: string;
}

export class InterpreterClient {
  private baseUrl: string;
  private abortController: AbortController | null = null;
  private isGenerating: boolean = false;
  private lastKnownFiles: Set<string> = new Set(); // Track known file IDs
  private modelConfig: ModelConfig = {
    visionModel: '',
    toolModel: '',
    ragModel: ''
  };
  private modelSelectionMode: 'auto' | 'manual' | 'smart' = 'manual';
  private currentConversationId: string | null = null;

  constructor(baseUrl: string = 'http://localhost:8000') {
    this.baseUrl = baseUrl;
    this.loadModelConfig();
    // Initialize lastKnownFiles
    this.updateLastKnownFiles();
  }

  private loadModelConfig() {
    const savedConfig = localStorage.getItem('model_selection_config_ollama');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      this.modelConfig = {
        visionModel: config.visionModel,
        toolModel: config.toolModel,
        ragModel: config.ragModel
      };
      this.modelSelectionMode = config.mode;
    }
  }

  setModelConfig(config: ModelConfig) {
    this.modelConfig = config;
  }

  setModelSelectionMode(mode: 'auto' | 'manual' | 'smart') {
    this.modelSelectionMode = mode;
  }

  private getAppropriateModel(selectedModel: string, context: { hasImages: boolean; hasTool: boolean; hasRag: boolean }): string {
    const { hasImages, hasTool, hasRag } = context;
    
    switch (this.modelSelectionMode) {
      case 'auto':
        if (hasImages && this.modelConfig.visionModel) {
          return this.modelConfig.visionModel;
        }
        if (hasTool && this.modelConfig.toolModel) {
          return this.modelConfig.toolModel;
        }
        if (hasRag && this.modelConfig.ragModel) {
          return this.modelConfig.ragModel;
        }
        return (
          this.modelConfig.ragModel ||
          this.modelConfig.toolModel ||
          this.modelConfig.visionModel ||
          selectedModel
        );
      case 'smart':
      case 'manual':
      default:
        return selectedModel;
    }
  }

  stopGeneration() {
    this.isGenerating = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    
    // Call the stop endpoint
    fetch(`${this.baseUrl}/stop`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }).catch(error => {
      console.error('Error stopping interpreter:', error);
    });
  }

  private findOrCreateMessage(messages: InterpreterMessage[], role: MessageRole, type: MessageType, format?: MessageFormat): { message: InterpreterMessage, index: number } {
    const index = messages.findIndex(msg => 
      msg.role === role && 
      msg.type === type && 
      (format === undefined || msg.format === format)
    );
    
    if (index >= 0) {
      return { message: messages[index], index };
    }
    
    const newMessage: InterpreterMessage = {
      role,
      type,
      content: '',
    };
    if (format) newMessage.format = format;
    
    messages.push(newMessage);
    return { message: newMessage, index: messages.length - 1 };
  }

  private async updateLastKnownFiles() {
    try {
      const files = await this.listFiles();
      this.lastKnownFiles = new Set(files.map(f => f.id));
    } catch (error) {
      console.error('Error updating known files:', error);
    }
  }

  // Get new files by comparing with last known files
  private async getNewFiles(): Promise<FileInfo[]> {
    const currentFiles = await this.listFiles();
    const newFiles = currentFiles.filter(file => !this.lastKnownFiles.has(file.id));
    this.lastKnownFiles = new Set(currentFiles.map(f => f.id));
    return newFiles;
  }

  async chat(messages: InterpreterMessage[], options: ChatOptions = {}, onChunk?: (messages: InterpreterMessage[]) => void): Promise<{ messages: InterpreterMessage[]; newFiles: FileInfo[] }> {
    try {
      // Start new conversation if none exists
      if (!this.currentConversationId) {
        await this.startNewConversation();
      }

      // Store files before chat
      await this.updateLastKnownFiles();

      // Determine if we have tools, images, or RAG in the messages
      const context = {
        hasImages: messages.some(msg => msg.type === 'image'),
        hasTool: messages.some(msg => msg.type === 'command'),
        hasRag: messages.some(msg => msg.type === 'file')
      };

      const defaultOptions = {
        auto_run: true,
        offline: true,
        model: options.model || this.getAppropriateModel('qwen3:30b-a3b', context),
        api_base: options.api_base || 'https://login.badboysm890.in/ollama'
      };

      this.abortController = new AbortController();
      const { signal } = this.abortController;

      const response = await fetch(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json',
        },
        body: JSON.stringify({
          messages: messages.map(msg => ({
            role: msg.role,
            type: msg.type,
            format: msg.format || 'text',
            content: msg.content,
            recipient: msg.recipient || 'user'
          })),
          conversation_id: this.currentConversationId,
          ...defaultOptions,
          ...options
        }),
        signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is null');
      }

      const workingMessages = [...messages];
      let currentMessageIndex = -1;
      let currentMessage: InterpreterMessage | null = null;
      
      this.isGenerating = true;
      const decoder = new TextDecoder();

      while (true) {
        if (!this.isGenerating) {
          await reader.cancel();
          this.abortController.abort();
          break;
        }

        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.trim()) {
            try {
              const chunk = JSON.parse(line) as StreamingChunk;
              
              // Handle error chunks specifically
              if (chunk.type === 'error') {
                const errorContent = chunk.content as string;
                if (errorContent.includes("Attempted to access streaming response content, without having called `read()`")) {
                  // Create a user-friendly error message
                  const errorMessage: InterpreterMessage = {
                    role: 'computer',
                    type: 'error',
                    format: 'text',
                    content: 'The model is either not supported or the application needs to be restarted. Please try restarting the application or selecting a different model.'
                  };
                  workingMessages.push(errorMessage);
                  if (onChunk) {
                    onChunk([...workingMessages]);
                  }
                  return { messages: workingMessages, newFiles: [] };
                }
                // Handle other errors
                const errorMessage: InterpreterMessage = {
                  role: 'computer',
                  type: 'error',
                  format: 'text',
                  content: errorContent
                };
                workingMessages.push(errorMessage);
                if (onChunk) {
                  onChunk([...workingMessages]);
                }
                return { messages: workingMessages, newFiles: [] };
              }
              
              if (chunk.start) {
                const { message, index } = this.findOrCreateMessage(
                  workingMessages, 
                  chunk.role, 
                  chunk.type, 
                  chunk.format
                );
                
                currentMessage = message;
                currentMessageIndex = index;
                
                if (typeof currentMessage.content === 'string') {
                  currentMessage.content = '';
                }
              }
              
              if (chunk.content && currentMessage) {
                if (chunk.format === 'active_line') {
                  currentMessage.activeLine = chunk.content as string;
                } else if (typeof chunk.content === 'string' && typeof currentMessage.content === 'string') {
                  currentMessage.content += chunk.content;
                } else if (typeof chunk.content !== 'string') {
                  currentMessage.content = chunk.content;
                }
              }
              
              if (chunk.end) {
                currentMessage = null;
                currentMessageIndex = -1;
              }
              
              if (onChunk) {
                onChunk([...workingMessages]);
              }
            } catch (e) {
              console.error('Error parsing message:', e, line);
              // Create an error message for parsing errors
              const errorMessage: InterpreterMessage = {
                role: 'computer',
                type: 'error',
                format: 'text',
                content: 'An error occurred while processing the response. Please try again.'
              };
              workingMessages.push(errorMessage);
              if (onChunk) {
                onChunk([...workingMessages]);
              }
              return { messages: workingMessages, newFiles: [] };
            }
          }
        }
      }

      this.isGenerating = false;
      // Get new files after chat completion
      const newFiles = await this.getNewFiles();

      return { messages: workingMessages, newFiles };
    } catch (error) {
      console.error('Error in chat:', error);
      this.isGenerating = false;
      // Create a user-friendly error message
      const errorMessage: InterpreterMessage = {
        role: 'computer',
        type: 'error',
        format: 'text',
        content: error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.'
      };
      return { messages: [...messages, errorMessage], newFiles: [] };
    }
  }

  async sendMessage(content: string): Promise<{ messages: InterpreterMessage[]; newFiles: FileInfo[] }> {
    const message: InterpreterMessage = {
      role: 'user',
      type: 'message',
      format: 'text',
      content: content
    };
    
    return this.chat([message]);
  }

  async resetEnvironment(): Promise<void> {
    try {
      const resetMessage: InterpreterMessage = {
        role: 'system',
        type: 'command',
        format: 'text',
        content: 'reset environment'
      };
      
      await this.chat([resetMessage]);
    } catch (error) {
      console.error('Error resetting environment:', error);
      throw error;
    }
  }

  async executeCode(code: string): Promise<string> {
    try {
      const codeMessage: InterpreterMessage = {
        role: 'user',
        type: 'code',
        format: 'python',
        content: code
      };
      
      const result = await this.chat([codeMessage]);
      const output = result.messages
        .filter(msg => msg.type === 'console' && msg.format === 'output')
        .map(msg => msg.content as string)
        .join('');
      
      return output;
    } catch (error) {
      console.error('Error executing code:', error);
      throw error;
    }
  }

  async getEnvironmentInfo(): Promise<any> {
    try {
      const infoRequest: InterpreterMessage = {
        role: 'system',
        type: 'command',
        format: 'text',
        content: 'get environment info'
      };
      
      const result = await this.chat([infoRequest]);
      const envInfo = result.messages.find(msg => msg.type === 'console' && msg.format === 'output');
      return envInfo ? JSON.parse(envInfo.content as string) : {};
    } catch (error) {
      console.error('Error getting environment info:', error);
      throw error;
    }
  }

  async uploadFile(file: File, targetDir?: string): Promise<FileInfo> {
    const formData = new FormData();
    formData.append('file', file);
    if (targetDir !== undefined) {
      formData.append('target_dir', targetDir);
    }

    const response = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async listFiles(): Promise<FileInfo[]> {
    const response = await fetch(`${this.baseUrl}/files`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async downloadFile(fileId: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/download/${fileId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.blob();
  }

  async deleteFile(fileId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/files/${fileId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }

  // Add methods to handle conversation history
  async startNewConversation(): Promise<string> {
    this.currentConversationId = crypto.randomUUID();
    return this.currentConversationId;
  }

  async clearConversation(): Promise<void> {
    if (this.currentConversationId) {
      try {
        // Clear conversation on server
        await fetch(`${this.baseUrl}/conversations/${this.currentConversationId}`, {
          method: 'DELETE'
        });
        
        // Start a new conversation
        await this.startNewConversation();
        
        // Clear any local state
        this.abortController?.abort();
        this.abortController = null;
        this.isGenerating = false;
      } catch (error) {
        console.error('Error clearing conversation:', error);
      }
    } else {
      // If no current conversation, just start a new one
      await this.startNewConversation();
    }
  }

  async getConversationHistory(): Promise<InterpreterMessage[]> {
    if (!this.currentConversationId) return [];
    try {
      const response = await fetch(`${this.baseUrl}/conversations/${this.currentConversationId}`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.messages;
    } catch (error) {
      console.error('Error getting conversation history:', error);
      return [];
    }
  }
} 