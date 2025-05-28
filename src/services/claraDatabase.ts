import { indexedDBService } from './indexedDB';
import { 
  ClaraChatSession, 
  ClaraMessage, 
  ClaraFileAttachment,
  ClaraArtifact 
} from '../types/clara_assistant_types';

export interface ClaraChatSessionRecord extends Omit<ClaraChatSession, 'createdAt' | 'updatedAt'> {
  createdAt: string; // Store as ISO string for IndexedDB
  updatedAt: string;
}

export interface ClaraMessageRecord extends Omit<ClaraMessage, 'timestamp'> {
  sessionId: string; // Reference to the session
  timestamp: string; // Store as ISO string for IndexedDB
}

export interface ClaraFileRecord {
  id: string;
  sessionId: string;
  messageId: string;
  name: string;
  type: string;
  size: number;
  mimeType: string;
  content: string; // Base64 for small files or blob URL for large files
  thumbnail?: string; // Base64 thumbnail for images
  processed: boolean;
  createdAt: string;
}

/**
 * Database service specifically for Clara chat sessions
 * Handles persistence of chat sessions, messages, and file attachments
 */
export class ClaraDatabaseService {
  private readonly SESSIONS_STORE = 'clara_sessions';
  private readonly MESSAGES_STORE = 'clara_messages';
  private readonly FILES_STORE = 'clara_files';

  /**
   * Save a chat session to the database
   */
  async saveSession(session: ClaraChatSession): Promise<void> {
    const sessionRecord: ClaraChatSessionRecord = {
      ...session,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      messages: [] // Don't store messages in the session record, they're separate
    };

    await indexedDBService.put(this.SESSIONS_STORE, sessionRecord);

    // Save all messages for this session
    for (const message of session.messages) {
      await this.saveMessage(session.id, message);
    }
  }

  /**
   * Save a message to the database
   */
  async saveMessage(sessionId: string, message: ClaraMessage): Promise<void> {
    const messageRecord: ClaraMessageRecord = {
      ...message,
      sessionId,
      timestamp: message.timestamp.toISOString()
    };

    await indexedDBService.put(this.MESSAGES_STORE, messageRecord);

    // Save file attachments if any
    if (message.attachments) {
      for (const attachment of message.attachments) {
        await this.saveFile(sessionId, message.id, attachment);
      }
    }
  }

  /**
   * Save a file attachment to the database
   */
  async saveFile(sessionId: string, messageId: string, file: ClaraFileAttachment): Promise<void> {
    const fileRecord: ClaraFileRecord = {
      id: file.id,
      sessionId,
      messageId,
      name: file.name,
      type: file.type,
      size: file.size,
      mimeType: file.mimeType,
      content: file.base64 || file.url || '',
      thumbnail: file.thumbnail,
      processed: file.processed || false,
      createdAt: new Date().toISOString()
    };

    await indexedDBService.put(this.FILES_STORE, fileRecord);
  }

  /**
   * Get all chat sessions, ordered by most recent first
   */
  async getAllSessions(includeMessages: boolean = false): Promise<ClaraChatSession[]> {
    const sessionRecords = await indexedDBService.getAll<ClaraChatSessionRecord>(this.SESSIONS_STORE);
    
    // Convert back to ClaraChatSession objects and sort by updatedAt
    const sessions = sessionRecords
      .map(this.recordToSession)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

    // Load messages if requested
    if (includeMessages) {
      for (const session of sessions) {
        session.messages = await this.getSessionMessages(session.id);
      }
    }

    return sessions;
  }

  /**
   * Get a specific session by ID with all its messages
   */
  async getSession(sessionId: string): Promise<ClaraChatSession | null> {
    const sessionRecord = await indexedDBService.get<ClaraChatSessionRecord>(this.SESSIONS_STORE, sessionId);
    if (!sessionRecord) return null;

    const session = this.recordToSession(sessionRecord);
    
    // Load all messages for this session
    const messages = await this.getSessionMessages(sessionId);
    session.messages = messages;

    return session;
  }

