// ClaraVerse Scheduler IPC Client
// Provides UI access to scheduler running in main process

declare global {
  interface Window {
    schedulerIPC: {
      start: () => Promise<{ success: boolean; error?: string }>;
      stop: () => Promise<{ success: boolean; error?: string }>;
      getStatus: () => Promise<{ isRunning: boolean; activeExecutions: number; error?: string }>;
      getActiveTasks: () => Promise<any[]>;
      getTaskExecutions: (taskId?: string) => Promise<any[]>;
      cancelTask: (taskId: string) => Promise<{ success: boolean; error?: string }>;
    };
  }
}

class SchedulerIPCClient {
  async start(): Promise<{ success: boolean; error?: string }> {
    try {
      return await window.electronAPI.invoke('scheduler:start');
    } catch (error) {
      console.error('Scheduler IPC start error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async stop(): Promise<{ success: boolean; error?: string }> {
    try {
      return await window.electronAPI.invoke('scheduler:stop');
    } catch (error) {
      console.error('Scheduler IPC stop error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async getStatus(): Promise<{ isRunning: boolean; activeExecutions: number; error?: string }> {
    try {
      return await window.electronAPI.invoke('scheduler:status');
    } catch (error) {
      console.error('Scheduler IPC status error:', error);
      return { isRunning: false, activeExecutions: 0, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async getActiveTasks(): Promise<any[]> {
    try {
      return await window.electronAPI.invoke('scheduler:getActiveTasks');
    } catch (error) {
      console.error('Scheduler IPC getActiveTasks error:', error);
      return [];
    }
  }

  async getTaskExecutions(taskId?: string): Promise<any[]> {
    try {
      return await window.electronAPI.invoke('scheduler:getTaskExecutions', taskId);
    } catch (error) {
      console.error('Scheduler IPC getTaskExecutions error:', error);
      return [];
    }
  }

  async cancelTask(taskId: string): Promise<{ success: boolean; error?: string }> {
    try {
      return await window.electronAPI.invoke('scheduler:cancelTask', taskId);
    } catch (error) {
      console.error('Scheduler IPC cancelTask error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}

// Create global scheduler IPC client
const schedulerIPC = new SchedulerIPCClient();

// Make available globally
if (typeof window !== 'undefined') {
  window.schedulerIPC = schedulerIPC;
}

export { schedulerIPC };
