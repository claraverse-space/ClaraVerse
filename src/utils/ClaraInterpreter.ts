import { ChatMessage } from './types';

interface ClaraInterpreterConfig {
  baseUrl?: string;
  apiKey?: string;
}

interface InterpreterSession {
  messages: ChatMessage[];
  lastUpdated: number;
}

export class ClaraInterpreter {
  private config: ClaraInterpreterConfig;
  private abortController: AbortController | null = null;
  private readonly STORAGE_KEY = 'clara_interpreter_session';

  constructor(config: ClaraInterpreterConfig = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:11434',
      apiKey: config.apiKey
    };
  }

  private getSession(): InterpreterSession {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    return { messages: [], lastUpdated: Date.now() };
  }

  private saveSession(session: InterpreterSession) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(session));
  }

  getMessages(): ChatMessage[] {
    return this.getSession().messages;
  }

  clearSession() {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  async chat(messages: ChatMessage[], options: any = {}): Promise<any> {
    try {
      // Add messages to session before sending
      const session = this.getSession();
      session.messages = [...session.messages, ...messages];
      console.log('Session messages:', session.messages);
      session.lastUpdated = Date.now();
      this.saveSession(session);

      // Add static preprompt
      const messagesWithPreprompt = [
        {
          role: 'system',
          content: 'You are Clara, a helpful AI assistant. You aim to provide clear, accurate, and helpful responses while maintaining a professional and friendly tone.'
        },
        ...messages
      ];

      const response = await fetch(`${this.config.baseUrl}/api/interpret`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify({
          messages: messagesWithPreprompt,
          options
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Add response to session
      if (result.message) {
        session.messages.push({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.message,
          timestamp: Date.now()
        });
        this.saveSession(session);
      }

      return result;
    } catch (error) {
      console.error('ClaraInterpreter chat error:', error);
      throw error;
    }
  }

  async executeCode(code: string, language: string): Promise<any> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` })
        },
        body: JSON.stringify({
          code,
          language
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Add execution result to session
      const session = this.getSession();
      session.messages.push({
        id: crypto.randomUUID(),
        role: 'system',
        content: `Executed ${language} code:\n${code}\n\nResult:\n${JSON.stringify(result, null, 2)}`,
        timestamp: Date.now()
      });
      this.saveSession(session);

      return result;
    } catch (error) {
      console.error('ClaraInterpreter execute error:', error);
      throw error;
    }
  }

  abortStream() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  // Add more methods as needed for code interpretation
}

export default ClaraInterpreter; 