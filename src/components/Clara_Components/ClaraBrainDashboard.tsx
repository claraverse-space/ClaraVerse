/**
 * ClaraBrainDashboard.tsx
 * 
 * Clara's Brain Memory Dashboard - Minimalist friendship & memory system
 * Simple, elegant UI following Dashboard design patterns
 */

import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Brain, Sparkles, User, MessageSquare, Settings, Heart,
  Clock, Edit2, Trash2, Save, X, ToggleLeft, ToggleRight, Grid3X3, FileText
} from 'lucide-react';
import { ClaraSweetMemoryAPI } from '../ClaraSweetMemory';
import type { UserMemoryProfile } from '../ClaraSweetMemory';

// ==================== INTERFACES ====================

interface FriendshipLevel {
  level: number;
  title: string;
  emoji: string;
  description: string;
  minPoints: number;
  maxMemories: number;
  learningSpeed: number;
  unlocks: string[];
}

const FRIENDSHIP_LEVELS: FriendshipLevel[] = [
  {
    level: 1,
    title: "Stranger",
    emoji: "👋",
    description: "Just met, learning the basics about you",
    minPoints: 0,
    maxMemories: 10,
    learningSpeed: 1.0,
    unlocks: ["Basic conversations"]
  },
  {
    level: 2,
    title: "Acquaintance",
    emoji: "😊",
    description: "Getting to know your basic preferences",
    minPoints: 100,
    maxMemories: 25,
    learningSpeed: 1.1,
    unlocks: ["Work context", "Basic preferences"]
  },
  {
    level: 3,
    title: "Friend",
    emoji: "😄",
    description: "Understanding your style and habits",
    minPoints: 300,
    maxMemories: 50,
    learningSpeed: 1.3,
    unlocks: ["Personal insights", "Pattern recognition"]
  },
  {
    level: 4,
    title: "Close Friend",
    emoji: "🤗",
    description: "Deep understanding of your preferences and needs",
    minPoints: 700,
    maxMemories: 100,
    learningSpeed: 1.5,
    unlocks: ["Proactive assistance", "Emotional understanding"]
  },
  {
    level: 5,
    title: "Best Friend",
    emoji: "💖",
    description: "Almost mind-reading level of understanding!",
    minPoints: 1500,
    maxMemories: 200,
    learningSpeed: 1.8,
    unlocks: ["Predictive assistance", "Complete sync"]
  }
];

interface MemoryCard {
  id: string;
  category: string;
  title: string;
  content: string;
  confidence: number;
  frequency: string;
  lastUpdated: Date;
  icon: React.ReactNode;
  source: string;
}

// ==================== HELPER FUNCTIONS ====================

const calculateFriendshipPoints = (profile: UserMemoryProfile | null): number => {
  if (!profile) return 0;
  
  let points = 0;
  
  // Knowledge points
  const knowledgeCount = countTotalMemories(profile);
  points += knowledgeCount * 8;
  
  // Time factor
  const daysActive = calculateDaysTogether(profile);
  points += Math.floor(daysActive * 3);
  
  // Quality bonus
  const avgConfidence = profile.metadata?.confidenceLevel || 0;
  points += Math.floor(avgConfidence * 150);
  
  // Diversity bonus
  const categories = getCategoryCount(profile);
  points += categories * 25;
  
  // Version bonus
  const versionBonus = Math.min((profile.version || 1) * 5, 100);
  points += versionBonus;
  
  return Math.floor(points);
};

const countTotalMemories = (profile: UserMemoryProfile | null): number => {
  if (!profile) return 0;
  
  let count = 0;
  
  if (profile.coreIdentity) {
    Object.values(profile.coreIdentity).forEach(value => {
      if (value && value !== 'unknown' && value !== '') {
        if (Array.isArray(value)) count += value.length;
        else count += 1;
      }
    });
  }
  
  ['personalCharacteristics', 'preferences', 'interactions', 'context', 'emotional', 'practical'].forEach(category => {
    const section = profile[category as keyof UserMemoryProfile];
    if (section && typeof section === 'object') {
      count += Object.keys(section).length;
    }
  });
  
  return count;
};

