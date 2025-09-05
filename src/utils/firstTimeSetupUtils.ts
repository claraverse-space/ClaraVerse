/**
 * Utility functions for testing the first-time setup modal
 */

/**
 * Reset the first-time setup flag to test the modal again
 */
export const resetFirstTimeSetup = () => {
  localStorage.removeItem('clara-setup-completed');
  localStorage.removeItem('clara-setup-timestamp');
  localStorage.removeItem('clara-setup-config');
  console.log('🔄 First-time setup flags reset. Reload the page to see the setup modal.');
};

/**
 * Check the current first-time setup status
 */
export const getFirstTimeSetupStatus = () => {
  const completed = localStorage.getItem('clara-setup-completed');
  const timestamp = localStorage.getItem('clara-setup-timestamp');
  const config = localStorage.getItem('clara-setup-config');
  
  return {
    isCompleted: completed === 'true',
    isSkipped: completed === 'skipped',
    timestamp: timestamp ? new Date(timestamp) : null,
    config: config ? JSON.parse(config) : null
  };
};

/**
 * Simulate first-time user for testing
 */
export const simulateFirstTimeUser = () => {
  resetFirstTimeSetup();
  console.log('🎯 Simulating first-time user. Reload the page to trigger setup modal.');
};

/**
 * Test the loading state by adding a delay to the setup process
 */
export const testLoadingState = () => {
  // Override the onComplete function to add delays for testing
  console.log('🧪 Testing loading state. The setup process will be slower to show loading states.');
  localStorage.setItem('clara-test-slow-setup', 'true');
};

// Make functions available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).debugFirstTimeSetup = {
    reset: resetFirstTimeSetup,
    status: getFirstTimeSetupStatus,
    simulate: simulateFirstTimeUser,
    testLoading: testLoadingState
  };
}