  /**
   * Get all messages for a session
   */
  async getSessionMessages(sessionId: string): Promise<ClaraMessage[]> {
    const allMessages = await indexedDBService.getAll<ClaraMessageRecord>(this.MESSAGES_STORE);
    const sessionMessages = allMessages
      .filter(msg => msg.sessionId === sessionId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Convert to ClaraMessage objects and load attachments
    const messages: ClaraMessage[] = [];
    for (const messageRecord of sessionMessages) {
      const message = await this.recordToMessage(messageRecord);
      messages.push(message);
    }

    return messages;
  }

  /**
   * Get files for a specific message
   */
  async getMessageFiles(messageId: string): Promise<ClaraFileAttachment[]> {
    const allFiles = await indexedDBService.getAll<ClaraFileRecord>(this.FILES_STORE);
    const messageFiles = allFiles.filter(file => file.messageId === messageId);

    return messageFiles.map(this.recordToFileAttachment);
  }

  /**
   * Update session metadata (title, starred, archived, etc.)
   */
  async updateSession(sessionId: string, updates: Partial<ClaraChatSession>): Promise<void> {
    const existingRecord = await indexedDBService.get<ClaraChatSessionRecord>(this.SESSIONS_STORE, sessionId);
    if (!existingRecord) throw new Error(`Session ${sessionId} not found`);

    const updatedRecord: ClaraChatSessionRecord = {
      ...existingRecord,
      ...updates,
      updatedAt: new Date().toISOString(),
      // Ensure dates are strings
      createdAt: updates.createdAt ? updates.createdAt.toISOString() : existingRecord.createdAt,
    };

    await indexedDBService.put(this.SESSIONS_STORE, updatedRecord);
  }

  /**
   * Delete a session and all its messages and files
   */
  async deleteSession(sessionId: string): Promise<void> {
    // Delete all messages for this session
    const messages = await indexedDBService.getAll<ClaraMessageRecord>(this.MESSAGES_STORE);
    for (const message of messages.filter(m => m.sessionId === sessionId)) {
      await indexedDBService.delete(this.MESSAGES_STORE, message.id);
    }

    // Delete all files for this session
    const files = await indexedDBService.getAll<ClaraFileRecord>(this.FILES_STORE);
    for (const file of files.filter(f => f.sessionId === sessionId)) {
      await indexedDBService.delete(this.FILES_STORE, file.id);
    }

    // Delete the session itself
    await indexedDBService.delete(this.SESSIONS_STORE, sessionId);
  }

  /**
   * Get recent sessions (for sidebar)
   */
  async getRecentSessions(limit: number = 20): Promise<ClaraChatSession[]> {
    const sessionRecords = await indexedDBService.getAll<ClaraChatSessionRecord>(this.SESSIONS_STORE);
    
    // Convert to sessions and sort by updatedAt
    const sessions = sessionRecords
      .map(this.recordToSession)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);

    // Load messages for each session
    for (const session of sessions) {
      session.messages = await this.getSessionMessages(session.id);
    }

    return sessions;
  }

  /**
   * Get recent sessions WITHOUT messages (for lightning-fast loading)
   */
  async getRecentSessionsLight(limit: number = 20, offset: number = 0): Promise<ClaraChatSession[]> {
    const sessionRecords = await indexedDBService.getAll<ClaraChatSessionRecord>(this.SESSIONS_STORE);
    
    // Convert to sessions and sort by updatedAt, then apply pagination
    const sessions = sessionRecords
      .map(this.recordToSession)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(offset, offset + limit);

    // Return sessions with empty messages array (no database queries for messages)
    return sessions.map(session => ({
      ...session,
      messages: [] // Empty array for fast loading
    }));
  }

  /**
   * Get starred sessions
   */
  async getStarredSessions(): Promise<ClaraChatSession[]> {
    const sessions = await this.getAllSessions(true); // Include messages
    return sessions.filter(session => session.isStarred);
  }

  /**
   * Get archived sessions
   */
  async getArchivedSessions(): Promise<ClaraChatSession[]> {
    const sessions = await this.getAllSessions(true); // Include messages
    return sessions.filter(session => session.isArchived);
  }

  /**
   * Search sessions by title or message content
   */
  async searchSessions(query: string): Promise<ClaraChatSession[]> {
    const sessions = await this.getAllSessions(true); // Include messages for search
    const lowerQuery = query.toLowerCase();

    return sessions.filter(session => 
      session.title.toLowerCase().includes(lowerQuery) ||
      session.messages.some(message => 
        message.content.toLowerCase().includes(lowerQuery)
      )
    );
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{
    totalSessions: number;
    totalMessages: number;
    totalFiles: number;
    totalSize: number;
  }> {
    const sessions = await indexedDBService.getAll<ClaraChatSessionRecord>(this.SESSIONS_STORE);
    const messages = await indexedDBService.getAll<ClaraMessageRecord>(this.MESSAGES_STORE);
    const files = await indexedDBService.getAll<ClaraFileRecord>(this.FILES_STORE);

    const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);

    return {
      totalSessions: sessions.length,
      totalMessages: messages.length,
      totalFiles: files.length,
      totalSize
    };
  }

