import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Import registry functions
import { registerNodeExecutor } from './nodeExecutors/NodeExecutorRegistry';

// Import the node executors index so all executors get registered
import './nodeExecutors';

// Double-check that the critical Image LLM executor is registered
import { executeImageLlmPrompt } from './nodeExecutors/ImageLlmPromptExecutor';

// Log which executors are registered for debugging
console.log('Node executors loaded and registered');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
