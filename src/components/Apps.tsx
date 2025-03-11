import React, { useState, useEffect } from 'react';
import { 
  Search,
  Plus,
  SlidersHorizontal,
  Grid,
  Layers,
  Code,
  FileText,
  Database,
  BarChart,
  ImageIcon,
  MessagesSquare,
  Bot,
  MoreVertical,
  Activity,
  Globe,
  Sparkles,
  Zap,
  Settings,
  User,
  Brain,
  Command,
  Book,
  Layout,
  Compass,
  Trash2,
  Copy,
  Edit
} from 'lucide-react';
import { appStore, AppData } from '../services/AppStore';
import { useTheme } from '../hooks/useTheme';

interface AppsProps {
  onPageChange: (page: string) => void;
}

const Apps: React.FC<AppsProps> = ({ onPageChange }) => {
  const { isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [apps, setApps] = useState<AppData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  // Map icon names to components
  const iconComponents: Record<string, React.ElementType> = {
    Activity, FileText, Code, ImageIcon, MessagesSquare, Database, Globe,
    Sparkles, Zap, User, Settings, BarChart, Search, Bot, Brain,
    Command, Book, Layout, Compass
  };

  const getIconComponent = (iconName: string) => {
    return iconComponents[iconName] || Activity;
  };

  // Load apps from IndexedDB
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

  // Handle app deletion
  const handleDeleteApp = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this app? This action cannot be undone.')) {
      try {
        await appStore.deleteApp(id);
        await loadApps(); // Reload the apps after deletion
      } catch (error) {
        console.error('Error deleting app:', error);
        alert('Failed to delete app');
      }
    }
    setMenuOpen(null);
  };

  // Handle app duplication
  const handleDuplicateApp = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await appStore.duplicateApp(id);
      await loadApps(); // Reload the apps after duplication
    } catch (error) {
      console.error('Error duplicating app:', error);
      alert('Failed to duplicate app');
    }
    setMenuOpen(null);
  };

  // Toggle the action menu
  const toggleMenu = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(menuOpen === id ? null : id);
  };

  // Create a new app - clear any existing app ID first
  const handleCreateApp = () => {
    // Clear any existing app ID to ensure we create a new one
    localStorage.removeItem('current_app_id'); 
    onPageChange('app-creator');
  };

  // Open an existing app for running (not editing)
  const handleOpenApp = (appId: string) => {
    localStorage.setItem('current_app_id', appId);
    onPageChange('app-runner');
  };

  // Open an existing app for editing
  const handleEditApp = (appId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem('current_app_id', appId);
    onPageChange('app-creator');
    setMenuOpen(null);
  };

  // Filter apps based on search query
  const filteredApps = apps.filter(app => 
    app.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    app.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort apps based on selected sort option
  const sortedApps = [...filteredApps].sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    } else if (sortBy === 'oldest') {
      return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
    } else {
      return a.name.localeCompare(b.name);
    }
  });

  return (
    <div className="h-[calc(100vh-theme(spacing.16)-theme(spacing.12))] overflow-y-auto flex flex-col">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          My Apps
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Create and manage your Clara-powered applications
        </p>
      </div>
      
      {/* Search and Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8">
        {/* Search Bar */}
        <div className="relative flex-grow max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search apps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sakura-300 dark:border-gray-700 dark:bg-gray-800/80 dark:text-white"
          />
        </div>
        
        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Sort Options */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sakura-300 dark:border-gray-700 dark:bg-gray-800/80 dark:text-white"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="alphabetical">A-Z</option>
            </select>
            <SlidersHorizontal className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>
          
          {/* View Options */}
          <div className="hidden sm:flex items-center gap-1 border border-gray-200 rounded-lg dark:border-gray-700">
            <button className="p-2 rounded-l-lg bg-sakura-100 dark:bg-sakura-100/10 text-sakura-500">
              <Grid className="h-4 w-4" />
            </button>
            <button className="p-2 rounded-r-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              <Layers className="h-4 w-4" />
            </button>
          </div>
          
          {/* Create New App Button */}
          <button 
            onClick={handleCreateApp}
            className="flex items-center gap-2 px-4 py-2 bg-sakura-500 hover:bg-sakura-600 text-white rounded-lg transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Create App</span>
          </button>
        </div>
      </div>
      
      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-sakura-500"></div>
        </div>
      )}
      
      {/* App Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {!isLoading && sortedApps.length > 0 ? (
          sortedApps.map(app => {
            const IconComponent = getIconComponent(app.icon || 'Activity');
            
            return (
              <div 
                key={app.id} 
                className="glassmorphic rounded-xl overflow-hidden hover:shadow-lg transition-shadow cursor-pointer transform hover:-translate-y-1 transition-transform duration-200"
                onClick={() => handleOpenApp(app.id)}
              >
                <div 
                  className="h-32 flex items-center justify-center" 
                  style={{ backgroundColor: app.color || '#3B82F6' }}
                >
                  <IconComponent className="h-16 w-16 text-white/90" />
                </div>
                <div className="p-5">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{app.name}</h3>
                    <div className="relative">
                      <button 
                        className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        onClick={(e) => toggleMenu(app.id, e)}
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>
                      
                      {menuOpen === app.id && (
                        <div className="absolute right-0 mt-1 py-1 w-48 rounded-md shadow-lg z-10 glassmorphic bg-white/95 dark:bg-gray-800/95 border border-gray-200 dark:border-gray-700">
                          <button
                            className="flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-700/50"
                            onClick={(e) => handleEditApp(app.id, e)}
                          >
                            <Edit className="h-4 w-4 mr-2" /> Edit
                          </button>
                          <button
                            className="flex w-full items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-700/50"
                            onClick={(e) => handleDuplicateApp(app.id, e)}
                          >
                            <Copy className="h-4 w-4 mr-2" /> Duplicate
                          </button>
                          <button
                            className="flex w-full items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100/80 dark:hover:bg-gray-700/50"
                            onClick={(e) => handleDeleteApp(app.id, e)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                    {app.description || 'No description'}
                  </p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Updated: {new Date(app.updatedAt).toLocaleDateString()}
                    </span>
                    <button className="text-sakura-500 hover:text-sakura-600 text-sm font-medium">
                      Run App
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : !isLoading && (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-sakura-100 dark:bg-sakura-100/10 flex items-center justify-center mb-4">
              <Bot className="w-8 h-8 text-sakura-500" />
            </div>
            <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No apps found</h3>
            <p className="text-gray-600 dark:text-gray-400 max-w-sm mb-6">
              {searchQuery ? "No apps match your search criteria." : "Create your first app to get started with Clara."}
            </p>
            {searchQuery ? (
              <button 
                onClick={() => setSearchQuery('')}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
              >
                Clear search
              </button>
            ) : (
              <button 
                onClick={handleCreateApp}
                className="flex items-center gap-2 px-4 py-2 bg-sakura-500 hover:bg-sakura-600 text-white rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Create First App</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Apps;