  /**
   * Debug method to check for orphaned data and integrity issues
   */
  async debugDataIntegrity(): Promise<{
    sessions: number;
    messages: number;
    files: number;
    orphanedMessages: number;
    orphanedFiles: number;
  }> {
    const sessions = await indexedDBService.getAll<ClaraChatSessionRecord>(this.SESSIONS_STORE);
    const messages = await indexedDBService.getAll<ClaraMessageRecord>(this.MESSAGES_STORE);
    const files = await indexedDBService.getAll<ClaraFileRecord>(this.FILES_STORE);

    const sessionIds = new Set(sessions.map(s => s.id));
    const messageIds = new Set(messages.map(m => m.id));

    // Find orphaned messages (messages without valid sessions)
    const orphanedMessages = messages.filter(m => !sessionIds.has(m.sessionId));
    
    // Find orphaned files (files without valid messages or sessions)
    const orphanedFiles = files.filter(f => 
      !sessionIds.has(f.sessionId) || !messageIds.has(f.messageId)
    );

    console.log('Data integrity check:', {
      sessions: sessions.length,
      messages: messages.length,
      files: files.length,
      orphanedMessages: orphanedMessages.length,
      orphanedFiles: orphanedFiles.length
    });

    return {
      sessions: sessions.length,
      messages: messages.length,
      files: files.length,
      orphanedMessages: orphanedMessages.length,
      orphanedFiles: orphanedFiles.length
    };
  }

  /**
   * Clean up orphaned data
   */
  async cleanupOrphanedData(): Promise<void> {
    const sessions = await indexedDBService.getAll<ClaraChatSessionRecord>(this.SESSIONS_STORE);
    const messages = await indexedDBService.getAll<ClaraMessageRecord>(this.MESSAGES_STORE);
    const files = await indexedDBService.getAll<ClaraFileRecord>(this.FILES_STORE);

    const sessionIds = new Set(sessions.map(s => s.id));
    const messageIds = new Set(messages.map(m => m.id));

    // Clean up orphaned messages
    const orphanedMessages = messages.filter(m => !sessionIds.has(m.sessionId));
    for (const message of orphanedMessages) {
      await indexedDBService.delete(this.MESSAGES_STORE, message.id);
      console.log('Deleted orphaned message:', message.id);
    }

    // Clean up orphaned files
    const orphanedFiles = files.filter(f => 
      !sessionIds.has(f.sessionId) || !messageIds.has(f.messageId)
    );
    for (const file of orphanedFiles) {
      await indexedDBService.delete(this.FILES_STORE, file.id);
      console.log('Deleted orphaned file:', file.id);
    }

    console.log(`Cleaned up ${orphanedMessages.length} orphaned messages and ${orphanedFiles.length} orphaned files`);
  }

  /**
   * Clear all Clara chat sessions, messages, and files
   * WARNING: This will permanently delete all chat history
   */
  async clearAllSessions(): Promise<void> {
    try {
      // Clear all files first
      await indexedDBService.clear(this.FILES_STORE);
      
      // Clear all messages
      await indexedDBService.clear(this.MESSAGES_STORE);
      
      // Clear all sessions
      await indexedDBService.clear(this.SESSIONS_STORE);
      
      console.log('Successfully cleared all Clara chat data');
    } catch (error) {
      console.error('Failed to clear Clara chat data:', error);
      throw error;
    }
  }

  // Helper methods for converting between records and objects

  private recordToSession(record: ClaraChatSessionRecord): ClaraChatSession {
    return {
      ...record,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      messages: [] // Messages are loaded separately
    };
  }

  private async recordToMessage(record: ClaraMessageRecord): Promise<ClaraMessage> {
    const attachments = await this.getMessageFiles(record.id);
    
    return {
      ...record,
      timestamp: new Date(record.timestamp),
      attachments: attachments.length > 0 ? attachments : undefined
    };
  }

  private recordToFileAttachment(record: ClaraFileRecord): ClaraFileAttachment {
    return {
      id: record.id,
      name: record.name,
      type: record.type as any,
      size: record.size,
      mimeType: record.mimeType,
      base64: record.content.startsWith('data:') ? record.content : undefined,
      url: !record.content.startsWith('data:') ? record.content : undefined,
      thumbnail: record.thumbnail,
      processed: record.processed
    };
  }
}

// Export singleton instance
export const claraDatabaseService = new ClaraDatabaseService(); 