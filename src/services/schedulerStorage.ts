// ClaraVerse Scheduler Storage Service
// Manages scheduled tasks and execution results in local database

import { ScheduledTask, ScheduledTaskExecution } from '../types/agent/types';

class SchedulerStorageService {
  private dbName = 'claraverse-scheduler';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Scheduled Tasks store
        if (!db.objectStoreNames.contains('scheduledTasks')) {
          const tasksStore = db.createObjectStore('scheduledTasks', { keyPath: 'id' });
          tasksStore.createIndex('agentFlowId', 'agentFlowId', { unique: false });
          tasksStore.createIndex('enabled', 'schedule.enabled', { unique: false });
          tasksStore.createIndex('nextRun', 'schedule.nextRun', { unique: false });
        }

        // Task Executions store
        if (!db.objectStoreNames.contains('taskExecutions')) {
          const executionsStore = db.createObjectStore('taskExecutions', { keyPath: 'id' });
          executionsStore.createIndex('taskId', 'taskId', { unique: false });
          executionsStore.createIndex('agentFlowId', 'agentFlowId', { unique: false });
          executionsStore.createIndex('status', 'status', { unique: false });
          executionsStore.createIndex('startTime', 'startTime', { unique: false });
        }
      };
    });
  }

  // ===== SCHEDULED TASKS CRUD =====

  async saveScheduledTask(task: ScheduledTask): Promise<void> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['scheduledTasks'], 'readwrite');
      const store = transaction.objectStore('scheduledTasks');
      
      const request = store.put(task);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getScheduledTask(taskId: string): Promise<ScheduledTask | null> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['scheduledTasks'], 'readonly');
      const store = transaction.objectStore('scheduledTasks');
      
      const request = store.get(taskId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllScheduledTasks(): Promise<ScheduledTask[]> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['scheduledTasks'], 'readonly');
      const store = transaction.objectStore('scheduledTasks');
      
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getScheduledTasksByAgent(agentFlowId: string): Promise<ScheduledTask[]> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['scheduledTasks'], 'readonly');
      const store = transaction.objectStore('scheduledTasks');
      const index = store.index('agentFlowId');
      
      const request = index.getAll(agentFlowId);
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getEnabledScheduledTasks(): Promise<ScheduledTask[]> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['scheduledTasks'], 'readonly');
      const store = transaction.objectStore('scheduledTasks');
      
      const request = store.getAll();
      request.onsuccess = () => {
        const results = (request.result || []).filter((task: ScheduledTask) => task.schedule.enabled);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteScheduledTask(taskId: string): Promise<void> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['scheduledTasks'], 'readwrite');
      const store = transaction.objectStore('scheduledTasks');
      
      const request = store.delete(taskId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ===== TASK EXECUTIONS CRUD =====

  async saveTaskExecution(execution: ScheduledTaskExecution): Promise<void> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['taskExecutions'], 'readwrite');
      const store = transaction.objectStore('taskExecutions');
      
      const request = store.put(execution);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getTaskExecution(executionId: string): Promise<ScheduledTaskExecution | null> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['taskExecutions'], 'readonly');
      const store = transaction.objectStore('taskExecutions');
      
      const request = store.get(executionId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getTaskExecutions(taskId: string, limit = 50): Promise<ScheduledTaskExecution[]> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['taskExecutions'], 'readonly');
      const store = transaction.objectStore('taskExecutions');
      const index = store.index('taskId');
      
      const request = index.getAll(taskId);
      request.onsuccess = () => {
        const results = (request.result || [])
          .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
          .slice(0, limit);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllTaskExecutions(limit = 100): Promise<ScheduledTaskExecution[]> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['taskExecutions'], 'readonly');
      const store = transaction.objectStore('taskExecutions');
      
      const request = store.getAll();
      request.onsuccess = () => {
        const results = (request.result || [])
          .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
          .slice(0, limit);
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteTaskExecution(executionId: string): Promise<void> {
    if (!this.db) await this.initialize();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(['taskExecutions'], 'readwrite');
      const store = transaction.objectStore('taskExecutions');
      
      const request = store.delete(executionId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ===== UTILITY METHODS =====

  async getTasksDueForExecution(): Promise<ScheduledTask[]> {
    const enabledTasks = await this.getEnabledScheduledTasks();
    const now = new Date();
    
    return enabledTasks.filter(task => {
      if (!task.schedule.nextRun) return false;
      return new Date(task.schedule.nextRun) <= now;
    });
  }

  calculateNextRun(schedule: ScheduledTask['schedule']): string {
    const now = new Date();
    let nextRun = new Date(now);

    switch (schedule.interval) {
      case '30seconds':
        nextRun.setSeconds(nextRun.getSeconds() + 30);
        break;
      
      case 'minute':
        nextRun.setMinutes(nextRun.getMinutes() + 1);
        break;
      
      case 'minutes':
        const minuteInterval = schedule.minuteInterval || 5;
        nextRun.setMinutes(nextRun.getMinutes() + minuteInterval);
        break;
      
      case 'hourly':
        nextRun.setHours(nextRun.getHours() + 1);
        break;
      
      case 'daily':
        if (schedule.time) {
          const [hours, minutes] = schedule.time.split(':').map(Number);
          nextRun.setHours(hours, minutes, 0, 0);
          
          // If time has passed today, schedule for tomorrow
          if (nextRun <= now) {
            nextRun.setDate(nextRun.getDate() + 1);
          }
        } else {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;
      
      case 'weekly':
        if (schedule.time) {
          const [hours, minutes] = schedule.time.split(':').map(Number);
          nextRun.setHours(hours, minutes, 0, 0);
        }
        // Add 7 days
        nextRun.setDate(nextRun.getDate() + 7);
        break;
    }

    return nextRun.toISOString();
  }

  async updateTaskNextRun(taskId: string): Promise<void> {
    const task = await this.getScheduledTask(taskId);
    if (!task) return;

    task.schedule.nextRun = this.calculateNextRun(task.schedule);
    task.schedule.lastRun = new Date().toISOString();
    
    await this.saveScheduledTask(task);
  }

  async incrementTaskRunCount(taskId: string, success: boolean): Promise<void> {
    const task = await this.getScheduledTask(taskId);
    if (!task) return;

    task.metadata.totalRuns++;
    if (success) {
      task.metadata.successRuns++;
    }

    await this.saveScheduledTask(task);
  }

  // Clean up old executions (keep last 100 per task)
  async cleanupOldExecutions(): Promise<void> {
    const allTasks = await this.getAllScheduledTasks();
    
    for (const task of allTasks) {
      const executions = await this.getTaskExecutions(task.id, 1000);
      
      // Keep only the latest 100 executions
      if (executions.length > 100) {
        const toDelete = executions.slice(100);
        
        for (const execution of toDelete) {
          await this.deleteTaskExecution(execution.id);
        }
      }
    }
  }
}

// Export singleton instance
export const schedulerStorage = new SchedulerStorageService();
