import React from 'react';
import { Search, LayoutGrid, Grid } from 'lucide-react';

interface FilterBarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filter: string;
  setFilter: (f: string) => void;
  sortBy: string;
  setSortBy: (s: string) => void;
  viewMode: 'grid' | 'masonry';
  setViewMode: (vm: 'grid' | 'masonry') => void;
  toggleBulkMode: () => void;
  handleDownloadAll: () => void;
}

const glassmorphicButton = "p-2 bg-white/20 dark:bg-gray-800/30 backdrop-blur-md border border-white/30 dark:border-gray-700/50 rounded-lg transition-all duration-300 shadow-sm";

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
  handleDownloadAll
}) => {
  return (
    <div className="sticky top-0 z-20 border-b border-gray-200 dark:border-gray-700 p-4 flex flex-col sm:flex-row items-center gap-4">
      <div className="relative flex-grow max-w-2xl">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search by prompt, model, or resolution..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-white"
        />
      </div>
      <div className="flex items-center gap-3">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-white"
        >
          <option value="all">All Images</option>
          <option value="favorites">Favorites</option>
          <option value="recent">Recent</option>
          <option value="liked">Liked</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-white"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="popular">Most Popular</option>
        </select>
        <button
          onClick={() => setViewMode(viewMode === 'grid' ? 'masonry' : 'grid')}
          className={glassmorphicButton}
          title="Toggle Grid/Masonry"
        >
          {viewMode === 'grid' ? <LayoutGrid className="w-5 h-5" /> : <Grid className="w-5 h-5" />}
        </button>
        <button
          onClick={toggleBulkMode}
          className={glassmorphicButton}
          title="Toggle Bulk Selection"
        >
          Bulk
        </button>
        <button
          onClick={handleDownloadAll}
          className={`px-3 py-2 ${glassmorphicButton}`}
          title="Download All"
        >
          Download All
        </button>
      </div>
    </div>
  );
};

export default FilterBar;
