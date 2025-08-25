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
setTimeout(async () => {
  if (window.electron?.sendReactReady) {
    console.log('Signaling that React app is ready');
    window.electron.sendReactReady();
  }
  
  // Expose required services globally for scheduler execution
  try {
    console.log('🔧 Setting up global scheduler dependencies...');
    
    // Import and expose ClaraFlowRunner
    const { ClaraFlowRunner } = await import('../sdk/src/ClaraFlowRunner');
    (window as any).ClaraFlowRunner = ClaraFlowRunner;
    
    // Import and expose storage services
    const { agentWorkflowStorage } = await import('./services/agentWorkflowStorage');
    const { schedulerStorage } = await import('./services/schedulerStorage');
    const customNodeManagerModule = await import('../sdk/src/customNodeManager');
    
    (window as any).agentWorkflowStorage = agentWorkflowStorage;
    (window as any).schedulerStorage = schedulerStorage;
    (window as any).customNodeManager = customNodeManagerModule.CustomNodeManager || customNodeManagerModule.default;
    
    // Debug: Log what methods are available
    console.log('🔍 agentWorkflowStorage methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(agentWorkflowStorage)));
    console.log('🔍 schedulerStorage methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(schedulerStorage)));
    console.log('🔍 Checking if getWorkflow exists:', typeof agentWorkflowStorage.getWorkflow);
    
    console.log('✅ Global scheduler dependencies ready');
  } catch (error) {
    console.error('❌ Failed to setup global scheduler dependencies:', error);
  }
}, 1000); // Give React time to fully render
