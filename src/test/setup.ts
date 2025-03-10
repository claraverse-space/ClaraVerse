import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend expect with jest-dom matchers
expect.extend(matchers);

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Mock for crypto.randomUUID
if (!global.crypto) {
  global.crypto = {
    randomUUID: () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  } as any;
}

// Mock for localStorage
class LocalStorageMock {
  store: Record<string, string> = {};

  getItem(key: string): string | null {
    return this.store[key] || null;
  }

  setItem(key: string, value: string): void {
    this.store[key] = value;
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  clear(): void {
    this.store = {};
  }
}

global.localStorage = new LocalStorageMock() as any;

// Basic mock objects for requests to avoid setting undefined properties
class MockEventTarget {
  listeners: Record<string, Function> = {};
  
  addEventListener(event: string, callback: Function) {
    this.listeners[event] = callback;
  }
  
  dispatchEvent(event: any) {
    const callback = this.listeners[event.type];
    if (callback) callback(event);
    return true;
  }
}

// This creates a properly structured mock for IndexedDB to prevent "cannot set property of undefined" errors
if (!global.indexedDB) {
  class MockIDBRequest extends MockEventTarget {
    result: any = null;
    error: Error | null = null;
    readyState: 'pending' | 'done' = 'pending';
    transaction: any = null;
    source: any = null;
    
    // For proper property definitions to avoid null errors
    get onsuccess() { return this.listeners['success']; }
    set onsuccess(callback: any) { this.addEventListener('success', callback); }
    
    get onerror() { return this.listeners['error']; }
    set onerror(callback: any) { this.addEventListener('error', callback); }
    
    get onupgradeneeded() { return this.listeners['upgradeneeded']; }
    set onupgradeneeded(callback: any) { this.addEventListener('upgradeneeded', callback); }
  }
  
  global.indexedDB = {
    open: () => new MockIDBRequest(),
    deleteDatabase: () => new MockIDBRequest()
  } as any;
}

// Mock fetch if not available
if (!global.fetch) {
  global.fetch = vi.fn();
}

// Mock URL if needed
if (!global.URL || !global.URL.createObjectURL) {
  global.URL = {
    ...global.URL,
    createObjectURL: vi.fn(() => 'mock-url'),
    revokeObjectURL: vi.fn()
  } as any;
}
