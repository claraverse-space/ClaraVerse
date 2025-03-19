import React from 'react';
import { Handle, Position } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';
import { ImageIcon, Download } from 'lucide-react';

const ImageOutputNode = ({ data, isConnectable }: any) => {
  const { isDark } = useTheme();
  const tool = data.tool;
  const Icon = tool.icon;
  const nodeColor = isDark ? tool.darkColor : tool.lightColor;

  const handleDownload = () => {
    if (data.config?.outputImage) {
      const link = document.createElement('a');
      link.href = data.config.outputImage;
      link.download = 'generated-image.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div 
      className={`p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-md w-64`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg" style={{ background: nodeColor }}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div className="font-medium text-sm text-gray-900 dark:text-white">
            {data.label}
          </div>
        </div>
        {data.config?.outputImage && (
          <button
            onClick={handleDownload}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
            title="Download Image"
          >
            <Download className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="mb-2">
        {data.config?.outputImage ? (
          <img 
            src={data.config.outputImage} 
            alt="Output" 
            className="w-full rounded border border-gray-200 dark:border-gray-700"
          />
        ) : (
          <div className="w-full h-32 rounded border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Image will appear here
            </span>
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Top}
        id="image-in"
        isConnectable={isConnectable}
        className="!bg-pink-500 !w-3 !h-3"
        style={{ top: -6 }}
      />
    </div>
  );
};

export const metadata = {
  id: 'image_output',
  name: 'Image Output',
  description: 'Display and save generated images',
  icon: ImageIcon,
  color: 'bg-pink-500',
  bgColor: 'bg-pink-100',
  lightColor: '#EC4899',
  darkColor: '#F472B6',
  category: 'output',
  inputs: ['image'],
  outputs: [],
};

export default ImageOutputNode;
