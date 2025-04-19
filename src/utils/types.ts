export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  images?: string[];
}

export interface RequestOptions {
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  tools?: any[];
  useRag?: boolean;
  [key: string]: any;
}

export interface Tool {
  name: string;
  description: string;
  parameters: {
    name: string;
    type: string;
    description: string;
    required?: boolean;
  }[];
  implementation: string;
  isEnabled: boolean;
}

export interface APIResponse {
  message?: {
    content: string;
    role?: ChatRole;
  };
  eval_count?: number;
  response?: string;
  error?: any;
} 