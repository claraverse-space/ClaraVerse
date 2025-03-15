import React from 'react';
import { Heart, Download, Trash2, Eye } from 'lucide-react';
import { GalleryImage } from '../types';

interface GalleryImageCardProps {
  image: GalleryImage;
  viewMode: 'grid' | 'masonry';
  bulkMode: boolean;
  isSelected: boolean;
  onClick: () => void;
  toggleBulkSelection: () => void;
  formatDate: (dateString: string) => string;
  handleLike: (id: string) => void;
  handleDownload: (image: GalleryImage) => void;
  handleDelete: (id: string) => void;
}

const glassmorphicCard = "bg-white/10 dark:bg-gray-900/30 backdrop-blur-lg border border-white/20 dark:border-gray-700/50 shadow-lg shadow-black/5 dark:shadow-black/20 rounded-xl";
const glassmorphicButton = "p-2 bg-white/20 dark:bg-gray-800/30 backdrop-blur-md border border-white/30 dark:border-gray-700/50 rounded-lg transition-all duration-300 shadow-sm";

const GalleryImageCard: React.FC<GalleryImageCardProps> = ({
  image,
  viewMode,
  bulkMode,
  isSelected,
  onClick,
  toggleBulkSelection,
  formatDate,
  handleLike,
  handleDownload,
  handleDelete
}) => {
  return (
    <div
      onClick={onClick}
      className={`group relative overflow-hidden ${glassmorphicCard} transition-all duration-300 hover:shadow-[0_0_15px_rgba(255,255,255,0.6)] ${viewMode === 'masonry' ? 'row-span-1' : ''}`}
    >
      {bulkMode && (
        <div className="absolute top-2 left-2 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => { e.stopPropagation(); toggleBulkSelection(); }}
            className="w-5 h-5"
          />
        </div>
      )}
      <img
        src={image.url}
        alt={image.prompt}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
          <p className="text-sm line-clamp-2 mb-2">{image.prompt}</p>
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <span
                onClick={(e) => { e.stopPropagation(); handleLike(image.id); }}
                className="flex items-center gap-1 cursor-pointer"
              >
                <Heart className={`w-4 h-4 ${image.likes > 0 ? 'text-red-500' : ''}`} /> {image.likes}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-4 h-4" /> {image.views}
              </span>
            </div>
            <span>{formatDate(image.createdAt)}</span>
          </div>
        </div>
      </div>
      <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <button
          onClick={(e) => { e.stopPropagation(); handleLike(image.id); }}
          className={glassmorphicButton}
          title="Like"
        >
          <Heart className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleDownload(image); }}
          className={glassmorphicButton}
          title="Download"
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleDelete(image.id); }}
          className={glassmorphicButton}
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default GalleryImageCard;
