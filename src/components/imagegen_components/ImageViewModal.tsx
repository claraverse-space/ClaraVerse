import React from 'react';
import { X } from 'lucide-react';

interface ImageViewModalProps {
  imageUrl: string | null;
  onClose: () => void;
  syncGroup?: string;
}

const ImageViewModal: React.FC<ImageViewModalProps> = ({ imageUrl, onClose, syncGroup = 'default' }) => {
  if (!imageUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative max-w-7xl w-full h-full p-4 flex items-center justify-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors z-10"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};

export default ImageViewModal;
