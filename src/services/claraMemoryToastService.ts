/**
 * ClaraMemoryToastService.tsx
 * 
 * Service to manage Clara's memory learning toast notifications.
 * Handles cooldown periods, knowledge level tracking, and toast state management.
 */

import { UserMemoryProfile } from '../components/ClaraSweetMemory';

// ==================== INTERFACES ====================

interface MemoryToastState {
  isVisible: boolean;
  knowledgeLevel: number;
  learnedInfo?: string;
  lastShownAt: number;
}

type MemoryToastListener = (state: MemoryToastState) => void;

// ==================== CONSTANTS ====================

const COOLDOWN_PERIOD = 60000; // 60 seconds in milliseconds
const STORAGE_KEY = 'clara-memory-toast-state';
const KNOWLEDGE_LEVEL_KEY = 'clara-knowledge-level';

// 🎨 DESIGN DEBUG MODE - Always show toasts for testing/design purposes
const DESIGN_DEBUG_MODE = true; // Set to false to disable

// ==================== SERVICE CLASS ====================

class ClaraMemoryToastService {
  private state: MemoryToastState = {
    isVisible: false,
    knowledgeLevel: 0,
    lastShownAt: 0
  };

  private listeners: Set<MemoryToastListener> = new Set();
  private knowledgeLevel: number = 0;

  constructor() {
    this.loadState();
    this.loadKnowledgeLevel();
  }

