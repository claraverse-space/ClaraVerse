import React, { useEffect, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Video } from 'lucide-react'; // Use a camera or video icon

interface WebcamInputNodeProps {
  data: any;
  isConnectable: boolean;
}

const WebcamInputNode: React.FC<WebcamInputNodeProps> = ({ data, isConnectable }) => {
  const [outputImage, setOutputImage] = useState(data.config?.outputImage || '');

  // Update the preview when the node's configuration changes
  useEffect(() => {
    if (data.config && data.config.outputImage) {
      setOutputImage(data.config.outputImage);
    }
  }, [data.config]);

  return (
    <div className="node-container min-w-[200px] rounded-md shadow-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div 
        className="node-header flex items-center p-2 border-b border-gray-200 dark:border-gray-700 rounded-t-md" 
        style={{ backgroundColor: data.tool?.lightColor || '#3B82F6' }}
      >
        <Video className="w-4 h-4 mr-2 text-white" />
        <div className="text-sm font-medium text-white truncate">
          {data.label || 'Webcam Input'}
        </div>
      </div>
      
      <div className="p-3 flex flex-col gap-2">
        {outputImage ? (
          <img src={outputImage} alt="Webcam capture" className="w-full h-auto rounded-md" />
        ) : (
          <div className="text-sm text-gray-500">No image captured yet.</div>
        )}
      </div>
      
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={isConnectable}
        className="w-2 h-2 rounded-full bg-green-500 border-2 border-white dark:border-gray-800"
      />
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={isConnectable}
        className="w-2 h-2 rounded-full bg-blue-500 border-2 border-white dark:border-gray-800"
      />
    </div>
  );
};

export default WebcamInputNode;
