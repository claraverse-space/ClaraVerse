import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { setupGlobalErrorHandlers } from './utils/globalErrorHandler.ts';
import './utils/errorTestHelpers.ts'; // Import to make console helpers available
import './index.css';
import './styles/animations.css'; // Import animations

// Set initial theme to light mode by default
document.documentElement.classList.remove('dark');

// Setup global error handlers for unhandled promise rejections and JS errors
setupGlobalErrorHandlers();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);

// Signal to electron main process that React app is ready
// Use setTimeout to ensure the app is fully rendered and initialized
setTimeout(() => {
  if (window.electron?.sendReactReady) {
    console.log('Signaling that React app is ready');
    window.electron.sendReactReady();
  }
}, 1000); // Give React time to fully render
