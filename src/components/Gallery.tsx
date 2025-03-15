import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import FilterBar from './gallery_components/FilterBar';
import BulkActionBar from './gallery_components/BulkActionBar';
import GalleryGrid from './gallery_components/GalleryGrid';
import ImagePreviewModal from './gallery_components/ImagePreviewModal';
import ToastNotification from './gallery_components/ToastNotification';
import { db } from '../db';
import { indexedDBService } from '../services/indexedDB';
import { GalleryImage } from '../types';

// Extend db with fallback methods if not available
if (!(db as any).getStorageItems) {
  (db as any).getStorageItems = async () => {
    try {
      return await indexedDBService.getAll('storage');
    } catch (error) {
      console.error('IndexedDB retrieval failed, falling back to localStorage', error);
      const data = localStorage.getItem('clara_db_storage');
      return data ? JSON.parse(data) : [];
    }
  };
}
if (!(db as any).deleteStorageItem) {
  (db as any).deleteStorageItem = async (id: string) => {
    try {
      await indexedDBService.delete('storage', id);
    } catch (error) {
      console.error('IndexedDB deletion failed, falling back to localStorage', error);
      const data = localStorage.getItem('clara_db_storage');
      if (data) {
        const items = JSON.parse(data);
        const updated = items.filter((item: any) => item.id !== id);
        localStorage.setItem('clara_db_storage', JSON.stringify(updated));
      }
    }
  };
}

