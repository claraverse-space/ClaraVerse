/**
 * Extracted Images Renderer
 * 
 * This component renders images that were extracted from tool results
 * and stored separately from the chat history. This allows images to be
 * displayed without being included in the conversation context sent to models.
 */

import React, { useState, useCallback } from 'react';
import { ClaraExtractedImage } from '../../types/clara_assistant_types';
import { claraImageExtractionService } from '../../services/claraImageExtractionService';
import { Download, Eye, Info, X, Maximize2 } from 'lucide-react';

interface ExtractedImagesRendererProps {
  /** Extracted images to display */
  images: ClaraExtractedImage[];
  
  /** Whether to show images in a compact grid layout */
  compact?: boolean;
  
  /** Maximum number of images to show initially */
  maxVisible?: number;
  
  /** Additional CSS classes */
  className?: string;
}

const ExtractedImagesRenderer: React.FC<ExtractedImagesRendererProps> = ({
  images,
  compact = false,
  maxVisible = 3,
  className = ''
}) => {
  const [showAll, setShowAll] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ClaraExtractedImage | null>(null);
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<string>>(new Set());

  // Filter out images that failed to load
  const validImages = images.filter(img => !imageLoadErrors.has(img.id));
  
  // Determine which images to show
  const imagesToShow = showAll ? validImages : validImages.slice(0, maxVisible);
  const hasMore = validImages.length > maxVisible;

  const handleImageError = useCallback((imageId: string) => {
    setImageLoadErrors(prev => new Set(prev).add(imageId));
    console.warn(`Failed to load extracted image: ${imageId}`);
  }, []);

  const handleDownload = useCallback((image: ClaraExtractedImage) => {
    try {
      // Create download link
      const link = document.createElement('a');
      link.href = image.data;
      link.download = `${image.toolName}_${image.id}.${image.mimeType.split('/')[1] || 'png'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error downloading image:', error);
    }
  }, []);

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Unknown size';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  if (validImages.length === 0) {
    return null;
  }

  return (
    <div className={`extracted-images-renderer ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Eye className="w-4 h-4 text-blue-500" />
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {validImages.length === 1 ? '1 Image Generated' : `${validImages.length} Images Generated`}
        </span>
        {hasMore && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            Show all {validImages.length}
          </button>
        )}
      </div>

      {/* Images Grid */}
      <div className={`grid gap-3 ${
        compact 
          ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' 
          : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
      }`}>
        {imagesToShow.map((image) => (
          <div
            key={image.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-200"
          >
            {/* Image */}
            <div className="relative group">
              <img
                src={image.data}
                alt={image.description || `Image from ${image.toolName}`}
                className={`w-full object-cover cursor-pointer transition-transform duration-200 group-hover:scale-[1.02] ${
                  compact ? 'h-24' : 'h-32 sm:h-40'
                }`}
                onClick={() => setSelectedImage(image)}
                onError={() => handleImageError(image.id)}
                loading="lazy"
              />
              
              {/* Overlay Controls */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImage(image);
                    }}
                    className="p-2 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-70"
                    title="View full size"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(image);
                    }}
                    className="p-2 bg-black bg-opacity-50 rounded-full text-white hover:bg-opacity-70"
                    title="Download image"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Image Info */}
            {!compact && (
              <div className="p-3">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {image.description || `Image from ${image.toolName}`}
                </h4>
                <div className="mt-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span className="truncate">{image.toolName}</span>
                  <span>{formatFileSize(image.fileSize)}</span>
                </div>
                {image.dimensions && (
                  <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                    {image.dimensions.width} × {image.dimensions.height}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Show Less Button */}
      {showAll && hasMore && (
        <div className="mt-3 text-center">
          <button
            onClick={() => setShowAll(false)}
            className="text-xs text-gray-600 dark:text-gray-400 hover:underline"
          >
            Show less
          </button>
        </div>
      )}

      {/* Full Size Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4">
          <div className="relative max-w-6xl max-h-full bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Info className="w-5 h-5 text-blue-500" />
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {selectedImage.description || `Image from ${selectedImage.toolName}`}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Generated by {selectedImage.toolName} • {formatFileSize(selectedImage.fileSize)}
                    {selectedImage.dimensions && (
                      <span> • {selectedImage.dimensions.width} × {selectedImage.dimensions.height}</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(selectedImage)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Download image"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setSelectedImage(null)}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Image */}
            <div className="p-4">
              <img
                src={selectedImage.data}
                alt={selectedImage.description || `Image from ${selectedImage.toolName}`}
                className="max-w-full max-h-[70vh] object-contain mx-auto"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtractedImagesRenderer; 