const getCategoryCount = (profile: UserMemoryProfile | null): number => {
  if (!profile) return 0;
  
  let categories = 0;
  
  if (profile.coreIdentity && Object.keys(profile.coreIdentity).length > 0) categories++;
  if (profile.personalCharacteristics && Object.keys(profile.personalCharacteristics).length > 0) categories++;
  if (profile.preferences && Object.keys(profile.preferences).length > 0) categories++;
  if (profile.interactions && Object.keys(profile.interactions).length > 0) categories++;
  if (profile.context && Object.keys(profile.context).length > 0) categories++;
  if (profile.emotional && Object.keys(profile.emotional).length > 0) categories++;
  if (profile.practical && Object.keys(profile.practical).length > 0) categories++;
  
  return categories;
};

const calculateFriendshipLevel = (points: number): FriendshipLevel => {
  for (let i = FRIENDSHIP_LEVELS.length - 1; i >= 0; i--) {
    if (points >= FRIENDSHIP_LEVELS[i].minPoints) {
      return FRIENDSHIP_LEVELS[i];
    }
  }
  return FRIENDSHIP_LEVELS[0];
};

const calculateLevelProgress = (points: number): { current: FriendshipLevel; next: FriendshipLevel | null; progressPercent: number } => {
  const current = calculateFriendshipLevel(points);
  const currentIndex = FRIENDSHIP_LEVELS.findIndex(level => level.level === current.level);
  const next = currentIndex < FRIENDSHIP_LEVELS.length - 1 ? FRIENDSHIP_LEVELS[currentIndex + 1] : null;
  
  if (!next) {
    return { current, next: null, progressPercent: 100 };
  }
  
  const pointsInCurrentLevel = points - current.minPoints;
  const pointsNeededForNextLevel = next.minPoints - current.minPoints;
  const progressPercent = Math.min(100, (pointsInCurrentLevel / pointsNeededForNextLevel) * 100);
  
  return { current, next, progressPercent };
};

const calculateDaysTogether = (profile: UserMemoryProfile | null): number => {
  if (!profile?.createdAt) return 0;
  const createdDate = new Date(profile.createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
};

const getMemoryCards = (profile: UserMemoryProfile | null): MemoryCard[] => {
  if (!profile) return [];
  
  const cards: MemoryCard[] = [];
  
  // Core Identity Cards
  if (profile.coreIdentity) {
    Object.entries(profile.coreIdentity).forEach(([key, value]) => {
      // Skip metadata fields that shouldn't be displayed as cards
      if (key === 'confidence' || key === 'category' || key === 'frequency') {
        return;
      }
      
      if (value && value !== 'unknown') {
        let displayValue = value;
        let confidence = 0.9;
        
        if (typeof value === 'object' && value !== null) {
          const keys = Object.keys(value);
          const hasNumberedKeys = keys.some(k => !isNaN(Number(k)));
          
          if (hasNumberedKeys && value.value) {
            displayValue = value.value;
            confidence = value.confidence || 0.9;
          } else if (value.value !== undefined) {
            displayValue = value.value;
            confidence = value.confidence || 0.9;
          }
        }
        
        if (displayValue && displayValue !== 'unknown' && String(displayValue).trim()) {
          cards.push({
            id: `core-${key}`,
            category: 'Identity',
            title: formatTitle(key),
            content: formatValue(displayValue),
            confidence: confidence,
            frequency: 'constant',
            lastUpdated: new Date(profile.updatedAt),
            icon: <User className="w-4 h-4" />,
            source: 'core'
          });
        }
      }
    });
  }
  
  // Dynamic sections
  const dynamicSections = [
    { key: 'personalCharacteristics', icon: <Sparkles className="w-4 h-4" />, category: 'Personality' },
    { key: 'preferences', icon: <Settings className="w-4 h-4" />, category: 'Preferences' },
    { key: 'context', icon: <MessageSquare className="w-4 h-4" />, category: 'Context' },
    { key: 'emotional', icon: <Heart className="w-4 h-4" />, category: 'Emotions' },
    { key: 'interactions', icon: <MessageSquare className="w-4 h-4" />, category: 'Interactions' },
    { key: 'practical', icon: <Settings className="w-4 h-4" />, category: 'Practical' }
  ];
  
  dynamicSections.forEach(section => {
    const sectionData = profile[section.key as keyof UserMemoryProfile];
    if (sectionData && typeof sectionData === 'object') {
      Object.entries(sectionData).forEach(([key, value]) => {
        // Skip metadata fields that shouldn't be displayed as cards
        if (key === 'confidence' || key === 'category' || key === 'frequency') {
          return;
        }
        
        if (value && value !== 'unknown') {
          let displayValue = value;
          let confidence = 0.7;
          let title = formatTitle(key);
          
          // Handle complex value objects
          if (typeof value === 'object' && value !== null) {
          // Extract title and content with better parsing
            title = value.category || formatTitle(key);
            displayValue = value.details || value.value || value;
            confidence = value.confidence || 0.7;
          
          // If content is still an object or JSON string, format it properly
            if (typeof displayValue === 'object' || 
                (typeof displayValue === 'string' && 
                 ((displayValue.startsWith('{') && displayValue.endsWith('}')) || 
                  (displayValue.startsWith('[') && displayValue.endsWith(']'))))) {
              displayValue = formatValue(displayValue);
            }
          }
          
          // Only add cards with meaningful content
          if (displayValue && displayValue !== 'unknown' && String(displayValue).trim()) {
          cards.push({
            id: `${section.key}-${key}`,
            category: section.category,
            title: title,
              content: String(displayValue),
              confidence: confidence,
              frequency: 'occasional',
            lastUpdated: new Date(profile.updatedAt),
            icon: section.icon,
            source: section.key
          });
          }
        }
      });
    }
  });
  
  return cards.sort((a, b) => b.confidence - a.confidence);
};

const formatTitle = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/([A-Z])/g, ' $1');
};

