import React from 'react';

interface FilterBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filter: string;
  setFilter: (filter: string) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
  viewMode: 'grid' | 'masonry';
  setViewMode: (mode: 'grid' | 'masonry') => void;
  toggleBulkMode: () => void;
  handleDownloadAll: () => void;
  isDarkMode?: boolean;
}

const FilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  setSearchQuery,
  filter,
  setFilter,
  sortBy,
  setSortBy,
  viewMode,
  setViewMode,
  toggleBulkMode,
  handleDownloadAll,
  isDarkMode
}) => {
  return (
    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
      {/* Search */}
      <div className="relative flex-grow max-w-md">
        <input
          type="text"
          placeholder="Search by prompt, model or resolution..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/50 dark:bg-gray-800/50 
                   border border-white/50 dark:border-gray-700/30 backdrop-blur-md
                   focus:ring-2 focus:ring-sakura-400 dark:focus:ring-blue-500
                   text-gray-700 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400
                   shadow-sm transition-all duration-200"
        />
        <svg 
          className="absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500" 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 20 20" 
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
        </svg>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0">
        <select 
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-white/50 dark:bg-gray-800/50 border border-white/50 dark:border-gray-700/30 
                   text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2
                   shadow-sm backdrop-blur-md focus:ring-2 focus:ring-sakura-400 dark:focus:ring-blue-500
                   transition-all duration-200"
        >
          <option value="all">All Images</option>
          <option value="favorites">Favorites</option>
          <option value="recent">Recent (7 days)</option>
        </select>

        <select 
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-white/50 dark:bg-gray-800/50 border border-white/50 dark:border-gray-700/30 
                   text-gray-700 dark:text-gray-200 rounded-lg px-3 py-2
                   shadow-sm backdrop-blur-md focus:ring-2 focus:ring-sakura-400 dark:focus:ring-blue-500
                   transition-all duration-200"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="popular">Most Liked</option>
        </select>

        {/* View Mode Toggle */}
        <div className="flex rounded-lg overflow-hidden border border-white/50 dark:border-gray-700/30 shadow-sm">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 ${viewMode === 'grid' 
              ? 'bg-sakura-400/80 dark:bg-blue-500/80 text-white' 
              : 'bg-white/50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300'} 
              backdrop-blur-md transition-all duration-200`}
            title="Grid View"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('masonry')}
            className={`p-2 ${viewMode === 'masonry' 
              ? 'bg-sakura-400/80 dark:bg-blue-500/80 text-white' 
              : 'bg-white/50 dark:bg-gray-800/50 text-gray-700 dark:text-gray-300'} 
              backdrop-blur-md transition-all duration-200`}
            title="Masonry View"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h4a2 2 0 002-2V5a2 2 0 00-2-2H5zM11 3a2 2 0 012 2v6a2 2 0 01-2 2h-2a2 2 0 01-2-2V5a2 2 0 012-2h2zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center space-x-2">
        <button
          onClick={toggleBulkMode}
          className="flex items-center gap-1 px-3 py-2 bg-sakura-400/80 dark:bg-blue-500/80 
                    text-white rounded-lg hover:bg-sakura-500/80 dark:hover:bg-blue-600/80 
                    transition-all duration-200 shadow-sm backdrop-blur-md"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" />
            <path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" />
          </svg>
          Bulk Select
        </button>
        <button
          onClick={handleDownloadAll}
          className="flex items-center gap-1 px-3 py-2 bg-white/50 dark:bg-gray-800/50 
                   border border-white/50 dark:border-gray-700/30
                   text-gray-700 dark:text-gray-200 rounded-lg hover:bg-white/70 dark:hover:bg-gray-700/70 
                   transition-all duration-200 shadow-sm backdrop-blur-md"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
          Download All
        </button>
      </div>
    </div>
  );
};

export default FilterBar;
