export * from './OllamaClient';
export * from './AssistantOllamaClient';
export * from './types';

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}