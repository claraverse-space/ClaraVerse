/**
 * Tool Success Registry Service
 * Tracks tools that have worked successfully to prevent false positive blacklisting
 */

export interface ToolSuccessRecord {
  name: string;
  description: string;
  providerId: string;
  successCount: number;
  lastSuccessTimestamp: string;
  firstSuccessTimestamp: string;
  compatibilityConfirmed: boolean;
  toolCallIds: string[]; // Track successful tool_call_ids
}

export interface ToolBlacklistAttempt {
  toolName: string;
  providerId: string;
  reason: string;
  timestamp: string;
  blocked: boolean;
  successHistory: ToolSuccessRecord | null;
}

export class ToolSuccessRegistry {
  private static readonly STORAGE_KEY = 'clara-tool-success-registry';
  private static readonly BLACKLIST_ATTEMPTS_KEY = 'clara-blacklist-attempts';
  private static readonly MIN_SUCCESS_COUNT = 1; // Minimum successes to protect from blacklisting
  
  private static successRegistry: Map<string, ToolSuccessRecord> = new Map();
  private static blacklistAttempts: ToolBlacklistAttempt[] = [];
  private static initialized = false;

  /**
   * Initialize the success registry by loading from localStorage
   */
  public static initialize(): void {
    if (this.initialized) return;
    
    try {
      // Load success registry
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const records: ToolSuccessRecord[] = JSON.parse(stored);
        records.forEach(record => {
          const key = this.generateToolKey(record.name, record.description, record.providerId);
          this.successRegistry.set(key, record);
        });
        console.log(`📊 [TOOL-SUCCESS-REGISTRY] Loaded ${records.length} tool success records`);
      }
      
      // Load blacklist attempts
      const attempts = localStorage.getItem(this.BLACKLIST_ATTEMPTS_KEY);
      if (attempts) {
        this.blacklistAttempts = JSON.parse(attempts);
        console.log(`📊 [TOOL-SUCCESS-REGISTRY] Loaded ${this.blacklistAttempts.length} blacklist attempts`);
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize Tool Success Registry:', error);
    }
  }

  /**
   * Record a successful tool execution
   */
  public static recordSuccess(
    toolName: string, 
    toolDescription: string, 
    providerId: string, 
    toolCallId?: string
  ): void {
    this.initialize();
    
    const key = this.generateToolKey(toolName, toolDescription, providerId);
    const now = new Date().toISOString();
    
    let record = this.successRegistry.get(key);
    
    if (record) {
      // Update existing record
      record.successCount++;
      record.lastSuccessTimestamp = now;
      record.compatibilityConfirmed = true;
      
      // Track unique tool call IDs
      if (toolCallId && !record.toolCallIds.includes(toolCallId)) {
        record.toolCallIds.push(toolCallId);
        // Keep only last 10 tool call IDs
        if (record.toolCallIds.length > 10) {
          record.toolCallIds = record.toolCallIds.slice(-10);
        }
      }
      
      console.log(`✅ [TOOL-SUCCESS] Updated ${toolName} for ${providerId}: ${record.successCount} successes`);
    } else {
      // Create new record
      record = {
        name: toolName,
        description: toolDescription,
        providerId,
        successCount: 1,
        lastSuccessTimestamp: now,
        firstSuccessTimestamp: now,
        compatibilityConfirmed: true,
        toolCallIds: toolCallId ? [toolCallId] : []
      };
      
      this.successRegistry.set(key, record);
      console.log(`🆕 [TOOL-SUCCESS] Registered new successful tool: ${toolName} for ${providerId}`);
    }
    
    // Persist to localStorage
    this.saveToStorage();
  }

  /**
   * Check if a tool should be protected from blacklisting
   */
  public static isToolProtected(toolName: string, toolDescription: string, providerId: string): boolean {
    this.initialize();
    
    const key = this.generateToolKey(toolName, toolDescription, providerId);
    const record = this.successRegistry.get(key);
    
    if (!record) {
      return false;
    }
    
    // Tool is protected if:
    // 1. It has succeeded at least once
    // 2. OR it has been confirmed as compatible
    const isProtected = record.successCount >= this.MIN_SUCCESS_COUNT || record.compatibilityConfirmed;
    
    if (isProtected) {
      console.log(`🛡️ [TOOL-PROTECTION] Tool ${toolName} is PROTECTED (${record.successCount} successes, confirmed: ${record.compatibilityConfirmed})`);
    }
    
    return isProtected;
  }

