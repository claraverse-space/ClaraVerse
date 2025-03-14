import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position } from 'reactflow';
import { Video } from 'lucide-react';
import { useTheme } from '../../../hooks/useTheme';

const WebcamInputNode: React.FC<{ data: any; isConnectable: boolean; isRunnerMode?: boolean }> = ({
  data,
  isConnectable,
  isRunnerMode = false,
}) => {
  const { isDark } = useTheme();
  const tool = data.tool;
  const Icon = tool.icon;
  const nodeColor = isDark ? tool.darkColor : tool.lightColor;
  
  // State for captured image (if already captured)
  const [capturedImage, setCapturedImage] = useState<string | null>(data.config?.image || null);
  // Reference for live video element
  const videoRef = useRef<HTMLVideoElement>(null);
  // Store the stream so we can stop it later
  const streamRef = useRef<MediaStream | null>(null);

  // If no image is captured, start webcam stream
  useEffect(() => {
    if (!capturedImage) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
        })
        .catch((err) => {
          console.error('Failed to access webcam:', err);
        });
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [capturedImage]);

  const captureImage = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageDataUrl = canvas.toDataURL('image/png');
        setCapturedImage(imageDataUrl);
        if (!data.config) data.config = {};
        data.config.image = imageDataUrl;
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
      }
    }
  };

  const retakeImage = () => {
    setCapturedImage(null);
    if (data.config) {
      data.config.image = null;
    }
  };

  return (
    <div 
      className={`p-3 rounded-lg border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} shadow-md w-64`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg" style={{ background: nodeColor }}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <div className="font-medium text-sm text-gray-900 dark:text-white">
          {isRunnerMode ? `${data.label} (Click to change)` : data.label}
        </div>
      </div>
      
      <div className="mb-2">
        {capturedImage ? (
          <div className="relative">
            <img 
              src={capturedImage} 
              alt="Webcam capture" 
              className="w-full h-32 object-cover rounded border"
            />
            <button 
              className="absolute top-1 right-1 bg-red-500 p-1 rounded-full text-white text-xs"
              onClick={(e) => {
                e.stopPropagation();
                retakeImage();
              }}
            >
              Retake
            </button>
          </div>
        ) : (
          <div className="relative">
            <video ref={videoRef} className="w-full h-32 object-cover rounded border" autoPlay muted playsInline />
            <button 
              className="absolute bottom-1 right-1 bg-blue-500 p-1 rounded-full text-white text-xs"
              onClick={(e) => {
                e.stopPropagation();
                captureImage();
              }}
            >
              Capture
            </button>
          </div>
        )}
      </div>
      
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
  id: 'webcam_input',
  name: 'Webcam Input',
  description: 'Capture image from your webcam',
  icon: Video,
  color: 'bg-blue-500',
  bgColor: 'bg-blue-100',
  lightColor: '#3B82F6',
  darkColor: '#60A5FA',
  category: 'input',
  inputs: [],
  outputs: ['image'],
};

export default WebcamInputNode;
