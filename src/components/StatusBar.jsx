import { useState, useEffect } from 'react';
import api from '../services/api';

export default function StatusBar() {
  const [status, setStatus] = useState('Connecting...');
  const [port, setPort] = useState(null);
  
  useEffect(() => {
    // Listen for Electron initialization status
    if (window.electron) {
      window.electron.receive('initialization-status', (data) => {
        setStatus(data.status);
        if (data.pythonPort) {
          setPort(data.pythonPort);
        }
      });
      
      // Try to get port directly
      window.electron.getPythonPort().then(setPort).catch(console.error);
    }
    
    // Test API connection
    const testConnection = async () => {
      try {
        const result = await api.getTest();
        if (result) {
          setStatus('Connected');
        }
      } catch (error) {
        setStatus('Disconnected');
        console.error('API connection test failed:', error);
      }
    };
    
    // Test connection every 5 seconds
    const interval = setInterval(testConnection, 5000);
    testConnection();
    
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="status-bar">
      <div className="status-indicator">
        <span className={`status-dot ${status === 'Connected' ? 'connected' : 'disconnected'}`}></span>
        <span>Python Backend: {status}</span>
        {port && <span className="port-info">Port: {port}</span>}
      </div>
    </div>
  );
}
