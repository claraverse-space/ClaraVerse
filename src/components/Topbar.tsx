import React, { useState } from 'react';
import { Search, Bell, User, Sun, Moon } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

interface TopbarProps {
  userName?: string;
  onPageChange?: (page: string) => void;
}

const Topbar = ({ userName, onPageChange }: TopbarProps) => {
  const { isDark, toggleTheme } = useTheme();
  const [searchInput, setSearchInput] = useState('');

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchInput.trim()) {
      e.preventDefault();
      // Navigate to assistant page
      onPageChange?.('assistant');
      // Store the search query in localStorage to be picked up by Assistant component
      localStorage.setItem('pending_chat_query', searchInput.trim());
      // Clear the input
      setSearchInput('');
    }
  };

  return (
    <div className="glassmorphic h-16 px-6 flex items-center justify-between">
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearch}
            placeholder="Ask Clara anything..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
          />
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <button 
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/10 transition-colors"
          aria-label="Toggle theme"
        >
          {isDark ? (
            <Sun className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          ) : (
            <Moon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          )}
        </button>
        <button className="p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/10 transition-colors">
          <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300" />
        </button>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/10">
          <User className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {userName || 'Profile'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default Topbar;