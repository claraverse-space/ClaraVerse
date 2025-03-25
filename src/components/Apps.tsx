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
  Copy,
  Edit,
  Check,
  X
} from 'lucide-react';
import { appStore, AppData } from '../services/AppStore';
import { useTheme } from '../hooks/useTheme';

interface AppsProps {
  onPageChange: (page: string) => void;
}

interface CommunityApp {
  name: string;
  description: string;
  icon: string;
  color: string;
  nodes: any[];
  edges: any[];
}

const Apps: React.FC<AppsProps> = ({ onPageChange }) => {
  const { isDark } = useTheme();
  const [activeTab, setActiveTab] = useState<'myApps' | 'community'>('myApps'); // Add state for tabs
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [apps, setApps] = useState<AppData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [communityApps, setCommunityApps] = useState<CommunityApp[]>([]);

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

  // Handle app deletion - Fixed function
  const handleDeleteApp = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent any default actions or bubbling
    
    // Make the confirmation message more explicit about irreversible deletion
    const confirmMessage = 'WARNING: This action is irreversible. All app data, configurations, and history will be permanently deleted.\n\nAre you absolutely sure you want to delete this app?';
    
    if (window.confirm(confirmMessage)) {
      try {
        // Get the app name for the success message
        const appToDelete = apps.find(app => app.id === id);
        const appName = appToDelete?.name || 'App';
        
        // Delete the app
        await appStore.deleteApp(id);
        
        // Clear app ID from localStorage if it's the currently selected app
        if (localStorage.getItem('current_app_id') === id) {
          localStorage.removeItem('current_app_id');
        }
        
        // Show success message
        setDeleteSuccess(`"${appName}" has been permanently deleted.`);
        
        // Hide success message after 3 seconds
        setTimeout(() => {
          setDeleteSuccess(null);
        }, 3000);
        
        // Reload the apps list
        await loadApps();
      } catch (error) {
        console.error('Error deleting app:', error);
        alert('Failed to delete app. Please try again.');
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

  // Add useEffect to load community apps
  useEffect(() => {
    const loadCommunityApps = async () => {
      try {
        // Dynamic import all .json files from Community folder
        const communityAppModules = import.meta.glob('/src/Community/*.json', { eager: true });
        const loadedApps = Object.values(communityAppModules) as CommunityApp[];
        setCommunityApps(loadedApps);
      } catch (error) {
        console.error('Error loading community apps:', error);
      }
    };

    loadCommunityApps();
  }, []);

  // Add handler for importing community apps
  const handleImportCommunityApp = async (communityApp: CommunityApp) => {
    try {
      // Create new app with community app data
      const newAppId = await appStore.createApp(communityApp.name, communityApp.description);
      
      // Update the app with all community app data
      await appStore.updateApp(newAppId, {
        name: communityApp.name,
        description: communityApp.description,
        icon: communityApp.icon,
        color: communityApp.color,
        nodes: communityApp.nodes,
        edges: communityApp.edges
      });

      // Show success message
      setDeleteSuccess(`Successfully imported "${communityApp.name}"`);
      
      // Reload apps list
      await loadApps();
      
      // Switch to My Apps tab
      setActiveTab('myApps');
    } catch (error) {
      console.error('Error importing community app:', error);
      alert('Failed to import app. Please try again.');
    }
  };

  // Replace the community apps section with:
  const renderCommunityContent = () => (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
          Community Apps
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Explore apps shared by the Clara community.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {communityApps.map((app, index) => {
          const IconComponent = getIconComponent(app.icon || 'Activity');
          return (
            <div
              key={index}
              className="glassmorphic rounded-xl overflow-hidden hover:shadow-lg transition-shadow cursor-pointer transform hover:-translate-y-1 transition-transform duration-200"
              onClick={() => {
                // Import the app into user's apps
                handleImportCommunityApp(app);
              }}
            >
              <div
                className="h-32 flex items-center justify-center"
                style={{ backgroundColor: app.color }}
              >
                <IconComponent className="h-16 w-16 text-white/90" />
              </div>
              <div className="p-5">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {app.name}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                  {app.description}
                </p>
                <button className="text-sakura-500 hover:text-sakura-600 text-sm font-medium">
                  Import App
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="h-[calc(100vh-theme(spacing.16)-theme(spacing.12))] overflow-y-auto flex flex-col">
      {/* Tabs */}
      <div className="flex justify-center border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab('myApps')}
          className={`px-6 py-3 text-sm font-medium ${
            activeTab === 'myApps'
              ? 'border-b-2 border-sakura-500 text-sakura-600 dark:text-sakura-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          My Apps
        </button>
        <button
          onClick={() => setActiveTab('community')}
          className={`px-6 py-3 text-sm font-medium ${
            activeTab === 'community'
              ? 'border-b-2 border-sakura-500 text-sakura-600 dark:text-sakura-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }`}
        >
          Community
        </button>
      </div>

      {/* Content */}
      {activeTab === 'myApps' ? (
        <>
          {/* My Apps Content */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              My Apps
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Create and manage your Clara-powered applications
            </p>
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
        </>
      ) : (
        renderCommunityContent()
      )}
    </div>
  );
};

export default Apps;