  /**
   * Calculate knowledge level based on memory profile completeness
   */
  private calculateKnowledgeLevel(profile: UserMemoryProfile): number {
    let totalPossibleSections = 8; // Number of memory sections
    let completedSections = 0;
    let totalFields = 0;
    let completedFields = 0;

    // Core Identity (weight: 2x)
    const coreFields = ['fullName', 'firstName', 'preferredName', 'email', 'age', 'location', 'occupation'];
    const coreCompleted = coreFields.filter(field => profile.coreIdentity?.[field as keyof typeof profile.coreIdentity]).length;
    totalFields += coreFields.length * 2; // Double weight
    completedFields += coreCompleted * 2;
    if (coreCompleted > 0) completedSections++;

    // Personal Characteristics (including interests and technology info)
    const personalFields = ['interests', 'hobbies', 'values', 'personalityTraits', 'communicationStyle'];
    const personalCompleted = personalFields.filter(field => {
      const value = profile.personalCharacteristics?.[field as keyof typeof profile.personalCharacteristics];
      return Array.isArray(value) ? value.length > 0 : !!value;
    }).length;
    
    // Count additional dynamic fields in personalCharacteristics
    const additionalPersonalFields = Object.keys(profile.personalCharacteristics || {}).filter(
      key => !personalFields.includes(key)
    ).length;
    
    totalFields += personalFields.length;
    completedFields += personalCompleted + Math.min(additionalPersonalFields, 3); // Cap bonus fields
    if (personalCompleted > 0 || additionalPersonalFields > 0) completedSections++;

    // Preferences
    const prefFields = ['communicationPreferences', 'workStyle', 'lifestylePreferences'];
    const prefCompleted = prefFields.filter(field => {
      const value = profile.preferences?.[field as keyof typeof profile.preferences];
      return value && Object.keys(value).length > 0;
    }).length;
    totalFields += prefFields.length;
    completedFields += prefCompleted;
    if (prefCompleted > 0) completedSections++;

    // Context Information
    const contextFields = ['lifeStage', 'professionalContext'];
    const contextCompleted = contextFields.filter(field => {
      const value = profile.context?.[field as keyof typeof profile.context];
      return value && (typeof value === 'string' ? !!value : Object.keys(value).length > 0);
    }).length;
    totalFields += contextFields.length;
    completedFields += contextCompleted;
    if (contextCompleted > 0) completedSections++;

    // Interactions
    const interactionFields = ['conversationTopics', 'expertiseAreas', 'supportNeeds'];
    const interactionCompleted = interactionFields.filter(field => {
      const value = profile.interactions?.[field as keyof typeof profile.interactions];
      return Array.isArray(value) ? value.length > 0 : !!value;
    }).length;
    totalFields += interactionFields.length;
    completedFields += interactionCompleted;
    if (interactionCompleted > 0) completedSections++;

    // Practical Information (including technology and work context)
    const practicalFields = ['skills', 'timeZone', 'importantDates'];
    const practicalCompleted = practicalFields.filter(field => {
      const value = profile.practical?.[field as keyof typeof profile.practical];
      return Array.isArray(value) ? value.length > 0 : value && Object.keys(value).length > 0;
    }).length;
    
    // Count dynamic practical fields (like workContext_hardware, personalDevices)
    const additionalPracticalFields = Object.keys(profile.practical || {}).filter(
      key => !practicalFields.includes(key)
    ).length;
    
    totalFields += practicalFields.length;
    completedFields += practicalCompleted + Math.min(additionalPracticalFields, 5); // Cap bonus fields
    if (practicalCompleted > 0 || additionalPracticalFields > 0) completedSections++;

    // Relationship Information
    const relationshipFields = ['familyMembers', 'friends', 'significantOthers'];
    const relationshipCompleted = Object.keys(profile.relationship || {}).length;
    totalFields += relationshipFields.length;
    completedFields += Math.min(relationshipCompleted, relationshipFields.length);
    if (relationshipCompleted > 0) completedSections++;

    // Emotional Information
    const emotionalFields = ['currentMood', 'recentEvents', 'emotionalState'];
    const emotionalCompleted = Object.keys(profile.emotional || {}).length;
    totalFields += emotionalFields.length;
    completedFields += Math.min(emotionalCompleted, emotionalFields.length);
    if (emotionalCompleted > 0) completedSections++;

    // Calculate knowledge level (0-100) with more granular scoring
    const sectionScore = (completedSections / totalPossibleSections) * 40; // 40% weight to section diversity
    const fieldScore = (completedFields / totalFields) * 50; // 50% weight to field completeness
    const profileMaturityBonus = Math.min(10, profile.version * 0.5); // Bonus for profile maturity
    
    const knowledgeLevel = Math.min(100, Math.round(sectionScore + fieldScore + profileMaturityBonus));
    
    console.log('🧠 Knowledge Level Calculation:', {
      completedSections,
      totalPossibleSections,
      completedFields,
      totalFields,
      sectionScore: Math.round(sectionScore),
      fieldScore: Math.round(fieldScore),
      profileMaturityBonus: Math.round(profileMaturityBonus),
      finalLevel: knowledgeLevel,
      profileVersion: profile.version,
      confidence: profile.metadata.confidenceLevel,
      totalDataPoints: completedFields
    });

    return knowledgeLevel;
  }

  /**
   * Extract a brief description of what was learned from the profile
   */
  private extractLearnedInfo(profile: UserMemoryProfile): string {
    const recentInfo: string[] = [];

    // Check core identity for interesting tidbits
    if (profile.coreIdentity?.preferredName && profile.coreIdentity.preferredName !== profile.coreIdentity.fullName) {
      recentInfo.push(`prefers to be called ${profile.coreIdentity.preferredName}`);
    }
    if (profile.coreIdentity?.occupation) {
      recentInfo.push(`works as a ${profile.coreIdentity.occupation}`);
    }
    if (profile.coreIdentity?.location) {
      recentInfo.push(`lives in ${profile.coreIdentity.location}`);
    }

    // Check hobbies and interests
    if (profile.personalCharacteristics?.hobbies?.length) {
      const hobbies = profile.personalCharacteristics.hobbies.slice(0, 2).join(' & ');
      recentInfo.push(`enjoys ${hobbies}`);
    }
    if (profile.personalCharacteristics?.interests?.length) {
      const interests = profile.personalCharacteristics.interests.slice(0, 2).join(' & ');
      recentInfo.push(`interested in ${interests}`);
    }

    // Check personality traits
    if (profile.personalCharacteristics?.personalityTraits?.length) {
      const trait = profile.personalCharacteristics.personalityTraits[0];
      recentInfo.push(`has a ${trait} personality`);
    }

    // Check communication style
    if (profile.personalCharacteristics?.communicationStyle) {
      recentInfo.push(`prefers ${profile.personalCharacteristics.communicationStyle} communication`);
    }

    // Check work style
    if (profile.preferences?.workStyle?.environment) {
      recentInfo.push(`works in a ${profile.preferences.workStyle.environment} environment`);
    }

    // Return a random selection or combine a few
    if (recentInfo.length === 0) {
      return 'something interesting about your personality';
    }

    if (recentInfo.length === 1) {
      return recentInfo[0];
    }

    // Pick 1-2 random items
    const selectedInfo = recentInfo
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(2, recentInfo.length));

