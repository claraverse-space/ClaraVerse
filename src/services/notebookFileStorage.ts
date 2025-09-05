/**
 * IndexedDB service for storing uploaded notebook files locally
 * Allows users to view file content without re-uploading
 */

interface StoredFile {
  id: string;
  notebookId: string;
  filename: string;
  fileType: string;
  content: ArrayBuffer | string;
  uploadDate: Date;
  size: number;
}

class NotebookFileStorage {
  private dbName = 'ClaraNotebookFiles';
  private version = 1;
  private storeName = 'files';
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        console.error('Failed to open IndexedDB for notebook files');
        reject(new Error('Failed to initialize file storage'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          
          // Create indexes for efficient querying
          store.createIndex('notebookId', 'notebookId', { unique: false });
          store.createIndex('filename', 'filename', { unique: false });
          store.createIndex('uploadDate', 'uploadDate', { unique: false });
        }
      };
    });
  }

  async storeFile(
    documentId: string,
    notebookId: string,
    file: File
  ): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const content = reader.result;
        if (!content) {
          reject(new Error('Failed to read file content'));
          return;
        }

        const storedFile: StoredFile = {
          id: documentId,
          notebookId,
          filename: file.name,
          fileType: file.type || this.getFileTypeFromName(file.name),
          content: content as ArrayBuffer,
          uploadDate: new Date(),
          size: file.size
        };

        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.put(storedFile);

        request.onsuccess = () => {
          console.log(`Stored file locally: ${file.name} (${documentId})`);
          resolve();
        };

        request.onerror = () => {
          console.error(`Failed to store file: ${file.name}`);
          reject(new Error('Failed to store file locally'));
        };
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file for storage'));
      };

      // Read file as ArrayBuffer for binary storage
      reader.readAsArrayBuffer(file);
    });
  }

  async storeTextFile(
    documentId: string,
    notebookId: string,
    filename: string,
    content: string
  ): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const storedFile: StoredFile = {
        id: documentId,
        notebookId,
        filename,
        fileType: 'text/plain',
        content: content,
        uploadDate: new Date(),
        size: content.length
      };

      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(storedFile);

      request.onsuccess = () => {
        console.log(`Stored text file locally: ${filename} (${documentId})`);
        resolve();
      };

      request.onerror = () => {
        console.error(`Failed to store text file: ${filename}`);
        reject(new Error('Failed to store text file locally'));
      };
    });
  }

  async getFile(documentId: string): Promise<StoredFile | null> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(documentId);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          // Convert uploadDate back to Date object if it's stored as string
          result.uploadDate = new Date(result.uploadDate);
        }
        resolve(result || null);
      };

      request.onerror = () => {
        console.error(`Failed to retrieve file: ${documentId}`);
        reject(new Error('Failed to retrieve file from local storage'));
      };
    });
  }

  async getFilesForNotebook(notebookId: string): Promise<StoredFile[]> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('notebookId');
      const request = index.getAll(notebookId);

      request.onsuccess = () => {
        const results = request.result || [];
        // Convert uploadDate back to Date objects
        results.forEach(file => {
          file.uploadDate = new Date(file.uploadDate);
        });
        resolve(results);
      };

      request.onerror = () => {
        console.error(`Failed to retrieve files for notebook: ${notebookId}`);
        reject(new Error('Failed to retrieve files from local storage'));
      };
    });
  }

  async deleteFile(documentId: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(documentId);

      request.onsuccess = () => {
        console.log(`Deleted file from local storage: ${documentId}`);
        resolve();
      };

      request.onerror = () => {
        console.error(`Failed to delete file: ${documentId}`);
        reject(new Error('Failed to delete file from local storage'));
      };
    });
  }

  async deleteNotebookFiles(notebookId: string): Promise<void> {
    if (!this.db) {
      await this.init();
    }

    const files = await this.getFilesForNotebook(notebookId);
    const deletePromises = files.map(file => this.deleteFile(file.id));
    await Promise.all(deletePromises);
  }

  async isFileAvailable(documentId: string): Promise<boolean> {
    try {
      const file = await this.getFile(documentId);
      return file !== null;
    } catch (error) {
      console.error('Error checking file availability:', error);
      return false;
    }
  }

  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    filesByType: Record<string, number>;
  }> {
    if (!this.db) {
      await this.init();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const files = request.result || [];
        const stats = {
          totalFiles: files.length,
          totalSize: files.reduce((sum, file) => sum + file.size, 0),
          filesByType: {} as Record<string, number>
        };

        files.forEach(file => {
          const type = file.fileType || 'unknown';
          stats.filesByType[type] = (stats.filesByType[type] || 0) + 1;
        });

        resolve(stats);
      };

      request.onerror = () => {
        reject(new Error('Failed to get storage statistics'));
      };
    });
  }

  private getFileTypeFromName(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return 'application/pdf';
      case 'txt':
        return 'text/plain';
      case 'md':
        return 'text/markdown';
      case 'json':
        return 'application/json';
      case 'csv':
        return 'text/csv';
      default:
        return 'application/octet-stream';
    }
  }

  // Helper method to convert ArrayBuffer to text for text files
  arrayBufferToText(buffer: ArrayBuffer): string {
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(buffer);
  }

  // Helper method to create blob URL for viewing
  createBlobUrl(content: ArrayBuffer | string, type: string): string {
    const blob = new Blob(
      [content instanceof ArrayBuffer ? content : new TextEncoder().encode(content)],
      { type }
    );
    return URL.createObjectURL(blob);
  }
}

// Export singleton instance
export const notebookFileStorage = new NotebookFileStorage();
export type { StoredFile };
