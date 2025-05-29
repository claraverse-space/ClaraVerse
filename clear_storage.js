// Clear browser storage script
// Run this in the browser console to simulate a first-time user experience

console.log('🧹 Clearing all browser storage...');

// Clear localStorage
try {
  localStorage.clear();
  console.log('✅ localStorage cleared');
} catch (e) {
  console.log('❌ localStorage clear failed:', e);
}

// Clear sessionStorage
try {
  sessionStorage.clear();
  console.log('✅ sessionStorage cleared');
} catch (e) {
  console.log('❌ sessionStorage clear failed:', e);
}

// Clear IndexedDB
async function clearIndexedDB() {
  try {
    const databases = await indexedDB.databases();
    await Promise.all(
      databases.map(({ name }) => {
        return new Promise((resolve, reject) => {
          const deleteReq = indexedDB.deleteDatabase(name);
          deleteReq.onerror = () => reject(deleteReq.error);
          deleteReq.onsuccess = () => resolve(deleteReq.result);
        });
      })
    );
    console.log('✅ IndexedDB cleared');
  } catch (e) {
    console.log('❌ IndexedDB clear failed:', e);
  }
}

clearIndexedDB();

console.log('🔄 Storage cleared! Refresh the page to simulate first-time user experience.');
console.log('💡 Tip: Open DevTools Console to see provider initialization logs.'); 