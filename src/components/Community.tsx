import React, { useState } from 'react';
import { 
  Users, 
  Download, 
  Upload, 
  Star, 
  MessageSquare, 
  Package, 
  Image, 
  FileText, 
  Code2, 
  Search,
  Github,
  Heart,
  Eye,
  Calendar
} from 'lucide-react';

interface CommunityItem {
  id: string;
  title: string;
  description: string;
  author: string;
  category: 'mcp-server' | 'prompt' | 'custom-node' | 'wallpaper' | 'workflow' | 'tutorial';
  tags: string[];
  downloads: number;
  likes: number;
  views: number;
  createdAt: string;
  thumbnail?: string;
  githubUrl?: string;
  featured?: boolean;
}

const Community: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'downloads'>('recent');

  // Mock data - this would come from your backend/API
  const communityItems: CommunityItem[] = [
    {
      id: '1',
      title: 'PDF Document Processor MCP Server',
      description: 'Advanced MCP server for processing and analyzing PDF documents with AI',
      author: 'claradev',
      category: 'mcp-server',
      tags: ['pdf', 'document', 'analysis'],
      downloads: 1250,
      likes: 89,
      views: 2340,
      createdAt: '2025-01-15',
      githubUrl: 'https://github.com/claradev/pdf-mcp',
      featured: true
    },
    {
      id: '2',
      title: 'Creative Writing Prompts Pack',
      description: 'Collection of 100+ creative writing prompts for storytelling and content creation',
      author: 'storyweaver',
      category: 'prompt',
      tags: ['creative', 'writing', 'storytelling'],
      downloads: 890,
      likes: 156,
      views: 1820,
      createdAt: '2025-01-14',
      featured: true
    },
    {
      id: '3',
      title: 'Cyberpunk City Wallpaper Collection',
      description: 'AI-generated cyberpunk cityscape wallpapers in 4K resolution',
      author: 'cyberpunkartist',
      category: 'wallpaper',
      tags: ['cyberpunk', 'city', '4k', 'neon'],
      downloads: 2340,
      likes: 234,
      views: 4560,
      createdAt: '2025-01-13',
      thumbnail: '/api/placeholder/300/200'
    },
    {
      id: '4',
      title: 'Data Visualization Custom Node',
      description: 'Custom Clara Agent node for creating interactive charts and graphs',
      author: 'dataviz_pro',
      category: 'custom-node',
      tags: ['data', 'visualization', 'charts'],
      downloads: 456,
      likes: 67,
      views: 890,
      createdAt: '2025-01-12',
      githubUrl: 'https://github.com/dataviz_pro/clara-dataviz-node'
    },
    {
      id: '5',
      title: 'Getting Started with Clara Agents',
      description: 'Comprehensive tutorial on building your first Clara Agent workflow',
      author: 'clara_educator',
      category: 'tutorial',
      tags: ['tutorial', 'beginner', 'agents'],
      downloads: 0,
      likes: 234,
      views: 5670,
      createdAt: '2025-01-11'
    }
  ];

  const categories = [
    { id: 'all', name: 'All', icon: Users },
    { id: 'mcp-server', name: 'MCP Servers', icon: Package },
    { id: 'prompt', name: 'Prompts', icon: FileText },
    { id: 'custom-node', name: 'Custom Nodes', icon: Code2 },
    { id: 'wallpaper', name: 'Wallpapers', icon: Image },
    { id: 'workflow', name: 'Workflows', icon: Package },
    { id: 'tutorial', name: 'Tutorials', icon: FileText }
  ];

  const getCategoryIcon = (category: string) => {
    const categoryMap = {
      'mcp-server': Package,
      'prompt': FileText,
      'custom-node': Code2,
      'wallpaper': Image,
      'workflow': Package,
      'tutorial': FileText
    };
    const IconComponent = categoryMap[category as keyof typeof categoryMap] || Package;
    return <IconComponent className="w-4 h-4" />;
  };

  const getCategoryColor = (category: string) => {
    const colorMap = {
      'mcp-server': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'prompt': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'custom-node': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'wallpaper': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
      'workflow': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'tutorial': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    };
    return colorMap[category as keyof typeof colorMap] || 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
  };

  const filteredItems = communityItems
    .filter(item => selectedCategory === 'all' || item.category === selectedCategory)
    .filter(item => 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      switch (sortBy) {
        case 'popular':
          return b.likes - a.likes;
        case 'downloads':
          return b.downloads - a.downloads;
        case 'recent':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="h-[calc(100vh-theme(spacing.16)-theme(spacing.1))] bg-white dark:bg-black flex flex-col overflow-hidden">
      {/* Fixed Header - No Scroll */}
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
              <button className="px-4 py-2 glassmorphic bg-sakura-500 text-white rounded-xl hover:bg-sakura-600 transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl">
                <Upload className="w-4 h-4" />
                Share Resource
              </button>
              <button className="px-4 py-2 glassmorphic border border-white/20 dark:border-gray-600/30 rounded-xl hover:bg-white/10 dark:hover:bg-gray-700/30 transition-all duration-200 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Discussions
              </button>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search resources..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 glassmorphic border border-white/20 dark:border-gray-600/30 rounded-xl bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder-gray-500 focus:ring-2 focus:ring-sakura-500 focus:border-transparent transition-all duration-200"
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2.5 glassmorphic border border-white/20 dark:border-gray-600/30 rounded-xl bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white focus:ring-2 focus:ring-sakura-500 transition-all duration-200"
            >
              <option value="recent">Most Recent</option>
              <option value="popular">Most Popular</option>
              <option value="downloads">Most Downloaded</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content Area - Following Help.tsx pattern with proper flex structure */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Fixed Width, Scrollable Content */}
        <div className="w-80 shrink-0 p-4">
          <div className="glassmorphic rounded-xl p-4 space-y-4 sticky top-4 h-[calc(100vh-10rem)] flex flex-col">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex-shrink-0">Categories</h3>
            
            {/* Scrollable Categories - Now properly constrained */}
            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 pb-4">
              <div className="space-y-1 mb-6">
                {categories.map((category) => {
                  const IconComponent = category.icon;
                  return (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                        selectedCategory === category.id
                          ? 'glassmorphic bg-sakura-100/50 text-sakura-700 dark:bg-sakura-900/30 dark:text-sakura-200 shadow-md'
                          : 'text-gray-700 dark:text-gray-300 hover:glassmorphic hover:bg-white/30 dark:hover:bg-gray-700/30'
                      }`}
                    >
                      <IconComponent className="w-4 h-4" />
                      {category.name}
                    </button>
                  );
                })}
              </div>

              {/* Community Stats - Glassmorphic Card */}
              <div className="glassmorphic p-4 rounded-xl border border-white/20 dark:border-gray-700/30 bg-gradient-to-br from-white/20 to-white/5 dark:from-gray-800/20 dark:to-gray-900/5">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <Star className="w-4 h-4 text-sakura-500" />
                  Community Stats
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                    <span>📦 Resources</span>
                    <span className="font-medium text-gray-900 dark:text-white">{communityItems.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                    <span>👥 Contributors</span>
                    <span className="font-medium text-gray-900 dark:text-white">150+</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                    <span>⬇️ Downloads</span>
                    <span className="font-medium text-gray-900 dark:text-white">10.2K</span>
                  </div>
                  <div className="flex items-center justify-between text-gray-600 dark:text-gray-400">
                    <span>⭐ Stars</span>
                    <span className="font-medium text-gray-900 dark:text-white">2.8K</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content - Following Help.tsx pattern exactly */}
        <div className="flex-1 overflow-y-auto">
          <div className="h-full overflow-y-auto custom-scrollbar">
            <div className="p-6">
              {/* Featured Section */}
              {selectedCategory === 'all' && (
                <div className="mb-8">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Star className="w-5 h-5 text-yellow-500" />
                    Featured Resources
                  </h2>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {communityItems.filter(item => item.featured).map((item) => (
                      <div key={item.id} className="glassmorphic rounded-xl border border-white/20 dark:border-gray-700/30 p-5 hover:shadow-xl transition-all duration-300 group cursor-pointer bg-gradient-to-br from-white/30 to-white/10 dark:from-gray-800/30 dark:to-gray-900/10">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {getCategoryIcon(item.category)}
                            <span className={`px-3 py-1 rounded-full text-xs font-medium glassmorphic ${getCategoryColor(item.category)}`}>
                              {item.category.replace('-', ' ')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-yellow-500 glassmorphic px-2 py-1 rounded-full bg-yellow-50/50 dark:bg-yellow-900/20">
                            <Star className="w-3 h-3 fill-current" />
                            <span className="text-xs font-medium">Featured</span>
                          </div>
                        </div>
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-sakura-600 dark:group-hover:text-sakura-400 transition-colors">{item.title}</h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">{item.description}</p>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">by <span className="font-medium text-gray-700 dark:text-gray-300">{item.author}</span></span>
                          <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Download className="w-3 h-3" />
                              {item.downloads}
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart className="w-3 h-3" />
                              {item.likes}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Resources Grid */}
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                  {selectedCategory === 'all' ? 'All Resources' : categories.find(c => c.id === selectedCategory)?.name}
                  <span className="text-gray-500 text-base font-normal ml-2">({filteredItems.length})</span>
                </h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredItems.map((item) => (
                  <div key={item.id} className="glassmorphic rounded-xl border border-white/20 dark:border-gray-700/30 overflow-hidden hover:shadow-xl transition-all duration-300 group cursor-pointer bg-gradient-to-br from-white/20 to-white/5 dark:from-gray-800/20 dark:to-gray-900/5">
                    {item.thumbnail && (
                      <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 relative overflow-hidden">
                        <img 
                          src={item.thumbnail} 
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium glassmorphic ${getCategoryColor(item.category)}`}>
                          {item.category.replace('-', ' ')}
                        </span>
                        {item.githubUrl && (
                          <a 
                            href={item.githubUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-lg hover:bg-white/20 dark:hover:bg-gray-700/30"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Github className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                      
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-1 group-hover:text-sakura-600 dark:group-hover:text-sakura-400 transition-colors">{item.title}</h3>
                      <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">{item.description}</p>
                      
                      <div className="flex flex-wrap gap-1 mb-3">
                        {item.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="px-2 py-1 glassmorphic bg-white/30 dark:bg-gray-700/30 text-gray-600 dark:text-gray-400 text-xs rounded-lg border border-white/20 dark:border-gray-600/20">
                            #{tag}
                          </span>
                        ))}
                      </div>
                      
                      <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-4">
                        <span>by <span className="font-medium text-gray-700 dark:text-gray-300">{item.author}</span></span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(item.createdAt)}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Download className="w-3 h-3" />
                            {item.downloads}
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart className="w-3 h-3" />
                            {item.likes}
                          </span>
                          <span className="flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {item.views}
                          </span>
                        </div>
                        <button className="px-4 py-1.5 glassmorphic bg-sakura-500 text-white text-sm rounded-lg hover:bg-sakura-600 transition-all duration-200 shadow-md hover:shadow-lg">
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {filteredItems.length === 0 && (
                <div className="text-center py-16">
                  <div className="glassmorphic w-20 h-20 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 mx-auto mb-4 flex items-center justify-center">
                    <Package className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No resources found</h3>
                  <p className="text-gray-500 dark:text-gray-400">Try adjusting your search or filters</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Community;
