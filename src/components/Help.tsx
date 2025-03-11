import React, { useState } from 'react';
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
  MoreVertical
} from 'lucide-react';

const Apps = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');

  // Mock data for apps - in a real application, this would come from a database
  const mockApps = [
    { 
      id: 1, 
      name: 'Code Assistant', 
      description: 'AI-powered coding helper for developers',
      icon: Code,
      color: 'from-blue-400 to-indigo-600',
      created: '2023-06-10',
    },
    { 
      id: 2, 
      name: 'Document Analyzer', 
      description: 'Extract insights from documents and PDFs',
      icon: FileText,
      color: 'from-amber-400 to-orange-600',
      created: '2023-07-22',
    },
    { 
      id: 3, 
      name: 'SQL Generator', 
      description: 'Generate SQL queries using natural language',
      icon: Database,
      color: 'from-emerald-400 to-teal-600',
      created: '2023-08-05',
    },
    { 
      id: 4, 
      name: 'Chart Maker', 
      description: 'Create data visualizations from datasets',
      icon: BarChart,
      color: 'from-rose-400 to-pink-600',
      created: '2023-09-18',
    },
    { 
      id: 5, 
      name: 'Image Describer', 
      description: 'Generate detailed descriptions from images',
      icon: ImageIcon,
      color: 'from-purple-400 to-violet-600',
      created: '2023-10-01',
    },
    { 
      id: 6, 
      name: 'Chatbot Builder', 
      description: 'Create custom chatbots for your website',
      icon: MessagesSquare,
      color: 'from-green-400 to-emerald-600',
      created: '2023-11-15',
    },
  ];

  // Filter apps based on search query
  const filteredApps = mockApps.filter(app => 
    app.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    app.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort apps based on selected sort option
  const sortedApps = [...filteredApps].sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.created).getTime() - new Date(a.created).getTime();
    } else if (sortBy === 'oldest') {
      return new Date(a.created).getTime() - new Date(b.created).getTime();
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
          <button className="flex items-center gap-2 px-4 py-2 bg-sakura-500 hover:bg-sakura-600 text-white rounded-lg transition-colors">
            <Plus className="h-4 w-4" />
            <span>Create App</span>
          </button>
        </div>
      </div>
      
      {/* App Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {sortedApps.length > 0 ? (
          sortedApps.map(app => (
            <div key={app.id} className="glassmorphic rounded-xl overflow-hidden hover:shadow-lg transition-shadow">
              <div className={`h-32 bg-gradient-to-r ${app.color} flex items-center justify-center`}>
                <app.icon className="h-16 w-16 text-white/90" />
              </div>
              <div className="p-5">
                <div className="flex justify-between items-start">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">{app.name}</h3>
                  <button className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {app.description}
                </p>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    Created: {new Date(app.created).toLocaleDateString()}
                  </span>
                  <button className="text-sakura-500 hover:text-sakura-600 text-sm font-medium">
                    Open
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
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
              <button className="flex items-center gap-2 px-4 py-2 bg-sakura-500 hover:bg-sakura-600 text-white rounded-lg transition-colors">
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