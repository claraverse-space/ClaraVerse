import React, { useRef, useEffect, useState } from 'react';
import { Home, Bot, AlertCircle, Sun, Moon, Monitor, Database, RefreshCw, Loader2, Settings, Wrench, Clock } from 'lucide-react';
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
  const { theme, setTheme, isDark } = useTheme();
  const [userName, setUserName] = useState<string>('');
  const [now, setNow] = useState(new Date());
  const [timezone, setTimezone] = useState<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [personalInfo, setPersonalInfo] = useState<any>(null);

  useEffect(() => {
    const loadUserName = async () => {
      const personalInfo = await db.getPersonalInfo();
      if (personalInfo?.name) {
        setUserName(personalInfo.name);
      }
      if (personalInfo?.timezone) {
        setTimezone(personalInfo.timezone);
      }
      setPersonalInfo(personalInfo);
      if (personalInfo?.theme_preference) setTheme(personalInfo.theme_preference);
    };
    loadUserName();
    let timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [setTheme]);

  const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: timezone });
  const dateString = now.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone });
  const dayString = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone });

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    if (personalInfo) {
      db.updatePersonalInfo({ ...personalInfo, theme_preference: newTheme });
      setPersonalInfo({ ...personalInfo, theme_preference: newTheme });
    }
  };

  const cycleTheme = () => {
    let newTheme;
    if (theme === 'light') newTheme = 'dark';
    else if (theme === 'dark') newTheme = 'system';
    else newTheme = 'light';
    handleThemeChange(newTheme);
  };

  return (
    <div className="glassmorphic flex flex-col md:flex-row md:items-center md:justify-between px-4 md:px-6 py-2 md:py-0 relative z-20 w-full">
      {/* Top row: Left and Right sections */}
      <div className="flex w-full items-center justify-between">
        {/* Left section */}
        <div className="flex items-center gap-2 md:gap-4">
          <button 
            onClick={onNavigateHome}
            className="flex items-center gap-2 px-2 md:px-4 py-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5 text-gray-700 dark:text-gray-300"
          >
            <Home className="w-5 h-5" />
            <span className="hidden sm:inline">Back to Home</span>
          </button>
        </div>

        {/* Right section with actions */}
        <div className="flex items-center gap-2 md:gap-6 overflow-x-auto">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            {connectionStatus === 'checking' ? (
              <div className="flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-lg bg-yellow-100/50 dark:bg-yellow-900/30">
                <Bot className="w-4 h-4 text-yellow-500 animate-spin" />
                <span className="text-xs md:text-sm text-yellow-700 dark:text-yellow-400 hidden sm:inline">Checking...</span>
              </div>
            ) : connectionStatus === 'connected' ? (
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" title="Connected" />
            ) : (
              <div className="flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-lg bg-red-100/50 dark:bg-red-900/30">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-xs md:text-sm text-red-700 dark:text-red-400 hidden sm:inline">Disconnected</span>
              </div>
            )}
          </div>

          {/* Knowledge Base Button */}
          <button
            onClick={onOpenKnowledgeBase}
            className="flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5"
            title="Knowledge Base"
          >
            <Database className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            <span className="hidden md:inline text-xs md:text-sm text-gray-700 dark:text-gray-300">Knowledge Base</span>
          </button>

          {/* Tools Button */}
          <button
            onClick={onOpenTools}
            className="flex items-center gap-2 px-2 md:px-3 py-1.5 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5"
            title="Tools"
          >
            <Wrench className="w-4 h-4 text-gray-700 dark:text-gray-300" />
            <span className="hidden md:inline text-xs md:text-sm text-gray-700 dark:text-gray-300">Tools</span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={cycleTheme}
            className="flex flex-col items-center p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5"
            title={
              theme === 'light' ? 'Switch to Dark Mode' :
              theme === 'dark' ? 'Switch to System Mode' :
              'Switch to Light Mode'
            }
          >
            {theme === 'light' && <Sun className="w-4 h-4 text-gray-700 dark:text-gray-300" />}
            {theme === 'dark' && <Moon className="w-4 h-4 text-gray-700 dark:text-gray-300" />}
            {theme === 'system' && <Monitor className="w-4 h-4 text-gray-700 dark:text-gray-300" />}
            <span className="text-[10px] mt-0.5 text-gray-500 dark:text-gray-400">
              {theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System'}
            </span>
          </button>

          {/* User Profile */}
          <UserProfileButton 
            userName={userName} 
            onPageChange={onPageChange}
          />
        </div>
      </div>

      {/* Second row: Center section - Clock (always below on small screens, centered on md+) */}
      <div className="flex justify-center mt-2 md:mt-0 md:absolute md:left-1/2 md:top-1/2 md:transform md:-translate-x-1/2 md:-translate-y-1/2 w-full md:w-auto">
        <div className="text-xs font-mono text-gray-700 dark:text-gray-200 flex flex-row items-center gap-2 min-w-[90px]">
          <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 mr-1" />
          <span className="font-semibold tracking-widest text-xs text-gray-700 dark:text-gray-200" style={{letterSpacing: '0.08em'}}>{timeString}</span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-normal">· {dateString} · {dayString}</span>
        </div>
      </div>
    </div>
  );
};

export default AssistantHeader;