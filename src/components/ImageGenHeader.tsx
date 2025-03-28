import React from 'react';
import { Bell, Sun, Moon, Image } from 'lucide-react';
import { useTheme } from '../hooks/useTheme';
import UserProfileButton from './common/UserProfileButton';

interface ImageGenHeaderProps {
  userName?: string;
  onPageChange?: (page: string) => void;
  // Pass system stats from ComfyUI
  systemStats?: any;
}

const ImageGenHeader: React.FC<ImageGenHeaderProps> = ({
  userName,
  onPageChange,
  systemStats
}) => {
  const { isDark, toggleTheme } = useTheme();

  // Safely extract and format some system stats if available
  const pythonVersion = systemStats?.system?.python_version || 'N/A';
  const ramFree = systemStats?.system?.ram_free || 0;
  const ramTotal = systemStats?.system?.ram_total || 0;
  const ramFreeGB = (ramFree / 1_073_741_824).toFixed(2);  // Convert bytes to GB
  const ramTotalGB = (ramTotal / 1_073_741_824).toFixed(2);

  return (
    <div className="glassmorphic h-16 px-6 flex items-center justify-between">
      {/* Left side: System stats (if any) */}
      <div className="flex-1 flex items-center gap-6">
        {systemStats && (
          <div className="text-xs text-gray-700 dark:text-gray-300">
            <span className="mr-4">
              <strong>Python:</strong> {pythonVersion}
            </span>
            <span>
              <strong>RAM:</strong> {ramFreeGB}/{ramTotalGB} GB
            </span>
          </div>
        )}
      </div>
      
      {/* Right side: Gallery, theme toggle, notifications, user info */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => onPageChange?.('gallery')}
          className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/10 transition-colors"
        >
          <Image className="w-5 h-5 text-gray-600 dark:text-gray-300" />
          <span className="text-sm text-gray-700 dark:text-gray-300">Gallery</span>
        </button>

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

        <UserProfileButton
          userName={userName || 'Profile'}
          onPageChange={onPageChange || (() => {})}
        />
      </div>
    </div>
  );
};

export default ImageGenHeader;
