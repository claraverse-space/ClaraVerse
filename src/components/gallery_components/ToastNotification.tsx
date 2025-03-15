import React from 'react';

interface ToastNotificationProps {
  message: string;
  type: string;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({ message, type }) => {
  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg z-50">
      {message}
    </div>
  );
};

export default ToastNotification;
