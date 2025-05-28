import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import { setupGlobalErrorHandlers } from './utils/globalErrorHandler.ts';
import './utils/errorTestHelpers.ts'; // Import to make console helpers available
import './index.css';
import './styles/animations.css'; // Import animations
// Import the node executors index so all executors get registered
import './nodeExecutors';

// Log which executors are registered for debugging
console.log('Node executors loaded and registered');

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
