import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, X, Volume2, VolumeX, Trash2, CheckCheck, TestTube } from 'lucide-react';
import { notificationService, ClaraNotification } from '../../services/notificationService';

interface NotificationPanelProps {
  className?: string;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ className = '' }) => {
  const [notifications, setNotifications] = useState<ClaraNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Subscribe to notification updates
    const unsubscribe = notificationService.subscribe((newNotifications) => {
      setNotifications(newNotifications);
      setUnreadCount(notificationService.getUnreadCount());
    });

    // Load initial state
    setNotifications(notificationService.getNotifications());
    setUnreadCount(notificationService.getUnreadCount());
    setSoundEnabled(notificationService.isSoundEnabled());

    return unsubscribe;
  }, []);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleTogglePanel = () => {
    setIsOpen(!isOpen);
    if (!isOpen && unreadCount > 0) {
      // Mark all as read when opening panel
      setTimeout(() => {
        notificationService.markAllAsRead();
      }, 1000);
    }
  };

  const handleToggleSound = () => {
    const newSoundEnabled = !soundEnabled;
    setSoundEnabled(newSoundEnabled);
    notificationService.setSoundEnabled(newSoundEnabled);
  };

  const handleTestSound = () => {
    notificationService.testCompletionChime();
  };

  const handleMarkAsRead = (id: string) => {
    notificationService.markAsRead(id);
  };

  const handleRemoveNotification = (id: string) => {
    notificationService.removeNotification(id);
  };

  const handleClearAll = () => {
    notificationService.clearAll();
  };

  const handleMarkAllAsRead = () => {
    notificationService.markAllAsRead();
  };

  const getNotificationIcon = (type: ClaraNotification['type']) => {
    switch (type) {
      case 'completion':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  const getNotificationColor = (type: ClaraNotification['type']) => {
    switch (type) {
      case 'completion':
        return 'text-green-600 dark:text-green-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'info':
      default:
        return 'text-blue-600 dark:text-blue-400';
    }
  };

  const formatTime = (timestamp: Date) => {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <div className={`relative ${className}`} ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={handleTogglePanel}
        className={`relative p-2 rounded-lg transition-all duration-200 ${
          unreadCount > 0 
            ? 'bg-blue-50/50 dark:bg-blue-900/20 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 border border-blue-200/30 dark:border-blue-700/30' 
            : 'hover:bg-sakura-50 dark:hover:bg-sakura-100/10'
        }`}
        aria-label="Notifications"
      >
        <Bell className={`w-5 h-5 transition-colors ${
          unreadCount > 0 
            ? 'text-blue-600 dark:text-blue-400' 
            : 'text-gray-600 dark:text-gray-300'
        }`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-medium shadow-lg animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notification Panel */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 glassmorphic rounded-lg shadow-xl border border-white/20 dark:border-gray-700/50 z-[9999] overflow-hidden backdrop-blur-xl animate-fadeIn">
          {/* Header */}
          <div className="p-4 border-b border-white/10 dark:border-gray-700/50 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">
                  ({unreadCount} unread)
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleSound}
                className="p-1 rounded hover:bg-white/10 dark:hover:bg-gray-700/50 transition-colors"
                title={soundEnabled ? 'Disable sound' : 'Enable sound'}
              >
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                ) : (
                  <VolumeX className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                )}
              </button>
              {soundEnabled && (
                <button
                  onClick={handleTestSound}
                  className="p-1 rounded hover:bg-white/10 dark:hover:bg-gray-700/50 transition-colors"
                  title="Test completion sound"
                >
                  <TestTube className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </button>
              )}
              <button
                onClick={() => {
                  // Demo different notification types
                  notificationService.addCompletionNotification(
                    'Demo Completion', 
                    'This is a demo completion notification with chime!',
                    3000
                  );
                  setTimeout(() => {
                    notificationService.addInfoNotification(
                      'Demo Info', 
                      'This is a demo info notification.',
                      3000
                    );
                  }, 1000);
                  setTimeout(() => {
                    notificationService.addErrorNotification(
                      'Demo Error', 
                      'This is a demo error notification.',
                      3000
                    );
                  }, 2000);
                }}
                className="p-1 rounded hover:bg-white/10 dark:hover:bg-gray-700/50 transition-colors"
                title="Demo notifications"
              >
                <span className="text-xs">🎭</span>
              </button>
              {notifications.length > 0 && (
                <>
                  <button
                    onClick={handleMarkAllAsRead}
                    className="p-1 rounded hover:bg-white/10 dark:hover:bg-gray-700/50 transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                  <button
                    onClick={handleClearAll}
                    className="p-1 rounded hover:bg-white/10 dark:hover:bg-gray-700/50 transition-colors"
                    title="Clear all"
                  >
                    <Trash2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto scrollbar-thin">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No notifications yet</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 border-b border-white/5 dark:border-gray-700/30 last:border-b-0 hover:bg-white/5 dark:hover:bg-gray-700/20 transition-colors ${
                    !notification.isRead ? 'bg-blue-50/20 dark:bg-blue-900/10 border-l-2 border-l-blue-400/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className={`font-medium text-sm ${getNotificationColor(notification.type)}`}>
                          {notification.title}
                        </h4>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {!notification.isRead && (
                            <button
                              onClick={() => handleMarkAsRead(notification.id)}
                              className="p-1 rounded hover:bg-white/10 dark:hover:bg-gray-600/50 transition-colors"
                              title="Mark as read"
                            >
                              <Check className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                            </button>
                          )}
                          <button
                            onClick={() => handleRemoveNotification(notification.id)}
                            className="p-1 rounded hover:bg-white/10 dark:hover:bg-gray-600/50 transition-colors"
                            title="Remove"
                          >
                            <X className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {formatTime(notification.timestamp)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel; 