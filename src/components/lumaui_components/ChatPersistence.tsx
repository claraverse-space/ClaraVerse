import { ChatCheckpoint } from './CheckpointManager';

export interface PersistedChatData {
  projectId: string;
  messages: any[];
  checkpoints: ChatCheckpoint[];
  lastUpdated: Date;
  metadata: {
    messageCount: number;
    lastActivity: Date;
    projectName?: string;
  };
}

export class ChatPersistence {
  private static readonly STORAGE_PREFIX = 'lumaui_project_chat_';
  private static readonly CHAT_LIST_KEY = 'lumaui_project_chats';

  // Save chat data for a specific project
  static saveChatData(projectId: string, messages: any[], checkpoints: ChatCheckpoint[], projectName?: string): void {
    try {
      const chatData: PersistedChatData = {
        projectId,
        messages: JSON.parse(JSON.stringify(messages)), // Deep clone
        checkpoints: JSON.parse(JSON.stringify(checkpoints)), // Deep clone
        lastUpdated: new Date(),
        metadata: {
          messageCount: messages.length,
          lastActivity: new Date(),
          projectName
        }
      };

      const storageKey = this.STORAGE_PREFIX + projectId;
      localStorage.setItem(storageKey, JSON.stringify(chatData));

      // Update the list of projects with chat data
      this.updateChatList(projectId, projectName);

      console.log('💾 Saved chat data for project:', projectId, 'with', messages.length, 'messages and', checkpoints.length, 'checkpoints');
    } catch (error) {
      console.error('Failed to save chat data:', error);
    }
  }

  // Load chat data for a specific project
  static loadChatData(projectId: string): PersistedChatData | null {
    try {
      const storageKey = this.STORAGE_PREFIX + projectId;
      const saved = localStorage.getItem(storageKey);
      
      if (!saved) {
        return null;
      }

      const chatData: PersistedChatData = JSON.parse(saved);
      
      // Convert date strings back to Date objects
      chatData.lastUpdated = new Date(chatData.lastUpdated);
      chatData.metadata.lastActivity = new Date(chatData.metadata.lastActivity);
      
      // Convert checkpoint timestamps back to Date objects
      chatData.checkpoints = chatData.checkpoints.map(cp => ({
        ...cp,
        timestamp: new Date(cp.timestamp)
      }));

      // Convert message timestamps back to Date objects
      chatData.messages = chatData.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));

      console.log('📖 Loaded chat data for project:', projectId, 'with', chatData.messages.length, 'messages');
      return chatData;
    } catch (error) {
      console.error('Failed to load chat data:', error);
      return null;
    }
  }

  // Delete chat data for a specific project
  static deleteChatData(projectId: string): void {
    try {
      const storageKey = this.STORAGE_PREFIX + projectId;
      localStorage.removeItem(storageKey);
      
      // Remove from chat list
      this.removeChatFromList(projectId);
      
      console.log('🗑️ Deleted chat data for project:', projectId);
    } catch (error) {
      console.error('Failed to delete chat data:', error);
    }
  }

  // Get list of all projects with chat data
  static getAllProjectChats(): Array<{projectId: string, projectName?: string, lastActivity: Date, messageCount: number}> {
    try {
      const chatListData = localStorage.getItem(this.CHAT_LIST_KEY);
      if (!chatListData) {
        return [];
      }

      const chatList = JSON.parse(chatListData);
      return chatList.map((item: any) => ({
        ...item,
        lastActivity: new Date(item.lastActivity)
      }));
    } catch (error) {
      console.error('Failed to get project chat list:', error);
      return [];
    }
  }

  // Check if a project has saved chat data
  static hasChatData(projectId: string): boolean {
    const storageKey = this.STORAGE_PREFIX + projectId;
    return localStorage.getItem(storageKey) !== null;
  }

  // Clear all chat data (for debugging/reset)
  static clearAllChatData(): void {
    try {
      const keys = Object.keys(localStorage).filter(key => key.startsWith(this.STORAGE_PREFIX));
      keys.forEach(key => localStorage.removeItem(key));
      localStorage.removeItem(this.CHAT_LIST_KEY);
      console.log('🧹 Cleared all chat data');
    } catch (error) {
      console.error('Failed to clear chat data:', error);
    }
  }

  // Auto-save with debouncing to prevent excessive saves
  private static saveTimeout: NodeJS.Timeout | null = null;
  static autoSave(projectId: string, messages: any[], checkpoints: ChatCheckpoint[], projectName?: string, delay: number = 2000): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    this.saveTimeout = setTimeout(() => {
      this.saveChatData(projectId, messages, checkpoints, projectName);
      this.saveTimeout = null;
    }, delay);
  }

  // Private helper methods
  private static updateChatList(projectId: string, projectName?: string): void {
    try {
      let chatList = this.getAllProjectChats();
      
      // Remove existing entry if it exists
      chatList = chatList.filter(item => item.projectId !== projectId);
      
      // Add updated entry
      chatList.push({
        projectId,
        projectName,
        lastActivity: new Date(),
        messageCount: 0 // Will be updated by the actual save
      });

      // Sort by last activity (most recent first)
      chatList.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

      // Keep only last 20 projects to prevent storage bloat
      chatList = chatList.slice(0, 20);

      localStorage.setItem(this.CHAT_LIST_KEY, JSON.stringify(chatList));
    } catch (error) {
      console.error('Failed to update chat list:', error);
    }
  }

  private static removeChatFromList(projectId: string): void {
    try {
      let chatList = this.getAllProjectChats();
      chatList = chatList.filter(item => item.projectId !== projectId);
      localStorage.setItem(this.CHAT_LIST_KEY, JSON.stringify(chatList));
    } catch (error) {
      console.error('Failed to remove chat from list:', error);
    }
  }
}

export default ChatPersistence; 