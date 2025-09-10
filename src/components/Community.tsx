import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Upload, 
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
  ChevronDown,
  Heart,
  Download,
  Eye
} from 'lucide-react';
import { CustomNodeDefinition } from '../types/agent/types';
import { CommunityService, LocalUserManager, CommunityResource } from '../services/communityService';
import UserSetupModal from './UserSetupModal';
import ResourceDetailModal from './ResourceDetailModal';
import { localContentService, LocalContent } from '../services/localContentService';
import { db } from '../db';
import { getDefaultWallpaper } from '../utils/uiPreferences';

interface CommunityProps {
  onPageChange?: (page: string) => void;
}

const Community: React.FC<CommunityProps> = ({ onPageChange }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'downloads'>('recent');
  const [activeTab, setActiveTab] = useState<'local' | 'shared'>('shared');
  
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
  const [downloadedResources, setDownloadedResources] = useState<Set<string>>(new Set());
  const [userDownloadedResources, setUserDownloadedResources] = useState<Set<string>>(new Set());
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMorePages, setHasMorePages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const ITEMS_PER_PAGE = 20;

  // Filter state
  const [showDownloaded, setShowDownloaded] = useState(false);
  
  // Wallpaper state
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);
  
  // Toast state
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
    enhanced?: {
      description: string;
      actions: Array<{ label: string; action: () => void; variant?: 'primary' | 'secondary' }>;
    };
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

  // Load wallpaper from database
  useEffect(() => {
    const loadWallpaper = async () => {
      try {
        const wallpaper = await db.getWallpaper();
        if (wallpaper) {
          setWallpaperUrl(wallpaper);
        } else {
          // Set Aurora Borealis as default wallpaper when none is set
          const defaultWallpaper = getDefaultWallpaper();
          if (defaultWallpaper) {
            setWallpaperUrl(defaultWallpaper);
          }
        }
      } catch (error) {
        console.error('Error loading wallpaper:', error);
        // Fallback to default wallpaper on error
        const defaultWallpaper = getDefaultWallpaper();
        if (defaultWallpaper) {
          setWallpaperUrl(defaultWallpaper);
        }
      }
    };
    loadWallpaper();
  }, []);

  // Load content based on active tab
  useEffect(() => {
    if (supabaseConnected) {
      if (activeTab === 'local') {
        loadLocalContent();
      } else if (activeTab === 'shared') {
        setCurrentPage(1); // Reset pagination when switching tabs
        loadSharedResources();
      }
    }
  }, [supabaseConnected, activeTab, searchQuery, selectedCategory]);

  // Load downloaded resources list from localStorage
  useEffect(() => {
    const loadDownloadedResources = () => {
      try {
        const customNodes = JSON.parse(localStorage.getItem('custom_nodes') || '[]');
        const downloadedIds = new Set<string>(
          customNodes
            .filter((node: any) => node.customMetadata?.sharedWith?.includes('community'))
            .map((node: any) => String(node.id?.replace('imported-', '') || ''))
            .filter(Boolean)
        );
        setDownloadedResources(downloadedIds);
      } catch (error) {
        console.error('Error loading downloaded resources:', error);
      }
    };
    
    loadDownloadedResources();
    
    // Listen for custom nodes updates to refresh downloaded list
    const handleCustomNodesUpdate = () => loadDownloadedResources();
    window.addEventListener('customNodesUpdated', handleCustomNodesUpdate);
    
    return () => window.removeEventListener('customNodesUpdated', handleCustomNodesUpdate);
  }, []);

  // Load user-specific download tracking to prevent duplicate downloads
  useEffect(() => {
    const loadUserDownloadHistory = () => {
      if (!currentUser) {
        setUserDownloadedResources(new Set());
        return;
      }
      
      try {
        const userDownloadKey = `userDownloads_${currentUser.id}`;
        const userDownloads = JSON.parse(localStorage.getItem(userDownloadKey) || '[]');
        setUserDownloadedResources(new Set(userDownloads));
      } catch (error) {
        console.error('Error loading user download history:', error);
        setUserDownloadedResources(new Set());
      }
    };
    
    loadUserDownloadHistory();
  }, [currentUser]);

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

  const loadSharedResources = async (loadMore = false) => {
    if (loadMore) {
      setIsLoadingMore(true);
    } else {
      setLoadingSharedContent(true);
    }
    
    try {
      const page = loadMore ? currentPage + 1 : 1;
      const offset = (page - 1) * ITEMS_PER_PAGE;
      
      const resources = await CommunityService.getResources({
        search: searchQuery || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        limit: ITEMS_PER_PAGE,
        offset: offset
      });
      
      console.log('Loaded shared resources:', resources);
      console.log('Custom node resources:', resources.filter(r => r.category === 'custom-node'));
      
      // Filter out downloaded resources if needed
      let filteredResources = resources;
      if (!showDownloaded) {
        filteredResources = resources.filter(r => !downloadedResources.has(r.id));
      }
      
      if (loadMore) {
        setSharedResources(prev => [...prev, ...filteredResources]);
        setCurrentPage(page);
      } else {
        setSharedResources(filteredResources);
        setCurrentPage(1);
      }
      
      // Check if there are more pages
      setHasMorePages(resources.length === ITEMS_PER_PAGE);
      
      // Check which resources are liked by current user
      if (currentUser) {
        checkUserLikes(filteredResources.map(r => r.id));
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
      setIsLoadingMore(false);
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

  const handleResourceClick = async (resource: CommunityResource) => {
    // Track view when resource is clicked for preview
    try {
      await CommunityService.incrementViews(resource.id);
      
      // Update the view count in the local state immediately
      setSharedResources(prev => 
        prev.map(r => 
          r.id === resource.id 
            ? { ...r, views_count: (r.views_count || 0) + 1 }
            : r
        )
      );
    } catch (error) {
      console.error('Error incrementing views:', error);
    }
    
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

  // Enhanced download feedback system
  const showEnhancedFeedback = (config: {
    title: string;
    description: string;
    actions: Array<{ label: string; action: () => void; variant?: 'primary' | 'secondary' }>;
    duration?: number;
    type?: 'success' | 'error' | 'info';
  }) => {
    setToast({
      show: true,
      message: config.title,
      type: config.type || 'success',
      enhanced: {
        description: config.description,
        actions: config.actions
      }
    });
    
    if (config.duration) {
      setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, config.duration);
    }
  };

  // Function to save user download to localStorage
  const saveUserDownload = (resourceId: string) => {
    if (!currentUser) return;
    
    try {
      const userDownloadKey = `userDownloads_${currentUser.id}`;
      const currentDownloads = Array.from(userDownloadedResources);
      const updatedDownloads = [...currentDownloads, resourceId];
      
      localStorage.setItem(userDownloadKey, JSON.stringify(updatedDownloads));
      setUserDownloadedResources(new Set(updatedDownloads));
    } catch (error) {
      console.error('Error saving user download:', error);
    }
  };

  const handleResourceDownload = async (e: React.MouseEvent, resource: CommunityResource) => {
    e.stopPropagation(); // Prevent opening detail modal
    
    // Check if user has already downloaded this resource
    const hasAlreadyDownloaded = userDownloadedResources.has(resource.id);
    
    if (hasAlreadyDownloaded) {
      showEnhancedFeedback({
        title: 'Re-downloading Resource',
        description: `Re-downloading "${resource.title}". Download count will not be incremented again for fair statistics.`,
        actions: [
          { 
            label: 'Continue', 
            action: () => setToast(prev => ({ ...prev, show: false })),
            variant: 'primary' 
          },
          { 
            label: 'View Resource', 
            action: () => handleResourceClick(resource),
            variant: 'secondary' 
          }
        ],
        duration: 4000,
        type: 'info'
      });
    }
    
    console.log('=== DOWNLOAD HANDLER CALLED ===');
    console.log('Resource:', resource);
    console.log('Resource category:', resource.category);
    console.log('Resource content:', resource.content);
    console.log('Already downloaded:', hasAlreadyDownloaded);
    
    try {
      setDownloadingResources(prev => new Set(prev).add(resource.id));
      
      // Only increment download count if user hasn't downloaded before
      if (!hasAlreadyDownloaded) {
        await CommunityService.incrementDownloads(resource.id);
        console.log('Download count incremented');
        
        // Save this download to user's history
        saveUserDownload(resource.id);
        
        // Update download count in the list
        setSharedResources(prev => 
          prev.map(r => 
            r.id === resource.id 
              ? { ...r, downloads_count: r.downloads_count + 1 }
              : r
          )
        );
      } else {
        console.log('Download count NOT incremented - user already downloaded this resource');
      }
      
      // Handle different content types
      if (resource.category === 'custom-node' && resource.content) {
        console.log('Processing custom-node download...');
        // Add custom node to the user's local custom nodes
        try {
          // Parse the custom node implementation
          const customNodeCode = resource.content;
          
          let originalNodeDefinition = null;
          let executionCode = customNodeCode;
          let inputs: any[] = [];
          let outputs: any[] = [];
          let properties: any[] = [];
          
          // Try to parse the content as a complete CustomNodeDefinition JSON
          try {
            originalNodeDefinition = JSON.parse(customNodeCode);
            console.log('Parsed original node definition:', originalNodeDefinition);
            
            if (originalNodeDefinition.executionCode) {
              executionCode = originalNodeDefinition.executionCode;
              console.log('Extracted execution code length:', executionCode.length);
            }
            if (originalNodeDefinition.inputs) {
              inputs = originalNodeDefinition.inputs;
              console.log('Extracted inputs:', inputs);
            }
            if (originalNodeDefinition.outputs) {
              outputs = originalNodeDefinition.outputs;
              console.log('Extracted outputs:', outputs);
            }
            if (originalNodeDefinition.properties) {
              properties = originalNodeDefinition.properties;
              console.log('Extracted properties:', properties);
            }
          } catch (parseError) {
            console.log('Content is not JSON, treating as raw execution code');
            console.log('Parse error:', parseError instanceof Error ? parseError.message : String(parseError));
            // If parsing fails, treat it as raw execution code
            executionCode = customNodeCode;
          }
          
          // Create a new custom node object based on the shared resource
          const newCustomNode: CustomNodeDefinition = {
            id: `imported-${resource.id}`,
            type: resource.title.toLowerCase().replace(/[^a-z0-9]/g, '-'),
            name: resource.title,
            description: resource.description,
            category: 'imported',
            inputs: inputs,
            outputs: outputs,
            properties: properties,
            executionCode: executionCode,
            version: resource.version || '1.0.0',
            executionHandler: 'custom-node-handler',
            icon: '📦', // Default icon for imported nodes
            author: resource.author_username,
            uiConfig: {
              backgroundColor: '#8B5CF6', // Purple for imported nodes
              iconUrl: undefined,
              customStyling: ''
            },
            customMetadata: {
              isUserCreated: true as const,
              createdBy: resource.author_username,
              createdAt: new Date().toISOString(),
              published: false,
              downloadCount: resource.downloads_count || 0,
              rating: resource.likes_count || 0,
              sharedWith: [],
            },
            metadata: {
              tags: ['imported', 'community'],
              documentation: '',
              examples: []
            }
          };
          
          // Use the CustomNodeManager to properly register the node
          // Import the customNodeManager
          console.log('Attempting to import CustomNodeManager...');
          const { customNodeManager } = await import('./AgentBuilder/NodeCreator/CustomNodeManager');
          console.log('CustomNodeManager imported successfully:', customNodeManager);
          
          // Check if this custom node already exists
          const existingNode = customNodeManager.getCustomNode(newCustomNode.type);
          console.log('Existing node check:', existingNode);
          
          if (existingNode) {
            // Node with same type exists - create unique type
            console.log('Node exists, creating unique type...');
            newCustomNode.type = `${newCustomNode.type}-${resource.id}`;
            customNodeManager.registerCustomNode(newCustomNode);
            console.log('Registered custom node with unique type:', newCustomNode.type);
            showEnhancedFeedback({
              title: `"${resource.title}" Added Successfully!`,
              description: 'Custom node is now available in Agent Studio with a unique name to avoid conflicts.',
              actions: [
                { 
                  label: 'Try it now', 
                  action: () => onPageChange?.('agents'),
                  variant: 'primary' 
                },
                { 
                  label: 'View in Studio', 
                  action: () => {
                    setToast(prev => ({ ...prev, show: false }));
                    onPageChange?.('agents');
                  },
                  variant: 'secondary' 
                }
              ],
              duration: 8000,
              type: 'success'
            });
          } else {
            // Add new node
            console.log('Registering new custom node:', newCustomNode);
            customNodeManager.registerCustomNode(newCustomNode);
            console.log('Custom node registered successfully');
            showEnhancedFeedback({
              title: `"${resource.title}" Added Successfully!`,
              description: 'Custom node is now available in your Agent Studio node library.',
              actions: [
                { 
                  label: 'Open Agent Studio', 
                  action: () => onPageChange?.('agents'),
                  variant: 'primary' 
                },
                { 
                  label: 'View Documentation', 
                  action: () => handleResourceClick(resource),
                  variant: 'secondary' 
                }
              ],
              duration: 8000,
              type: 'success'
            });
          }
          
          // Trigger custom nodes sync if available
          console.log('Dispatching customNodesUpdated event...');
          if (window.dispatchEvent) {
            window.dispatchEvent(new CustomEvent('customNodesUpdated'));
            console.log('Event dispatched successfully');
          }
          
        } catch (parseError) {
          console.error('Error adding custom node:', parseError);
          // Enhanced error feedback with recovery options
          showEnhancedFeedback({
            title: 'Installation Failed',
            description: 'Could not install the custom node automatically. You can still download it as a file and import manually.',
            actions: [
              { 
                label: 'Download File', 
                action: () => {
                  const blob = new Blob([resource.content || ''], { type: 'text/javascript' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `${resource.title}.js`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                },
                variant: 'primary' 
              },
              { 
                label: 'Get Help', 
                action: () => handleResourceClick(resource),
                variant: 'secondary' 
              }
            ],
            duration: 10000,
            type: 'error'
          });
        }
      } else if (resource.category === 'tool' && resource.content) {
        console.log('Processing tool download...');
        // Add tool to the user's local tools
        try {
          // Parse the tool definition
          const toolDefinition = JSON.parse(resource.content);
          console.log('Parsed tool definition:', toolDefinition);
          
          // Add to the database using the same method as ToolBelt
          await db.addTool({
            name: toolDefinition.name || resource.title,
            description: toolDefinition.description || resource.description,
            parameters: toolDefinition.parameters || [],
            implementation: toolDefinition.implementation || '',
            isEnabled: true // Enable by default when downloaded
          });
          
          console.log('Tool successfully added to database');
          
          showEnhancedFeedback({
            title: 'Tool Downloaded!',
            description: `"${resource.title}" has been added to your tools. You can find it in the Tool Belt.`,
            actions: [
              { 
                label: 'Open Tool Belt', 
                action: () => {
                  setToast(prev => ({ ...prev, show: false }));
                  // Could add navigation to Tool Belt here if needed
                },
                variant: 'primary' 
              },
              { 
                label: 'View More Tools', 
                action: () => {
                  setSelectedCategory('tool');
                  setToast(prev => ({ ...prev, show: false }));
                },
                variant: 'secondary' 
              }
            ],
            duration: 8000,
            type: 'success'
          });
        } catch (error) {
          console.error('Error adding tool to database:', error);
          
          showEnhancedFeedback({
            title: 'Tool Download Failed',
            description: `Failed to install "${resource.title}". The tool format may be invalid.`,
            actions: [
              { 
                label: 'Download File', 
                action: () => {
                  // Fallback: download as file
                  const content = resource.content || '';
                  const blob = new Blob([content], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `${resource.title}.json`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(url);
                },
                variant: 'primary' 
              },
              { 
                label: 'Get Help', 
                action: () => handleResourceClick(resource),
                variant: 'secondary' 
              }
            ],
            duration: 10000,
            type: 'error'
          });
        }
      } else if (resource.content_type === 'image/base64' && resource.content) {
        // Download image
        const link = document.createElement('a');
        link.href = resource.content;
        link.download = `${resource.title}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showEnhancedFeedback({
          title: 'Image Downloaded!',
          description: `"${resource.title}" has been saved to your downloads folder.`,
          actions: [
            { 
              label: 'View Similar', 
              action: () => {
                setSelectedCategory('image');
                setToast(prev => ({ ...prev, show: false }));
              },
              variant: 'secondary' 
            }
          ],
          duration: 5000,
          type: 'success'
        });
      } else if (resource.download_url) {
        // Open download URL
        window.open(resource.download_url, '_blank');
        
        showEnhancedFeedback({
          title: 'Download Started!',
          description: 'The download has opened in a new tab.',
          actions: [],
          duration: 3000,
          type: 'success'
        });
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
        
        showEnhancedFeedback({
          title: 'Resource Downloaded!',
          description: `"${resource.title}" has been saved as a text file.`,
          actions: [
            { 
              label: 'Browse More', 
              action: () => setToast(prev => ({ ...prev, show: false })),
              variant: 'secondary' 
            }
          ],
          duration: 5000,
          type: 'success'
        });
      }
      
    } catch (error) {
      console.error('=== ERROR DOWNLOADING RESOURCE ===');
      console.error('Error:', error);
      console.error('Resource:', resource);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      
      showEnhancedFeedback({
        title: 'Download Failed',
        description: `Sorry, we couldn't download "${resource.title}". This might be a temporary issue.`,
        actions: [
          { 
            label: 'Try Again', 
            action: () => handleResourceDownload(e, resource),
            variant: 'primary' 
          },
          { 
            label: 'Report Issue', 
            action: () => handleResourceClick(resource),
            variant: 'secondary' 
          }
        ],
        duration: 8000,
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

  // Trust score calculation (simplified version)
  const calculateTrustScore = (resource: CommunityResource) => {
    const downloadWeight = Math.min(resource.downloads_count || 0, 100) * 0.4;
    const likesWeight = Math.min(resource.likes_count || 0, 50) * 0.3;
    const recentWeight = resource.created_at && 
      (Date.now() - new Date(resource.created_at).getTime()) < 30 * 24 * 60 * 60 * 1000 ? 20 : 0; // Recent = last 30 days
    const authorWeight = resource.author_username ? 10 : 0;
    
    return Math.min(Math.round(downloadWeight + likesWeight + recentWeight + authorWeight), 100);
  };

  // Get trust badge based on score
  const getTrustBadge = (score: number) => {
    if (score >= 90) return { emoji: '🥇', label: 'Highly Trusted', color: 'text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/30' };
    if (score >= 75) return { emoji: '🥈', label: 'Trusted', color: 'text-gray-700 bg-gray-100 dark:text-gray-300 dark:bg-gray-800/50' };
    if (score >= 60) return { emoji: '🥉', label: 'Reliable', color: 'text-orange-700 bg-orange-100 dark:text-orange-300 dark:bg-orange-900/30' };
    if (score >= 40) return { emoji: '⚠️', label: 'Use Caution', color: 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30' };
    return { emoji: '🔍', label: 'Unverified', color: 'text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30' };
  };

  // Parse custom node for preview
  const parseCustomNodePreview = (content: string) => {
    try {
      const parsed = JSON.parse(content);
      return {
        inputs: parsed.inputs?.length || 0,
        outputs: parsed.outputs?.length || 0,
        properties: parsed.properties?.length || 0,
        hasExecutionCode: !!parsed.executionCode
      };
    } catch {
      return { inputs: '?', outputs: '?', properties: '?', hasExecutionCode: true };
    }
  };

  const categories = [
    { id: 'all', name: 'All', icon: Users },
    { id: 'custom-node', name: 'Custom Nodes', icon: Code2 },
    { id: 'tool', name: 'Tools', icon: Package }
  ];

  const filteredContent = getFilteredContent();

  return (
    <div className="h-[calc(100vh-theme(spacing.16)-theme(spacing.1))] bg-white dark:bg-black flex flex-col overflow-hidden relative">
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

      {/* Content with relative z-index */}
      <div className="relative z-10 flex flex-col h-full overflow-hidden">{/* Fixed Header */}
      <div className="glassmorphic border-b border-white/20 dark:border-gray-800/50 flex-shrink-0 z-10">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-sakura-500" />
                Community
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Discover, share, and collaborate on Clara resources
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleShareResource}
                disabled={!supabaseConnected}
                className="px-3 py-1.5 glassmorphic bg-sakura-500 text-white rounded-lg hover:bg-sakura-600 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <Upload className="w-3 h-3" />
                Share Resource
              </button>
              <button 
                onClick={() => {
                  // Try to open Discord app first, fallback to web
                  const discordAppUrl = 'discord://discord.com/invite/j633fsrAne';
                  const discordWebUrl = 'https://discord.gg/j633fsrAne';
                  
                  // Create a hidden iframe to try opening the Discord app
                  const iframe = document.createElement('iframe');
                  iframe.style.display = 'none';
                  iframe.src = discordAppUrl;
                  document.body.appendChild(iframe);
                  
                  // Set a timeout to open web version if app doesn't open
                  setTimeout(() => {
                    document.body.removeChild(iframe);
                    window.open(discordWebUrl, '_blank');
                  }, 1000);
                }}
                className="px-3 py-1.5 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl text-sm"
                title="Join our Discord community - will try to open Discord app first"
              >
                {/* Discord Logo SVG */}
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.0002 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9554 2.4189-2.1568 2.4189Z"/>
                </svg>
                Discord
              </button>
            </div>
          </div>

          {/* Tabs */}
          {supabaseConnected && (
            <div className="flex gap-1 bg-white/20 dark:bg-gray-800/30 rounded-lg p-1 mb-3">
              <button
                onClick={() => setActiveTab('local')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                  activeTab === 'local'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-md'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Package className="w-3 h-3" />
                My Content ({localContent.length})
              </button>
              <button
                onClick={() => setActiveTab('shared')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 flex items-center gap-2 ${
                  activeTab === 'shared'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-md'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Users className="w-3 h-3" />
                Community Shared
              </button>
            </div>
          )}

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder={activeTab === 'local' ? "Search your content..." : "Search community resources..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={!supabaseConnected}
                className="w-full pl-10 pr-4 py-2 glassmorphic border border-white/20 dark:border-gray-600/30 rounded-lg bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-sakura-500 focus:border-transparent transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              disabled={!supabaseConnected}
              className="px-3 py-2 glassmorphic border border-white/20 dark:border-gray-600/30 rounded-lg bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-sakura-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
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
        <div className="w-64 shrink-0 p-3">
          <div className="glassmorphic rounded-xl p-3 space-y-3 sticky top-4 h-[calc(100vh-8rem)] flex flex-col">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex-shrink-0">Categories</h3>
            
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

              {/* Downloaded Resources Filter */}
              {activeTab === 'shared' && downloadedResources.size > 0 && (
                <div className="glassmorphic p-4 rounded-xl border border-white/20 dark:border-gray-700/30 bg-gradient-to-br from-white/20 to-white/5 dark:from-gray-800/20 dark:to-gray-900/5">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <Download className="w-4 h-4 text-sakura-500" />
                    Downloaded Items
                  </h4>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showDownloaded}
                      onChange={(e) => setShowDownloaded(e.target.checked)}
                      className="w-4 h-4 text-sakura-600 bg-white/60 border-gray-300 rounded focus:ring-sakura-500 focus:ring-2"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      Show downloaded ({downloadedResources.size})
                    </span>
                  </label>
                </div>
              )}

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
            <div className="p-4">
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
                            <div className="flex items-center gap-3">
                              <button
                                onClick={handleShareSelected}
                                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
                              >
                                <Share2 className="w-4 h-4" />
                                Share Selected
                              </button>
                              <button
                                onClick={() => setSelectedContent([])}
                                className="text-xs text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                              >
                                Clear selection
                              </button>
                            </div>
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
                    <div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                      {sharedResources.map((resource) => {
                        const IconComponent = getCategoryIcon(resource.category);
                        const isLiked = likedResources.has(resource.id);
                        const isDownloading = downloadingResources.has(resource.id);
                        const trustScore = calculateTrustScore(resource);
                        const trustBadge = getTrustBadge(trustScore);
                        const nodePreview = resource.category === 'custom-node' && resource.content 
                          ? parseCustomNodePreview(resource.content) 
                          : null;
                        
                        return (
                          <div
                            key={resource.id}
                            className="glassmorphic rounded-xl p-5 border border-white/20 dark:border-gray-700/30 hover:border-sakura-200 dark:hover:border-sakura-700 transition-all duration-300 hover:shadow-2xl cursor-pointer group flex flex-col h-full relative overflow-hidden"
                          >
                            {/* Trust Badge - Top Right */}
                            <div className="absolute top-3 right-3 z-10">
                              <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${trustBadge.color} shadow-sm`}>
                                <span className="text-xs">{trustBadge.emoji}</span>
                                <span className="font-semibold">{trustBadge.label}</span>
                                {/* <span className="opacity-75">({trustScore})</span> */}
                              </div>
                            </div>

                            {/* Header */}
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className={`p-3 rounded-xl ${getCategoryColor(resource.category)} shadow-sm`}>
                                  <IconComponent className="w-5 h-5" />
                                </div>
                                <div>
                                  <div className="text-xs px-2 py-1 bg-white/60 dark:bg-gray-700/60 rounded-full text-gray-600 dark:text-gray-400 capitalize font-medium">
                                    {resource.category.replace('-', ' ')}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Title & Description */}
                            <div className="mb-4">
                              <h3 className="font-bold text-gray-900 dark:text-white mb-2 line-clamp-2 text-base leading-tight group-hover:text-sakura-600 dark:group-hover:text-sakura-400 transition-colors">
                                {resource.title}
                              </h3>
                              
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-3 leading-relaxed">
                                {resource.description}
                              </p>
                            </div>

                            {/* Node Preview for Custom Nodes */}
                            {nodePreview && (
                              <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg border border-purple-200/50 dark:border-purple-700/50">
                                <div className="text-xs font-semibold text-purple-700 dark:text-purple-300 mb-2 flex items-center gap-1">
                                  <Code2 className="w-3 h-3" />
                                  Node Structure
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-xs">
                                  <div className="text-center">
                                    <div className="text-green-600 dark:text-green-400 font-bold">{nodePreview.inputs}</div>
                                    <div className="text-gray-500">Inputs</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-blue-600 dark:text-blue-400 font-bold">{nodePreview.outputs}</div>
                                    <div className="text-gray-500">Outputs</div>
                                  </div>
                                  <div className="text-center">
                                    <div className="text-orange-600 dark:text-orange-400 font-bold">{nodePreview.properties}</div>
                                    <div className="text-gray-500">Props</div>
                                  </div>
                                </div>
                                {nodePreview.hasExecutionCode && (
                                  <div className="mt-2 flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                    <span>Ready to Execute</span>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* Quick Stats */}
                            <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-white/30 dark:bg-gray-800/30 rounded-lg">
                              <div className="text-center">
                                <div className="flex items-center justify-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
                                  <Download className="w-3 h-3" />
                                </div>
                                <div className="text-sm font-bold text-gray-900 dark:text-white">{resource.downloads_count || 0}</div>
                                <div className="text-xs text-gray-500">Downloads</div>
                              </div>
                              <div className="text-center">
                                <div className="flex items-center justify-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
                                  <Heart className="w-3 h-3" />
                                </div>
                                <div className="text-sm font-bold text-gray-900 dark:text-white">{resource.likes_count || 0}</div>
                                <div className="text-xs text-gray-500">Likes</div>
                              </div>
                              <div className="text-center">
                                <div className="flex items-center justify-center gap-1 text-gray-600 dark:text-gray-400 mb-1">
                                  <Eye className="w-3 h-3" />
                                </div>
                                <div className="text-sm font-bold text-gray-900 dark:text-white">{resource.views_count || 0}</div>
                                <div className="text-xs text-gray-500">Views</div>
                              </div>
                            </div>

                            {/* Author & Date */}
                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-4">
                              <div className="flex items-center gap-1">
                                <div className="w-6 h-6 bg-gradient-to-br from-sakura-400 to-pink-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                                  {resource.author_username?.[0]?.toUpperCase() || 'U'}
                                </div>
                                <span className="font-medium">by {resource.author_username}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>{new Date(resource.created_at).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric',
                                  year: new Date(resource.created_at).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
                                })}</span>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="grid grid-cols-3 gap-2 mt-auto">
                              {/* Preview/Details Button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResourceClick(resource);
                                }}
                                className="flex items-center justify-center gap-1 px-3 py-2 bg-white/60 dark:bg-gray-700/60 hover:bg-white/80 dark:hover:bg-gray-700/80 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-md"
                                title="Preview and view details"
                              >
                                <Eye className="w-4 h-4" />
                                <span className="hidden sm:inline">Preview</span>
                              </button>

                              {/* Like Button */}
                              <button
                                onClick={(e) => handleResourceLike(e, resource.id)}
                                className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-md ${
                                  isLiked
                                    ? 'bg-red-500 text-white shadow-md'
                                    : 'bg-white/60 dark:bg-gray-700/60 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-700 dark:text-gray-300 hover:text-red-500'
                                }`}
                                title={isLiked ? 'Unlike' : 'Like'}
                              >
                                <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                                <span className="hidden sm:inline">{isLiked ? 'Liked' : 'Like'}</span>
                              </button>

                              {/* Download Button */}
                              <button
                                onClick={(e) => handleResourceDownload(e, resource)}
                                disabled={isDownloading}
                                className={`flex items-center justify-center gap-1 px-3 py-2 text-white rounded-lg text-sm font-medium transition-all duration-200 hover:shadow-lg transform hover:scale-105 disabled:cursor-not-allowed disabled:transform-none ${
                                  userDownloadedResources.has(resource.id)
                                    ? 'bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-500'
                                    : isDownloading
                                    ? 'bg-gray-400'
                                    : 'bg-sakura-500 hover:bg-sakura-600'
                                }`}
                                title={
                                  userDownloadedResources.has(resource.id)
                                    ? 'Already downloaded - click to re-download'
                                    : isDownloading
                                    ? 'Downloading...'
                                    : 'Download and install'
                                }
                              >
                                {userDownloadedResources.has(resource.id) ? (
                                  <>
                                    <Download className="w-4 h-4" />
                                    <span className="hidden sm:inline">Downloaded</span>
                                  </>
                                ) : isDownloading ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span className="hidden sm:inline">Downloading</span>
                                  </>
                                ) : (
                                  <>
                                    <Download className="w-4 h-4" />
                                    <span className="hidden sm:inline">Download</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                      </div>
                      
                      {/* Pagination Controls */}
                      {hasMorePages && (
                        <div className="flex justify-center mt-8">
                          <button
                            onClick={() => loadSharedResources(true)}
                            disabled={isLoadingMore}
                            className="flex items-center gap-2 px-6 py-3 bg-white/60 dark:bg-gray-700/60 hover:bg-white/80 dark:hover:bg-gray-700/80 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isLoadingMore ? (
                              <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>Loading more...</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-5 h-5" />
                                <span>Load More</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
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

      {/* Enhanced Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-2 duration-300 max-w-md">
          <div className={`rounded-xl shadow-2xl border backdrop-blur-sm ${
            toast.type === 'success' 
              ? 'bg-green-500/95 text-white border-green-400/50' 
              : toast.type === 'error'
              ? 'bg-red-500/95 text-white border-red-400/50'
              : 'bg-blue-500/95 text-white border-blue-400/50'
          }`}>
            {/* Main content */}
            <div className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {toast.type === 'success' && <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-sm">✓</div>}
                  {toast.type === 'error' && <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-sm">✕</div>}
                  {toast.type === 'info' && <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-sm">ℹ</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-white mb-1">{toast.message}</h4>
                  {toast.enhanced?.description && (
                    <p className="text-sm text-white/90 mb-3 leading-relaxed">
                      {toast.enhanced.description}
                    </p>
                  )}
                  
                  {/* Action buttons */}
                  {toast.enhanced?.actions && toast.enhanced.actions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {toast.enhanced.actions.map((action, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            action.action();
                            if (action.variant !== 'secondary') {
                              setToast(prev => ({ ...prev, show: false }));
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                            action.variant === 'primary'
                              ? 'bg-white text-gray-900 hover:bg-gray-100 shadow-md'
                              : 'bg-white/20 text-white hover:bg-white/30 border border-white/30'
                          }`}
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Close button */}
                <button
                  onClick={() => setToast(prev => ({ ...prev, show: false }))}
                  className="flex-shrink-0 p-1 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default Community;