/**
 * ClaraBrainDashboard.tsx
 * 
 * Clara's Brain Memory Dashboard - Interactive friendship & memory system
 * Beautiful UI showing friendship progress, memory cards, and celebrations
 */

import React, { useState, useEffect } from 'react';
import { 
  Brain, Sparkles, User, MessageSquare, Settings, Heart,
  Edit, Trash2
} from 'lucide-react';
import { ClaraSweetMemoryAPI } from '../ClaraSweetMemory';
import type { UserMemoryProfile } from '../ClaraSweetMemory';

// ==================== INTERFACES ====================

// Dynamic Friendship Level System - Game-like progression with time and knowledge factors
interface FriendshipLevel {
  level: number;
  title: string;
  emoji: string;
  description: string;
  minPoints: number; // Combined score of knowledge + time + interactions
  maxMemories: number;
  learningSpeed: number;
  color: string;
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
    color: "from-gray-400 to-gray-500",
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
    color: "from-blue-400 to-blue-500",
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
    color: "from-green-400 to-green-500",
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
    color: "from-purple-400 to-purple-500",
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
    color: "from-pink-400 to-pink-500",
    unlocks: ["Predictive assistance", "Complete sync"]
  }
];

// Dynamic Memory Card interface
interface MemoryCard {
  id: string;
  category: string;
  title: string;
  content: string;
  confidence: number;
  frequency: string;
  lastUpdated: Date;
  icon: React.ReactNode;
  color: string;
  source: string;
}

// ==================== HELPER FUNCTIONS ====================

// Calculate friendship points (knowledge + time + interaction factors)
const calculateFriendshipPoints = (profile: UserMemoryProfile | null): number => {
  if (!profile) return 0;
  
  let points = 0;
  
  // Knowledge points - count all meaningful entries
  const knowledgeCount = countTotalMemories(profile);
  points += knowledgeCount * 8; // 8 points per memory (increased from 5)
  
  // Time factor - days since creation (slower progression)
  const daysActive = calculateDaysTogther(profile);
  points += Math.floor(daysActive * 3); // 3 points per day (increased from 2)
  
  // Quality bonus - higher confidence memories are worth more
  const avgConfidence = profile.metadata?.confidenceLevel || 0;
  points += Math.floor(avgConfidence * 150); // Up to 150 bonus points
  
  // Diversity bonus - having memories in different categories
  const categories = getCategoryCount(profile);
  points += categories * 25; // 25 points per category (increased from 15)
  
  // Version bonus - more updates = more interaction (diminishing returns)
  const versionBonus = Math.min((profile.version || 1) * 5, 100); // Max 100 points from versions
  points += versionBonus;
  
  // Interaction depth bonus - longer/more detailed memories are worth more
  const depthBonus = calculateDepthBonus(profile);
  points += depthBonus;
  
  return Math.floor(points);
};

// Calculate depth bonus based on content richness
const calculateDepthBonus = (profile: UserMemoryProfile | null): number => {
  if (!profile) return 0;
  
  let bonus = 0;
  const sections = ['personalCharacteristics', 'preferences', 'context', 'emotional', 'interactions', 'practical'];
  
  sections.forEach(sectionKey => {
    const section = profile[sectionKey as keyof UserMemoryProfile];
    if (section && typeof section === 'object') {
      Object.values(section).forEach((value: any) => {
        if (value && typeof value === 'object' && value.details) {
          // Bonus for detailed entries
          const detailLength = value.details.length;
          if (detailLength > 50) bonus += 10;
          if (detailLength > 100) bonus += 15;
          if (detailLength > 200) bonus += 25;
        }
      });
    }
  });
  
  return Math.min(bonus, 200); // Cap depth bonus at 200
};

// Count total meaningful memories across all categories
const countTotalMemories = (profile: UserMemoryProfile | null): number => {
  if (!profile) return 0;
  
  let count = 0;
  
  // Count core identity items
  if (profile.coreIdentity) {
    Object.values(profile.coreIdentity).forEach(value => {
      if (value && value !== 'unknown' && value !== '') {
        if (Array.isArray(value)) count += value.length;
        else count += 1;
      }
    });
  }
  
  // Count dynamic categories
  ['personalCharacteristics', 'preferences', 'interactions', 'context', 'emotional', 'practical'].forEach(category => {
    const section = profile[category as keyof UserMemoryProfile];
    if (section && typeof section === 'object') {
      count += Object.keys(section).length;
    }
  });
  
  return count;
};

// Count categories with data
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

