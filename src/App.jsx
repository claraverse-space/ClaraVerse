import React, { useEffect } from 'react';
import MicrophonePermission from './components/MicrophonePermission';

function App() {
  return (
    <div className="app-container">
      {/* This component will request microphone permissions on app load */}
      <MicrophonePermission />
      
      {/* ...existing app UI... */}
    </div>
  );
}

export default App;