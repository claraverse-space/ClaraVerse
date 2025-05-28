import { claraDatabaseService } from '../services/claraDatabase';
import { ClaraChatSession, ClaraMessage, ClaraFileAttachment } from '../types/clara_assistant_types';

/**
 * Clara Database Helper
 * Provides convenient methods for Clara chat persistence
 */
export class ClaraDatabase {
  /**
   * Generate a unique ID for messages/sessions
   */
  generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Create a new Clara chat session
   */
  async createClaraSession(title: string): Promise<ClaraChatSession> {
    const session: ClaraChatSession = {
      id: this.generateId(),
      title,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      isStarred: false,
      isArchived: false
    };

    await claraDatabaseService.saveSession(session);
    return session;
  }

  /**
   * Get a Clara chat session by ID
   */
  async getClaraSession(sessionId: string): Promise<ClaraChatSession | null> {
    return await claraDatabaseService.getSession(sessionId);
  }

  /**
   * Save/Update a Clara chat session
   */
  async saveClaraSession(session: ClaraChatSession): Promise<void> {
    await claraDatabaseService.saveSession(session);
  }

  /**
   * Update Clara session metadata
   */
  async updateClaraSession(sessionId: string, updates: Partial<ClaraChatSession>): Promise<void> {
    await claraDatabaseService.updateSession(sessionId, updates);
  }

  /**
   * Delete a Clara chat session
   */
  async deleteClaraSession(sessionId: string): Promise<void> {
    await claraDatabaseService.deleteSession(sessionId);
  }

  /**
   * Get recent Clara chat sessions
   */
  async getRecentClaraSessions(limit: number = 20): Promise<ClaraChatSession[]> {
    return await claraDatabaseService.getRecentSessions(limit);
  }

  /**
   * Get recent Clara chat sessions without messages (for fast loading)
   */
  async getRecentClaraSessionsLight(limit: number = 20, offset: number = 0): Promise<ClaraChatSession[]> {
    return await claraDatabaseService.getRecentSessionsLight(limit, offset);
  }

  /**
   * Get all Clara chat sessions
   */
  async getAllClaraSessions(): Promise<ClaraChatSession[]> {
    return await claraDatabaseService.getAllSessions();
  }

  /**
   * Get starred Clara sessions
   */
  async getStarredClaraSessions(): Promise<ClaraChatSession[]> {
    return await claraDatabaseService.getStarredSessions();
  }

  /**
   * Get archived Clara sessions
   */
  async getArchivedClaraSessions(): Promise<ClaraChatSession[]> {
    return await claraDatabaseService.getArchivedSessions();
  }

  /**
   * Search Clara sessions
   */
  async searchClaraSessions(query: string): Promise<ClaraChatSession[]> {
    return await claraDatabaseService.searchSessions(query);
  }

  /**
   * Add a message to a Clara session
   */
  async addClaraMessage(sessionId: string, message: ClaraMessage): Promise<void> {
    await claraDatabaseService.saveMessage(sessionId, message);
    
    // Update session's updatedAt timestamp
    await claraDatabaseService.updateSession(sessionId, {
      updatedAt: new Date()
    });
  }

  /**
   * Get Clara storage statistics
   */
  async getClaraStorageStats(): Promise<{
    totalSessions: number;
    totalMessages: number;
    totalFiles: number;
    totalSize: number;
  }> {
    return await claraDatabaseService.getStorageStats();
  }

  /**
   * Clear all Clara chat sessions, messages, and files
   * WARNING: This will permanently delete all chat history
   */
  async clearAllClaraSessions(): Promise<void> {
    return await claraDatabaseService.clearAllSessions();
  }

  /**
   * Debug data integrity and check for orphaned data
   */
  async debugDataIntegrity(): Promise<{
    sessions: number;
    messages: number;
    files: number;
    orphanedMessages: number;
    orphanedFiles: number;
  }> {
    return await claraDatabaseService.debugDataIntegrity();
  }

  /**
   * Clean up orphaned data (messages without sessions, files without messages)
   */
  async cleanupOrphanedData(): Promise<void> {
    return await claraDatabaseService.cleanupOrphanedData();
  }
}

// Export singleton instance
export const claraDB = new ClaraDatabase(); 