const formatValue = (value: any): string => {
  // Helper function to parse JSON string and extract meaningful content
  const parseJsonString = (str: string): string => {
    try {
      const parsed = JSON.parse(str);
      return formatParsedObject(parsed);
    } catch {
      // If it's not valid JSON, return as is
      return str;
    }
  };

  // Helper function to format parsed objects into readable text
  const formatParsedObject = (obj: any): string => {
    if (typeof obj === 'string') return obj;
    if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
    
    if (Array.isArray(obj)) {
      return obj.map(item => formatParsedObject(item)).join(', ');
    }
    
    if (typeof obj === 'object' && obj !== null) {
      // Extract known meaningful fields first
      if (obj.value !== undefined) return String(obj.value);
      if (obj.details !== undefined) return String(obj.details);
      if (obj.category !== undefined) return String(obj.category);
      if (obj.name !== undefined) return String(obj.name);
      if (obj.title !== undefined) return String(obj.title);
      
      // For location objects
      if (obj.city || obj.state || obj.country) {
        const parts = [];
        if (obj.city) parts.push(obj.city);
        if (obj.state) parts.push(obj.state);
        if (obj.country) parts.push(obj.country);
        return parts.join(', ');
      }
      
      // For company/employer objects
      if (obj.company || obj.currentEmployer) {
        return obj.company || obj.currentEmployer;
      }
      
      // For preference objects
      if (obj.preferredFollowUpDay || obj.preferredMethod) {
        const parts = [];
        if (obj.preferredFollowUpDay) parts.push(`Follow-up: ${obj.preferredFollowUpDay}`);
        if (obj.preferredMethod) parts.push(`Method: ${obj.preferredMethod}`);
        return parts.join(', ');
      }
      
      // For interest/intent objects
      if (obj.interest !== undefined || obj.intent !== undefined) {
        return obj.interest !== undefined ? 
          (obj.interest ? 'Interested' : 'Not interested') :
          (obj.intent ? 'Has intent' : 'No intent');
      }
      
      // Generic key-value formatting for other objects
      const entries = Object.entries(obj).filter(([key, val]) => 
        val !== null && val !== undefined && val !== '' && key !== 'confidence'
      );
      
      if (entries.length === 0) return 'No details available';
      
      if (entries.length === 1) {
        const [, val] = entries[0];
        return typeof val === 'object' ? formatParsedObject(val) : String(val);
      }
      
      // Multiple key-value pairs - format nicely
      return entries.map(([key, val]) => {
        const formattedKey = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
        const formattedVal = typeof val === 'object' ? formatParsedObject(val) : String(val);
        return `${formattedKey}: ${formattedVal}`;
      }).join(', ');
    }
    
    return String(obj);
  };

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(item => {
      if (typeof item === 'object') {
        return formatParsedObject(item);
      }
      if (typeof item === 'string' && (item.startsWith('{') || item.startsWith('['))) {
        return parseJsonString(item);
      }
      return String(item);
    }).join(', ');
  }
  
  // Handle objects
  if (typeof value === 'object' && value !== null) {
    return formatParsedObject(value);
  }
  
  // Handle strings that might be JSON
  if (typeof value === 'string') {
    // Check if it looks like JSON
    if ((value.startsWith('{') && value.endsWith('}')) || 
        (value.startsWith('[') && value.endsWith(']'))) {
      return parseJsonString(value);
    }
    return value;
  }
  
  // Handle primitives
  return String(value);
};

