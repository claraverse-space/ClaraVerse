import React, { useState, useEffect } from 'react';
import { TrendingUp, Star } from 'lucide-react';
import ModelCard from './ModelCard';
import { HuggingFaceModel, DownloadProgress, TrendingFilter } from './types';

interface PopularModelsSectionProps {
  onDownload: (modelId: string, fileName: string) => void;
  onDownloadWithDependencies?: (modelId: string, fileName: string, allFiles: Array<{ rfilename: string; size?: number }>) => void;
  downloading: Set<string>;
  downloadProgress: { [fileName: string]: DownloadProgress };
  onTagClick?: (tag: string) => void;
}

const PopularModelsSection: React.FC<PopularModelsSectionProps> = ({
  onDownload,
  onDownloadWithDependencies,
  downloading,
  downloadProgress,
  onTagClick
}) => {
  const [popularModels, setPopularModels] = useState<HuggingFaceModel[]>([]);
  const [isLoadingPopular, setIsLoadingPopular] = useState(true);
  const [trendingFilter, setTrendingFilter] = useState<TrendingFilter>('month');

  // Load popular models on mount and when filter changes
  useEffect(() => {
    const loadPopularModels = async () => {
      if (!window.modelManager?.searchHuggingFaceModels) return;
      
      setIsLoadingPopular(true);
      try {
        const allModels: HuggingFaceModel[] = [];
        
        if (trendingFilter === 'all') {
          // For "All Time", search for popular models using trending terms
          const popularQueries = [
            'llama-3', 'qwen2.5', 'phi-3', 'mistral-7b', 'gemma-2',
            'llama', 'qwen', 'phi', 'mistral', 'gemma', 'deepseek', 'yi'
          ];
          
          for (const query of popularQueries) {
            const result = await window.modelManager.searchHuggingFaceModels(query, 3);
            if (result.success) {
              allModels.push(...result.models);
            }
          }
          
          // Remove duplicates and sort by downloads
          const uniqueModels = allModels.filter((model, index, self) => 
            index === self.findIndex(m => m.id === model.id)
          );
          
          const sortedModels = uniqueModels
            .sort((a, b) => b.downloads - a.downloads)
            .slice(0, 12);
          
          setPopularModels(sortedModels);
        } else {
          // For time-based filters, we'll use a broader search and then filter by date
          // Since HF API doesn't support date filtering, we'll search for recent model terms
          // and prioritize models with recent-sounding names
          const recentQueries = [
            'llama-3.2', 'llama-3.1', 'qwen2.5', 'phi-3.5', 'mistral-7b', 'gemma-2',
            'deepseek-r1', 'deepseek-v3', 'yi-1.5', 'claude', 'gpt', '2024', '2025'
          ];
          
          for (const query of recentQueries) {
            const result = await window.modelManager.searchHuggingFaceModels(query, 2);
            if (result.success) {
              allModels.push(...result.models);
            }
          }
          
          // Remove duplicates
          const uniqueModels = allModels.filter((model, index, self) => 
            index === self.findIndex(m => m.id === model.id)
          );
          
          // Filter by recency indicators in model names/descriptions
          const recentKeywords = [
            '3.2', '3.1', '2.5', '2024', '2025', 'latest', 'new', 'updated', 
            'r1', 'v3', 'pro', 'turbo', 'instruct', 'chat'
          ];
          
          const filteredModels = uniqueModels.filter(model => {
            const searchText = `${model.name} ${model.description}`.toLowerCase();
            return recentKeywords.some(keyword => searchText.includes(keyword));
          });
          
          // If no recent models found, fall back to top downloaded
          const modelsToShow = filteredModels.length > 0 ? filteredModels : uniqueModels;
          
          // Sort by downloads and limit based on filter
          const sortedModels = modelsToShow
            .sort((a, b) => b.downloads - a.downloads)
            .slice(0, trendingFilter === 'today' ? 6 : trendingFilter === 'week' ? 8 : 12);
          
          setPopularModels(sortedModels);
        }
      } catch (error) {
        console.error('Error loading popular models:', error);
      } finally {
        setIsLoadingPopular(false);
      }
    };

    loadPopularModels();
  }, [trendingFilter]);

  return (
    <div className="glassmorphic rounded-xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-sakura-500" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Trending Models
          </h3>
          <div className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-orange-100 to-yellow-100 dark:from-orange-900/30 dark:to-yellow-900/30 text-orange-700 dark:text-orange-300 text-xs rounded-full">
            <Star className="w-3 h-3" />
            Popular
          </div>
        </div>
        
        {/* Time Filter */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 overflow-x-auto">
          {[
            { key: 'today', label: 'Today' },
            { key: 'week', label: 'Week' },
            { key: 'month', label: 'Month' },
            { key: 'all', label: 'All' }
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => setTrendingFilter(filter.key as TrendingFilter)}
              className={`px-2 py-1.5 text-xs font-medium rounded-md transition-all duration-200 whitespace-nowrap ${
                trendingFilter === filter.key
                  ? 'bg-sakura-500 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-gray-700/50'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
      
      {isLoadingPopular ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-sakura-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading trending models...</p>
        </div>
      ) : popularModels.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {trendingFilter === 'today' ? 'Latest and most recent models' :
               trendingFilter === 'week' ? 'Recently updated trending models' :
               trendingFilter === 'month' ? 'Recent popular models' :
               'All-time most downloaded models'}
            </p>
            <span className="text-sm text-gray-500 dark:text-gray-400">{popularModels.length} models</span>
          </div>
          <div className="grid gap-4 max-h-[600px] overflow-y-auto">
            {popularModels.map((model) => (
              <ModelCard
                key={model.id}
                model={model}
                onDownload={onDownload}
                onDownloadWithDependencies={onDownloadWithDependencies}
                downloading={downloading}
                downloadProgress={downloadProgress}
                onTagClick={onTagClick}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-gray-400 dark:text-gray-600" />
          </div>
          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No trending models found</h4>
          <p className="text-gray-500 dark:text-gray-400">
            Try a different time period or search for specific models above
          </p>
        </div>
      )}
    </div>
  );
};

export default PopularModelsSection; 