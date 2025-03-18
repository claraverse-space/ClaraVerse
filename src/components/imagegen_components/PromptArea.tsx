import React, { useRef, useState } from 'react';
import { Settings, RefreshCw, Wand2, ImagePlus, X } from 'lucide-react';

interface PromptAreaProps {
  prompt: string;
  setPrompt: (value: string) => void;
  mustSelectModel: boolean;
  isGenerating: boolean;
  handleSettingsClick: () => void;
  handleGenerate: () => void;
  showSettings: boolean;
  handleImageUpload?: (buffer: ArrayBuffer) => void;
}

const PromptArea: React.FC<PromptAreaProps> = ({
  prompt,
  setPrompt,
  mustSelectModel,
  isGenerating,
  handleSettingsClick,
  handleGenerate,
  showSettings,
  handleImageUpload
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);

      // Handle the buffer for generation
      const buffer = await file.arrayBuffer();
      console.log('Uploaded image buffer:', buffer);
      handleImageUpload?.(buffer);
    } catch (err) {
      console.error('Error reading file:', err);
    }
  };

  const clearImagePreview = () => {
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="glassmorphic rounded-xl p-6">
      <div className="space-y-4">
        {mustSelectModel && (
          <div className="bg-red-100 text-red-800 p-2 rounded">
            <strong>Please select a model from the side panel first.</strong>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Describe your image
          </label>
          <div className="relative flex gap-4">
            {imagePreview && (
              <div className="flex-shrink-0 relative group">
                <img
                  src={imagePreview}
                  alt="Upload preview"
                  className="w-[100px] h-[100px] object-cover rounded-lg border border-gray-200 dark:border-gray-700"
                />
                <button
                  onClick={clearImagePreview}
                  className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex-grow relative">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="A serene landscape with mountains and a lake at sunset..."
                className="w-full px-4 py-3 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100 min-h-[100px]"
              />
              {!imagePreview && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute right-2 top-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Upload image"
                >
                  <ImagePlus className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
          </div>
        </div>
        <div className="flex justify-between items-center">
          <button
            onClick={handleSettingsClick}
            className="p-2 rounded-lg hover:bg-sakura-50 dark:hover:bg-sakura-100/5 cursor-pointer transition-colors"
          >
            <Settings
              className={`w-6 h-6 text-gray-600 dark:text-gray-400 transition-transform duration-300 ${
                showSettings ? 'rotate-180' : ''
              }`}
            />
          </button>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-sakura-500 text-white hover:bg-sakura-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                Generate
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PromptArea;
