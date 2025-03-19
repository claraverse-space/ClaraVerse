import React, { useState, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';
import { ImageIcon, Settings } from 'lucide-react';

const ImageResizeNode = ({ data, isConnectable }: any) => {
  const { isDark } = useTheme();
  const tool = data.tool;
  const Icon = tool.icon || ImageIcon;
  const nodeColor = isDark ? tool.darkColor : tool.lightColor;

  const [showSettings, setShowSettings] = useState(false);
  const [percentage, setPercentage] = useState(data.config?.percentage || 100);
  const [width, setWidth] = useState(data.config?.width || 512);
  const [height, setHeight] = useState(data.config?.height || 512);
  const [useManualSize, setUseManualSize] = useState(data.config?.useManualSize || false);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Update node config when settings change
  const handlePercentageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setPercentage(value);
    if (!data.config) data.config = {};
    data.config.percentage = value;

    // Update dimensions if we have an input image
    if (data?.inputs?.image) {
      const img = new Image();
      img.onload = () => {
        const newWidth = Math.round((img.width * value) / 100);
        const newHeight = Math.round((img.height * value) / 100);
        setDimensions({ width: newWidth, height: newHeight });
      };
      img.src = data.inputs.image;
    }
  };

  const handleManualSizeChange = (dimension: 'width' | 'height', value: number) => {
    if (dimension === 'width') {
      setWidth(value);
    } else {
      setHeight(value);
    }
    if (!data.config) data.config = {};
    data.config[dimension] = value;
    data.config.useManualSize = true;
  };

  const toggleSizeMode = () => {
    setUseManualSize(!useManualSize);
    if (!data.config) data.config = {};
    data.config.useManualSize = !useManualSize;
  };

  // Update config when mode changes
  useEffect(() => {
    if (!data.config) data.config = {};
    data.config.useManualSize = useManualSize;
    data.config.width = width;
    data.config.height = height;
    data.config.percentage = percentage;
  }, [useManualSize, width, height, percentage]);

  // Add effect to calculate dimensions when image input changes
  useEffect(() => {
    if (data?.inputs?.image) {
      const img = new Image();
      img.onload = () => {
        if (!useManualSize) {
          const newWidth = Math.round((img.width * percentage) / 100);
          const newHeight = Math.round((img.height * percentage) / 100);
          setDimensions({ width: newWidth, height: newHeight });
        }
      };
      img.src = data.inputs.image;
    }
  }, [data?.inputs?.image, percentage, useManualSize]);

  return (
    <div className={`p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-md w-64`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ background: nodeColor }}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="font-medium text-sm text-gray-900 dark:text-white">
            {data.label || 'Image Resize'}
          </div>
        </div>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {showSettings && (
        <div className="mb-3 space-y-3">
          <div className="flex items-center justify-between">
            <label className="block text-xs text-gray-700 dark:text-gray-300">
              Resize Mode
            </label>
            <button
              onClick={toggleSizeMode}
              className="text-xs px-2 py-1 rounded bg-blue-500 hover:bg-blue-600 text-white"
            >
              {useManualSize ? 'Use Percentage' : 'Use Manual Size'}
            </button>
          </div>

          {!useManualSize ? (
            <div>
              <label className="block text-xs mb-1 text-gray-700 dark:text-gray-300">
                Resize Percentage: {percentage}%
              </label>
              <input
                type="range"
                min="1"
                max="200"
                value={percentage}
                onChange={handlePercentageChange}
                className="w-full"
              />
              {dimensions.width > 0 && dimensions.height > 0 && (
                <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  Output size: {dimensions.width}×{dimensions.height}px
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="block text-xs mb-1 text-gray-700 dark:text-gray-300">
                  Width (px)
                </label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => handleManualSizeChange('width', Number(e.target.value))}
                  className="w-full p-2 text-sm rounded border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="1"
                  step="1"
                />
              </div>
              <div>
                <label className="block text-xs mb-1 text-gray-700 dark:text-gray-300">
                  Height (px)
                </label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => handleManualSizeChange('height', Number(e.target.value))}
                  className="w-full p-2 text-sm rounded border bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="1"
                  step="1"
                />
              </div>
            </div>
          )}
        </div>
      )}

      <Handle
        type="target"
        position={Position.Top}
        id="image-in"
        isConnectable={isConnectable}
        className="!bg-pink-500 !w-3 !h-3"
        style={{ top: -6 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="image-out"
        isConnectable={isConnectable}
        className="!bg-pink-500 !w-3 !h-3"
        style={{ bottom: -6 }}
      />
    </div>
  );
};

export const metadata = {
  id: 'image_resize',
  name: 'Image Resize',
  description: 'Resize images by percentage',
  icon: ImageIcon,
  color: 'bg-orange-500',
  bgColor: 'bg-orange-100',
  lightColor: '#F97316',
  darkColor: '#FB923C',
  category: 'image',
  inputs: ['image'],
  outputs: ['image'],
};

export default ImageResizeNode;
