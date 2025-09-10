import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Upload, 
  MessageSquare, 
  Package, 
  Image, 
  FileText, 
  Code2, 
  Search,
  Loader2,
  Database,
  Settings,
  Share2,
  Clock,
  X,
  Heart,
  Download,
  Eye,
  ExternalLink
} from 'lucide-react';
import { CommunityService, LocalUserManager, CommunityResource } from '../services/communityService';
import UserSetupModal from './UserSetupModal';
import ResourceDetailModal from './ResourceDetailModal';
import { localContentService, LocalContent } from '../services/localContentService';

const Community: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'downloads'>('recent');
  const [activeTab, setActiveTab] = useState<'local' | 'shared'>('local');
  
  // User and setup state
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string } | null>(null);
  const [showUserSetup, setShowUserSetup] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Local content state
  const [localContent, setLocalContent] = useState<LocalContent[]>([]);
  const [loadingLocalContent, setLoadingLocalContent] = useState(false);
  const [selectedContent, setSelectedContent] = useState<string[]>([]);
  const [isSharing, setIsSharing] = useState(false);
  
  // Community shared content state
  const [sharedResources, setSharedResources] = useState<any[]>([]);
  const [loadingSharedContent, setLoadingSharedContent] = useState(false);
  
  // Resource detail modal state
  const [selectedResource, setSelectedResource] = useState<CommunityResource | null>(null);
  const [showResourceDetail, setShowResourceDetail] = useState(false);
  
  // Interaction states
  const [likedResources, setLikedResources] = useState<Set<string>>(new Set());
  const [downloadingResources, setDownloadingResources] = useState<Set<string>>(new Set());
  
  // Toast state
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ show: false, message: '', type: 'info' });

  // Check Supabase connection and user on mount
  useEffect(() => {
    const checkSetup = async () => {
      try {
        // Check if user exists locally
        const user = LocalUserManager.getCurrentUser();
        setCurrentUser(user);

        // Try to connect to Supabase and get stats
        await CommunityService.getCommunityStats();
        setSupabaseConnected(true);
      } catch (error) {
        console.log('Supabase not configured yet:', error);
        setSupabaseConnected(false);
      } finally {
        setLoading(false);
      }
    };

    checkSetup();
  }, []);

  // Load content based on active tab
  useEffect(() => {
    if (supabaseConnected) {
      if (activeTab === 'local') {
        loadLocalContent();
      } else if (activeTab === 'shared') {
        loadSharedResources();
      }
    }
  }, [supabaseConnected, activeTab, searchQuery, selectedCategory]);

  // Auto-hide toast
  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, 5000); // Hide after 5 seconds

      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  const loadLocalContent = async () => {
    setLoadingLocalContent(true);
    try {
      const content = await localContentService.getAllLocalContent();
      console.log('Loaded local content:', content);
      console.log('Image items:', content.filter(item => item.category === 'image'));
      setLocalContent(content);
    } catch (error) {
      console.error('Error loading local content:', error);
    } finally {
      setLoadingLocalContent(false);
    }
  };

  const loadSharedResources = async () => {
    setLoadingSharedContent(true);
    try {
      const resources = await CommunityService.getResources({
        search: searchQuery || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        limit: 50
      });
      console.log('Loaded shared resources:', resources);
      setSharedResources(resources);
      
      // Check which resources are liked by current user
      if (currentUser) {
        checkUserLikes(resources.map(r => r.id));
      }
    } catch (error) {
      console.error('Error loading shared resources:', error);
      setToast({
        show: true,
        message: 'Failed to load community resources',
        type: 'error'
      });
    } finally {
      setLoadingSharedContent(false);
    }
  };

  const checkUserLikes = async (resourceIds: string[]) => {
    try {
      const likedResourceIds = await CommunityService.checkUserLikes(resourceIds);
      setLikedResources(likedResourceIds);
    } catch (error) {
      console.error('Error checking user likes:', error);
      setLikedResources(new Set());
    }
  };

  const handleShareResource = () => {
    if (!currentUser) {
      setShowUserSetup(true);
    } else {
      // Switch to local tab to show content to share
      setActiveTab('local');
    }
  };

  const handleUserCreated = (user: { id: string; username: string }) => {
    setCurrentUser(user);
    setShowUserSetup(false);
  };

  const handleShareSelected = async () => {
    if (selectedContent.length === 0) return;
    
    if (!currentUser) {
      setShowUserSetup(true);
      return;
    }

    try {
      setIsSharing(true);
      
      // Get the selected content items
      const itemsToShare = localContent.filter(item => selectedContent.includes(item.id));
      
      console.log('Sharing content:', itemsToShare);
      
      // Share each selected item
      const sharePromises = itemsToShare.map(async (item) => {
        try {
          // Skip if already shared
          if (item.isShared) {
            console.log('Skipping already shared item:', item.title);
            return null;
          }
          
          // Map local categories to community categories
          let communityCategory: 'mcp-server' | 'prompt' | 'custom-node' | 'wallpaper' | 'workflow' | 'tutorial' | 'tool' | 'template';
          switch (item.category) {
            case 'custom-node':
              communityCategory = 'custom-node';
              break;
            case 'image':
              communityCategory = 'wallpaper'; // Map images to wallpaper category
              break;
            default:
              communityCategory = 'tool'; // Default fallback
          }
          
          const result = await CommunityService.createResource({
            title: item.title,
            description: item.description,
            category: communityCategory,
            tags: [item.category], // Use original category as tag
            content: item.content || '',
            content_type: item.category === 'image' ? 'image/base64' : 'text/plain',
            thumbnail_url: item.thumbnailUrl,
            version: '1.0.0'
          });
          
          // Mark as shared in local storage
          await localContentService.markAsShared(item.id, result.id);
          
          console.log('Shared item:', item.title, 'Result:', result);
          return result;
        } catch (error) {
          console.error('Error sharing item:', item.title, error);
          throw error;
        }
      });
      
      // Wait for all items to be shared (filter out nulls for already shared items)
      const results = await Promise.all(sharePromises);
      const successfulShares = results.filter(result => result !== null);
      
      // Clear selection and show success message
      setSelectedContent([]);
      setToast({
        show: true,
        message: `Successfully shared ${successfulShares.length} ${successfulShares.length === 1 ? 'item' : 'items'} to the community!`,
        type: 'success'
      });
      
      // Reload local content to update isShared status
      await loadLocalContent();
      
    } catch (error) {
      console.error('Error sharing content:', error);
      setToast({
        show: true,
        message: 'Failed to share content. Please try again.',
        type: 'error'
      });
    } finally {
      setIsSharing(false);
    }
  };

  const toggleContentSelection = (contentId: string) => {
    setSelectedContent(prev => 
      prev.includes(contentId) 
        ? prev.filter(id => id !== contentId)
        : [...prev, contentId]
    );
  };

  const handleUnshareContent = async (contentId: string) => {
    if (!window.confirm('Are you sure you want to remove this content from the community? This action cannot be undone.')) {
      return;
    }

    try {
      setIsSharing(true);
      
      // Get the community resource ID
      const communityResourceId = await localContentService.getCommunityResourceId(contentId);
      
      if (!communityResourceId) {
        throw new Error('Community resource ID not found');
      }

      // Delete from Supabase
      await CommunityService.deleteResource(communityResourceId);
      
      // Remove from local shared list
      await localContentService.unmarkAsShared(contentId);
      
      // Reload local content to update UI
      await loadLocalContent();
      
      setToast({
        show: true,
        message: 'Content successfully removed from the community',
        type: 'success'
      });
      
    } catch (error) {
      console.error('Error unsharing content:', error);
      setToast({
        show: true,
        message: 'Failed to remove content from community. Please try again.',
        type: 'error'
      });
    } finally {
      setIsSharing(false);
    }
  };

  const handleResourceClick = (resource: CommunityResource) => {
    setSelectedResource(resource);
    setShowResourceDetail(true);
  };

  const handleResourceLike = async (e: React.MouseEvent, resourceId: string) => {
    e.stopPropagation(); // Prevent opening detail modal
    
    if (!currentUser) {
      setShowUserSetup(true);
      return;
    }

    try {
      const result = await CommunityService.toggleLike(resourceId);
      
      // Update liked resources set
      const newLikedResources = new Set(likedResources);
      if (result.liked) {
        newLikedResources.add(resourceId);
      } else {
        newLikedResources.delete(resourceId);
      }
      setLikedResources(newLikedResources);
      
      // Update the resource in the list
      setSharedResources(prev => 
        prev.map(resource => 
          resource.id === resourceId 
            ? { ...resource, likes_count: result.likesCount }
            : resource
        )
      );
    } catch (error) {
      console.error('Error toggling like:', error);
      setToast({
        show: true,
        message: 'Failed to update like. Please try again.',
        type: 'error'
      });
    }
  };

  const handleResourceDownload = async (e: React.MouseEvent, resource: CommunityResource) => {
    e.stopPropagation(); // Prevent opening detail modal
    
    try {
      setDownloadingResources(prev => new Set(prev).add(resource.id));
      
      // Track download
      await CommunityService.incrementDownloads(resource.id);
      
      // Handle different content types
      if (resource.content_type === 'image/base64' && resource.content) {
        // Download image
        const link = document.createElement('a');
        link.href = resource.content;
        link.download = `${resource.title}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (resource.download_url) {
        // Open download URL
        window.open(resource.download_url, '_blank');
      } else if (resource.content) {
        // Download text content
        const blob = new Blob([resource.content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${resource.title}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      
      // Update download count in the list
      setSharedResources(prev => 
        prev.map(r => 
          r.id === resource.id 
            ? { ...r, downloads_count: r.downloads_count + 1 }
            : r
        )
      );
      
      setToast({
        show: true,
        message: 'Resource downloaded successfully!',
        type: 'success'
      });
    } catch (error) {
      console.error('Error downloading resource:', error);
      setToast({
        show: true,
        message: 'Failed to download resource. Please try again.',
        type: 'error'
      });
    } finally {
      setDownloadingResources(prev => {
        const newSet = new Set(prev);
        newSet.delete(resource.id);
        return newSet;
      });
    }
  };

  const getFilteredContent = () => {
    let filtered = localContent;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(item => item.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
        case 'popular':
          // For local content, sort by title as proxy
          return a.title.localeCompare(b.title);
        case 'downloads':
          // For local content, sort by category then title
          if (a.category !== b.category) {
            return a.category.localeCompare(b.category);
          }
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

    return filtered;
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'custom-node': return Code2;
      case 'image': return Image;
      case 'wallpaper': return Image; // Map wallpaper to image icon
      case 'tool': return Package;
      case 'template': return FileText;
      // TODO: Add back when ready
      // case 'prompt': return FileText;
      // case 'workflow': return Package;
      // case 'mcp-server': return Package;
      // case 'tutorial': return FileText;
      default: return FileText;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'custom-node': return 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30';
      case 'image': return 'text-pink-600 dark:text-pink-400 bg-pink-100 dark:bg-pink-900/30';
      case 'wallpaper': return 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30';
      case 'tool': return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30';
      case 'template': return 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30';
      // TODO: Add back when ready
      // case 'prompt': return 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30';
      // case 'workflow': return 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30';
      // case 'mcp-server': return 'text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/30';
      // case 'tutorial': return 'text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30';
      default: return 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30';
    }
  };

  const categories = [
    { id: 'all', name: 'All', icon: Users },
    { id: 'custom-node', name: 'Custom Nodes', icon: Code2 },
    { id: 'image', name: 'Generated Images', icon: Image },
    { id: 'wallpaper', name: 'Wallpapers', icon: Image },
    { id: 'tool', name: 'Tools', icon: Package }
    // TODO: Add back when ready
    // { id: 'prompt', name: 'Prompts', icon: FileText },
    // { id: 'mcp-server', name: 'MCP Servers', icon: Package },
    // { id: 'workflow', name: 'Workflows', icon: Package },
    // { id: 'tutorial', name: 'Tutorials', icon: FileText }
  ];

  const filteredContent = getFilteredContent();

  return (
    <div className="h-[calc(100vh-theme(spacing.16)-theme(spacing.1))] bg-white dark:bg-black flex flex-col overflow-hidden">
      {/* Fixed Header */}
      <div className="glassmorphic border-b border-white/20 dark:border-gray-800/50 flex-shrink-0 z-10">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-6 h-6 text-sakura-500" />
                Community
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Discover, share, and collaborate on Clara resources
              </p>
            </div>
            <div className="flex gap-3">
              {supabaseConnected && activeTab === 'local' && selectedContent.length > 0 && (
                <button 
                  onClick={handleShareSelected}
                  disabled={isSharing}
                  className="px-4 py-2 glassmorphic bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSharing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sharing...
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" />
                      Share Selected ({selectedContent.length})
                    </>
                  )}
                </button>
              )}
              <button 
                onClick={handleShareResource}
                disabled={!supabaseConnected}
                className="px-4 py-2 glassmorphic bg-sakura-500 text-white rounded-xl hover:bg-sakura-600 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                Share Resource
              </button>
              <button 
                disabled={!supabaseConnected}
                className="px-4 py-2 glassmorphic border border-white/20 dark:border-gray-600/30 rounded-xl hover:bg-white/10 dark:hover:bg-gray-700/30 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <MessageSquare className="w-4 h-4" />
                Discussions
              </button>
            </div>
          </div>

          {/* Tabs */}
          {supabaseConnected && (
            <div className="flex gap-1 bg-white/20 dark:bg-gray-800/30 rounded-xl p-1 mb-4">
              <button
                onClick={() => setActiveTab('local')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                  activeTab === 'local'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-md'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Package className="w-4 h-4" />
                My Content ({localContent.length})
              </button>
              <button
                onClick={() => setActiveTab('shared')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                  activeTab === 'shared'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-md'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                Community Shared
              </button>
            </div>
          )}

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={activeTab === 'local' ? "Search your content..." : "Search community resources..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={!supabaseConnected}
                className="w-full pl-10 pr-4 py-2.5 glassmorphic border border-white/20 dark:border-gray-600/30 rounded-xl bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-sakura-500 focus:border-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              disabled={!supabaseConnected}
              className="px-4 py-2.5 glassmorphic border border-white/20 dark:border-gray-600/30 rounded-xl bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-sakura-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="recent">Most Recent</option>
              <option value="popular">Most Popular</option>
              <option value="downloads">Most Downloaded</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 shrink-0 p-4">
          <div className="glassmorphic rounded-xl p-4 space-y-4 sticky top-4 h-[calc(100vh-10rem)] flex flex-col">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex-shrink-0">Categories</h3>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 pb-4">
              <div className="space-y-1 mb-6">
                {categories.map((category) => {
                  const IconComponent = category.icon;
                  const categoryCount = activeTab === 'local' 
                    ? localContent.filter(item => category.id === 'all' || item.category === category.id).length
                    : 0;
                  
                  return (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      disabled={!supabaseConnected}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                        selectedCategory === category.id
                          ? 'glassmorphic bg-sakura-100/50 text-sakura-700 dark:bg-sakura-900/30 dark:text-sakura-200 shadow-md'
                          : 'text-gray-700 dark:text-gray-300 hover:glassmorphic hover:bg-white/30 dark:hover:bg-gray-700/30'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <IconComponent className="w-4 h-4" />
                        {category.name}
                      </div>
                      {activeTab === 'local' && categoryCount > 0 && (
                        <span className="text-xs bg-white/50 dark:bg-gray-700/50 rounded-full px-2 py-0.5">
                          {categoryCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Connection Status */}
              <div className="glassmorphic p-4 rounded-xl border border-white/20 dark:border-gray-700/30 bg-gradient-to-br from-white/20 to-white/5 dark:from-gray-800/20 dark:to-gray-900/5">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Database className="w-4 h-4 text-sakura-500" />
                  Database Status
                </h4>
                {loading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Checking connection...</span>
                  </div>
                ) : supabaseConnected ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span>Connected to Supabase</span>
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">
                      {activeTab === 'local' ? 'Ready to share your content!' : 'Community features are ready!'}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
                      <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      <span>Database setup required</span>
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">
                      Configure Supabase to enable community features
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="h-full overflow-y-auto custom-scrollbar">
            <div className="p-6">
              {loading ? (
                /* Loading State */
                <div className="flex items-center justify-center py-20">
                  <div className="glassmorphic p-8 rounded-2xl flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 animate-spin text-sakura-500" />
                    <p className="text-gray-600 dark:text-gray-400 font-medium">Initializing Community...</p>
                  </div>
                </div>
              ) : !supabaseConnected ? (
                /* Setup Required State */
                <div className="flex items-center justify-center py-20">
                  <div className="glassmorphic p-12 rounded-2xl max-w-lg text-center border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10">
                    <div className="p-4 bg-orange-100 dark:bg-orange-900/30 rounded-2xl inline-block mb-6">
                      <Settings className="w-16 h-16 text-orange-600 dark:text-orange-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                      Database Setup Required
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                      The ClaraVerse Community requires Supabase database configuration. 
                      Please set up your Supabase project and update the environment variables.
                    </p>
                    <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4 mb-6 text-left">
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Quick Setup:</h3>
                      <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <li>1. Create a Supabase project</li>
                        <li>2. Run the SQL migration</li>
                        <li>3. Update your .env file</li>
                        <li>4. Restart the application</li>
                      </ol>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      See <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">COMMUNITY_SETUP.md</code> for detailed instructions
                    </p>
                  </div>
                </div>
              ) : activeTab === 'local' ? (
                /* Local Content View */
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">My Content</h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Select content from your local ClaraVerse to share with the community
                      </p>
                    </div>
                    {localContent.length > 0 && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {filteredContent.length} of {localContent.length} items
                      </div>
                    )}
                  </div>
                  
                  {loadingLocalContent ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="glassmorphic p-8 rounded-2xl flex flex-col items-center gap-4">
                        <Loader2 className="w-12 h-12 animate-spin text-sakura-500" />
                        <p className="text-gray-600 dark:text-gray-400 font-medium">Scanning your local content...</p>
                      </div>
                    </div>
                  ) : filteredContent.length === 0 ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="glassmorphic p-12 rounded-2xl max-w-lg text-center">
                        <div className="p-4 bg-sakura-100 dark:bg-sakura-900/30 rounded-2xl inline-block mb-6">
                          <Package className="w-16 h-16 text-sakura-600 dark:text-sakura-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                          {searchQuery ? 'No matching content found' : 'No local content detected'}
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                          {searchQuery 
                            ? 'Try adjusting your search terms or category filter.'
                            : 'Create some custom nodes, prompts, or generate images to see them here for sharing.'
                          }
                        </p>
                        {!searchQuery && (
                          <div className="bg-white/50 dark:bg-gray-800/50 rounded-lg p-4 text-left">
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Create content to share:</h3>
                            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                              <li>• Build custom nodes in Agent Builder</li>
                              <li>• Save prompts in Clara Assistant</li>
                              <li>• Generate images in Image Gen</li>
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Content Grid */
                    <div className="space-y-4">
                      {selectedContent.length > 0 && (
                        <div className="glassmorphic p-4 rounded-xl bg-green-50/50 dark:bg-green-900/10 border border-green-200 dark:border-green-800">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                                {selectedContent.length} item{selectedContent.length !== 1 ? 's' : ''} selected for sharing
                              </span>
                            </div>
                            <button
                              onClick={() => setSelectedContent([])}
                              className="text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                            >
                              Clear selection
                            </button>
                          </div>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredContent.map((item) => {
                          const IconComponent = getCategoryIcon(item.category);
                          const isSelected = selectedContent.includes(item.id);
                          const isShared = item.isShared;
                          
                          return (
                            <div
                              key={item.id}
                              className={`glassmorphic rounded-xl p-6 border transition-all duration-200 hover:shadow-xl ${
                                isShared
                                  ? 'border-green-300 dark:border-green-600 bg-green-50/50 dark:bg-green-900/20'
                                  : isSelected 
                                  ? 'border-sakura-300 dark:border-sakura-600 bg-sakura-50/50 dark:bg-sakura-900/20 shadow-md cursor-pointer' 
                                  : 'border-white/20 dark:border-gray-700/30 hover:border-sakura-200 dark:hover:border-sakura-700 cursor-pointer'
                              }`}
                              onClick={() => !isShared && toggleContentSelection(item.id)}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className={`p-2 rounded-lg ${getCategoryColor(item.category)}`}>
                                  <IconComponent className="w-5 h-5" />
                                </div>
                                <div className="flex items-center gap-2">
                                  {isShared ? (
                                    <div className="flex items-center gap-2">
                                      <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">Shared</span>
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUnshareContent(item.id);
                                        }}
                                        disabled={isSharing}
                                        className="p-1 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all duration-200 disabled:opacity-50"
                                        title="Remove from community"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : isSelected ? (
                                    <div className="w-5 h-5 bg-sakura-500 rounded-full flex items-center justify-center">
                                      <div className="w-2 h-2 bg-white rounded-full"></div>
                                    </div>
                                  ) : null}
                                  <span className="text-xs px-2 py-1 bg-white/50 dark:bg-gray-700/50 rounded-full text-gray-600 dark:text-gray-400 capitalize">
                                    {item.category.replace('-', ' ')}
                                  </span>
                                </div>
                              </div>
                              
                              {/* Show image thumbnail for image category */}
                              {item.category === 'image' && item.thumbnailUrl && (
                                <div className="mb-3 rounded-lg overflow-hidden">
                                  <img 
                                    src={item.thumbnailUrl} 
                                    alt={item.title}
                                    className="w-full h-32 object-cover hover:scale-105 transition-transform duration-200"
                                    loading="lazy"
                                  />
                                </div>
                              )}
                              
                              <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
                                {item.title}
                              </h3>
                              
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3">
                                {item.description}
                              </p>
                              
                              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>{new Date(item.lastModified).toLocaleDateString()}</span>
                                </div>
                                {item.isShared ? (
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1 text-green-500">
                                      <Share2 className="w-3 h-3" />
                                      <span>Shared</span>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleUnshareContent(item.id);
                                      }}
                                      disabled={isSharing}
                                      className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Remove from community"
                                    >
                                      {isSharing ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <X className="w-3 h-3" />
                                      )}
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Community Shared Content */
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-white">Community Resources</h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Discover and download resources shared by the ClaraVerse community
                      </p>
                    </div>
                    {sharedResources.length > 0 && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {sharedResources.length} resources available
                      </div>
                    )}
                  </div>
                  
                  {loadingSharedContent ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="glassmorphic p-8 rounded-2xl flex flex-col items-center gap-4">
                        <Loader2 className="w-12 h-12 animate-spin text-sakura-500" />
                        <p className="text-gray-600 dark:text-gray-400 font-medium">Loading community resources...</p>
                      </div>
                    </div>
                  ) : sharedResources.length === 0 ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="glassmorphic p-12 rounded-2xl max-w-lg text-center">
                        <div className="p-4 bg-sakura-100 dark:bg-sakura-900/30 rounded-2xl inline-block mb-6">
                          <Users className="w-16 h-16 text-sakura-600 dark:text-sakura-400" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                          {searchQuery ? 'No matching resources found' : 'No community resources yet'}
                        </h2>
                        <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
                          {searchQuery 
                            ? 'Try adjusting your search terms or category filter.'
                            : 'Be the first to share your content with the community! Start by sharing your local resources.'
                          }
                        </p>
                        {!searchQuery && (
                          <button
                            onClick={() => setActiveTab('local')}
                            className="px-6 py-3 bg-sakura-500 hover:bg-sakura-600 text-white rounded-xl transition-all duration-200 font-medium flex items-center gap-2 mx-auto shadow-lg hover:shadow-xl"
                          >
                            <Package className="w-5 h-5" />
                            Share My Content
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {sharedResources.map((resource) => {
                        const IconComponent = getCategoryIcon(resource.category);
                        const isLiked = likedResources.has(resource.id);
                        const isDownloading = downloadingResources.has(resource.id);
                        
                        return (
                          <div
                            key={resource.id}
                            onClick={() => handleResourceClick(resource)}
                            className="glassmorphic rounded-xl p-6 border border-white/20 dark:border-gray-700/30 hover:border-sakura-200 dark:hover:border-sakura-700 transition-all duration-200 hover:shadow-xl cursor-pointer group flex flex-col h-full"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className={`p-2 rounded-lg ${getCategoryColor(resource.category)}`}>
                                <IconComponent className="w-5 h-5" />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs px-2 py-1 bg-white/50 dark:bg-gray-700/50 rounded-full text-gray-600 dark:text-gray-400 capitalize">
                                  {resource.category.replace('-', ' ')}
                                </span>
                              </div>
                            </div>
                            
                            {/* Show image thumbnail for wallpaper category */}
                            {resource.category === 'wallpaper' && resource.thumbnail_url && (
                              <div className="mb-3 rounded-lg overflow-hidden">
                                <img 
                                  src={resource.thumbnail_url} 
                                  alt={resource.title}
                                  className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-200"
                                  loading="lazy"
                                />
                              </div>
                            )}
                            
                            <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
                              {resource.title}
                            </h3>
                            
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-3 flex-grow">
                              {resource.description}
                            </p>
                            
                            {/* Resource Stats */}
                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{new Date(resource.created_at).toLocaleDateString()}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1">
                                  <Eye className="w-3 h-3" />
                                  <span>{resource.views_count}</span>
                                </div>
                                <span className="text-xs text-gray-400">by {resource.author_username}</span>
                              </div>
                            </div>

                            {/* Interactive Buttons - Always at bottom */}
                            <div className="flex items-center justify-between pt-3 border-t border-white/10 dark:border-gray-700/30 mt-auto">
                              <div className="flex items-center gap-2">
                                {/* Like Button */}
                                <button
                                  onClick={(e) => handleResourceLike(e, resource.id)}
                                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 ${
                                    isLiked
                                      ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                      : 'bg-white/20 dark:bg-gray-700/30 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-600 dark:text-gray-400 hover:text-red-500'
                                  }`}
                                  title={isLiked ? 'Unlike' : 'Like'}
                                >
                                  <Heart className={`w-3 h-3 ${isLiked ? 'fill-current' : ''}`} />
                                  <span>{resource.likes_count}</span>
                                </button>

                                {/* View Details Button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResourceClick(resource);
                                  }}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-white/20 dark:bg-gray-700/30 hover:bg-sakura-50 dark:hover:bg-sakura-900/20 text-gray-600 dark:text-gray-400 hover:text-sakura-600 transition-all duration-200"
                                  title="View details"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Details</span>
                                </button>
                              </div>

                              {/* Download Button */}
                              <button
                                onClick={(e) => handleResourceDownload(e, resource)}
                                disabled={isDownloading}
                                className="flex items-center gap-1 px-3 py-1.5 bg-sakura-500 hover:bg-sakura-600 disabled:bg-gray-400 text-white rounded-lg text-xs transition-all duration-200 font-medium disabled:cursor-not-allowed"
                                title="Download resource"
                              >
                                {isDownloading ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>Downloading...</span>
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-3 h-3" />
                                    <span>{resource.downloads_count}</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* User Setup Modal */}
      <UserSetupModal
        isOpen={showUserSetup}
        onClose={() => setShowUserSetup(false)}
        onUserCreated={handleUserCreated}
      />

      {/* Resource Detail Modal */}
      <ResourceDetailModal
        resource={selectedResource}
        isOpen={showResourceDetail}
        onClose={() => setShowResourceDetail(false)}
      />

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-2 duration-300">
          <div className={`px-6 py-4 rounded-xl shadow-2xl border backdrop-blur-sm max-w-md ${
            toast.type === 'success' 
              ? 'bg-green-500/90 text-white border-green-400/50' 
              : toast.type === 'error'
              ? 'bg-red-500/90 text-white border-red-400/50'
              : 'bg-blue-500/90 text-white border-blue-400/50'
          }`}>
            <div className="flex items-center gap-3">
              {toast.type === 'success' && <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">✓</div>}
              {toast.type === 'error' && <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">✕</div>}
              {toast.type === 'info' && <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center">i</div>}
              <span className="font-medium">{toast.message}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Community;