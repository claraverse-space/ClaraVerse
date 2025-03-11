const DB_NAME = 'clara_db';
const DB_VERSION = 2; // Increment version to trigger upgrade

export class IndexedDBService {
  private db: IDBDatabase | null = null;
  private connecting: Promise<IDBDatabase> | null = null;

  constructor() {
    this.initDB();
  }

  async initDB(): Promise<IDBDatabase> {
    // Return existing connection or in-progress connection
    if (this.db) return this.db;
    if (this.connecting) return this.connecting;

    this.connecting = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('IndexedDB error:', event);
        reject('Failed to open database');
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create stores for all our data types
        if (!db.objectStoreNames.contains('chats')) {
          db.createObjectStore('chats', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('messages')) {
          db.createObjectStore('messages', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('storage')) {
          db.createObjectStore('storage', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('usage')) {
          db.createObjectStore('usage', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('model_usage')) {
          db.createObjectStore('model_usage', { keyPath: 'name' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        // Add the apps object store
        if (!db.objectStoreNames.contains('apps')) {
          db.createObjectStore('apps', { keyPath: 'id' });
        }
      };
    });

    return this.connecting;
  }

  async getAll<T>(storeName: string): Promise<T[]> {
    try {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`Error in getAll(${storeName}):`, error);
      return [];
    }
  }

  async get<T>(storeName: string, key: string | number): Promise<T | undefined> {
    try {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`Error in get(${storeName}, ${key}):`, error);
      return undefined;
    }
  }

  async put<T>(storeName: string, value: T): Promise<T> {
    try {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(value);

        request.onsuccess = () => resolve(value);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`Error in put(${storeName}):`, error);
      throw error;
    }
  }

  async delete(storeName: string, key: string | number): Promise<void> {
    try {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`Error in delete(${storeName}, ${key}):`, error);
      throw error;
    }
  }

  async clear(storeName: string): Promise<void> {
    try {
      const db = await this.initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`Error in clear(${storeName}):`, error);
      throw error;
    }
  }
}

export const indexedDBService = new IndexedDBService();