// Calculate friendship level based on points
const calculateFriendshipLevel = (points: number): FriendshipLevel => {
  for (let i = FRIENDSHIP_LEVELS.length - 1; i >= 0; i--) {
    if (points >= FRIENDSHIP_LEVELS[i].minPoints) {
      return FRIENDSHIP_LEVELS[i];
    }
  }
  return FRIENDSHIP_LEVELS[0];
};

// Calculate progress to next level
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

// Calculate days together
const calculateDaysTogther = (profile: UserMemoryProfile | null): number => {
  if (!profile?.createdAt) return 0;
  const createdDate = new Date(profile.createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
};

// Generate dynamic memory cards from actual profile data
const getMemoryCards = (profile: UserMemoryProfile | null): MemoryCard[] => {
  if (!profile) return [];
  
  const cards: MemoryCard[] = [];
  
  // Core Identity Cards
  if (profile.coreIdentity) {
    Object.entries(profile.coreIdentity).forEach(([key, value]) => {
      if (value && value !== 'unknown') {
        // Handle new structure where core identity has confidence objects
        let displayValue = value;
        let confidence = 0.9;
        
        if (typeof value === 'object' && value !== null) {
          // Check for numbered keys (character arrays) and extract value
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
        
        if (displayValue && displayValue !== 'unknown') {
          cards.push({
            id: `core-${key}`,
            category: 'Identity',
            title: formatTitle(key),
            content: formatValue(displayValue),
            confidence: confidence,
            frequency: 'constant',
            lastUpdated: new Date(profile.updatedAt),
            icon: <User className="w-4 h-4" />,
            color: 'blue',
            source: 'core'
          });
        }
      }
    });
  }
  
  // Dynamic sections - personalCharacteristics, preferences, context, etc.
  const dynamicSections = [
    { key: 'personalCharacteristics', icon: <Sparkles className="w-4 h-4" />, color: 'purple', category: 'Personality' },
    { key: 'preferences', icon: <Settings className="w-4 h-4" />, color: 'orange', category: 'Preferences' },
    { key: 'context', icon: <MessageSquare className="w-4 h-4" />, color: 'green', category: 'Context' },
    { key: 'emotional', icon: <Heart className="w-4 h-4" />, color: 'pink', category: 'Emotions' },
    { key: 'interactions', icon: <MessageSquare className="w-4 h-4" />, color: 'teal', category: 'Interactions' },
    { key: 'practical', icon: <Settings className="w-4 h-4" />, color: 'indigo', category: 'Practical' }
  ];
  
  dynamicSections.forEach(section => {
    const sectionData = profile[section.key as keyof UserMemoryProfile];
    if (sectionData && typeof sectionData === 'object') {
      Object.entries(sectionData).forEach(([key, value]) => {
        if (value && typeof value === 'object') {
          // Handle the new numbered key structure (0, 1, 2, etc.)
          const title = value.category || formatTitle(key);
          const content = value.details || value.value || formatValue(value);
          
          cards.push({
            id: `${section.key}-${key}`,
            category: section.category,
            title: title,
            content: content,
            confidence: value.confidence || 0.7,
            frequency: value.frequency || 'occasional',
            lastUpdated: new Date(profile.updatedAt),
            icon: section.icon,
            color: section.color,
            source: section.key
          });
        }
      });
    }
  });
  
  return cards.sort((a, b) => b.confidence - a.confidence);
};

// Helper functions
const formatTitle = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/([A-Z])/g, ' $1');
};

const formatValue = (value: any): string => {
  if (Array.isArray(value)) {
    return value.map(item => {
      if (typeof item === 'object') {
        // Handle new memory structure objects
        if (item.language) return item.language;
        if (item.culture) return item.culture;
        if (item.value) return item.value; // Handle core identity values
        if (item.details) return item.details; // Handle characteristic details
        if (item.category) return item.category; // Handle category-based data
        return JSON.stringify(item);
      }
      return item;
    }).join(', ');
  }
  
  // Handle object values (new memory structure)
  if (typeof value === 'object' && value !== null) {
    // Clean up objects that have numbered keys (character arrays) - use value field
    const keys = Object.keys(value);
    const hasNumberedKeys = keys.some(key => !isNaN(Number(key)));
    
    if (hasNumberedKeys && value.value) {
      // This object has character array keys, use the value field
      return String(value.value);
    }
    
    // Handle core identity value objects
    if (value.value !== undefined) {
      return String(value.value);
    }
    // Handle characteristic/preference objects
    if (value.details) {
      return String(value.details);
    }
    if (value.category) {
      return String(value.category);
    }
    // Fallback for other objects
    return JSON.stringify(value);
  }
  
  return String(value);
};

