import React, { useRef, useEffect, useState } from 'react';
import { Home, Bot, AlertCircle, Sun, Moon, Database, RefreshCw, Loader2, Settings, Wrench } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { db } from '../../db';
import UserProfileButton from '../common/UserProfileButton';

interface AssistantHeaderProps {
  connectionStatus: 'checking' | 'connected' | 'disconnected';
  onPageChange: (page: string) => void;
  onNavigateHome: () => void;
  onOpenSettings: () => void;
  onOpenKnowledgeBase: () => void;
  onOpenTools: () => void;
}

const AssistantHeader: React.FC<AssistantHeaderProps> = ({
  connectionStatus,
  onPageChange,
  onNavigateHome,
  onOpenSettings,
  onOpenKnowledgeBase,
  onOpenTools,
}) => {
  const { isDark, toggleTheme } = useTheme();
  const [userName, setUserName] = useState<string>('');

  useEffect(() => {
    const loadUserName = async () => {
      const personalInfo = await db.getPersonalInfo();
      if (personalInfo?.name) {
        setUserName(personalInfo.name);
      }
    };
    loadUserName();
  }, []);

  return (
    <div className="h-16 glassmorphic flex items-center justify-between px-6 relative z-20">
      {/* Left section with fixed width */}
      <div className="flex items-center gap-4 w-[500px]">
        <button 
          onClick={onNavigateHome}
          className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5 text-gray-700 dark:text-gray-300"
        >
          <Home className="w-5 h-5" />
          <span>Back to Home</span>
        </button>
      </div>

      {/* Center section - empty now */}
      <div className="flex-1 flex items-center justify-center gap-2">
      </div>

      {/* Right section with actions */}
      <div className="flex items-center gap-2">
        {/* Connection Status */}
        <div className="flex items-center gap-2">
          {connectionStatus === 'checking' ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-100/50 dark:bg-yellow-900/30">
              <Bot className="w-4 h-4 text-yellow-500 animate-spin" />
              <span className="text-sm text-yellow-700 dark:text-yellow-400">Checking...</span>
            </div>
          ) : connectionStatus === 'connected' ? (
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Connected" />
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-100/50 dark:bg-red-900/30">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <span className="text-sm text-red-700 dark:text-red-400">Disconnected</span>
            </div>
          )}
        </div>

        {/* Knowledge Base Button */}
        <button
          onClick={onOpenKnowledgeBase}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5"
          title="Knowledge Base"
        >
          <Database className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          <span className="text-sm text-gray-700 dark:text-gray-300 hidden sm:inline">Knowledge Base</span>
        </button>

        {/* Tools Button */}
        <button
          onClick={onOpenTools}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5"
          title="Tools"
        >
          <Wrench className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          <span className="text-sm text-gray-700 dark:text-gray-300 hidden sm:inline">Tools</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5"
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          ) : (
            <Moon className="w-4 h-4 text-gray-700 dark:text-gray-300" />
          )}
        </button>

        {/* User Profile */}
        <UserProfileButton 
          userName={userName} 
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
};

export default AssistantHeader;