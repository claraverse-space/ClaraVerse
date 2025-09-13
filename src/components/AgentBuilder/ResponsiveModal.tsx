import React from 'react';

interface ResponsiveModalProps {
  isOpen: boolean;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
}

/**
 * A responsive modal component that automatically adjusts to sidebar and topbar spacing
 * in the Agent Studio context.
 */
const ResponsiveModal: React.FC<ResponsiveModalProps> = ({
  isOpen,
  children,
  size = 'lg',
  className = ''
}) => {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl', 
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-full'
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex">
      {/* Offset for sidebar - responsive to both collapsed and expanded states */}
      <div className="w-20 xl:w-64 flex-shrink-0" />
      
      <div className="flex-1 flex items-center justify-center p-4 min-w-0" style={{ paddingTop: '5rem' }}>
        <div 
          className={`bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full ${sizeClasses[size]} flex flex-col overflow-hidden ${className}`}
          style={{
            height: size === 'full' ? 'calc(100vh - 8rem)' : 'min(85vh, calc(100vh - 8rem))',
            maxHeight: size === 'full' ? 'calc(100vh - 8rem)' : 'min(85vh, calc(100vh - 8rem))',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default ResponsiveModal;