    return selectedInfo.join(' and ');
  }

  /**
   * Check if enough time has passed since last toast
   */
  private isOnCooldown(): boolean {
    return Date.now() - this.state.lastShownAt < COOLDOWN_PERIOD;
  }

  /**
   * Show memory learning toast if conditions are met
   */
  public showMemoryToast(profile: UserMemoryProfile): boolean {
    console.log('🧠 🔍 Memory Toast Check - Profile received:', {
      profileId: profile.id,
      userId: profile.userId,
      version: profile.version,
      confidence: profile.metadata.confidenceLevel,
      coreIdentityKeys: Object.keys(profile.coreIdentity || {}),
      personalCharKeys: Object.keys(profile.personalCharacteristics || {}),
      preferencesKeys: Object.keys(profile.preferences || {}),
      currentStoredLevel: this.knowledgeLevel,
      designDebugMode: DESIGN_DEBUG_MODE
    });

    // 🎨 DESIGN DEBUG MODE: Always show toast
    if (DESIGN_DEBUG_MODE) {
      console.log('🎨 DESIGN DEBUG MODE: Forcing memory toast to show for testing/design');
      
      // 🎨 Add some design variations for testing different states
      const designVariations = [
        { level: 15, info: "loves coding and technology" },
        { level: 35, info: "enjoys cycling and ice cream" },
        { level: 55, info: "works with RTX 4090 and dual monitors" },
        { level: 75, info: "has an iPhone and interesting personality" },
        { level: 95, info: "is a fascinating person with great taste" }
      ];
      
      const variation = designVariations[Math.floor(Math.random() * designVariations.length)];
      
      // Update state with design variation
      this.state = {
        isVisible: true,
        knowledgeLevel: variation.level,
        learnedInfo: variation.info,
        lastShownAt: Date.now()
      };

      // Update stored knowledge level
      const oldLevel = this.knowledgeLevel;
      this.knowledgeLevel = variation.level;
      this.saveKnowledgeLevel();
      this.saveState();

      // Notify listeners
      this.notifyListeners();

      console.log('🎨 ✨ Design debug toast shown with variation:', {
        oldLevel,
        newLevel: variation.level,
        learnedInfo: variation.info,
        profileVersion: profile.version
      });

      return true;
    }

    // Check cooldown (normal mode)
    if (this.isOnCooldown()) {
      const remaining = this.getCooldownRemaining();
      console.log(`🧠 Memory toast on cooldown, ${remaining}s remaining`);
      return false;
    }

    // Calculate new knowledge level
    const newKnowledgeLevel = this.calculateKnowledgeLevel(profile);
    
    console.log('🧠 🔍 Knowledge Level Comparison:', {
      currentLevel: this.knowledgeLevel,
      newCalculatedLevel: newKnowledgeLevel,
      difference: newKnowledgeLevel - this.knowledgeLevel,
      thresholdRequired: 0.5,
      willShow: newKnowledgeLevel > this.knowledgeLevel + 0.4, // Very sensitive threshold
      profileVersion: profile?.version || 'unknown',
      cooldownRemaining: this.getCooldownRemaining()
    });
    
    // Only show if knowledge level increased (very low threshold for testing)
    if (newKnowledgeLevel <= this.knowledgeLevel + 0.4) {
      console.log(`🧠 Knowledge level didn't increase enough (${this.knowledgeLevel} -> ${newKnowledgeLevel}), skipping toast`);
      return false;
    }

    // Extract what was learned
    const learnedInfo = this.extractLearnedInfo(profile);

    // Update state
    this.state = {
      isVisible: true,
      knowledgeLevel: newKnowledgeLevel,
      learnedInfo,
      lastShownAt: Date.now()
    };

    // Save the new knowledge level
    const oldLevel = this.knowledgeLevel;
    this.knowledgeLevel = newKnowledgeLevel;
    this.saveKnowledgeLevel();
    this.saveState();

    // Notify listeners
    this.notifyListeners();

    console.log('🧠 ✨ Showing memory toast:', {
      oldLevel,
      newLevel: newKnowledgeLevel,
      increase: newKnowledgeLevel - oldLevel,
      learnedInfo,
      profileVersion: profile.version
    });

    return true;
  }

  /**
   * Hide the memory toast
   */
  public hideMemoryToast(): void {
    this.state = {
      ...this.state,
      isVisible: false
    };

    this.saveState();
    this.notifyListeners();
  }

  /**
   * Get current toast state
   */
  public getState(): MemoryToastState {
    return { ...this.state };
  }

  /**
   * Get current knowledge level
   */
  public getKnowledgeLevel(): number {
    return this.knowledgeLevel;
  }

  /**
   * Reset knowledge level (for testing or user preference)
   */
  public resetKnowledgeLevel(): void {
    this.knowledgeLevel = 0;
    this.saveKnowledgeLevel();
    
    this.state = {
      ...this.state,
      knowledgeLevel: 0
    };
    
    this.saveState();
    this.notifyListeners();
    
    console.log('🧠 Reset knowledge level to 0');
  }

  /**
   * Subscribe to toast state changes
   */
  public subscribe(listener: MemoryToastListener): () => void {
    this.listeners.add(listener);
    
    // Immediately notify with current state
    listener(this.getState());
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyListeners(): void {
    const currentState = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(currentState);
      } catch (error) {
        console.error('Error notifying memory toast listener:', error);
      }
    });
  }

  /**
   * Save state to localStorage
   */
  private saveState(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        lastShownAt: this.state.lastShownAt,
        knowledgeLevel: this.state.knowledgeLevel
      }));
    } catch (error) {
      console.warn('Failed to save memory toast state:', error);
    }
  }

  /**
   * Load state from localStorage
   */
  private loadState(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state = {
          isVisible: false, // Never restore visibility
          knowledgeLevel: parsed.knowledgeLevel || 0,
          lastShownAt: parsed.lastShownAt || 0
        };
      }
    } catch (error) {
      console.warn('Failed to load memory toast state:', error);
    }
  }

  /**
   * Save knowledge level separately for persistence
   */
  private saveKnowledgeLevel(): void {
    try {
      localStorage.setItem(KNOWLEDGE_LEVEL_KEY, this.knowledgeLevel.toString());
    } catch (error) {
      console.warn('Failed to save knowledge level:', error);
    }
  }

  /**
   * Load knowledge level from localStorage
   */
  private loadKnowledgeLevel(): void {
    try {
      const saved = localStorage.getItem(KNOWLEDGE_LEVEL_KEY);
      if (saved) {
        this.knowledgeLevel = parseInt(saved, 10) || 0;
        console.log(`🧠 Loaded knowledge level: ${this.knowledgeLevel}%`);
      }
    } catch (error) {
      console.warn('Failed to load knowledge level:', error);
    }
  }

  /**
   * Get time remaining on cooldown (in seconds)
   */
  public getCooldownRemaining(): number {
    const remaining = COOLDOWN_PERIOD - (Date.now() - this.state.lastShownAt);
    return Math.max(0, Math.ceil(remaining / 1000));
  }

  /**
   * Force show toast (bypass cooldown, for testing)
   */
  public forceShowToast(knowledgeLevel?: number, learnedInfo?: string): void {
    this.state = {
      isVisible: true,
      knowledgeLevel: knowledgeLevel || this.knowledgeLevel + 5,
      learnedInfo: learnedInfo || 'something interesting about you (test)',
      lastShownAt: Date.now()
    };

    this.saveState();
    this.notifyListeners();
    
    console.log('🧠 🧪 Force showing memory toast for testing');
  }

  /**
   * Debug method to analyze current memory profile and knowledge calculation
   */
  public debugKnowledgeCalculation(profile?: UserMemoryProfile): void {
    console.log('🧠 🔍 === MEMORY TOAST DEBUG ===');
    console.log('Current stored knowledge level:', this.knowledgeLevel);
    console.log('Cooldown remaining:', this.getCooldownRemaining(), 'seconds');
    console.log('Last toast shown at:', new Date(this.state.lastShownAt).toLocaleString());
    
    if (profile) {
      console.log('\n📊 Profile Analysis:');
      const calculatedLevel = this.calculateKnowledgeLevel(profile);
      console.log('Calculated knowledge level:', calculatedLevel);
      console.log('Would trigger toast:', calculatedLevel > this.knowledgeLevel + 1);
      
      console.log('\n📝 Profile Contents:');
      console.log('- Core Identity:', profile.coreIdentity);
      console.log('- Personal Characteristics:', profile.personalCharacteristics);
      console.log('- Preferences:', profile.preferences);
      console.log('- Context:', profile.context);
      console.log('- Interactions:', profile.interactions);
      console.log('- Practical:', profile.practical);
      
      const learnedInfo = this.extractLearnedInfo(profile);
      console.log('- Extracted learned info:', learnedInfo);
    } else {
      console.log('No profile provided for analysis');
    }
    
    console.log('\n🎯 Current State:', this.getState());
  }
}

