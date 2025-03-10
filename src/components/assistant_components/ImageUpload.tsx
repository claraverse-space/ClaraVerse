import React, { useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';

interface UploadedImage {
  id: string;
  base64: string;
  preview: string;
}

interface ImageUploadProps {
  images: UploadedImage[];
  onImageUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (id: string) => void;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  images,
  onImageUpload,
  onRemoveImage
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {images.map((image) => (
        <div 
          key={image.id} 
          className="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700"
        >
          <img 
            src={image.preview} 
            alt="Uploaded" 
            className="w-full h-full object-cover"
          />
          <button
            onClick={() => onRemoveImage(image.id)}
            className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-16 h-16 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-sakura-500 dark:hover:border-sakura-500 transition-colors"
      >
        <ImagePlus className="w-5 h-5 text-gray-400 dark:text-gray-600" />
        <span className="text-[10px] text-gray-500 dark:text-gray-400">Add Image</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onImageUpload}
        className="hidden"
      />
    </div>
  );
};

export default ImageUpload;