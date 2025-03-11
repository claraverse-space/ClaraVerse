import React, { useState, useEffect } from 'react';
import { appStore, AppData } from '../services/AppStore';
import { Activity, Trash2, Edit, Copy, MoreHorizontal, Globe, FileText } from 'lucide-react';
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

  const handleDeleteApp = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this app? This action cannot be undone.')) {
      await appStore.deleteApp(id);
      loadApps();
    }
    setMenuOpen(null);
  };

  const handleDuplicateApp = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await appStore.duplicateApp(id);
      loadApps();
      setMenuOpen(null);
    } catch (error) {
      console.error('Error duplicating app:', error);
      alert('Failed to duplicate app');
    }
  };

  const toggleMenu = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(menuOpen === id ? null : id);
  };

  const getIconComponent = (iconName: string) => {
    const icons: Record<string, React.ElementType> = {
      Activity: Activity,
      Globe: Globe,
      FileText: FileText,
      // Add more icon mappings as needed
    };
    
    return icons[iconName] || Activity;
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-full">Loading apps...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Your Apps</h1>
        <button
          onClick={onCreateNewApp}
          className="px-4 py-2 bg-sakura-500 text-white rounded-lg hover:bg-sakura-600 transition-colors"
        >
          Create New App
        </button>
      </div>

      {apps.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
            <Activity className="h-8 w-8 text-sakura-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No apps yet</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Create your first app to get started
          </p>
          <button
            onClick={onCreateNewApp}
            className="px-4 py-2 bg-sakura-500 text-white rounded-lg hover:bg-sakura-600 transition-colors"
          >
            Create New App
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {apps.map((app) => {
            const IconComponent = getIconComponent(app.icon || 'Activity');
            return (
              <div
                key={app.id}
                className={`relative rounded-lg border ${
                  isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                } shadow-sm hover:shadow-md transition-shadow cursor-pointer`}
                onClick={() => onEditApp(app.id)}
              >
                <div 
                  className="h-24 flex items-center justify-center" 
                  style={{ backgroundColor: app.color || '#3B82F6' }}
                >
                  <IconComponent className="w-12 h-12 text-white" />
                </div>
                <div className="p-4">
                  <h3 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'} mb-1`}>
                    {app.name}
                  </h3>
                  <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'} mb-2`}>
                    {app.description || 'No description'}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                      Updated: {new Date(app.updatedAt).toLocaleDateString()}
                    </span>
                    <div className="relative">
                      <button
                        className={`p-1 rounded-full ${
                          isDark ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                        }`}
                        onClick={(e) => toggleMenu(app.id, e)}
                      >
                        <MoreHorizontal className="h-5 w-5 text-gray-500" />
                      </button>
                      
                      {menuOpen === app.id && (
                        <div 
                          className={`absolute right-0 mt-1 py-1 w-48 rounded-md shadow-lg z-10 ${
                            isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'
                          }`}
                        >
                          <button
                            className={`flex w-full items-center px-4 py-2 text-sm ${
                              isDark ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'
                            }`}
                            onClick={(e) => handleDuplicateApp(app.id, e)}
                          >
                            <Copy className="h-4 w-4 mr-2" /> Duplicate
                          </button>
                          <button
                            className={`flex w-full items-center px-4 py-2 text-sm ${
                              isDark ? 'text-red-400 hover:bg-gray-700' : 'text-red-600 hover:bg-gray-100'
                            }`}
                            onClick={(e) => handleDeleteApp(app.id, e)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </button>
                        </div>
                      )}
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