// Handle memory actions
const handleEditMemory = async (memoryId: string) => {
  console.log('🔧 Edit memory:', memoryId);
  // TODO: Implement memory editing functionality
  alert('Memory editing will be implemented soon!');
};

const handleForgetMemory = async (memoryId: string) => {
  console.log('🗑️ Forget memory:', memoryId);
  // TODO: Implement memory deletion functionality
  if (confirm('Are you sure you want me to forget this memory?')) {
    alert('Memory forgetting will be implemented soon!');
  }
};

// ==================== MAIN COMPONENT ====================

const ClaraBrainDashboard: React.FC = () => {
  const [userProfile, setUserProfile] = useState<UserMemoryProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user memory profile on mount
  useEffect(() => {
    const loadMemoryData = async () => {
      setIsLoading(true);
      try {
        // Get current user profile
        const profile = await ClaraSweetMemoryAPI.getCurrentUserProfile();
        setUserProfile(profile);

        console.log('🧠 Dashboard - Loaded profile:', profile);

      } catch (error) {
        console.error('Failed to load memory data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMemoryData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <div className="relative">
            <Brain className="w-16 h-16 text-purple-400 animate-pulse mx-auto mb-4" />
            <Sparkles className="w-6 h-6 text-pink-400 animate-ping absolute -top-2 -right-2" />
          </div>
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
            Loading Clara's memories...
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gathering our friendship data 💭
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
  const daysTogother = calculateDaysTogther(userProfile);
  const memoryCount = countTotalMemories(userProfile);
  const memoryCards = getMemoryCards(userProfile);

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/20 dark:from-gray-900 dark:via-purple-950/20 dark:to-pink-950/10">
      {/* Elegant Header with Glassmorphism */}
      <div className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 via-pink-600/10 to-blue-600/10 dark:from-purple-400/5 dark:via-pink-400/5 dark:to-blue-400/5"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(139,69,255,0.1),transparent_50%)] dark:bg-[radial-gradient(circle_at_30%_20%,rgba(139,69,255,0.05),transparent_50%)]"></div>
        
        <div className="relative p-8 text-center">
          <div className="inline-flex items-center justify-center gap-4 mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur-lg opacity-20"></div>
              <div className="relative bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl p-4 border border-white/20 dark:border-gray-700/50 shadow-xl">
                <Brain className="w-10 h-10 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-700 via-pink-600 to-blue-600 dark:from-purple-400 dark:via-pink-400 dark:to-blue-400 bg-clip-text text-transparent">
                Clara's Brain
              </h1>
              <div className="h-1 w-24 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full mx-auto mt-2"></div>
            </div>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-300 font-medium">
            Our friendship journey and shared memories ✨
          </p>
        </div>
      </div>

      <div className="p-6 space-y-8 max-w-6xl mx-auto">
        {/* Friendship Level Card - Premium Design */}
        <div className="relative">
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-3xl p-8 border border-white/50 dark:border-gray-700/50 shadow-2xl">
            <div className="text-center mb-8">
              {/* Level Emoji with Glow */}
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full blur-2xl opacity-20"></div>
                <div className="relative text-8xl filter drop-shadow-lg">{friendshipLevel.emoji}</div>
              </div>
              
              <div className="space-y-3">
                <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-700 via-pink-600 to-blue-600 dark:from-purple-400 dark:via-pink-400 dark:to-blue-400 bg-clip-text text-transparent">
                  Level {friendshipLevel.level}: {friendshipLevel.title}
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-300 font-medium max-w-md mx-auto">
                  {friendshipLevel.description}
                </p>
              </div>
              
              {/* Elegant Progress Bar */}
              {nextLevel && (
                <div className="mt-8 space-y-4">
                  <div className="flex justify-between items-center text-sm font-medium text-gray-600 dark:text-gray-400">
                    <span className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"></div>
                      Progress to {nextLevel.title}
                    </span>
                    <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent font-bold">
                      {Math.round(progressPercent)}%
                    </span>
                  </div>
                  
                  <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                    <div className="absolute inset-0 bg-gradient-to-r from-gray-300 to-gray-200 dark:from-gray-600 dark:to-gray-700 rounded-full"></div>
                    <div 
                      className="relative h-full bg-gradient-to-r from-purple-500 via-pink-500 to-blue-500 rounded-full shadow-lg transition-all duration-1000 ease-out"
                      style={{ width: `${progressPercent}%` }}
                    >
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg px-4 py-2 border border-gray-200 dark:border-gray-700">
                    <span className="font-semibold text-purple-600 dark:text-purple-400">{friendshipPoints}</span> points • 
                    Need <span className="font-semibold text-pink-600 dark:text-pink-400">{nextLevel.minPoints - friendshipPoints}</span> more to level up
                  </p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-6 mt-8">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity"></div>
                  <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 border border-purple-200 dark:border-purple-800 shadow-lg">
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-1">{friendshipPoints}</div>
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Friendship Points</div>
                    <div className="mt-2 h-1 bg-gradient-to-r from-purple-500 to-purple-600 rounded-full"></div>
                  </div>
                </div>
                
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity"></div>
                  <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 border border-green-200 dark:border-green-800 shadow-lg">
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-1">{daysTogother}</div>
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Days Together</div>
                    <div className="mt-2 h-1 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full"></div>
                  </div>
                </div>
                
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity"></div>
                  <div className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 border border-blue-200 dark:border-blue-800 shadow-lg">
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">{memoryCount}</div>
                    <div className="text-sm font-medium text-gray-600 dark:text-gray-400">Memories</div>
                    <div className="mt-2 h-1 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Elegant Unlocked Features */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-8">
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-6 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center text-white font-bold text-sm">
                  ✓
                </div>
                Unlocked Features
              </h3>
              <div className="flex flex-wrap gap-3">
                {friendshipLevel.unlocks.map((unlock, index) => (
                  <div
                    key={index}
                    className="relative group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full blur opacity-20 group-hover:opacity-30 transition-opacity"></div>
                    <span className="relative px-6 py-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-medium border border-green-200 dark:border-green-800 shadow-md">
                      {unlock}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Premium Memory Cards Section */}
        <div className="relative">
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-3xl p-8 border border-white/50 dark:border-gray-700/50 shadow-2xl">
            <div className="flex items-center gap-4 mb-8">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl blur opacity-30"></div>
                <div className="relative bg-white dark:bg-gray-800 rounded-xl p-3 border border-purple-200 dark:border-purple-800">
                  <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-700 via-pink-600 to-blue-600 dark:from-purple-400 dark:via-pink-400 dark:to-blue-400 bg-clip-text text-transparent">
                  Memory Cards
                </h3>
                <p className="text-gray-600 dark:text-gray-400 font-medium">
                  {memoryCards.length} precious memories stored
                </p>
              </div>
            </div>
            
            {memoryCards.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {memoryCards.map((card) => {
                  // Define premium color classes
                  const getColorClasses = (color: string) => {
                    const colorMap = {
                      blue: {
                        border: 'border-blue-200/50 dark:border-blue-700/50',
                        bg: 'bg-gradient-to-br from-blue-50/80 to-blue-100/40 dark:from-blue-950/30 dark:to-blue-900/20',
                        iconBg: 'bg-gradient-to-r from-blue-500 to-blue-600',
                        iconText: 'text-white',
                        glow: 'from-blue-500/30 to-blue-600/30'
                      },
                      purple: {
                        border: 'border-purple-200/50 dark:border-purple-700/50',
                        bg: 'bg-gradient-to-br from-purple-50/80 to-purple-100/40 dark:from-purple-950/30 dark:to-purple-900/20',
                        iconBg: 'bg-gradient-to-r from-purple-500 to-purple-600',
                        iconText: 'text-white',
                        glow: 'from-purple-500/30 to-purple-600/30'
                      },
                      orange: {
                        border: 'border-orange-200/50 dark:border-orange-700/50',
                        bg: 'bg-gradient-to-br from-orange-50/80 to-orange-100/40 dark:from-orange-950/30 dark:to-orange-900/20',
                        iconBg: 'bg-gradient-to-r from-orange-500 to-orange-600',
                        iconText: 'text-white',
                        glow: 'from-orange-500/30 to-orange-600/30'
                      },
                      green: {
                        border: 'border-green-200/50 dark:border-green-700/50',
                        bg: 'bg-gradient-to-br from-green-50/80 to-green-100/40 dark:from-green-950/30 dark:to-green-900/20',
                        iconBg: 'bg-gradient-to-r from-green-500 to-green-600',
                        iconText: 'text-white',
                        glow: 'from-green-500/30 to-green-600/30'
                      },
                      pink: {
                        border: 'border-pink-200/50 dark:border-pink-700/50',
                        bg: 'bg-gradient-to-br from-pink-50/80 to-pink-100/40 dark:from-pink-950/30 dark:to-pink-900/20',
                        iconBg: 'bg-gradient-to-r from-pink-500 to-pink-600',
                        iconText: 'text-white',
                        glow: 'from-pink-500/30 to-pink-600/30'
                      },
                      teal: {
                        border: 'border-teal-200/50 dark:border-teal-700/50',
                        bg: 'bg-gradient-to-br from-teal-50/80 to-teal-100/40 dark:from-teal-950/30 dark:to-teal-900/20',
                        iconBg: 'bg-gradient-to-r from-teal-500 to-teal-600',
                        iconText: 'text-white',
                        glow: 'from-teal-500/30 to-teal-600/30'
                      },
                      indigo: {
                        border: 'border-indigo-200/50 dark:border-indigo-700/50',
                        bg: 'bg-gradient-to-br from-indigo-50/80 to-indigo-100/40 dark:from-indigo-950/30 dark:to-indigo-900/20',
                        iconBg: 'bg-gradient-to-r from-indigo-500 to-indigo-600',
                        iconText: 'text-white',
                        glow: 'from-indigo-500/30 to-indigo-600/30'
                      }
                    };
                    return colorMap[color as keyof typeof colorMap] || colorMap.blue;
                  };
                  
                  const colors = getColorClasses(card.color);
                  
                  return (
                    <div 
                      key={card.id}
                      className="relative"
                    >
                      <div className={`${colors.bg} ${colors.border} border-2 rounded-2xl p-6 backdrop-blur-sm shadow-lg transition-all duration-300 hover:shadow-xl`}>
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <div className={`relative p-3 rounded-xl ${colors.iconBg} ${colors.iconText} shadow-lg`}>
                              <div className="absolute inset-0 bg-white/20 rounded-xl"></div>
                              <div className="relative">{card.icon}</div>
                            </div>
                            <div>
                              <h4 className="text-lg font-bold text-gray-800 dark:text-white mb-1">
                                {card.title}
                              </h4>
                              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                                <span className="font-medium">{card.category}</span>
                                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                <div className="flex items-center gap-1">
                                  <div className="w-3 h-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full"></div>
                                  <span className="font-semibold text-green-600 dark:text-green-400">
                                    {Math.round(card.confidence * 100)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                            <button
                              onClick={() => handleEditMemory(card.id)}
                              className="p-2 rounded-lg bg-white/80 dark:bg-gray-700/80 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all duration-200 shadow-md"
                              title="Edit memory"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleForgetMemory(card.id)}
                              className="p-2 rounded-lg bg-white/80 dark:bg-gray-700/80 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all duration-200 shadow-md"
                              title="Forget memory"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        
                        <p className="text-gray-700 dark:text-gray-300 mb-4 line-clamp-3 leading-relaxed">
                          {card.content}
                        </p>
                        
                        <div className="flex justify-between items-center pt-4 border-t border-gray-200/50 dark:border-gray-600/50">
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                            <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full"></div>
                            <span className="capitalize font-medium">{card.frequency}</span>
                          </div>
                          <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                            {card.lastUpdated.toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full blur-2xl opacity-20 scale-150"></div>
                  <Brain className="relative w-16 h-16 text-gray-400 mx-auto filter drop-shadow-lg" />
                </div>
                <h4 className="text-xl font-bold text-gray-600 dark:text-gray-300 mb-2">
                  No memories yet!
                </h4>
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  Start chatting with me to build our memory together ✨
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Debug Section (Development only) */}
        {process.env.NODE_ENV === 'development' && userProfile && (
          <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-red-500" />
              Debug Info (Development Only)
            </h3>
            
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Profile ID:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">{userProfile.id}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Version:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">{userProfile.version}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Friendship Points:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">{friendshipPoints}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Memory Count:</span>
                  <span className="ml-2 text-gray-600 dark:text-gray-400">{memoryCount}</span>
                </div>
              </div>
              
              <details className="mt-4">
                <summary className="font-medium text-gray-700 dark:text-gray-300 cursor-pointer hover:text-gray-900 dark:hover:text-gray-100">
                  Raw Profile Data (click to expand)
                </summary>
                <pre className="mt-2 p-3 bg-gray-200 dark:bg-gray-800 rounded text-xs overflow-auto max-h-64">
                  {JSON.stringify(userProfile, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        )}

        {/* Elegant Footer */}
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-full border border-pink-200/50 dark:border-pink-700/50 shadow-lg">
            <Heart className="w-5 h-5 text-pink-500" />
            <span className="text-gray-600 dark:text-gray-300 font-medium">
              Building our friendship, one memory at a time
            </span>
            <Heart className="w-5 h-5 text-pink-500" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClaraBrainDashboard;