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
  X,
  Trash2
} from 'lucide-react';
import { appStore, AppData } from '../services/AppStore';
import { useTheme } from '../hooks/useTheme';
import { uiBuilderService, UIBuilderProject } from '../services/UIBuilderService';
import { db } from '../db';

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
  const [activeTab, setActiveTab] = useState<'myApps' | 'community' | 'uiApps'>('myApps'); // Add uiApps tab
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [apps, setApps] = useState<AppData[]>([]);
  const [uiProjects, setUiProjects] = useState<UIBuilderProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingUiProjects, setIsLoadingUiProjects] = useState(true);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  const [communityApps, setCommunityApps] = useState<CommunityApp[]>([]);
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);

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

    // Load wallpaper from IndexedDB
    const loadWallpaper = async () => {
      try {
        const wallpaper = await db.getWallpaper();
        if (wallpaper) {
          setWallpaperUrl(wallpaper);
        }
      } catch (error) {
        console.error('Error loading wallpaper:', error);
      }
    };
    loadWallpaper();
  }, []);

  // Add effect to load UI projects when the tab is selected
  useEffect(() => {
    if (activeTab === 'uiApps') {
      loadUiProjects();
    }
  }, [activeTab]);

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

  // Load UI Builder projects
  const loadUiProjects = async () => {
    setIsLoadingUiProjects(true);
    try {
      const projects = await uiBuilderService.getAllProjects();
      // Sort by most recently updated
      setUiProjects(projects.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      );
    } catch (error) {
      console.error('Error loading UI Builder projects:', error);
    } finally {
      setIsLoadingUiProjects(false);
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
          Explore and import apps shared by the Clara community.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {communityApps.map((app, index) => {
          const IconComponent = getIconComponent(app.icon || 'Activity');
          return (
            <div
              key={index}
              className="group glassmorphic rounded-2xl overflow-hidden hover:shadow-2xl hover:shadow-emerald-500/10 transition-all duration-300 cursor-pointer transform hover:-translate-y-2 hover:scale-[1.02] relative"
              onClick={() => {
                handleImportCommunityApp(app);
              }}
            >
              {/* Enhanced App Icon Section */}
              <div
                className="h-40 flex items-center justify-center relative overflow-hidden"
                style={{ 
                  background: `linear-gradient(135deg, ${app.color}, ${app.color}90)` 
                }}
              >
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-4 right-4 w-16 h-16 rounded-full bg-white/20"></div>
                  <div className="absolute bottom-4 left-4 w-8 h-8 rounded-full bg-white/20"></div>
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-white/5"></div>
                </div>
                
                {/* Icon with enhanced styling */}
                <div className="relative z-10 p-4 rounded-2xl bg-white/10 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
                  <IconComponent className="h-12 w-12 text-white drop-shadow-lg" />
                </div>
                
                {/* Community Badge */}
                <div className="absolute top-3 right-3 px-3 py-1 bg-emerald-500/90 rounded-lg text-xs font-medium text-white backdrop-blur-sm">
                  <Globe className="w-3 h-3 inline mr-1" />
                  Community
                </div>
                
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              
              {/* Enhanced Content Section */}
              <div className="p-6">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors duration-200">
                    {app.name}
                  </h3>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3 leading-relaxed">
                  {app.description}
                </p>
                
                {/* Enhanced Footer */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                  <div className="flex items-center">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></div>
                    <span className="text-xs text-gray-600 dark:text-gray-300 font-medium">
                      Ready to import
                    </span>
                  </div>
                  <button 
                    className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-lg text-sm font-medium hover:from-emerald-600 hover:to-teal-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleImportCommunityApp(app);
                    }}
                  >
                    Import App
                  </button>
                </div>
              </div>
              
              {/* Subtle shine effect on hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-pulse transition-opacity duration-300 pointer-events-none"></div>
            </div>
          );
        })}
      </div>
    </>
  );

  // Open an existing UI Builder project
  const handleOpenUiProject = (projectId: string) => {
    localStorage.setItem('current_ui_project', projectId);
    onPageChange('ui-project-viewer');
  };

  // Edit an existing UI Builder project
  const handleEditUiProject = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem('current_ui_project', projectId);
    onPageChange('ui-builder');
    setMenuOpen(null);
  };

  // Delete UI Builder project
  const handleDeleteUiProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault(); 
    
    const confirmMessage = 'WARNING: This action is irreversible. The UI project will be permanently deleted.\n\nAre you absolutely sure you want to delete this project?';
    
    if (window.confirm(confirmMessage)) {
      try {
        const projectToDelete = uiProjects.find(project => project.id === id);
        const projectName = projectToDelete?.name || 'Project';
        
        await uiBuilderService.deleteProject(id);
        
        // Show success message
        setDeleteSuccess(`"${projectName}" has been permanently deleted.`);
        
        // Hide success message after 3 seconds
        setTimeout(() => {
          setDeleteSuccess(null);
        }, 3000);
        
        // Reload the projects list
        await loadUiProjects();
      } catch (error) {
        console.error('Error deleting project:', error);
        alert('Failed to delete project. Please try again.');
      }
    }
    setMenuOpen(null);
  };

  // Add UI Builder apps section:
  const renderUiBuilderContent = () => {
    // Filter projects based on search
    const filteredProjects = searchQuery
      ? uiProjects.filter(project => 
          project.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
          (project.description && project.description.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : uiProjects;

    // Sort projects based on selected sort option
    const sortedProjects = [...filteredProjects].sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      } else if (sortBy === 'oldest') {
        return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      } else {
        return a.name.localeCompare(b.name);
      }
    });

    return (
      <>
        <div className="mb-6" style={{ fontFamily: 'Quicksand, sans-serif' }}>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2" style={{ fontFamily: 'Quicksand, sans-serif' }}>
            My Apps
          </h1>
          <p className="text-gray-600 dark:text-gray-400" style={{ fontFamily: 'Quicksand, sans-serif' }}>
            Create and manage your UI Based apps
          </p>
        </div>

        {/* Enhanced Success Notification */}
        {deleteSuccess && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200/50 dark:border-green-800/50 flex items-center justify-between shadow-lg backdrop-blur-sm" style={{ fontFamily: 'Quicksand, sans-serif' }}>
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center mr-3">
                <Check className="w-5 h-5 text-green-500" />
              </div>
              <div style={{ fontFamily: 'Quicksand, sans-serif' }}>
                <h4 className="font-medium text-green-800 dark:text-green-200" style={{ fontFamily: 'Quicksand, sans-serif' }}>Success!</h4>
                <p className="text-sm text-green-700 dark:text-green-300" style={{ fontFamily: 'Quicksand, sans-serif' }}>{deleteSuccess}</p>
              </div>
            </div>
            <button 
              onClick={() => setDeleteSuccess(null)}
              className="text-green-500 hover:text-green-700 dark:hover:text-green-300 p-2 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-all duration-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        
        {/* Enhanced Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20" style={{ fontFamily: 'Quicksand, sans-serif' }}>
            <div className="relative">
              {/* Animated loader */}
              <div className="w-16 h-16 border-4 border-sakura-200 dark:border-sakura-800 rounded-full animate-spin border-t-sakura-500"></div>
              <div className="absolute inset-0 w-16 h-16 border-4 border-transparent rounded-full animate-ping border-t-sakura-300"></div>
            </div>
            <p className="mt-6 text-gray-600 dark:text-gray-400 font-medium" style={{ fontFamily: 'Quicksand, sans-serif' }}>Loading your agents...</p>
          </div>
        )}
        
        {/* Enhanced Search and Controls */}
        <div className="glassmorphic rounded-2xl p-6 mb-8 border border-white/20 dark:border-gray-700/20" style={{ fontFamily: 'Quicksand, sans-serif' }}>
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
            {/* Search Section */}
            <div className="flex-1 max-w-2xl">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search UI projects by name or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-300 dark:focus:ring-violet-500 focus:border-transparent dark:bg-gray-800/80 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-lg backdrop-blur-sm transition-all duration-200"
                  style={{ fontFamily: 'Quicksand, sans-serif' }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>
            
            {/* Controls Section */}
            <div className="flex items-center gap-4">
              {/* Enhanced Sort Options */}
              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="appearance-none pl-4 pr-10 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-300 dark:focus:ring-violet-500 dark:bg-gray-800/80 dark:text-white backdrop-blur-sm transition-all duration-200 font-medium"
                  style={{ fontFamily: 'Quicksand, sans-serif' }}
                >
                  <option value="newest">📅 Newest First</option>
                  <option value="oldest">⏰ Oldest First</option>
                  <option value="alphabetical">🔤 A to Z</option>
                </select>
                <SlidersHorizontal className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
              
              {/* Enhanced View Options */}
              <div className="hidden sm:flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
                <button className="p-3 rounded-lg bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg">
                  <Grid className="h-4 w-4" />
                </button>
                <button className="p-3 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-gray-700 transition-all duration-200">
                  <Layers className="h-4 w-4" />
                </button>
              </div>
              
              {/* Enhanced Create Button */}
              <button 
                onClick={() => {
                  localStorage.removeItem('current_ui_project');
                  localStorage.setItem('create_new_ui_project', 'true');
                  onPageChange('ui-builder');
                }}
                className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                style={{ fontFamily: 'Quicksand, sans-serif' }}
              >
                <Plus className="h-5 w-5" />
                <span className="hidden sm:inline">Create Project</span>
              </button>
            </div>
          </div>
          
          {/* Search Results Counter */}
          {searchQuery && (
            <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
              <p className="text-sm text-gray-600 dark:text-gray-400" style={{ fontFamily: 'Quicksand, sans-serif' }}>
                Found <span className="font-semibold text-violet-500">{filteredProjects.length}</span> project{filteredProjects.length !== 1 ? 's' : ''} matching "<span className="font-medium">{searchQuery}</span>"
              </p>
            </div>
          )}
        </div>
        
        {/* Loading state */}
        {isLoadingUiProjects && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-sakura-500"></div>
          </div>
        )}
        
        {/* UI Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {!isLoadingUiProjects && sortedProjects.length > 0 ? (
            sortedProjects.map(project => (
              <div 
                key={project.id} 
                className="group glassmorphic rounded-2xl overflow-hidden hover:shadow-2xl hover:shadow-violet-500/10 transition-all duration-300 cursor-pointer transform hover:-translate-y-2 hover:scale-[1.02] relative ui-project-card"
                onClick={() => handleOpenUiProject(project.id)}
              >
                {/* Preview area - show rendered HTML/CSS */}
                <div className="h-40 overflow-hidden bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 relative">
                  {/* Isolated preview container */}
                  <div className="absolute inset-0 overflow-hidden preview-isolation">
                    <div 
                      className="absolute inset-0 p-1"
                      style={{ 
                        fontFamily: 'inherit', // Prevent font inheritance from preview
                        isolation: 'isolate' // CSS isolation
                      }}
                      dangerouslySetInnerHTML={{ 
                        __html: `
                          <style>
                            ${project.cssCode}
                            /* Force contain styles within preview */
                            .preview-container * {
                              font-family: inherit !important;
                            }
                          </style>
                          <div class="preview-container transform scale-50 origin-top-left w-[200%] h-[200%] overflow-hidden">
                            ${project.htmlCode}
                          </div>
                        `
                      }}
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-violet-500/20 dark:to-purple-500/20 opacity-60"></div>
                  
                  {/* Enhanced Preview Label */}
                  <div className="absolute top-3 right-3 px-3 py-1 bg-white/90 dark:bg-gray-900/90 rounded-lg text-xs font-medium text-violet-600 dark:text-violet-400 backdrop-blur-sm" style={{ fontFamily: 'Quicksand, sans-serif' }}>
                    <Layout className="w-3 h-3 inline mr-1" />
                    Preview
                  </div>
                  
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
                
                {/* Enhanced Content Section - Force Font */}
                <div className="p-6" style={{ fontFamily: 'Quicksand, sans-serif' }}>
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-violet-500 dark:group-hover:text-violet-400 transition-colors duration-200" style={{ fontFamily: 'Quicksand, sans-serif' }}>
                      {project.name}
                    </h3>
                    <div className="relative">
                      <button 
                        className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
                        onClick={(e) => toggleMenu(project.id, e)}
                      >
                        <MoreVertical className="h-5 w-5" />
                      </button>
                      
                      {menuOpen === project.id && (
                        <div className="absolute right-0 mt-1 py-2 w-52 rounded-xl shadow-xl z-10 glassmorphic bg-white/95 dark:bg-gray-800/95 border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-md" style={{ fontFamily: 'Quicksand, sans-serif' }}>
                          <button
                            className="flex w-full items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-700/50 transition-colors duration-200"
                            onClick={(e) => handleEditUiProject(project.id, e)}
                            style={{ fontFamily: 'Quicksand, sans-serif' }}
                          >
                            <Edit className="h-4 w-4 mr-3 text-blue-500" />
                            <span>Edit Project</span>
                          </button>
                          <div className="border-t border-gray-200/50 dark:border-gray-700/50 my-1"></div>
                          <button
                            className="flex w-full items-center px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50/80 dark:hover:bg-red-900/30 transition-colors duration-200"
                            onClick={(e) => handleDeleteUiProject(project.id, e)}
                            style={{ fontFamily: 'Quicksand, sans-serif' }}
                          >
                            <Trash2 className="h-4 w-4 mr-3" />
                            <span>Delete Project</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3 leading-relaxed" style={{ fontFamily: 'Quicksand, sans-serif' }}>
                    {project.description || 'No description available for this project.'}
                  </p>
                  
                  {/* Enhanced Footer */}
                  <div className="flex justify-between items-center pt-4 border-t border-gray-200/50 dark:border-gray-700/50" style={{ fontFamily: 'Quicksand, sans-serif' }}>
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 dark:text-gray-400" style={{ fontFamily: 'Quicksand, sans-serif' }}>Last updated</span>
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-300" style={{ fontFamily: 'Quicksand, sans-serif' }}>
                        {new Date(project.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <button 
                      className="px-4 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-lg text-sm font-medium hover:from-violet-600 hover:to-purple-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenUiProject(project.id);
                      }}
                      style={{ fontFamily: 'Quicksand, sans-serif' }}
                    >
                      Open Project
                    </button>
                  </div>
                </div>
                
                {/* Subtle shine effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-pulse transition-opacity duration-300 pointer-events-none"></div>
              </div>
            ))
          ) : !isLoadingUiProjects && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-center" style={{ fontFamily: 'Quicksand, sans-serif' }}>
              <div className="relative mb-8">
                {/* Animated background circles */}
                <div className="absolute inset-0 -m-8">
                  <div className="w-32 h-32 bg-sakura-100 dark:bg-sakura-100/10 rounded-full animate-pulse opacity-60"></div>
                </div>
                <div className="absolute inset-0 -m-4">
                  <div className="w-24 h-24 bg-sakura-200 dark:bg-sakura-200/10 rounded-full animate-pulse opacity-40 animation-delay-1000"></div>
                </div>
                
                {/* Main icon */}
                <div className="relative w-20 h-20 bg-gradient-to-br from-sakura-100 to-pink-100 dark:from-sakura-900/30 dark:to-pink-900/30 rounded-2xl flex items-center justify-center shadow-lg">
                  <Bot className="w-10 h-10 text-sakura-500 animate-bounce" />
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3" style={{ fontFamily: 'Quicksand, sans-serif' }}>
                {searchQuery ? "No projects found" : "Ready to create your first project?"}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-md mb-8 leading-relaxed" style={{ fontFamily: 'Quicksand, sans-serif' }}>
                {searchQuery 
                  ? "Try adjusting your search terms or clear the search to see all projects." 
                  : "Build stunning apps with Clara's powerful visual editor. Create workflows, automations, and custom AI assistants."
                }
              </p>
              
              <div className="flex gap-4">
                {searchQuery ? (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl transition-all duration-200 font-medium"
                    style={{ fontFamily: 'Quicksand, sans-serif' }}
                  >
                    <X className="h-4 w-4" />
                    Clear search
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={() => {
                        localStorage.removeItem('current_ui_project');
                        localStorage.setItem('create_new_ui_project', 'true');
                        onPageChange('ui-builder');
                      }}
                      className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sakura-500 to-pink-500 hover:from-sakura-600 hover:to-pink-600 text-white rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                      style={{ fontFamily: 'Quicksand, sans-serif' }}
                    >
                      <Plus className="h-5 w-5" />
                      Create First Project
                    </button>
                    <button 
                      onClick={() => setActiveTab('community')}
                      className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl transition-all duration-200 font-medium border border-gray-200 dark:border-gray-700"
                      style={{ fontFamily: 'Quicksand, sans-serif' }}
                    >
                      <Globe className="h-5 w-5" />
                      Explore Community
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <>
      {/* Wallpaper */}
      {wallpaperUrl && (
        <div 
          className="fixed top-0 left-0 right-0 bottom-0 z-0"
          style={{
            backgroundImage: `url(${wallpaperUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.1,
            filter: 'blur(1px)',
            pointerEvents: 'none'
          }}
        />
      )}
      <div className="h-[calc(100vh-theme(spacing.16)-theme(spacing.12))] overflow-y-auto relative z-10 apps-component">
        {/* Enhanced Header Section */}
        <div className="mb-8">
          <div className="text-center mb-6 pt-4">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
              <span className="bg-gradient-to-r from-sakura-500 via-pink-500 to-purple-500 bg-clip-text text-transparent">
                Your Creative Workspace
              </span>
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Build powerful agents, create stunning apps, and explore community creations
            </p>
          </div>

          {/* Enhanced Tabs */}
          <div className="flex justify-center mb-6">
            <div className="glassmorphic rounded-2xl p-2 border border-white/20 dark:border-gray-700/20">
              <div className="flex space-x-1">
                <button
                  onClick={() => setActiveTab('myApps')}
                  className={`relative px-6 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${
                    activeTab === 'myApps'
                      ? 'bg-gradient-to-r from-sakura-500 to-pink-500 text-white shadow-lg shadow-sakura-500/25'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <Bot className="w-4 h-4 inline mr-2" />
                  My Agents
                </button>
                <button
                  onClick={() => setActiveTab('uiApps')}
                  className={`relative px-6 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${
                    activeTab === 'uiApps'
                      ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white shadow-lg shadow-violet-500/25'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <Layout className="w-4 h-4 inline mr-2" />
                  My Apps
                </button>
                <button
                  onClick={() => setActiveTab('community')}
                  className={`relative px-6 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${
                    activeTab === 'community'
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-800/50'
                  }`}
                >
                  <Globe className="w-4 h-4 inline mr-2" />
                  Community
                </button>
              </div>
            </div>
          </div>
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
                Create and manage your UI Based apps
              </p>
            </div>
            
            {/* Enhanced Search and Controls */}
            <div className="glassmorphic rounded-2xl p-6 mb-8 border border-white/20 dark:border-gray-700/20">
              <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6">
                {/* Search Section */}
                <div className="flex-1 max-w-2xl">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search agents by name or description..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-6 py-4 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-sakura-300 dark:focus:ring-sakura-500 focus:border-transparent dark:bg-gray-800/80 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-lg backdrop-blur-sm transition-all duration-200"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Controls Section */}
                <div className="flex items-center gap-4">
                  {/* Enhanced Sort Options */}
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="appearance-none pl-4 pr-10 py-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-sakura-300 dark:focus:ring-sakura-500 dark:bg-gray-800/80 dark:text-white backdrop-blur-sm transition-all duration-200 font-medium"
                    >
                      <option value="newest">📅 Newest First</option>
                      <option value="oldest">⏰ Oldest First</option>
                      <option value="alphabetical">🔤 A to Z</option>
                    </select>
                    <SlidersHorizontal className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                  
                  {/* Enhanced View Options */}
                  <div className="hidden sm:flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
                    <button className="p-3 rounded-lg bg-gradient-to-r from-sakura-500 to-pink-500 text-white shadow-lg">
                      <Grid className="h-4 w-4" />
                    </button>
                    <button className="p-3 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white dark:hover:bg-gray-700 transition-all duration-200">
                      <Layers className="h-4 w-4" />
                    </button>
                  </div>
                  
                  {/* Enhanced Create Button */}
                  <button 
                    onClick={handleCreateApp}
                    className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-sakura-500 to-pink-500 hover:from-sakura-600 hover:to-pink-600 text-white rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                  >
                    <Plus className="h-5 w-5" />
                    <span className="hidden sm:inline">Create Agent</span>
                  </button>
                </div>
              </div>
              
              {/* Search Results Counter */}
              {searchQuery && (
                <div className="mt-4 pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Found <span className="font-semibold text-sakura-500">{filteredApps.length}</span> agent{filteredApps.length !== 1 ? 's' : ''} matching "<span className="font-medium">{searchQuery}</span>"
                  </p>
                </div>
              )}
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
                      className="group glassmorphic rounded-2xl overflow-hidden hover:shadow-2xl hover:shadow-sakura-500/10 transition-all duration-300 cursor-pointer transform hover:-translate-y-2 hover:scale-[1.02] relative"
                      onClick={() => handleOpenApp(app.id)}
                    >
                      {/* Enhanced App Icon Section */}
                      <div 
                        className="h-40 flex items-center justify-center relative overflow-hidden" 
                        style={{ 
                          background: `linear-gradient(135deg, ${app.color || '#3B82F6'}, ${app.color ? app.color + '90' : '#1E40AF'})` 
                        }}
                      >
                        {/* Background pattern */}
                        <div className="absolute inset-0 opacity-10">
                          <div className="absolute top-4 right-4 w-16 h-16 rounded-full bg-white/20"></div>
                          <div className="absolute bottom-4 left-4 w-8 h-8 rounded-full bg-white/20"></div>
                          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-white/5"></div>
                        </div>
                        
                        {/* Icon with enhanced styling */}
                        <div className="relative z-10 p-4 rounded-2xl bg-white/10 backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
                          <IconComponent className="h-12 w-12 text-white drop-shadow-lg" />
                        </div>
                        
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </div>
                      
                      {/* Enhanced Content Section */}
                      <div className="p-6">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-white group-hover:text-sakura-500 dark:group-hover:text-sakura-400 transition-colors duration-200">
                            {app.name}
                          </h3>
                          <div className="relative">
                            <button 
                              className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200"
                              onClick={(e) => toggleMenu(app.id, e)}
                            >
                              <MoreVertical className="h-5 w-5" />
                            </button>
                            
                            {menuOpen === app.id && (
                              <div className="absolute right-0 mt-1 py-2 w-52 rounded-xl shadow-xl z-10 glassmorphic bg-white/95 dark:bg-gray-800/95 border border-gray-200/50 dark:border-gray-700/50 backdrop-blur-md">
                                <button
                                  className="flex w-full items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-700/50 transition-colors duration-200"
                                  onClick={(e) => handleEditApp(app.id, e)}
                                >
                                  <Edit className="h-4 w-4 mr-3 text-blue-500" />
                                  <span>Edit Agent</span>
                                </button>
                                <button
                                  className="flex w-full items-center px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100/80 dark:hover:bg-gray-700/50 transition-colors duration-200"
                                  onClick={(e) => handleDuplicateApp(app.id, e)}
                                >
                                  <Copy className="h-4 w-4 mr-3 text-green-500" />
                                  <span>Duplicate Agent</span>
                                </button>
                                <div className="border-t border-gray-200/50 dark:border-gray-700/50 my-1"></div>
                                <button
                                  className="flex w-full items-center px-4 py-3 text-sm text-red-600 dark:text-red-400 hover:bg-red-50/80 dark:hover:bg-red-900/30 transition-colors duration-200"
                                  onClick={(e) => handleDeleteApp(app.id, e)}
                                >
                                  <Trash2 className="h-4 w-4 mr-3" />
                                  <span>Delete Agent</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3 leading-relaxed">
                          {app.description || 'No description available for this agent.'}
                        </p>
                        
                        {/* Enhanced Footer */}
                        <div className="flex justify-between items-center pt-4 border-t border-gray-200/50 dark:border-gray-700/50">
                          <div className="flex flex-col">
                            <span className="text-xs text-gray-500 dark:text-gray-400">Last updated</span>
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                              {new Date(app.updatedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <button 
                            className="px-4 py-2 bg-gradient-to-r from-sakura-500 to-pink-500 text-white rounded-lg text-sm font-medium hover:from-sakura-600 hover:to-pink-600 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenApp(app.id);
                            }}
                          >
                            Open Agent
                          </button>
                        </div>
                      </div>
                      
                      {/* Subtle shine effect on hover */}
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-pulse transition-opacity duration-300 pointer-events-none"></div>
                    </div>
                  );
                })
              ) : !isLoading && (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-center">
                  <div className="relative mb-8">
                    {/* Animated background circles */}
                    <div className="absolute inset-0 -m-8">
                      <div className="w-32 h-32 bg-sakura-100 dark:bg-sakura-100/10 rounded-full animate-pulse opacity-60"></div>
                    </div>
                    <div className="absolute inset-0 -m-4">
                      <div className="w-24 h-24 bg-sakura-200 dark:bg-sakura-200/10 rounded-full animate-pulse opacity-40 animation-delay-1000"></div>
                    </div>
                    
                    {/* Main icon */}
                    <div className="relative w-20 h-20 bg-gradient-to-br from-sakura-100 to-pink-100 dark:from-sakura-900/30 dark:to-pink-900/30 rounded-2xl flex items-center justify-center shadow-lg">
                      <Bot className="w-10 h-10 text-sakura-500 animate-bounce" />
                    </div>
                  </div>
                  
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    {searchQuery ? "No agents found" : "Ready to create your first agent?"}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 max-w-md mb-8 leading-relaxed">
                    {searchQuery 
                      ? "Try adjusting your search terms or clear the search to see all agents." 
                      : "Build intelligent agents with Clara's powerful visual editor. Create workflows, automations, and custom AI assistants."
                    }
                  </p>
                  
                  <div className="flex gap-4">
                    {searchQuery ? (
                      <button 
                        onClick={() => setSearchQuery('')}
                        className="flex items-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl transition-all duration-200 font-medium"
                      >
                        <X className="h-4 w-4" />
                        Clear search
                      </button>
                    ) : (
                      <>
                        <button 
                          onClick={handleCreateApp}
                          className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-sakura-500 to-pink-500 hover:from-sakura-600 hover:to-pink-600 text-white rounded-xl transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                          <Plus className="h-5 w-5" />
                          Create First Agent
                        </button>
                        <button 
                          onClick={() => setActiveTab('community')}
                          className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl transition-all duration-200 font-medium border border-gray-200 dark:border-gray-700"
                        >
                          <Globe className="h-5 w-5" />
                          Explore Community
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : activeTab === 'community' ? (
          renderCommunityContent()
        ) : (
          renderUiBuilderContent()
        )}
      </div>
    </>
  );
};

export default Apps;