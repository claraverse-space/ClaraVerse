import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with Testing Library matchers
expect.extend(matchers);

// Cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia (used by some components)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock sessionStorage and localStorage
const createStorageMock = () => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
});

Object.defineProperty(window, 'sessionStorage', {
  value: createStorageMock(),
  writable: true,
});

Object.defineProperty(window, 'localStorage', {
  value: createStorageMock(),
  writable: true,
});

// Mock performance API
Object.defineProperty(window, 'performance', {
  value: {
    now: vi.fn(() => Date.now()),
    mark: vi.fn(),
    measure: vi.fn(),
  },
  writable: true,
});

// Mock document.hidden property
Object.defineProperty(document, 'hidden', {
  value: false,
  writable: true,
});

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  
  // Reset storage mocks to actual implementations
  Object.defineProperty(window, 'sessionStorage', {
    value: {
      getItem: (key: string) => {
        const value = (global as any).__sessionStorage?.[key];
        return value !== undefined ? value : null;
      },
      setItem: (key: string, value: string) => {
        if (!(global as any).__sessionStorage) {
          (global as any).__sessionStorage = {};
        }
        (global as any).__sessionStorage[key] = value;
      },
      removeItem: (key: string) => {
        if ((global as any).__sessionStorage) {
          delete (global as any).__sessionStorage[key];
        }
      },
      clear: () => {
        (global as any).__sessionStorage = {};
      },
      length: 0,
      key: vi.fn(),
    },
    writable: true,
  });
  
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: (key: string) => {
        const value = (global as any).__localStorage?.[key];
        return value !== undefined ? value : null;
      },
      setItem: (key: string, value: string) => {
        if (!(global as any).__localStorage) {
          (global as any).__localStorage = {};
        }
        (global as any).__localStorage[key] = value;
      },
      removeItem: (key: string) => {
        if ((global as any).__localStorage) {
          delete (global as any).__localStorage[key];
        }
      },
      clear: () => {
        (global as any).__localStorage = {};
      },
      length: 0,
      key: vi.fn(),
    },
    writable: true,
  });
});