// ==================== EXPORTS ====================

// Export singleton instance
export const claraMemoryToastService = new ClaraMemoryToastService();

// Export types
export type { MemoryToastState, MemoryToastListener };

// Make available for debugging in development
if (import.meta.env.DEV) {
  (window as any).claraMemoryToastService = claraMemoryToastService;
  
  // Add helpful debugging functions
  (window as any).debugMemoryToast = () => {
    claraMemoryToastService.debugKnowledgeCalculation();
  };
  
  (window as any).testMemoryToast = () => {
    console.log('🧪 Testing memory toast...');
    claraMemoryToastService.forceShowToast(45, 'testing with fake data');
  };
  
  (window as any).resetMemoryKnowledge = () => {
    console.log('🧪 Resetting memory knowledge level...');
    claraMemoryToastService.resetKnowledgeLevel();
  };
  
  (window as any).toggleDesignDebugMode = () => {
    // Note: This is a compile-time constant, so it can't be changed at runtime
    // But we can provide feedback about the current state
    console.log('🎨 Design Debug Mode is currently:', DESIGN_DEBUG_MODE ? 'ENABLED' : 'DISABLED');
    console.log('🎨 To change this, edit DESIGN_DEBUG_MODE in ClaraMemoryToastService.ts');
    return DESIGN_DEBUG_MODE;
  };
  
  (window as any).getCurrentMemoryProfile = async () => {
    console.log('🧪 Getting current memory profile...');
    try {
      const { ClaraSweetMemoryAPI } = await import('../components/ClaraSweetMemory');
      const profile = await ClaraSweetMemoryAPI.getCurrentUserProfile();
      if (profile) {
        console.log('Current profile:', profile);
        claraMemoryToastService.debugKnowledgeCalculation(profile);
      } else {
        console.log('No profile found');
      }
      return profile;
    } catch (error) {
      console.error('Failed to get current profile:', error);
    }
  };
}
