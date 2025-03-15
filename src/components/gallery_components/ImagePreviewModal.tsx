import React from 'react';
import { Heart, Download, Share2, Trash2, ZoomIn, ZoomOut, X, Copy, Edit, CheckSquare, Eye } from 'lucide-react';
import { GalleryImage } from '../types';

interface ImagePreviewModalProps {
  image: GalleryImage;
  onClose: () => void;
  zoom: number;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleLike: (id: string) => void;
  handleDownload: (image: GalleryImage) => void;
  handleShare: (image: GalleryImage) => void;
  handleDelete: (id: string) => void;
  isEditingPrompt: boolean;
  editedPrompt: string;
  setEditedPrompt: (prompt: string) => void;
  startEditingPrompt: () => void;
  saveEditedPrompt: () => void;
  handleCopyPrompt: (prompt: string) => void;
  formatDate: (dateString: string) => string;
}

const glassmorphicButton = "p-3 bg-white/20 dark:bg-gray-800/30 backdrop-blur-md border border-white/30 dark:border-gray-700/50 rounded-lg transition-all duration-300 shadow-sm";

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  image,
  onClose,
  zoom,
  handleZoomIn,
  handleZoomOut,
  handleLike,
  handleDownload,
  handleShare,
  handleDelete,
  isEditingPrompt,
  editedPrompt,
  setEditedPrompt,
  startEditingPrompt,
  saveEditedPrompt,
  handleCopyPrompt,
  formatDate
}) => {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="max-w-4xl w-full max-h-full overflow-auto bg-gray-900 rounded-lg shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <img
            src={image.url}
            alt={image.prompt}
            style={{ transform: `scale(${zoom})` }}
            className="w-full max-h-[80vh] object-contain rounded-t-lg transition-transform duration-300"
          />
          <div className="absolute top-4 right-4 flex gap-2">
            <button onClick={() => handleLike(image.id)} className={glassmorphicButton} title="Like">
              <Heart className={`w-5 h-5 ${image.likes > 0 ? 'text-red-500' : ''}`} />
            </button>
            <button onClick={() => handleDownload(image)} className={glassmorphicButton} title="Download">
              <Download className="w-5 h-5" />
            </button>
            <button onClick={() => handleShare(image)} className={glassmorphicButton} title="Share">
              <Share2 className="w-5 h-5" />
            </button>
            <button onClick={() => handleDelete(image.id)} className={glassmorphicButton} title="Delete">
              <Trash2 className="w-5 h-5" />
            </button>
            <button onClick={handleZoomIn} className={glassmorphicButton} title="Zoom In">
              <ZoomIn className="w-5 h-5" />
            </button>
            <button onClick={handleZoomOut} className={glassmorphicButton} title="Zoom Out">
              <ZoomOut className="w-5 h-5" />
            </button>
            <button onClick={onClose} className={glassmorphicButton} title="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="p-4 bg-gray-800 rounded-b-lg text-white">
          <div className="flex items-center justify-between mb-2">
            {isEditingPrompt ? (
              <>
                <input
                  value={editedPrompt}
                  onChange={(e) => setEditedPrompt(e.target.value)}
                  className="flex-1 p-2 rounded-lg bg-gray-700 text-white border border-gray-600"
                />
                <button onClick={saveEditedPrompt} title="Save Prompt" className="ml-2 p-1">
                  <CheckSquare className="w-5 h-5" />
                </button>
                <button onClick={onClose} title="Cancel" className="ml-2 p-1">
                  <X className="w-5 h-5" />
                </button>
              </>
            ) : (
              <>
                <p className="text-lg flex-1 break-words overflow-auto max-h-20">{image.prompt}</p>
                <button
                  onClick={() => handleCopyPrompt(image.prompt)}
                  title="Copy Prompt"
                  className="ml-2 p-1"
                >
                  <Copy className="w-5 h-5" />
                </button>
                <button
                  onClick={startEditingPrompt}
                  title="Edit Prompt"
                  className="ml-2 p-1"
                >
                  <Edit className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span>{image.model}</span>
              <span>{image.resolution}</span>
              <span onClick={() => handleLike(image.id)} className="flex items-center gap-1 cursor-pointer">
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
    </div>
  );
};

export default ImagePreviewModal;
