import React, { useState, useEffect } from 'react';
import { appStore, AppData } from '../services/AppStore';
import { 
  Activity, FileText, Code, Image, MessageSquare, Database, Globe, 
  Sparkles, Zap, User, Settings, BarChart2, Search, Bot, Brain,
  Command, Book, Layout, Compass, Copy, MoreHorizontal, Plus,
  Check, X
} from 'lucide-react';
import { useTheme } from '../hooks/useTheme';

interface AppListProps {
  onEditApp: (appId: string) => void;
  onCreateNewApp: () => void;
}

const AppList: React.FC<AppListProps> = ({ onEditApp, onCreateNewApp }) => {
  const { isDark } = useTheme();
  const [apps, setApps] = useState<AppData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadApps();
  }, []);

  const loadApps = async () => {
    setIsLoading(true);
    try {
      const appList = await appStore.listApps();
      setApps(appList);
    } catch (error) {
      console.error('Error loading apps:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDuplicateApp = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await appStore.duplicateApp(id);
      loadApps();
    } catch (error) {
      console.error('Error duplicating app:', error);
      alert('Failed to duplicate app');
    }
    setMenuOpen(null);
  };

  const toggleMenu = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(menuOpen === id ? null : id);
  };

  // Map icon names to components
  const iconComponents: Record<string, React.ElementType> = {
    Activity, FileText, Code, Image, MessageSquare, Database, Globe,
    Sparkles, Zap, User, Settings, Chart: BarChart2, Search, Bot, Brain,
    Command, Book, Layout, Compass
  };

  const getIconComponent = (iconName: string) => {
    return iconComponents[iconName] || Activity;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sakura-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Applications</h2>
        <button
          onClick={onCreateNewApp}
          className="px-4 py-2 bg-sakura-500 hover:bg-sakura-600 text-white rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus size={18} />
          Create New App
        </button>
      </div>

      {/* Show success notification */}
      {deleteSuccess && (
        <div className="mb-4 p-4 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 flex items-center justify-between">
          <div className="flex items-center">
            <Check className="w-5 h-5 text-green-500 mr-2" />
            <span className="text-green-700 dark:text-green-300">{deleteSuccess}</span>
          </div>
          <button 
            onClick={() => setDeleteSuccess(null)}
            className="text-green-500 hover:text-green-700 dark:hover:text-green-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {apps.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-lg border-gray-300 dark:border-gray-700">
          <div className="inline-flex items-center justify-center p-6 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
            <Activity className="h-10 w-10 text-sakura-500" />
          </div>
          <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No apps yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
            Create your first app to start building custom workflows with text, images, and AI models.
          </p>
          <button
            onClick={onCreateNewApp}
            className="px-5 py-2.5 bg-sakura-500 hover:bg-sakura-600 text-white rounded-lg flex items-center gap-2 mx-auto transition-colors"
          >
            <Plus size={18} />
            Create Your First App
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {apps.map((app) => {
            const IconComponent = getIconComponent(app.icon || 'Activity');
            return (
              <div
                key={app.id}
                className={`glassmorphic relative rounded-lg border ${
                  isDark ? 'border-gray-700' : 'border-gray-200'
                } shadow-sm hover:shadow-md transition-shadow cursor-pointer transform hover:-translate-y-1 transition-transform duration-200`}
                onClick={() => onEditApp(app.id)}
              >
                <div 
                  className="h-28 flex items-center justify-center rounded-t-lg" 
                  style={{ backgroundColor: app.color || '#3B82F6' }}
                >
                  <IconComponent className="w-14 h-14 text-white" />
                </div>
                <div className="p-4">
                  <div className="flex justify-between items-start">
                    <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-1`}>
                      {app.name}
                    </h3>
                    <div className="relative">
                      <button
                        className={`p-1.5 rounded-full ${
                          isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                        }`}
                        onClick={(e) => toggleMenu(app.id, e)}
                        aria-label="App options"
                      >
                        <MoreHorizontal className="h-4 w-4 text-gray-500" />
                      </button>
                      
                      {menuOpen === app.id && (
                        <div 
                          className={`absolute right-0 mt-1 py-1 w-48 rounded-md shadow-lg z-10 glassmorphic ${
                            isDark ? 'dark:bg-gray-800/95 border border-gray-700' : 'bg-white/95 border border-gray-200'
                          }`}
                        >
                          <button
                            className={`flex w-full items-center px-4 py-2 text-sm ${
                              isDark ? 'text-gray-300 hover:bg-gray-700/50' : 'text-gray-700 hover:bg-gray-100/80'
                            }`}
                            onClick={(e) => handleDuplicateApp(app.id, e)}
                          >
                            <Copy className="h-4 w-4 mr-2" /> Duplicate
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-4 line-clamp-2 h-10`}>
                    {app.description || 'No description'}
                  </p>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200 dark:border-gray-700">
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Updated {new Date(app.updatedAt).toLocaleDateString()}
                    </span>
                    <div className="relative">
                      <button
                        className="text-sakura-500 hover:text-sakura-600 text-sm font-medium"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AppList;
