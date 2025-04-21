import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PostHogProvider } from 'posthog-js/react';
import posthog from 'posthog-js';
import App from './App.tsx';
import './index.css';
import './styles/animations.css'; // Import animations
// Import the node executors index so all executors get registered
import './nodeExecutors';

// PostHog configuration
const posthogOptions: Partial<posthog.Config> = {
  api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
  loaded: (posthog: posthog.PostHog) => {
    if (process.env.NODE_ENV === 'development') posthog.debug();
  },
  capture_pageview: false, // We'll manually capture what we want
  disable_session_recording: true, // Privacy first - no session recording
  persistence: 'localStorage' as const,
  bootstrap: {
    distinctID: 'anonymous', // Never collect real IDs
  },
};

// Log which executors are registered for debugging
console.log('Node executors loaded and registered');

// Set initial theme to light mode by default
document.documentElement.classList.remove('dark');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PostHogProvider 
      apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
      options={posthogOptions}
    >
      <App />
    </PostHogProvider>
  </StrictMode>
);
