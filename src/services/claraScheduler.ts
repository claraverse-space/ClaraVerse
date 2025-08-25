// ClaraVerse Core Scheduler Service
// Handles background execution of scheduled tasks

import { schedulerStorage } from './schedulerStorage';
import { agentWorkflowStorage } from './agentWorkflowStorage';
import { ClaraFlowRunner } from '../../sdk/src/ClaraFlowRunner';
import { customNodeManager } from '../components/AgentBuilder/NodeCreator/CustomNodeManager';
import { ScheduledTask, ScheduledTaskExecution, ScheduledInputValue, ExecutionLog } from '../types/agent/types';

class ClaraSchedulerService {
  private isRunning = false;
  private checkInterval = 60000; // Check every minute
  private timer: NodeJS.Timeout | null = null;
  private activeExecutions = new Map<string, string>(); // taskId -> executionId

  constructor() {
    // Initialize storage on creation
    this.initializeStorage();
  }

  private async initializeStorage(): Promise<void> {
    try {
      await schedulerStorage.initialize();
      console.log('✅ Scheduler storage initialized');
    } catch (error) {
      console.error('❌ Failed to initialize scheduler storage:', error);
    }
  }

  // ===== SCHEDULER LIFECYCLE =====

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️ Scheduler already running');
      return;
    }

    this.isRunning = true;
    console.log('🚀 Starting ClaraVerse Scheduler');

    // Initial check
    await this.checkAndExecuteTasks();

    // Set up periodic checks
    this.timer = setInterval(() => {
      this.checkAndExecuteTasks().catch(error => {
        console.error('❌ Scheduler check failed:', error);
      });
    }, this.checkInterval);

    console.log(`✅ Scheduler started - checking every ${this.checkInterval / 1000} seconds`);
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ Scheduler not running');
      return;
    }

    this.isRunning = false;
    
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    console.log('🛑 Scheduler stopped');
  }

  getStatus(): { isRunning: boolean; activeExecutions: number; nextCheck?: Date } {
    return {
      isRunning: this.isRunning,
      activeExecutions: this.activeExecutions.size,
      nextCheck: this.timer ? new Date(Date.now() + this.checkInterval) : undefined
    };
  }

  // ===== CORE SCHEDULER LOGIC =====

  private async checkAndExecuteTasks(): Promise<void> {
    try {
      console.log('🔍 Checking for scheduled tasks...');
      
      const dueTasks = await schedulerStorage.getTasksDueForExecution();
      console.log(`📋 Found ${dueTasks.length} tasks due for execution`);

      if (dueTasks.length === 0) return;

      // Separate overdue from current tasks for better logging
      const now = new Date();
      const overdueTasks = dueTasks.filter(task => 
        task.schedule.nextRun && new Date(task.schedule.nextRun) < new Date(now.getTime() - 60000) // More than 1 minute overdue
      );
      
      if (overdueTasks.length > 0) {
        console.log(`⏰ Found ${overdueTasks.length} overdue tasks - executing immediately:`);
        overdueTasks.forEach(task => {
          const overdue = Math.floor((now.getTime() - new Date(task.schedule.nextRun!).getTime()) / (1000 * 60));
          console.log(`  - ${task.agentName}: ${overdue} minutes overdue`);
        });
      }

      // Execute each due task
      for (const task of dueTasks) {
        // Skip if already executing
        if (this.activeExecutions.has(task.id)) {
          console.log(`⏳ Task ${task.agentName} already executing, skipping...`);
          continue;
        }

        // Execute task in background
        this.executeScheduledTask(task).catch(error => {
          console.error(`❌ Failed to execute scheduled task ${task.agentName}:`, error);
        });
      }
    } catch (error) {
      console.error('❌ Error checking scheduled tasks:', error);
    }
  }

  private async executeScheduledTask(task: ScheduledTask): Promise<void> {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log(`🚀 Executing scheduled task: ${task.agentName} (${task.id})`);
    
    // Mark as executing
    this.activeExecutions.set(task.id, executionId);

    const execution: ScheduledTaskExecution = {
      id: executionId,
      taskId: task.id,
      agentFlowId: task.agentFlowId,
      startTime: new Date().toISOString(),
      status: 'running',
      inputs: task.inputs,
      logs: [],
      outputs: undefined,
      error: undefined,
      duration: undefined
    };

    try {
      // Save initial execution record
      await schedulerStorage.saveTaskExecution(execution);

      // Load agent flow
      const agentFlow = await agentWorkflowStorage.getWorkflow(task.agentFlowId);
      if (!agentFlow) {
        throw new Error(`Agent flow not found: ${task.agentFlowId}`);
      }

      // Execute using same logic as AgentRunnerSDK
      const result = await this.executeAgentFlow(agentFlow, task.inputs);

      // Update execution with results
      execution.status = 'completed';
      execution.endTime = new Date().toISOString();
      execution.outputs = result.outputs;
      execution.logs = result.logs;
      execution.duration = Date.now() - new Date(execution.startTime).getTime();

      await schedulerStorage.saveTaskExecution(execution);
      await schedulerStorage.incrementTaskRunCount(task.id, true);

      console.log(`✅ Scheduled task completed: ${task.agentName}`);

    } catch (error) {
      console.error(`❌ Scheduled task failed: ${task.agentName}:`, error);

      // Update execution with error
      execution.status = 'error';
      execution.endTime = new Date().toISOString();
      execution.error = error instanceof Error ? error.message : String(error);
      execution.duration = Date.now() - new Date(execution.startTime).getTime();

      await schedulerStorage.saveTaskExecution(execution);
      await schedulerStorage.incrementTaskRunCount(task.id, false);

      // Update task with error
      const updatedTask = await schedulerStorage.getScheduledTask(task.id);
      if (updatedTask) {
        updatedTask.metadata.lastError = execution.error;
        await schedulerStorage.saveScheduledTask(updatedTask);
      }

    } finally {
      // Remove from active executions
      this.activeExecutions.delete(task.id);
      
      // Update next run time
      await schedulerStorage.updateTaskNextRun(task.id);
    }
  }

  // ===== AGENT EXECUTION (Same as AgentRunnerSDK) =====

  private async executeAgentFlow(
    agentFlow: any,
    inputs: ScheduledInputValue[]
  ): Promise<{ outputs: Record<string, any>; logs: ExecutionLog[] }> {
    
    const logs: ExecutionLog[] = [];
    
    // Create Clara Flow SDK Runner
    const runner = new ClaraFlowRunner({
      enableLogging: true,
      timeout: 300000, // 5 minute timeout for scheduled tasks
      onExecutionLog: (log: any) => {
        const executionLog: ExecutionLog = {
          id: `${Date.now()}-${Math.random()}`,
          level: log.level || 'info',
          message: log.message,
          timestamp: new Date().toISOString(),
          nodeId: log.nodeId,
          nodeName: log.nodeName,
          duration: log.duration,
          data: log.data
        };
        logs.push(executionLog);
      }
    });

    // Convert to SDK format (same as AgentRunnerSDK)
    const sdkFlowData = this.convertToSDKFormat(agentFlow);

    // Register custom nodes
    if (sdkFlowData.customNodes?.length > 0) {
      for (const customNode of sdkFlowData.customNodes) {
        try {
          runner.registerCustomNode(customNode);
        } catch (error) {
          console.error(`Failed to register custom node ${customNode.type}:`, error);
        }
      }
    }

    // Prepare inputs for SDK execution
    const sdkInputs: Record<string, any> = {};
    
    for (const inputValue of inputs) {
      if (inputValue.value) {
        // For scheduled tasks, files are already converted to text/base64
        sdkInputs[inputValue.nodeName] = inputValue.value;
      }
    }

    // Execute flow
    const executionResult = await runner.executeFlow(sdkFlowData, sdkInputs);
    
    return {
      outputs: executionResult.outputs,
      logs: executionResult.logs
    };
  }

  private convertToSDKFormat(agentFlow: any): any {
    // Same conversion logic as AgentRunnerSDK
    let customNodes = agentFlow.customNodes || [];
    
    // Identify custom node types
    const customNodeTypes = new Set<string>();
    
    if (customNodeManager?.getCustomNodes) {
      try {
        const allCustomNodes = customNodeManager.getCustomNodes();
        allCustomNodes.forEach((customNode: any) => {
          customNodeTypes.add(customNode.type);
        });
      } catch (error) {
        console.warn('Error getting custom nodes:', error);
      }
    }

    // Check flow nodes for custom types
    agentFlow.nodes.forEach((node: any) => {
      const builtInTypes = [
        'input', 'output', 'text-input', 'number-input', 'image-input', 'file-input', 'pdf-input', 'file-upload',
        'text-processor', 'math-calculator', 'image-processor', 'pdf-processor', 'llm-text', 'llm-chat',
        'data-formatter', 'conditional', 'loop', 'delay', 'http-request', 'database-query',
        'email-sender', 'file-writer', 'code-executor', 'webhook', 'scheduler'
      ];
      
      if (!builtInTypes.includes(node.type)) {
        customNodeTypes.add(node.type);
      }
    });

    // Get custom node definitions
    if (customNodeTypes.size > 0 && customNodeManager?.getCustomNode) {
      const customNodeDefinitions = Array.from(customNodeTypes).map(nodeType => {
        const customNode = customNodeManager.getCustomNode(nodeType);
        return customNode ? {
          id: customNode.id,
          type: customNode.type,
          name: customNode.name,
          description: customNode.description,
          category: customNode.category,
          icon: customNode.icon,
          inputs: customNode.inputs,
          outputs: customNode.outputs,
          properties: customNode.properties,
          executionCode: customNode.executionCode,
          metadata: customNode.metadata
        } : null;
      }).filter(Boolean);
      
      customNodes = [...customNodes, ...customNodeDefinitions];
    }

    return {
      format: 'clara-sdk',
      version: '1.0.0',
      flow: {
        id: agentFlow.id,
        name: agentFlow.name,
        description: agentFlow.description,
        nodes: agentFlow.nodes,
        connections: agentFlow.connections || []
      },
      customNodes,
      metadata: {
        exportedAt: new Date().toISOString(),
        exportedFrom: 'Clara Scheduler',
        hasCustomNodes: customNodes.length > 0
      }
    };
  }

  // ===== PUBLIC API =====

  async getActiveTasks(): Promise<ScheduledTask[]> {
    return await schedulerStorage.getEnabledScheduledTasks();
  }

  async getTaskExecutions(taskId?: string): Promise<ScheduledTaskExecution[]> {
    if (taskId) {
      return await schedulerStorage.getTaskExecutions(taskId);
    }
    return await schedulerStorage.getAllTaskExecutions();
  }

  async cancelTask(taskId: string): Promise<void> {
    const task = await schedulerStorage.getScheduledTask(taskId);
    if (task) {
      task.schedule.enabled = false;
      await schedulerStorage.saveScheduledTask(task);
    }
  }

  // Cleanup method to be called periodically
  async cleanup(): Promise<void> {
    await schedulerStorage.cleanupOldExecutions();
  }
}

// Export singleton instance
export const claraScheduler = new ClaraSchedulerService();
