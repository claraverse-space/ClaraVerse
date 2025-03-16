import React, { useState, useEffect } from 'react';

interface LoadingOverlayProps {
  progress?: { value: number; max: number } | null;
  images?: string[];
  error?: string | null;
  onCancel?: () => void;
  onRetry?: () => void;
  onNavigateHome?: () => void;  // New prop for navigation
}

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  progress, 
  images = [], 
  error, 
  onCancel,
  onRetry,
  onNavigateHome
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // Carousel effect - cycle through images every 3 seconds
  useEffect(() => {
    if (images.length <= 1) return;
    
    const interval = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 3000);
    
    return () => clearInterval(interval);
  }, [images.length]);

  // Calculate progress percentage
  const percentage = progress ? Math.floor((progress.value / progress.max) * 100) : 0;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 text-white text-center backdrop-blur-sm transition-all duration-300">
      <div className="relative max-w-2xl w-full px-6">
        {/* Progress indicator */}
        <div className="absolute -top-16 left-0 w-full">
          {progress && !error && (
            <div className="w-full">
              <div className="flex justify-between text-sm mb-1 opacity-80">
                <span>Generating...</span>
                <span>{percentage}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div 
                  className="bg-blue-500 h-2.5 rounded-full transition-all duration-300 animate-pulse"
                  style={{ width: `${percentage}%` }}
                ></div>
              </div>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="bg-gray-900/70 p-6 rounded-xl border border-gray-700 shadow-2xl backdrop-blur-md">
          {error ? (
            <div className="flex flex-col items-center">
              <h3 className="text-xl font-medium mb-4 text-red-400">Generation Error</h3>
              
              <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4 mb-4 w-full">
                <p className="text-sm text-red-300">{error}</p>
              </div>
              
              <div className="flex space-x-4 mt-4">
                <button
                  onClick={onRetry}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium transition-colors"
                >
                  Retry Generation
                </button>
                <button
                  onClick={onCancel}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-md text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={onNavigateHome}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-md text-sm font-medium transition-colors"
                >
                  Go Back Home
                </button>
              </div>
            </div>
          ) : images.length > 0 ? (
            <div className="flex flex-col items-center">
              <h3 className="text-xl font-medium mb-4">Creating your masterpiece...</h3>
              
              <div className="w-full h-72 relative overflow-hidden rounded-lg">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent z-10"></div>
                  
                  {/* Image carousel */}
                  <div className="relative w-full h-full transition-all duration-1000 ease-in-out">
                    {images.map((img, idx) => (
                      <div 
                        key={idx}
                        className={`absolute inset-0 transition-opacity duration-1000 ease-in-out bg-center bg-cover transform ${
                          idx === currentImageIndex ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
                        }`}
                        style={{ backgroundImage: `url(${img})` }}
                      />
                    ))}
                  </div>
                  
                  {/* Overlay with spinning icon */}
                  <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/30 backdrop-blur-sm">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                </div>
              </div>
              
              {/* Carousel indicators */}
              {images.length > 1 && (
                <div className="flex space-x-2 mt-4">
                  {images.map((_, idx) => (
                    <div 
                      key={idx}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        idx === currentImageIndex ? 'bg-blue-500 scale-125' : 'bg-gray-500'
                      }`}
                    />
                  ))}
                </div>
              )}
              
              <p className="mt-4 text-gray-300 animate-pulse">
                AI is weaving its magic...
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <h3 className="text-xl font-medium mb-4">Generating your first image</h3>
              <pre className="mb-4 text-blue-400 animate-pulse">
                {`
         /\\_./\\
        ( o.o  )
         > ^ < 
                `}
              </pre>
              <div className="flex items-center space-x-2">
                <div className="animate-bounce h-2 w-2 bg-blue-500 rounded-full"></div>
                <div className="animate-bounce h-2 w-2 bg-blue-500 rounded-full" style={{ animationDelay: '0.2s' }}></div>
                <div className="animate-bounce h-2 w-2 bg-blue-500 rounded-full" style={{ animationDelay: '0.4s' }}></div>
              </div>
              
              <p className="mt-4 text-gray-300">
                Crafting your imagination into pixels...
              </p>
            </div>
          )}
          
          {progress && !error && (
            <div className="mt-6 text-sm text-gray-400">
              Step {progress.value} of {progress.max}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LoadingOverlay;
