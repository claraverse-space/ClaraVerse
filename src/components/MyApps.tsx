import React from 'react';
import AppList from './AppList';
import { useTheme } from '../hooks/useTheme';

interface MyAppsProps {
  onEditApp: (appId: string) => void;
  onCreateNewApp: () => void;
}

const MyApps: React.FC<MyAppsProps> = ({ onEditApp, onCreateNewApp }) => {
  const { isDark } = useTheme();

  return (
    <div className={`flex flex-col h-screen ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <div className="glassmorphic flex items-center justify-between p-4 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">My Apps</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Create and manage your custom AI applications
          </span>
        </div>
      </div>
      
      <div className="flex-1 overflow-auto">
        <AppList onEditApp={onEditApp} onCreateNewApp={onCreateNewApp} />
      </div>
    </div>
  );
};

export default MyApps;
