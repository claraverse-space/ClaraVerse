import React from 'react';
import { GalleryImage } from '../types';
import GalleryImageCard from './GalleryImageCard';

interface GalleryGridProps {
  images: GalleryImage[];
  viewMode: 'grid' | 'masonry';
  bulkMode: boolean;
  selectedBulk: Set<string>;
  onImageClick: (image: GalleryImage) => void;
  toggleBulkSelection: (imageId: string) => void;
  formatDate: (dateString: string) => string;
  handleLike: (id: string) => void;
  handleDownload: (image: GalleryImage) => void;
  handleDelete: (id: string) => void;
}

const GalleryGrid: React.FC<GalleryGridProps> = ({
  images,
  viewMode,
  bulkMode,
  selectedBulk,
  onImageClick,
  toggleBulkSelection,
  formatDate,
  handleLike,
  handleDownload,
  handleDelete
}) => {
  return (
    <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 auto-rows-[200px]'}`}>
      {images.map(image => (
        <GalleryImageCard 
          key={image.id}
          image={image}
          viewMode={viewMode}
          bulkMode={bulkMode}
          isSelected={selectedBulk.has(image.id)}
          onClick={() => onImageClick(image)}
          toggleBulkSelection={() => toggleBulkSelection(image.id)}
          formatDate={formatDate}
          handleLike={handleLike}
          handleDownload={handleDownload}
          handleDelete={handleDelete}
        />
      ))}
    </div>
  );
};

export default GalleryGrid;
