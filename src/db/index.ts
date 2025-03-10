// Types
export interface Chat {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  is_archived: boolean;
  is_starred: boolean;
  is_deleted: boolean;
}

export interface Message {
  id: string;
  chat_id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  tokens: number;
  images?: string[];
}

export interface StorageItem {
  id: string;
  title: string;
  description: string;
  size: number;
  timestamp: string;
  type: 'image' | 'document' | 'other';
  mime_type: string;
  data: string;
}

export interface Usage {
  id: string;
  type: 'tokens' | 'storage' | 'messages' | 'response_time';
  value: number;
  timestamp: string;
}

export interface PersonalInfo {
  name: string;
  email: string;
  avatar_url?: string;
  timezone: string;
  theme_preference: 'light' | 'dark' | 'system';
}

export interface APIConfig {
  ollama_base_url: string;
}

export interface ModelUsage {
  name: string;
  totalDuration: number;
  requestCount: number;
  avgDuration: number;
  lastUsed: string;
}

const DB_PREFIX = 'clara_db_';

class LocalStorageDB {
  private getItem<T>(key: string): T | null {
    try {
      const data = localStorage.getItem(`${DB_PREFIX}${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`Error reading from localStorage: ${key}`, error);
      return null;
    }
  }

  private setItem(key: string, value: any): void {
    try {
      localStorage.setItem(`${DB_PREFIX}${key}`, JSON.stringify(value));
    } catch (error) {
      console.error(`Error writing to localStorage: ${key}`, error);
    }
  }

  private generateId(): string {
    return crypto.randomUUID();
  }

  // Chat methods
  async createChat(title: string): Promise<string> {
    const chats = this.getItem<Chat[]>('chats') || [];
    const now = new Date().toISOString();
    const newChat: Chat = {
      id: this.generateId(),
      title,
      created_at: now,
      updated_at: now,
      is_archived: false,
      is_starred: false,
      is_deleted: false
    };
    chats.push(newChat);
    this.setItem('chats', chats);
    return newChat.id;
  }

  async getChat(id: string): Promise<Chat | undefined> {
    const chats = this.getItem<Chat[]>('chats') || [];
    return chats.find(chat => chat.id === id);
  }

  async updateChat(id: string, updates: Partial<Chat>): Promise<string> {
    const chats = this.getItem<Chat[]>('chats') || [];
    const index = chats.findIndex(chat => chat.id === id);
    if (index !== -1) {
      chats[index] = {
        ...chats[index],
        ...updates,
        updated_at: new Date().toISOString()
      };
      this.setItem('chats', chats);
    }
    return id;
  }

  async getRecentChats(limit: number = 10): Promise<Chat[]> {
    const chats = this.getItem<Chat[]>('chats') || [];
    return chats
      .filter(chat => !chat.is_deleted)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, limit);
  }

  // Message methods
  async addMessage(
    chatId: string, 
    content: string, 
    role: Message['role'], 
    tokens: number,
    images?: string[]
  ): Promise<string> {
    const messages = this.getItem<Message[]>('messages') || [];
    const newMessage: Message = {
      id: this.generateId(),
      chat_id: chatId,
      content,
      role,
      tokens,
      timestamp: new Date().toISOString(),
      images
    };
    messages.push(newMessage);
    this.setItem('messages', messages);
    await this.updateUsage('tokens', tokens);
    await this.updateUsage('messages', 1);
    return newMessage.id;
  }

  async getChatMessages(chatId: string): Promise<Message[]> {
    const messages = this.getItem<Message[]>('messages') || [];
    return messages
      .filter(message => message.chat_id === chatId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  // Storage methods
  async addStorageItem(item: Omit<StorageItem, 'id' | 'timestamp'>): Promise<string> {
    const storage = this.getItem<StorageItem[]>('storage') || [];
    const newItem: StorageItem = {
      ...item,
      id: this.generateId(),
      timestamp: new Date().toISOString()
    };
    storage.push(newItem);
    this.setItem('storage', storage);
    await this.updateUsage('storage', item.size);
    return newItem.id;
  }

  async getStorageItem(id: string): Promise<StorageItem | undefined> {
    const storage = this.getItem<StorageItem[]>('storage') || [];
    return storage.find(item => item.id === id);
  }

  async getRecentStorageItems(limit: number = 5): Promise<StorageItem[]> {
    const storage = this.getItem<StorageItem[]>('storage') || [];
    return storage
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  // Usage methods
  private async updateUsage(type: Usage['type'], value: number): Promise<void> {
    const usage = this.getItem<Usage[]>('usage') || [];
    usage.push({
      id: this.generateId(),
      type,
      value,
      timestamp: new Date().toISOString()
    });
    this.setItem('usage', usage);
  }

  async updateModelUsage(model: string, duration: number): Promise<void> {
    const usageKey = 'model_usage';
    const usage = this.getItem<Record<string, ModelUsage>>(usageKey) || {};
    
    if (!usage[model]) {
      usage[model] = {
        name: model,
        totalDuration: 0,
        requestCount: 0,
        avgDuration: 0,
        lastUsed: new Date().toISOString()
      };
    }
    
    usage[model].totalDuration += duration;
    usage[model].requestCount += 1;
    usage[model].avgDuration = usage[model].totalDuration / usage[model].requestCount;
    usage[model].lastUsed = new Date().toISOString();
    
    this.setItem(usageKey, usage);
  }

  async getModelUsage(): Promise<ModelUsage[]> {
    const usage = this.getItem<Record<string, ModelUsage>>('model_usage') || {};
    return Object.values(usage).sort((a, b) => b.requestCount - a.requestCount);
  }

  async getTokensUsed(days: number = 30): Promise<number> {
    const usage = this.getItem<Usage[]>('usage') || [];
    const since = new Date();
    since.setDate(since.getDate() - days);
    return usage
      .filter(record => 
        record.type === 'tokens' && 
        new Date(record.timestamp) >= since
      )
      .reduce((sum, record) => sum + record.value, 0);
  }

  async getTotalStorage(): Promise<number> {
    const usage = this.getItem<Usage[]>('usage') || [];
    return usage
      .filter(record => record.type === 'storage')
      .reduce((sum, record) => sum + record.value, 0);
  }

  async getMessageCount(): Promise<number> {
    const messages = this.getItem<Message[]>('messages') || [];
    return messages.length;
  }

  async getAverageResponseTime(days: number = 1): Promise<number> {
    const usage = this.getItem<Usage[]>('usage') || [];
    const since = new Date();
    since.setDate(since.getDate() - days);
    const records = usage.filter(
      record => 
        record.type === 'response_time' && 
        new Date(record.timestamp) >= since
    );
    const sum = records.reduce((sum, record) => sum + record.value, 0);
    return records.length ? sum / records.length : 0;
  }

  // Settings methods
  async updatePersonalInfo(info: PersonalInfo): Promise<void> {
    this.setItem('personal_info', info);
  }

  async getPersonalInfo(): Promise<PersonalInfo | null> {
    return this.getItem<PersonalInfo>('personal_info');
  }

  async updateAPIConfig(config: APIConfig): Promise<void> {
    this.setItem('api_config', config);
  }

  async getAPIConfig(): Promise<APIConfig | null> {
    return this.getItem<APIConfig>('api_config');
  }

  // Clear all data
  async reset(): Promise<void> {
    Object.keys(localStorage)
      .filter(key => key.startsWith(DB_PREFIX))
      .forEach(key => localStorage.removeItem(key));
  }
}

export const db = new LocalStorageDB();