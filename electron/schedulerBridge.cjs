// ClaraVerse Scheduler Bridge for Electron Main Process
// This bridge handles the TypeScript/ES module compatibility issues

const path = require('path');

class SchedulerBridge {
  constructor() {
    this.isRunning = false;
    this.activeExecutions = 0;
    this.schedulerInstance = null;
    this.checkInterval = null;
    this.mainWindow = null; // Reference to main window for IPC communication
  }

  setMainWindow(window) {
    this.mainWindow = window;
  }

  async start() {
    if (this.isRunning) {
      console.log('⚠️ Scheduler already running');
      return;
    }

    try {
      this.isRunning = true;
      this.activeExecutions = 0;
      
      // Start more frequent checking for short intervals
      // Check every 10 seconds to handle 30-second and minute intervals properly
      this.checkInterval = setInterval(() => {
        this.checkAndExecuteTasks();
      }, 10000); // 10 seconds

      // Run initial check for overdue tasks
      setTimeout(() => {
        this.checkAndExecuteTasks();
      }, 2000); // 2 seconds after start

      console.log('✅ Scheduler bridge started successfully (checking every 10 seconds)');
    } catch (error) {
      console.error('❌ Failed to start scheduler bridge:', error);
      this.isRunning = false;
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      console.log('⚠️ Scheduler already stopped');
      return;
    }

    try {
      this.isRunning = false;
      
      if (this.checkInterval) {
        clearInterval(this.checkInterval);
        this.checkInterval = null;
      }

      console.log('🛑 Scheduler bridge stopped');
    } catch (error) {
      console.error('❌ Failed to stop scheduler bridge:', error);
      throw error;
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      activeExecutions: this.activeExecutions,
      nextCheck: this.checkInterval ? new Date(Date.now() + 10000) : undefined // Next check in 10 seconds
    };
  }

  async checkAndExecuteTasks() {
    if (!this.isRunning) return;

    try {
      console.log('🔍 Checking for scheduled tasks...');
      
      // Request the renderer process to check and execute tasks
      // since IndexedDB and ClaraFlowRunner are only available there
      if (this.mainWindow && this.mainWindow.webContents) {
        try {
          const result = await this.mainWindow.webContents.executeJavaScript(`
            (async () => {
              try {
                // Check if schedulerStorage is available
                if (typeof window !== 'undefined' && window.schedulerStorage) {
                  
                  // Get tasks that are due
                  const tasksDue = await window.schedulerStorage.getTasksDueForExecution();
                  
                  if (tasksDue.length > 0) {
                    // Notify about overdue tasks
                    const now = new Date();
                    tasksDue.forEach(task => {
                      if (task.schedule.nextRun) {
                        const nextRun = new Date(task.schedule.nextRun);
                        const overdue = Math.floor((now - nextRun) / 60000);
                        if (overdue > 0) {
                          console.log('⏰ Task "' + task.agentName + '" is ' + overdue + ' minutes overdue');
                        } else {
                          console.log('🎯 Task "' + task.agentName + '" is due now');
                        }
                      }
                    });
                    
                    // Execute each task
                    for (const task of tasksDue) {
                      try {
                        
                        // Try to execute manually using available globals
                        if (window.ClaraFlowRunner && window.agentWorkflowStorage) {
                          const execution = {
                            id: 'exec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                            taskId: task.id,
                            startTime: new Date().toISOString(),
                            status: 'running',
                            outputs: {},
                            logs: []
                          };
                          
                          // Load agent flow
                          const agentFlow = await window.agentWorkflowStorage.getWorkflow(task.agentFlowId);
                          if (!agentFlow) {
                            throw new Error('Agent flow not found: ' + task.agentFlowId);
                          }
                          
                          // Create runner
                          const runner = new window.ClaraFlowRunner();
                          
                          // Register custom nodes if any
                          if (agentFlow.customNodes?.length > 0) {
                            for (const customNode of agentFlow.customNodes) {
                              runner.registerCustomNode(customNode);
                            }
                          }
                          
                          // Convert scheduled inputs to SDK format
                          const sdkInputs = {};
                          task.inputs.forEach(input => {
                            sdkInputs[input.nodeName] = input.value;
                          });
                          
                          console.log('🔧 Executing with inputs:', Object.keys(sdkInputs));
                          
                          // Execute
                          const result = await runner.executeFlow(agentFlow, sdkInputs);
                          
                          execution.endTime = new Date().toISOString();
                          execution.status = 'completed';
                          execution.outputs = result.outputs || {};
                          execution.logs = result.logs || [];
                          execution.duration = new Date(execution.endTime).getTime() - new Date(execution.startTime).getTime();
                          
                          // Save execution
                          await window.schedulerStorage.saveTaskExecution(execution);
                          
                          // Update task
                          task.schedule.lastRun = execution.endTime;
                          task.schedule.nextRun = window.schedulerStorage.calculateNextRun(task.schedule);
                          task.schedule.status = 'idle';
                          await window.schedulerStorage.saveScheduledTask(task);
                          
                          console.log('✅ Execution completed for:', task.agentName);
                        } else {
                          console.log('❌ Required execution dependencies not available (ClaraFlowRunner, agentWorkflowStorage)');
                        }
                      } catch (execError) {
                        console.error('❌ Failed to execute task "' + task.agentName + '":', execError);
                        
                        // Save failed execution
                        const failedExecution = {
                          id: 'exec_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                          taskId: task.id,
                          startTime: new Date().toISOString(),
                          endTime: new Date().toISOString(),
                          status: 'error',
                          error: execError.message,
                          outputs: {},
                          logs: []
                        };
                        await window.schedulerStorage.saveTaskExecution(failedExecution);
                        
                        // Update task status
                        task.schedule.status = 'error';
                        task.metadata = task.metadata || {};
                        task.metadata.lastError = execError.message;
                        await window.schedulerStorage.saveScheduledTask(task);
                      }
                    }
                  }
                  
                  return { success: true, tasksExecuted: tasksDue.length };
                } else {
                  console.log('⚠️ schedulerStorage not available in renderer context');
                  return { success: false, error: 'schedulerStorage not available' };
                }
              } catch (error) {
                console.error('❌ Error in task execution script:', error);
                return { success: false, error: error.message };
              }
            })();
          `);
          
          if (result.success) {
            console.log('📊 Task check completed, executed:', result.tasksExecuted, 'tasks');
            this.activeExecutions = result.tasksExecuted || 0;
          } else {
            console.log('⚠️ Task check failed:', result.error);
          }
        } catch (jsError) {
          console.error('❌ JavaScript execution failed:', jsError);
        }
      } else {
        console.log('⚠️ Main window not available for task execution');
      }
      
    } catch (error) {
      console.error('❌ Error during task check:', error);
    }
  }

  // Placeholder methods for IPC compatibility
  async getActiveTasks() {
    return [];
  }

  async getTaskExecutions(taskId) {
    return [];
  }

  async cancelTask(taskId) {
    console.log(`🚫 Cancel task requested: ${taskId}`);
    return true;
  }
}

// Create singleton instance
const schedulerBridge = new SchedulerBridge();

module.exports = { schedulerBridge };
