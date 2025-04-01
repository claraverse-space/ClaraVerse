import { useEffect, useState } from 'react';

export default function MicrophonePermission() {
  const [micPermission, setMicPermission] = useState('unknown');

  useEffect(() => {
    // Check if we're in production build where permissions matter most
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(() => {
          setMicPermission('granted');
          console.log('Microphone permission granted');
        })
        .catch(err => {
          setMicPermission('denied');
          console.error('Microphone permission error:', err);
          
          // Only show UI warning in production build
          if (import.meta.env.PROD) {
            // You can add a UI notification here if needed
          }
        });
    }
  }, []);

  // Return null as this is just a utility component
  return null;
}