interface GalleryProps {
  onPageChange?: (page: string) => void;
  userName?: string;
  userAvatar?: string;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

const Gallery: React.FC<GalleryProps> = ({ 
  onPageChange, 
  userName = "User", 
  userAvatar = "/user-avatar.png",
  isDarkMode = false,
  onToggleDarkMode = () => {}
}) => {
  // States
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'masonry'>('masonry');
  const [darkMode, setDarkMode] = useState(isDarkMode);

  const [bulkMode, setBulkMode] = useState(false);
  const [selectedBulk, setSelectedBulk] = useState<Set<string>>(new Set());

  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState('');

  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  // Sync dark mode with parent component
  useEffect(() => {
    setDarkMode(isDarkMode);
  }, [isDarkMode]);

  // Handle dark mode toggle
  const handleDarkModeToggle = () => {
    setDarkMode(!darkMode);
    onToggleDarkMode();
  };

  // Load images on mount
  useEffect(() => {
    const loadImages = async () => {
      setIsLoading(true);
      try {
        const storedItems = await (db as any).getStorageItems();
        const imageItems = storedItems.filter((item: any) => item.type === 'image');
        const galleryImages: GalleryImage[] = imageItems.map((item: any, idx: number) => {
          let finalPrompt = item.description ?? '';
          if (finalPrompt.startsWith('Prompt:')) {
            finalPrompt = finalPrompt.replace(/^Prompt:\s*/, '');
          }
          return {
            id: item.id ?? `img-${idx}`,
            url: item.data,
            prompt: finalPrompt,
            createdAt: item.timestamp || new Date().toISOString(),
            likes: item.likes ?? 0,
            views: item.views ?? 0,
            model: item.model || 'SD-Model',
            resolution: item.resolution || '1024x1024'
          };
        });
        setImages(galleryImages);
      } catch (error) {
        console.error('Error loading images from DB:', error);
        showToast('Failed to load images', 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadImages();
  }, []);

  const showToast = (message: string, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 3000);
  };

  // Apply search, filter, and sort
  const applyFilterAndSort = (items: GalleryImage[]) => {
    let filtered = [...items];
    if (filter === 'favorites' || filter === 'liked') {
      filtered = filtered.filter(img => img.likes > 0);
    } else if (filter === 'recent') {
      const now = Date.now();
      const oneWeek = 7 * 24 * 60 * 60 * 1000;
      filtered = filtered.filter(img => now - new Date(img.createdAt).getTime() < oneWeek);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        img =>
          img.prompt.toLowerCase().includes(q) ||
          img.model.toLowerCase().includes(q) ||
          img.resolution.toLowerCase().includes(q)
      );
    }
    if (sortBy === 'newest') {
      filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sortBy === 'oldest') {
      filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (sortBy === 'popular') {
      filtered.sort((a, b) => b.likes - a.likes);
    }
    return filtered;
  };

  const displayedImages = applyFilterAndSort(images);

  // Handlers
  const handleImageClick = (image: GalleryImage) => {
    if (bulkMode) {
      toggleBulkSelection(image.id);
    } else {
      setSelectedImage(image);
      setZoom(1);
      setIsEditingPrompt(false);
    }
  };

  const toggleBulkMode = () => {
    setBulkMode(!bulkMode);
    if (bulkMode) setSelectedBulk(new Set());
  };

  const toggleBulkSelection = (imageId: string) => {
    setSelectedBulk(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  };

  const handleDownload = (image: GalleryImage) => {
    const a = document.createElement('a');
    a.href = image.url;
    a.download = `generated-image-${image.id}.png`;
    a.click();
    showToast('Image downloaded successfully');
  };

  const handleLike = (imageId: string) => {
    setImages(prev =>
      prev.map(img => (img.id === imageId ? { ...img, likes: img.likes === 0 ? 1 : 0 } : img))
    );
    if (selectedImage && selectedImage.id === imageId) {
      setSelectedImage(prev => (prev ? { ...prev, likes: prev.likes === 0 ? 1 : 0 } : prev));
    }
    showToast(
      images.find(img => img.id === imageId)?.likes === 0
        ? 'Added to favorites'
        : 'Removed from favorites'
    );
  };

  const handleDelete = async (imageId: string) => {
    if (!window.confirm('Are you sure you want to delete this image?')) return;
    try {
      await (db as any).deleteStorageItem(imageId);
      setImages(prev => prev.filter(img => img.id !== imageId));
      if (selectedImage && selectedImage.id === imageId) {
        setSelectedImage(null);
      }
      setSelectedBulk(prev => {
        const newSet = new Set(prev);
        newSet.delete(imageId);
        return newSet;
      });
      showToast('Image deleted successfully');
    } catch (error) {
      console.error('Error deleting image from DB:', error);
      showToast('Failed to delete image', 'error');
    }
  };

  const handleCopyPrompt = (prompt: string) => {
    navigator.clipboard.writeText(prompt)
      .then(() => showToast('Prompt copied to clipboard!'))
      .catch(() => showToast('Failed to copy prompt', 'error'));
  };

  const handleShare = (image: GalleryImage) => {
    if (navigator.share) {
      navigator.share({ title: 'Check out this image', text: image.prompt, url: image.url })
        .then(() => showToast('Shared successfully'))
        .catch(error => {
          console.error('Error sharing:', error);
          showToast('Failed to share image', 'error');
        });
    } else {
      showToast('Web Share API not supported on this device', 'error');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedBulk.size === 0) {
      showToast('No images selected', 'error');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedBulk.size} selected images?`)) return;
    
    try {
      let deleteCount = 0;
      for (let id of selectedBulk) {
        await (db as any).deleteStorageItem(id);
        deleteCount++;
      }
      
      setImages(prev => prev.filter(img => !selectedBulk.has(img.id)));
      setSelectedBulk(new Set());
      showToast(`${deleteCount} images deleted successfully`);
    } catch (error) {
      console.error('Error in bulk delete:', error);
      showToast('Some images could not be deleted', 'error');
    }
  };

  const handleBulkDownload = () => {
    if (selectedBulk.size === 0) {
      showToast('No images selected', 'error');
      return;
    }
    
    let downloadCount = 0;
    selectedBulk.forEach(id => {
      const img = images.find(image => image.id === id);
      if (img) {
        handleDownload(img);
        downloadCount++;
      }
    });
    
    showToast(`Downloading ${downloadCount} images`);
  };

  const handleBulkShare = () => {
    if (selectedBulk.size === 0) {
      showToast('No images selected', 'error');
      return;
    }
    
    const firstSelected = images.find(img => selectedBulk.has(img.id));
    if (firstSelected) handleShare(firstSelected);
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.5));

  const startEditingPrompt = () => {
    setEditedPrompt(selectedImage?.prompt || '');
    setIsEditingPrompt(true);
  };

  const saveEditedPrompt = () => {
    if (selectedImage) {
      setImages(prev =>
        prev.map(img => (img.id === selectedImage.id ? { ...img, prompt: editedPrompt } : img))
      );
      setSelectedImage({ ...selectedImage, prompt: editedPrompt });
      setIsEditingPrompt(false);
      showToast('Prompt updated successfully');
      // Persist changes to DB if needed.
    }
  };

  const handleDownloadAll = () => {
    if (displayedImages.length === 0) {
      showToast('No images to download', 'error');
      return;
    }
    
    displayedImages.forEach(img => handleDownload(img));
    showToast(`Downloading ${displayedImages.length} images`);
  };

  const handleSelectAll = () => {
    if (!bulkMode) {
      setBulkMode(true);
    }
    
    const newSelection = new Set<string>();
    displayedImages.forEach(img => newSelection.add(img.id));
    setSelectedBulk(newSelection);
    showToast(`Selected ${newSelection.size} images`);
  };

  const handleDeselectAll = () => {
    setSelectedBulk(new Set());
    showToast('All images deselected');
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className={`${darkMode ? 'dark' : ''} h-screen flex flex-col`}>
      <div className="flex-1 flex overflow-hidden relative">
        <div className="z-10">
          <Sidebar activePage="gallery" onPageChange={onPageChange || (() => {})} />
        </div>
        <div className="flex-1 flex flex-col z-0">
          <Topbar 
            userName={userName}
            userAvatar={userAvatar}
            onPageChange={onPageChange} 
            isDarkMode={darkMode}
            onToggleDarkMode={handleDarkModeToggle}
          />
          <div className="flex-1 overflow-hidden bg-gradient-to-br from-purple-50/80 via-sakura-50/80 to-blue-50/80 dark:from-gray-900/90 dark:via-gray-800/90 dark:to-blue-900/90 backdrop-blur-sm">
            <div className="mx-4 mt-4 rounded-xl overflow-hidden backdrop-blur-md bg-white/70 dark:bg-gray-800/60 shadow-lg border border-white/50 dark:border-gray-700/30">
              <FilterBar 
                searchQuery={searchQuery} 
                setSearchQuery={setSearchQuery}
                filter={filter}
                setFilter={setFilter}
                sortBy={sortBy}
                setSortBy={setSortBy}
                viewMode={viewMode}
                setViewMode={setViewMode}
                toggleBulkMode={toggleBulkMode}
                handleDownloadAll={handleDownloadAll}
                isDarkMode={darkMode}
              />
            </div>
            
            {bulkMode && (
              <div className="mx-4 mt-4 rounded-xl overflow-hidden backdrop-blur-md bg-white/70 dark:bg-gray-800/60 shadow-lg border border-white/50 dark:border-gray-700/30">
                <BulkActionBar 
                  handleSelectAll={handleSelectAll}
                  handleDeselectAll={handleDeselectAll}
                  handleBulkDelete={handleBulkDelete}
                  handleBulkDownload={handleBulkDownload}
                  handleBulkShare={handleBulkShare}
                  selectedCount={selectedBulk.size}
                  isDarkMode={darkMode}
                />
              </div>
            )}
            
            <div className="p-4 h-full overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sakura-500"></div>
                </div>
              ) : displayedImages.length === 0 ? (
                <div className="text-center py-16 backdrop-blur-md bg-white/50 dark:bg-gray-800/50 rounded-xl border border-white/50 dark:border-gray-700/30 shadow-lg">
                  <p className="text-xl font-medium text-gray-900 dark:text-white mb-2">No images found</p>
                  <p className="text-gray-600 dark:text-gray-400">Start generating some amazing images!</p>
                </div>
              ) : (
                <GalleryGrid 
                  images={displayedImages}
                  viewMode={viewMode}
                  bulkMode={bulkMode}
                  selectedBulk={selectedBulk}
                  onImageClick={handleImageClick}
                  toggleBulkSelection={toggleBulkSelection}
                  formatDate={formatDate}
                  handleLike={handleLike}
                  handleDownload={handleDownload}
                  handleDelete={handleDelete}
                  isDarkMode={darkMode}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      
      {selectedImage && (
        <ImagePreviewModal 
          image={selectedImage}
          onClose={() => { setSelectedImage(null); setIsEditingPrompt(false); }}
          zoom={zoom}
          handleZoomIn={handleZoomIn}
          handleZoomOut={handleZoomOut}
          handleLike={handleLike}
          handleDownload={handleDownload}
          handleShare={handleShare}
          handleDelete={handleDelete}
          isEditingPrompt={isEditingPrompt}
          editedPrompt={editedPrompt}
          setEditedPrompt={setEditedPrompt}
          startEditingPrompt={startEditingPrompt}
          saveEditedPrompt={saveEditedPrompt}
          handleCopyPrompt={handleCopyPrompt}
          formatDate={formatDate}
          isDarkMode={darkMode}
        />
      )}
      
      {toast.show && <ToastNotification message={toast.message} type={toast.type} glassmorphic={true} />}
    </div>
  );
};

export default Gallery;
