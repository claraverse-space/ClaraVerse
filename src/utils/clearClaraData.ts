import { claraDB } from '../db/claraDatabase';

/**
 * Utility to clear all Clara chat data
 * This will permanently delete all chat sessions, messages, and files
 */
export async function clearAllClaraData(): Promise<boolean> {
  try {
    // Get current stats before clearing
    const stats = await claraDB.getClaraStorageStats();
    
    console.log('Current Clara data:', stats);
    
    // Clear IndexedDB Clara data
    await claraDB.clearAllClaraSessions();
    
    // Clear localStorage Clara data
    const claraKeys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.includes('clara') || 
        key.includes('Clara') ||
        key === 'clara_interpreter_session' ||
        key === 'clara_provider_configs'
      )) {
        claraKeys.push(key);
      }
    }
    
    // Remove all Clara-related localStorage items
    claraKeys.forEach(key => {
      localStorage.removeItem(key);
      console.log(`Removed localStorage item: ${key}`);
    });
    
    // Clear sessionStorage as well
    const claraSessionKeys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (
        key.includes('clara') || 
        key.includes('Clara')
      )) {
        claraSessionKeys.push(key);
      }
    }
    
    claraSessionKeys.forEach(key => {
      sessionStorage.removeItem(key);
      console.log(`Removed sessionStorage item: ${key}`);
    });
    
    console.log(`Successfully cleared ${stats.totalSessions} sessions, ${stats.totalMessages} messages, and ${stats.totalFiles} files`);
    console.log(`Cleared ${claraKeys.length} localStorage items and ${claraSessionKeys.length} sessionStorage items`);
    
    return true;
  } catch (error) {
    console.error('Failed to clear Clara data:', error);
    return false;
  }
}

/**
 * Clear Clara data with user confirmation (browser only)
 */
export async function clearClaraDataWithConfirmation(): Promise<boolean> {
  try {
    const stats = await claraDB.getClaraStorageStats();
    
    const confirmMessage = `This will permanently delete:\n` +
                         `• ${stats.totalSessions} chat sessions\n` +
                         `• ${stats.totalMessages} messages\n` +
                         `• ${stats.totalFiles} files\n` +
                         `• All localStorage/sessionStorage Clara data\n\n` +
                         `Are you sure you want to continue?`;

    if (confirm(confirmMessage)) {
      const success = await clearAllClaraData();
      if (success) {
        alert('Clara chat data cleared successfully!\n\nThe page will reload to refresh the UI.');
        // Add a small delay before reload to ensure all operations complete
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        alert('Failed to clear Clara chat data. Check console for details.');
      }
      return success;
    }
    
    return false;
  } catch (error) {
    console.error('Error in clearClaraDataWithConfirmation:', error);
    alert('Error clearing data. Check console for details.');
    return false;
  }
}

/**
 * Emergency clear function - clears everything and forces reload
 * Use this if the normal clear doesn't work
 */
export async function emergencyClearClaraData(): Promise<void> {
  try {
    console.log('🚨 Emergency Clara data clear initiated...');
    
    // Force clear IndexedDB by deleting the entire database
    if (typeof indexedDB !== 'undefined') {
      const deleteRequest = indexedDB.deleteDatabase('clara_db');
      deleteRequest.onsuccess = () => console.log('IndexedDB clara_db deleted');
      deleteRequest.onerror = () => console.log('Failed to delete IndexedDB clara_db');
    }
    
    // Clear all localStorage
    localStorage.clear();
    console.log('localStorage cleared');
    
    // Clear all sessionStorage
    sessionStorage.clear();
    console.log('sessionStorage cleared');
    
    alert('Emergency clear completed. The page will reload.');
    window.location.reload();
    
  } catch (error) {
    console.error('Emergency clear failed:', error);
    alert('Emergency clear failed. Try manually refreshing the page.');
  }
}

// Make it available globally for easy access from browser console
if (typeof window !== 'undefined') {
  (window as any).clearClaraData = clearClaraDataWithConfirmation;
  (window as any).clearClaraDataNow = clearAllClaraData;
  (window as any).emergencyClearClara = emergencyClearClaraData;
} 