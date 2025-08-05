import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useNetworkResiliency, useNetworkRecovery } from './useNetworkResiliency';

describe('Network Resiliency Hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset sessionStorage
    window.sessionStorage.clear();
    // Mock window.electron
    (window as any).electron = { networkRecovered: null };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('useNetworkResiliency', () => {
    it('should initialize with correct methods', () => {
      const { result } = renderHook(() => useNetworkResiliency());
      
      expect(typeof result.current.preserveState).toBe('function');
      expect(typeof result.current.restoreState).toBe('function');
    });

    it('should preserve and restore state correctly', () => {
      const { result } = renderHook(() => useNetworkResiliency());
      
      const testState = {
        chatHistory: ['Message 1', 'Message 2'],
        currentModel: 'llama-3.1-8b',
        userInput: 'Test input'
      };

      // Preserve state
      act(() => {
        result.current.preserveState(testState);
      });

      // Check sessionStorage was updated
      const savedState = JSON.parse(sessionStorage.getItem('__network_recovery_state__') || '{}');
      expect(savedState.chatHistory).toEqual(testState.chatHistory);
      expect(savedState.currentModel).toBe(testState.currentModel);
      expect(savedState.userInput).toBe(testState.userInput);
      expect(savedState.timestamp).toBeDefined();

      // Restore state
      let restoredState: any;
      act(() => {
        restoredState = result.current.restoreState();
      });

      expect(restoredState?.chatHistory).toEqual(testState.chatHistory);
      expect(restoredState?.currentModel).toBe(testState.currentModel);
      expect(restoredState?.timestamp).toBeDefined();
    });

    it('should restore from sessionStorage when memory is empty', () => {
      const testState = {
        formData: { prompt: 'Test prompt' },
        timestamp: Date.now()
      };
      
      // Manually set sessionStorage
      sessionStorage.setItem('__network_recovery_state__', JSON.stringify(testState));
      
      const { result } = renderHook(() => useNetworkResiliency());
      
      let restoredState: any;
      act(() => {
        restoredState = result.current.restoreState();
      });

      expect(restoredState).toEqual(testState);
      // Should remove from sessionStorage after restore
      expect(sessionStorage.getItem('__network_recovery_state__')).toBeNull();
    });

    it('should handle corrupted sessionStorage gracefully', () => {
      // Set invalid JSON
      sessionStorage.setItem('__network_recovery_state__', 'invalid-json');
      
      const { result } = renderHook(() => useNetworkResiliency());
      
      let restoredState: any;
      act(() => {
        restoredState = result.current.restoreState();
      });

      expect(restoredState).toBeNull();
    });

    it('should setup network recovery handler', () => {
      renderHook(() => useNetworkResiliency());
      
      // Should set up window.electron.networkRecovered
      expect((window as any).electron.networkRecovered).toBeDefined();
      expect(typeof (window as any).electron.networkRecovered).toBe('function');
    });

    it('should dispatch custom event on network recovery', () => {
      const { result } = renderHook(() => useNetworkResiliency());
      
      const testState = {
        test: 'data',
        timestamp: Date.now()
      };

      // Preserve state first
      act(() => {
        result.current.preserveState(testState);
      });

      // Mock event listener
      const eventHandler = vi.fn();
      window.addEventListener('network-state-recovered', eventHandler);

      // Trigger network recovery
      if ((window as any).electron.networkRecovered) {
        act(() => {
          (window as any).electron.networkRecovered();
        });
      }

      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'network-state-recovered',
          detail: expect.objectContaining({
            test: 'data',
            timestamp: expect.any(Number)
          })
        })
      );
    });
  });

  describe('useNetworkRecovery', () => {
    it('should call onRecover when network state is recovered', () => {
      const onRecover = vi.fn();
      renderHook(() => useNetworkRecovery(onRecover));

      const recoveredState = { test: 'recovered data' };
      
      // Dispatch recovery event
      act(() => {
        window.dispatchEvent(new CustomEvent('network-state-recovered', {
          detail: recoveredState
        }));
      });

      expect(onRecover).toHaveBeenCalledWith(recoveredState);
    });

    it('should work without onRecover callback', () => {
      expect(() => {
        renderHook(() => useNetworkRecovery());
      }).not.toThrow();
    });

    it('should clean up event listener on unmount', () => {
      const onRecover = vi.fn();
      const { unmount } = renderHook(() => useNetworkRecovery(onRecover));
      
      // Should not throw on unmount
      expect(() => unmount()).not.toThrow();
      
      // Event should not be called after unmount
      act(() => {
        window.dispatchEvent(new CustomEvent('network-state-recovered', {
          detail: { test: 'data' }
        }));
      });

      expect(onRecover).not.toHaveBeenCalled();
    });
  });

  describe('Integration Test: Full Recovery Flow', () => {
    it('should handle complete network crash recovery flow', async () => {
      const onRecover = vi.fn();
      
      // Setup hooks
      const { result: resiliencyResult } = renderHook(() => useNetworkResiliency());
      renderHook(() => useNetworkRecovery(onRecover));

      const initialState = {
        chatHistory: ['User: Hello', 'AI: Hi there!'],
        currentModel: 'llama-3.1-8b',
        formData: { prompt: 'In progress...' },
        uiState: { theme: 'dark', language: 'en' }
      };

      // Step 1: Preserve state (as would happen during crash)
      act(() => {
        resiliencyResult.current.preserveState(initialState);
      });

      // Step 2: Simulate network recovery
      act(() => {
        if ((window as any).electron.networkRecovered) {
          (window as any).electron.networkRecovered();
        }
      });

      // Step 3: Verify recovery callback was called
      expect(onRecover).toHaveBeenCalledWith(
        expect.objectContaining({
          chatHistory: initialState.chatHistory,
          currentModel: initialState.currentModel,
          formData: initialState.formData,
          uiState: initialState.uiState,
          timestamp: expect.any(Number)
        })
      );
    });

    it('should not recover state if too much time has passed', () => {
      const onRecover = vi.fn();
      
      renderHook(() => useNetworkResiliency());
      renderHook(() => useNetworkRecovery(onRecover));

      const oldState = {
        test: 'data',
        timestamp: Date.now() - 60000 // 60 seconds ago
      };

      // Manually set old state in sessionStorage
      sessionStorage.setItem('__network_recovery_state__', JSON.stringify(oldState));

      // Trigger recovery
      act(() => {
        if ((window as any).electron.networkRecovered) {
          (window as any).electron.networkRecovered();
        }
      });

      // Should not call onRecover for old state
      expect(onRecover).not.toHaveBeenCalled();
    });
  });

  describe('Form Data Preservation', () => {
    it('should gather form data on beforeunload', () => {
      // Create test form elements
      const input = document.createElement('input');
      input.id = 'test-input';
      input.value = 'test value';
      document.body.appendChild(input);

      const textarea = document.createElement('textarea');
      textarea.name = 'test-textarea';
      textarea.value = 'textarea content';
      document.body.appendChild(textarea);

      renderHook(() => useNetworkResiliency());

      // Mock performance.now to return > 5000 (5 seconds)
      const originalPerformanceNow = performance.now;
      performance.now = vi.fn(() => 10000);
      
      // Mock document.hidden
      Object.defineProperty(document, 'hidden', {
        value: false,
        writable: true
      });

      // Simulate beforeunload
      const beforeUnloadEvent = new Event('beforeunload') as BeforeUnloadEvent;
      
      act(() => {
        window.dispatchEvent(beforeUnloadEvent);
      });

      // Check that form data was preserved
      const savedState = JSON.parse(sessionStorage.getItem('__network_recovery_state__') || '{}');
      expect(savedState.formData).toBeDefined();
      expect(savedState.formData['test-input']).toEqual({
        type: 'text',
        value: 'test value',
        tagName: 'INPUT'
      });
      expect(savedState.formData['test-textarea']).toEqual({
        type: undefined,
        value: 'textarea content',
        tagName: 'TEXTAREA'
      });

      // Cleanup
      performance.now = originalPerformanceNow;
      document.body.removeChild(input);
      document.body.removeChild(textarea);
    });
  });
});
