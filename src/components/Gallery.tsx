import React, { useState, useEffect } from 'react';
import { ImageIcon, Download, Search, SlidersHorizontal, Heart, Share2, Eye, ZoomIn, X } from 'lucide-react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { db } from '../db';

interface GalleryImage {
  id: string;
  url: string;
  prompt: string;
  createdAt: string;
  likes: number;
  views: number;
  model: string;
  resolution: string;
}

interface GalleryProps {
  onPageChange?: (page: string) => void;
}

const Gallery: React.FC<GalleryProps> = ({ onPageChange }) => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'masonry'>('masonry');

  // Example data - replace with actual data from your database
  useEffect(() => {
    const loadImages = async () => {
      setIsLoading(true);
      try {
        // Mock data - replace with actual DB call
        const mockImages: GalleryImage[] = Array.from({ length: 12 }, (_, i) => ({
          id: `img-${i}`,
          url: `https://source.unsplash.com/random/800x${600 + i * 50}?ai`,
          prompt: "A beautiful AI-generated landscape with mountains and lakes",
          createdAt: new Date(Date.now() - i * 86400000).toISOString(),
          likes: Math.floor(Math.random() * 100),
          views: Math.floor(Math.random() * 1000),
          model: "stable-diffusion-xl",
          resolution: "1024x1024"
        }));
        setImages(mockImages);
      } catch (error) {
        console.error('Error loading images:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadImages();
  }, []);

  const handleImageClick = (image: GalleryImage) => {
    setSelectedImage(image);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="flex h-screen">
      <Sidebar activePage="gallery" onPageChange={onPageChange || (() => {})} />
      
      <div className="flex-1 flex flex-col">
        <Topbar userName="User" onPageChange={onPageChange} />
        
        <div className="flex-1 overflow-hidden bg-gradient-to-br from-gray-50 to-sakura-50 dark:from-gray-900 dark:to-gray-800">
          {/* Search and Filters Bar */}
          <div className="sticky top-0 z-10 glassmorphic border-b border-gray-200 dark:border-gray-700 p-4">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row gap-4 items-center">
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
                  className="p-2 rounded-lg bg-white/50 border border-gray-200 hover:bg-gray-100 dark:bg-gray-800/50 dark:border-gray-700 dark:hover:bg-gray-700"
                >
                  <SlidersHorizontal className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </button>
              </div>
            </div>
          </div>

          {/* Gallery Content */}
          <div className="p-6 overflow-y-auto">
            <div className="max-w-7xl mx-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sakura-500"></div>
                </div>
              ) : images.length === 0 ? (
                <div className="text-center py-16">
                  <ImageIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">No images found</h3>
                  <p className="text-gray-600 dark:text-gray-400">Start generating some amazing images!</p>
                </div>
              ) : (
                <div className={`grid gap-6 ${
                  viewMode === 'grid' 
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-[200px]'
                }`}>
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className={`group relative overflow-hidden rounded-xl glassmorphic transition-all duration-300 hover:shadow-xl ${
                        viewMode === 'masonry' ? 'row-span-1' : ''
                      }`}
                      onClick={() => handleImageClick(image)}
                    >
                      <img
                        src={image.url}
                        alt={image.prompt}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      
                      {/* Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                          <p className="text-sm line-clamp-2 mb-2">{image.prompt}</p>
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <Heart className="w-4 h-4" /> {image.likes}
                              </span>
                              <span className="flex items-center gap-1">
                                <Eye className="w-4 h-4" /> {image.views}
                              </span>
                            </div>
                            <span>{formatDate(image.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Quick Actions */}
                      <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <button className="p-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white transition-colors">
                          <ZoomIn className="w-4 h-4" />
                        </button>
                        <button className="p-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white transition-colors">
                          <Share2 className="w-4 h-4" />
                        </button>
                        <button className="p-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white transition-colors">
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Image Preview Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setSelectedImage(null)}>
          <div className="max-w-7xl w-full h-full p-4 flex items-center justify-center" onClick={e => e.stopPropagation()}>
            <div className="relative w-full h-full flex items-center">
              <img
                src={selectedImage.url}
                alt={selectedImage.prompt}
                className="max-w-full max-h-full mx-auto rounded-lg shadow-2xl"
              />
              <div className="absolute top-4 right-4 flex gap-2">
                <button className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-colors">
                  <Share2 className="w-5 h-5" />
                </button>
                <button className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-colors">
                  <Download className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="absolute bottom-4 left-4 right-4 p-4 bg-white/10 backdrop-blur-sm rounded-lg text-white">
                <p className="text-lg mb-2">{selectedImage.prompt}</p>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-4">
                    <span>{selectedImage.model}</span>
                    <span>{selectedImage.resolution}</span>
                    <span className="flex items-center gap-1">
                      <Heart className="w-4 h-4" /> {selectedImage.likes}
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" /> {selectedImage.views}
                    </span>
                  </div>
                  <span>{formatDate(selectedImage.createdAt)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;