  /**
   * Attempt to blacklist a tool - will be blocked if tool is protected
   */
  public static attemptBlacklist(
    toolName: string, 
    toolDescription: string, 
    providerId: string, 
    reason: string
  ): { allowed: boolean; reason: string } {
    this.initialize();
    
    const key = this.generateToolKey(toolName, toolDescription, providerId);
    const record = this.successRegistry.get(key);
    const isProtected = this.isToolProtected(toolName, toolDescription, providerId);
    
    const attempt: ToolBlacklistAttempt = {
      toolName,
      providerId,
      reason,
      timestamp: new Date().toISOString(),
      blocked: isProtected,
      successHistory: record || null
    };
    
    this.blacklistAttempts.push(attempt);
    this.saveBlacklistAttempts();
    
    if (isProtected) {
      const successCount = record?.successCount || 0;
      const protectionReason = `Tool has ${successCount} successful executions and is confirmed compatible`;
      
      console.warn(`🚫 [BLACKLIST-BLOCKED] Prevented blacklisting of protected tool: ${toolName}`);
      console.warn(`🚫 [BLACKLIST-BLOCKED] Reason: ${protectionReason}`);
      console.warn(`🚫 [BLACKLIST-BLOCKED] Original error: ${reason}`);
      
      return { 
        allowed: false, 
        reason: protectionReason 
      };
    }
    
    console.log(`✅ [BLACKLIST-ALLOWED] Allowing blacklist of unprotected tool: ${toolName}`);
    return { 
      allowed: true, 
      reason: 'Tool has no success history' 
    };
  }

  /**
   * Get success record for a tool
   */
  public static getSuccessRecord(toolName: string, toolDescription: string, providerId: string): ToolSuccessRecord | null {
    this.initialize();
    
    const key = this.generateToolKey(toolName, toolDescription, providerId);
    return this.successRegistry.get(key) || null;
  }

  /**
   * Get all successful tools for a provider
   */
  public static getSuccessfulToolsForProvider(providerId: string): ToolSuccessRecord[] {
    this.initialize();
    
    return Array.from(this.successRegistry.values())
      .filter(record => record.providerId === providerId);
  }

  /**
   * Get blacklist attempt history
   */
  public static getBlacklistAttempts(): ToolBlacklistAttempt[] {
    this.initialize();
    return [...this.blacklistAttempts];
  }

  /**
   * Clear success registry for a provider (for debugging)
   */
  public static clearSuccessRegistryForProvider(providerId: string): void {
    this.initialize();
    
    const keysToRemove = Array.from(this.successRegistry.keys())
      .filter(key => key.includes(`:${providerId}:`));
    
    keysToRemove.forEach(key => this.successRegistry.delete(key));
    
    this.saveToStorage();
    console.log(`🗑️ [TOOL-SUCCESS-REGISTRY] Cleared success registry for provider ${providerId}`);
  }

  /**
   * Clear all success records (for debugging)
   */
  public static clearAllSuccessRecords(): void {
    this.successRegistry.clear();
    this.blacklistAttempts = [];
    
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.BLACKLIST_ATTEMPTS_KEY);
      console.log(`🗑️ [TOOL-SUCCESS-REGISTRY] Cleared all success records and blacklist attempts`);
    } catch (error) {
      console.warn('Failed to clear success registry from localStorage:', error);
    }
  }

  /**
   * Get statistics about tool success
   */
  public static getStatistics(): {
    totalSuccessfulTools: number;
    totalSuccesses: number;
    totalBlacklistAttempts: number;
    blockedBlacklistAttempts: number;
    providerBreakdown: { [providerId: string]: number };
  } {
    this.initialize();
    
    const records = Array.from(this.successRegistry.values());
    const totalSuccesses = records.reduce((sum, record) => sum + record.successCount, 0);
    const blockedAttempts = this.blacklistAttempts.filter(attempt => attempt.blocked).length;
    
    const providerBreakdown: { [providerId: string]: number } = {};
    records.forEach(record => {
      providerBreakdown[record.providerId] = (providerBreakdown[record.providerId] || 0) + 1;
    });
    
    return {
      totalSuccessfulTools: records.length,
      totalSuccesses,
      totalBlacklistAttempts: this.blacklistAttempts.length,
      blockedBlacklistAttempts: blockedAttempts,
      providerBreakdown
    };
  }

  /**
   * Generate a unique key for a tool
   */
  private static generateToolKey(name: string, description: string, providerId: string): string {
    return `${name}:${description}:${providerId}`;
  }

  /**
   * Save success registry to localStorage
   */
  private static saveToStorage(): void {
    try {
      const records = Array.from(this.successRegistry.values());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(records));
    } catch (error) {
      console.warn('Failed to save tool success registry to localStorage:', error);
    }
  }

  /**
   * Save blacklist attempts to localStorage
   */
  private static saveBlacklistAttempts(): void {
    try {
      // Keep only last 100 attempts to prevent storage bloat
      const recentAttempts = this.blacklistAttempts.slice(-100);
      localStorage.setItem(this.BLACKLIST_ATTEMPTS_KEY, JSON.stringify(recentAttempts));
      this.blacklistAttempts = recentAttempts;
    } catch (error) {
      console.warn('Failed to save blacklist attempts to localStorage:', error);
    }
  }
}

// Initialize the registry when the module loads
ToolSuccessRegistry.initialize(); 