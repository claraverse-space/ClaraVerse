import React, { useEffect, useState } from 'react';
import { Bell, Sun, Moon, Monitor, Clock } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import UserProfileButton from './common/UserProfileButton';
import { db } from '../db';

interface TopbarProps {
  userName?: string;
  onPageChange?: (page: string) => void;
  projectTitle?: string;
  showProjectTitle?: boolean;
}

const Topbar = ({ userName, onPageChange, projectTitle, showProjectTitle = false }: TopbarProps) => {
  const { theme, setTheme, isDark } = useTheme();
  const [now, setNow] = useState(new Date());
  const [timezone, setTimezone] = useState<string>(Intl.DateTimeFormat().resolvedOptions().timeZone);

  useEffect(() => {
    let timer = setInterval(() => setNow(new Date()), 1000);
    db.getPersonalInfo().then(info => {
      if (info?.timezone) setTimezone(info.timezone);
    });
    return () => clearInterval(timer);
  }, []);

  const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: timezone });
  const dateString = now.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: timezone });
  const dayString = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone });

  // Cycle through theme modes: light -> dark -> system -> light ...
  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  return (
    <div className="glassmorphic h-16 px-6 flex items-center justify-between relative">
      <div className="flex-1" />
      {/* Center section - Project Title and Clock */}
      <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center min-w-[120px]">
        {showProjectTitle && projectTitle && (
          <h1 className="text-lg font-semibold text-gray-800 dark:text-white mb-0.5">
            {projectTitle}
          </h1>
        )}
        <div className="text-xs font-mono text-gray-700 dark:text-gray-200 flex flex-row items-center gap-2 min-w-[90px]">
          <Clock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 mr-1" />
          <span className="font-semibold tracking-widest text-xs text-gray-700 dark:text-gray-200" style={{letterSpacing: '0.08em'}}>{timeString}</span>
          <span className="text-[10px] text-gray-500 dark:text-gray-400 font-normal">· {dateString} · {dayString}</span>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <button 
          onClick={cycleTheme}
          className="p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/10 transition-colors"
          aria-label="Toggle theme"
        >
          {theme === 'light' && <Sun className="w-5 h-5 text-gray-600 dark:text-gray-300" />}
          {theme === 'dark' && <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />}
          {theme === 'system' && <Monitor className="w-5 h-5 text-gray-600 dark:text-gray-300" />}
        </button>
        <button className="p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/10 transition-colors">
          <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <UserProfileButton
          userName={userName || 'Profile'}
          onPageChange={onPageChange || (() => {})}
        />
      </div>
    </div>
  );
};

export default Topbar;