// ==================== MAIN COMPONENT ====================

const ClaraBrainDashboard: React.FC = () => {
  const [userProfile, setUserProfile] = useState<UserMemoryProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [editingCard, setEditingCard] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'smart'>('smart'); // Default to smart mode
  const [smartSummary, setSmartSummary] = useState<string>('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryCache, setSummaryCache] = useState<{
    content: string;
    timestamp: number;
    profileVersion: number;
  } | null>(null);

  // Load memory settings and summary cache from localStorage
  useEffect(() => {
    const savedMemoryEnabled = localStorage.getItem('clara-memory-enabled');
    if (savedMemoryEnabled !== null) {
      setMemoryEnabled(JSON.parse(savedMemoryEnabled));
    }

    // Load cached summary
    const cachedSummary = localStorage.getItem('clara-smart-summary-cache');
    console.log('🧠 Loading cache from localStorage:', !!cachedSummary);
    
    if (cachedSummary) {
      try {
        const cache = JSON.parse(cachedSummary);
        console.log('🧠 Parsed cache:', {
          hasContent: !!cache.content,
          timestamp: new Date(cache.timestamp).toLocaleString(),
          profileVersion: cache.profileVersion
        });
        
        setSummaryCache(cache);
        
        // Check if cache is still valid (1 hour = 3600000ms)
        const now = Date.now();
        const cacheAge = now - cache.timestamp;
        const oneHour = 60 * 60 * 1000;
        
        console.log('🧠 Initial cache validation:');
        console.log('  - Cache age:', Math.round(cacheAge / (1000 * 60)), 'minutes');
        console.log('  - Is valid:', cacheAge < oneHour);
        
        if (cacheAge < oneHour) {
          setSmartSummary(cache.content);
          console.log('🧠 ✅ Using cached smart summary on initial load');
        } else {
          console.log('🧠 ❌ Cache expired on initial load, clearing');
          // Clear expired cache
          localStorage.removeItem('clara-smart-summary-cache');
          setSummaryCache(null);
        }
      } catch (error) {
        console.error('🧠 Error loading cached summary:', error);
        localStorage.removeItem('clara-smart-summary-cache');
        setSummaryCache(null);
      }
    } else {
      console.log('🧠 No cached summary found in localStorage');
    }
  }, []);

  // Save memory settings to localStorage
  useEffect(() => {
    localStorage.setItem('clara-memory-enabled', JSON.stringify(memoryEnabled));
  }, [memoryEnabled]);

  useEffect(() => {
    const loadMemoryData = async () => {
      setIsLoading(true);
      try {
        const profile = await ClaraSweetMemoryAPI.getCurrentUserProfile();
        setUserProfile(profile);
        console.log('🧠 Dashboard - Loaded profile:', profile);
        
        // Since we default to smart view, check if we need to generate summary
        // Only generate if we don't have any summary content yet
        if (profile && !smartSummary) {
          console.log('🧠 No summary content, generating for default smart view');
          await generateSmartSummary(profile);
        }
      } catch (error) {
        console.error('Failed to load memory data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMemoryData();
  }, []); // Remove summaryCache dependency to prevent loops

  // Handle memory toggle
  const handleMemoryToggle = () => {
    setMemoryEnabled(!memoryEnabled);
  };

  // Handle card editing
  const handleEditCard = (cardId: string, currentContent: string) => {
    setEditingCard(cardId);
    setEditContent(currentContent);
  };

  // Handle save edit
  const handleSaveEdit = async (cardId: string) => {
    try {
      console.log('🧠 Saving edit for card:', cardId, 'New content:', editContent);
      
      // Update the memory field using the new API
      await ClaraSweetMemoryAPI.updateMemoryField(cardId, editContent);
      
      // Reload the profile to refresh the data
      const profile = await ClaraSweetMemoryAPI.getCurrentUserProfile();
      setUserProfile(profile);
      
      // Clear cache since profile changed
      console.log('🧠 Clearing cache due to profile change (edit)');
      setSummaryCache(null);
      localStorage.removeItem('clara-smart-summary-cache');
      
      setEditingCard(null);
      setEditContent('');
      
      // If we're in smart view, regenerate summary
      if (viewMode === 'smart') {
        await generateSmartSummary(profile);
      }
    } catch (error) {
      console.error('Failed to save card edit:', error);
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingCard(null);
    setEditContent('');
  };

  // Handle card deletion
  const handleDeleteCard = async (cardId: string) => {
    if (!confirm('Are you sure you want to delete this memory? This action cannot be undone.')) {
      return;
    }

    try {
      console.log('🧠 Deleting card:', cardId);
      
      // Delete the memory field using the new API
      await ClaraSweetMemoryAPI.deleteMemoryField(cardId);
      
      // Reload the profile to refresh the data
      const profile = await ClaraSweetMemoryAPI.getCurrentUserProfile();
      setUserProfile(profile);
      
      // Clear cache since profile changed
      console.log('🧠 Clearing cache due to profile change (delete)');
      setSummaryCache(null);
      localStorage.removeItem('clara-smart-summary-cache');
      
      // If we're in smart view, regenerate summary
      if (viewMode === 'smart') {
        await generateSmartSummary(profile);
      }
    } catch (error) {
      console.error('Failed to delete card:', error);
    }
  };

  // Generate smart summary using LLM with caching
  const generateSmartSummary = async (profile?: UserMemoryProfile | null) => {
    try {
      const currentProfile = profile || userProfile;
      
      if (!currentProfile) {
        setSmartSummary('No memory data available to summarize.');
        return;
      }

      // Check if we have a valid cache first
      if (summaryCache) {
        const now = Date.now();
        const cacheAge = now - summaryCache.timestamp;
        const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
        
        console.log('🧠 Cache validation:');
        console.log('  - Cache age:', Math.round(cacheAge / (1000 * 60)), 'minutes');
        console.log('  - Cache profile version:', summaryCache.profileVersion);
        console.log('  - Current profile version:', currentProfile.version || 0);
        console.log('  - Cache valid:', cacheAge < oneHour);
        console.log('  - Profile unchanged:', summaryCache.profileVersion === (currentProfile.version || 0));
        
        // If cache is valid and profile hasn't changed, use cached version
        if (cacheAge < oneHour && summaryCache.profileVersion === (currentProfile.version || 0)) {
          console.log('🧠 ✅ Using valid cached summary');
          setSmartSummary(summaryCache.content);
          return;
        } else {
          console.log('🧠 ❌ Cache invalid, generating fresh summary');
        }
      } else {
        console.log('🧠 No cache found, generating fresh summary');
      }

      setIsGeneratingSummary(true);

      // Create a comprehensive prompt for the LLM
      const memoryData = JSON.stringify(currentProfile, null, 2);
      const prompt = `Based on the following memory data about a user, create a warm, personalized summary of what Clara knows about them. Write it as if Clara is speaking directly to the user, using a friendly and conversational tone. Focus on the most meaningful and interesting aspects of what Clara has learned.

Memory Data:
${memoryData}

Please create a well-structured, engaging summary that covers:
1. Personal identity and background
2. Interests and characteristics
3. Work/project context
4. Any notable preferences or patterns

Keep it concise but comprehensive, and make it feel personal and meaningful. Use markdown formatting for better readability.`;

      const systemPrompt = `You are Clara, an AI assistant who has been learning about a user through conversations. Create a warm, personal summary of what you know about them. Be friendly, engaging, and focus on the most meaningful aspects of their profile. Use markdown formatting and write as if speaking directly to the user.`;

      console.log('🧠 Generating smart summary using EXACT same method as memory extraction...');
      
      // DON'T create any AI config! Let the system use whatever is currently configured
      // This is EXACTLY how memory extraction works - it doesn't hardcode anything
      
      // Call the memory extraction API directly to get a summary instead of extracting memory
      // This ensures we use the EXACT same provider, model, and configuration
      const response = await ClaraSweetMemoryAPI.generateSummary(prompt, systemPrompt);
      
      // Extract the content from the ClaraMessage response
      const summaryText = typeof response === 'object' && response.content 
        ? response.content 
        : typeof response === 'string' 
          ? response 
          : JSON.stringify(response);
          
      setSmartSummary(summaryText);
      
      // Cache the generated summary
      const newCache = {
        content: summaryText,
        timestamp: Date.now(),
        profileVersion: currentProfile.version || 0
      };
      
      console.log('🧠 Caching new summary:', {
        contentLength: summaryText.length,
        timestamp: new Date(newCache.timestamp).toLocaleString(),
        profileVersion: newCache.profileVersion
      });
      
      setSummaryCache(newCache);
      localStorage.setItem('clara-smart-summary-cache', JSON.stringify(newCache));
      
      console.log('🧠 ✅ Smart summary generated and cached successfully');
    } catch (error) {
      console.error('Failed to generate smart summary:', error);
      setSmartSummary('Sorry, I encountered an error while generating your personalized summary. Please try again later.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Handle view mode change
  const handleViewModeChange = async (mode: 'cards' | 'smart') => {
    setViewMode(mode);
    
    // If switching to smart view and we don't have a summary, generate one
    if (mode === 'smart' && !smartSummary && userProfile) {
      await generateSmartSummary();
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <Brain className="w-16 h-16 text-gray-400 animate-pulse mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            Loading Clara's memories...
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gathering our friendship data
          </p>
        </div>
      </div>
    );
  }

  // Calculate dynamic values
  const friendshipPoints = calculateFriendshipPoints(userProfile);
  const levelProgress = calculateLevelProgress(friendshipPoints);
  const friendshipLevel = levelProgress.current;
  const nextLevel = levelProgress.next;
  const progressPercent = levelProgress.progressPercent;
  const daysTogether = calculateDaysTogether(userProfile);
  const memoryCount = countTotalMemories(userProfile);
  const memoryCards = getMemoryCards(userProfile);

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
      {/* Clean Header */}
      <div className="p-8 text-center ">
        <div className="inline-flex items-center justify-center gap-4 mb-6">
          <div className="glassmorphic rounded-xl p-3 shadow-lg">
            <Brain className="w-8 h-8 text-gray-700 dark:text-gray-300" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">
              Clara's Brain
            </h1>
          </div>
        </div>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          Our friendship journey and shared memories
        </p>
      </div>

      <div className="p-6 space-y-8 max-w-6xl mx-auto">
        {/* Friendship Level Card */}
        <div className="glassmorphic rounded-2xl p-8 shadow-lg ">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">{friendshipLevel.emoji}</div>
            
            <div className="space-y-3">
              <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                Level {friendshipLevel.level}: {friendshipLevel.title}
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-300 max-w-md mx-auto">
                {friendshipLevel.description}
              </p>
            </div>
            
            {/* Progress Bar */}
            {nextLevel && (
              <div className="mt-8 space-y-4">
                <div className="flex justify-between items-center text-sm font-medium text-gray-600 dark:text-gray-400">
                  <span>Progress to {nextLevel.title}</span>
                  <span className="text-gray-800 dark:text-gray-200 font-bold">
                    {Math.round(progressPercent)}%
                  </span>
                </div>
                
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gray-800 dark:bg-gray-300 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                
                <p className="text-sm text-gray-500 dark:text-gray-400 glassmorphic rounded-lg px-4 py-2">
                  <span className="font-semibold text-gray-700 dark:text-gray-300">{friendshipPoints}</span> points • 
                  Need <span className="font-semibold text-gray-700 dark:text-gray-300">{nextLevel.minPoints - friendshipPoints}</span> more to level up
                </p>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-6 mt-8">
              <div className="glassmorphic rounded-xl p-6 ">
                <div className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-1">{friendshipPoints}</div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Friendship Points</div>
              </div>
              
              <div className="glassmorphic rounded-xl p-6 ">
                <div className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-1">{daysTogether}</div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Days Together</div>
              </div>
              
              <div className="glassmorphic rounded-xl p-6 ">
                <div className="text-3xl font-bold text-gray-800 dark:text-gray-200 mb-1">{memoryCount}</div>
                <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Memories</div>
              </div>
            </div>
          </div>

          {/* Unlocked Features */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-6 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-800 dark:bg-gray-200 flex items-center justify-center text-white dark:text-gray-900 font-bold text-sm">
                ✓
              </div>
              Unlocked Features
            </h3>
            <div className="flex flex-wrap gap-3">
              {friendshipLevel.unlocks.map((unlock, index) => (
                <span
                  key={index}
                  className="px-4 py-2 glassmorphic text-gray-700 dark:text-gray-300 rounded-full text-sm font-medium "
                >
                  {unlock}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Memory Cards Section */}
        <div className="glassmorphic rounded-2xl p-8 shadow-lg ">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
            <div className="glassmorphic rounded-xl p-3">
              <Sparkles className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                  {viewMode === 'cards' ? 'Memory Cards' : 'Smart Memory View'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                  {viewMode === 'cards' 
                    ? `${memoryCards.length} memories stored`
                    : 'AI-generated personalized summary'
                  }
              </p>
            </div>
          </div>
          
            <div className="flex items-center gap-6">
              {/* View Mode Toggle */}
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                <button
                  onClick={() => handleViewModeChange('smart')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    viewMode === 'smart'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Memory
                </button>
                <button
                  onClick={() => handleViewModeChange('cards')}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    viewMode === 'cards'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <Grid3X3 className="w-4 h-4" />
                  Edit
                </button>
              </div>
              
              {/* Memory Toggle Switch */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Memory Learning
                </span>
                <button
                  onClick={handleMemoryToggle}
                  className={`relative inline-flex items-center h-6 w-11 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    memoryEnabled 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
                      memoryEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {memoryEnabled ? (
                    <ToggleRight className="w-4 h-4 text-green-500" />
                  ) : (
                    <ToggleLeft className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Memory Status Notice */}
          {!memoryEnabled && (
            <div className="mb-6 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-800">
                  <Brain className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200">
                    Memory Learning Disabled
                  </h4>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    Clara won't learn new information about you while this setting is off.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Conditional Content Based on View Mode */}
          {viewMode === 'cards' ? (
            // Cards View
            memoryCards.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {memoryCards.map((card) => (
                <div 
                  key={card.id}
                  className="glassmorphic rounded-xl p-6  hover:shadow-lg transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                        {card.icon}
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">
                          {card.title}
                        </h4>
                        <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-medium">{card.category}</span>
                          <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                          <span className="font-semibold text-gray-700 dark:text-gray-300">
                            {Math.round(card.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                      
                      {/* Card Actions */}
                      <div className="flex items-center gap-2">
                        {editingCard === card.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleSaveEdit(card.id)}
                              className="p-2 rounded-lg bg-green-100 hover:bg-green-200 dark:bg-green-800 dark:hover:bg-green-700 text-green-600 dark:text-green-400 transition-colors"
                              title="Save changes"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
                              title="Cancel editing"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEditCard(card.id, card.content)}
                              className="p-2 rounded-lg bg-blue-100 hover:bg-blue-200 dark:bg-blue-800 dark:hover:bg-blue-700 text-blue-600 dark:text-blue-400 transition-colors"
                              title="Edit memory"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCard(card.id)}
                              className="p-2 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-800 dark:hover:bg-red-700 text-red-600 dark:text-red-400 transition-colors"
                              title="Delete memory"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                    </div>
                  </div>
                  
                    {/* Card Content - Editable when in edit mode */}
                    {editingCard === card.id ? (
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full h-24 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Edit memory content..."
                      />
                    ) : (
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4 line-clamp-3">
                    {card.content}
                  </p>
                    )}
                  
                  <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      <span>{card.frequency}</span>
                    </div>
                    <span>
                      {new Date(card.lastUpdated).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h4 className="text-xl font-bold text-gray-600 dark:text-gray-400 mb-2">
                No memories yet
              </h4>
              <p className="text-gray-500 dark:text-gray-500">
                Start chatting with Clara to create some memories!
              </p>
            </div>
            )
          ) : (
            // Smart View
            <div className="max-w-4xl mx-auto">
              {isGeneratingSummary ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
                    <Sparkles className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-pulse" />
                  </div>
                  <h4 className="text-xl font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Generating your personalized summary...
                  </h4>
                  <p className="text-gray-500 dark:text-gray-400">
                    Clara is analyzing your memories to create a meaningful overview.
                  </p>
                </div>
              ) : smartSummary ? (
                <div className="glassmorphic rounded-xl p-8 ">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                        <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                          What Clara Knows About You
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          AI-generated personalized summary
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => generateSmartSummary()}
                      className="px-4 py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-800 dark:hover:bg-blue-700 text-blue-600 dark:text-blue-400 rounded-lg transition-colors text-sm font-medium"
                      disabled={isGeneratingSummary}
                    >
                      Refresh Summary
                    </button>
                  </div>
                  
                                     <div className="prose prose-gray dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed">
                     <ReactMarkdown 
                       remarkPlugins={[remarkGfm]}
                       components={{
                         h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-8 mb-4 text-gray-900 dark:text-gray-100" {...props} />,
                         h2: ({node, ...props}) => <h2 className="text-xl font-semibold mt-6 mb-3 text-gray-900 dark:text-gray-100" {...props} />,
                         h3: ({node, ...props}) => <h3 className="text-lg font-medium mt-4 mb-2 text-gray-900 dark:text-gray-100" {...props} />,
                         p: ({node, ...props}) => <p className="mb-4 leading-relaxed" {...props} />,
                         strong: ({node, ...props}) => <strong className="font-semibold text-gray-900 dark:text-gray-100" {...props} />,
                         em: ({node, ...props}) => <em className="italic" {...props} />,
                         ul: ({node, ...props}) => <ul className="list-disc list-inside mb-4 space-y-1" {...props} />,
                         ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-4 space-y-1" {...props} />,
                         li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                         code: ({node, ...props}) => <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm font-mono" {...props} />,
                         blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-blue-200 dark:border-blue-800 pl-4 italic my-4" {...props} />
                       }}
                     >
                       {typeof smartSummary === 'string' ? smartSummary : String(smartSummary)}
                     </ReactMarkdown>
                   </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-xl font-bold text-gray-600 dark:text-gray-400 mb-2">
                    No memory data to summarize
                  </h4>
                  <p className="text-gray-500 dark:text-gray-500 mb-4">
                    Start chatting with Clara to build your memory profile!
                  </p>
                  {userProfile && (
                    <button
                      onClick={() => generateSmartSummary()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                      disabled={isGeneratingSummary}
                    >
                      Generate Summary
                    </button>
          )}
        </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClaraBrainDashboard;
