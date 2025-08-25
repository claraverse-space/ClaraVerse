import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Bot, MessageSquare, Image, Zap, Play, Pause, Trash2, RefreshCw, BarChart3 } from 'lucide-react';
import { schedulerStorage } from '../services/schedulerStorage';
import { schedulerIPC } from '../services/schedulerIPC';
import { ScheduledTask } from '../types/agent/types';
import TaskExecutionHistory from './TaskExecutionHistory';

interface TasksProps {
  onPageChange: (page: string) => void;
}

type TaskTab = 'agents' | 'chats' | 'imageGen' | 'lumaUI';

const Tasks: React.FC<TasksProps> = ({ onPageChange }) => {
  const [activeTab, setActiveTab] = useState<TaskTab>('agents');
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [currentView, setCurrentView] = useState<'tasks' | 'execution-history'>('tasks');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [schedulerStatus, setSchedulerStatus] = useState<{
    isRunning: boolean;
    activeExecutions: number;
    error?: string;
  }>({ isRunning: false, activeExecutions: 0 });

  // Load scheduled tasks and executions
  useEffect(() => {
    loadTasksData();
    loadSchedulerStatus();
  }, []);

  const loadTasksData = async () => {
    try {
      // Initialize storage if needed
      await schedulerStorage.initialize();
      
      // Load all scheduled tasks
      const scheduledTasks = await schedulerStorage.getAllScheduledTasks();
      setTasks(scheduledTasks);
      
    } catch (error) {
      console.error('Failed to load tasks data:', error);
    }
  };

  const loadSchedulerStatus = async () => {
    try {
      console.log('🔍 Loading scheduler status...');
      const status = await schedulerIPC.getStatus();
      console.log('📊 Received scheduler status:', status);
      setSchedulerStatus(status);
    } catch (error) {
      console.error('❌ Failed to load scheduler status:', error);
      setSchedulerStatus({ isRunning: false, activeExecutions: 0, error: 'Failed to connect to scheduler' });
    }
  };

  const handleToggleTask = async (taskId: string) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      // Toggle enabled status
      task.schedule.enabled = !task.schedule.enabled;
      
      // Update next run time if enabling
      if (task.schedule.enabled) {
        const nextRun = schedulerStorage.calculateNextRun(task.schedule);
        task.schedule.nextRun = nextRun;
      } else {
        task.schedule.nextRun = undefined;
      }

      await schedulerStorage.saveScheduledTask(task);
      await loadTasksData(); // Refresh data
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    const taskName = task?.agentName || 'this task';
    
    if (!confirm(`⚠️ Warning: Delete "${taskName}"?\n\nThis will permanently delete:\n• The scheduled task\n• All execution history\n• All related data\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      // Delete all executions for this task first
      console.log(`🗑️ Deleting executions for task: ${taskId}`);
      const executions = await schedulerStorage.getTaskExecutions(taskId);
      console.log(`📊 Found ${executions.length} executions to delete`);
      
      for (const execution of executions) {
        console.log(`🗑️ Deleting execution: ${execution.id}`);
        await schedulerStorage.deleteTaskExecution(execution.id);
      }
      
      console.log(`✅ Deleted ${executions.length} executions`);
      
      // Then delete the task itself
      console.log(`🗑️ Deleting task: ${taskId}`);
      await schedulerStorage.deleteScheduledTask(taskId);
      console.log(`✅ Task deleted successfully`);
      
      await loadTasksData(); // Refresh data
      console.log(`🔄 Data refreshed`);
      
    } catch (error) {
      console.error('❌ Failed to delete task:', error);
      alert(`Failed to delete task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleViewResults = (taskId: string) => {
    setSelectedTaskId(taskId);
    setCurrentView('execution-history');
  };

  const handleBackToTasks = () => {
    setCurrentView('tasks');
    setSelectedTaskId(null);
  };

  const tabs: { id: TaskTab; label: string; icon: React.ComponentType<any>; count: number; disabled?: boolean }[] = [
    { 
      id: 'agents', 
      label: 'Agents', 
      icon: Bot, 
      count: tasks.length // All tasks are agent tasks for now
    },
    { 
      id: 'chats', 
      label: 'Chats', 
      icon: MessageSquare, 
      count: 0,
      disabled: true
    },
    { 
      id: 'imageGen', 
      label: 'Image Gen', 
      icon: Image, 
      count: 0,
      disabled: true
    },
    { 
      id: 'lumaUI', 
      label: 'Luma UI', 
      icon: Zap, 
      count: 0,
      disabled: true
    }
  ];

  const getStatusColor = (schedule: ScheduledTask['schedule']) => {
    if (!schedule.enabled) {
      return 'text-gray-600 bg-gray-100 dark:text-gray-400 dark:bg-gray-700';
    }
    if (schedule.status === 'running') {
      return 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20';
    }
    if (schedule.status === 'error') {
      return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/20';
    }
    return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20';
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString();
  };

  const formatNextRun = (nextRun: string | undefined) => {
    if (!nextRun) return 'Not scheduled';
    
    const now = new Date();
    const nextRunDate = new Date(nextRun);
    const diff = nextRunDate.getTime() - now.getTime();
    
    if (diff < 0) return 'Overdue';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours < 24) {
      return `In ${hours}h ${minutes}m`;
    } else {
      const days = Math.floor(hours / 24);
      return `In ${days} day(s)`;
    }
  };

  const formatScheduleDescription = (schedule: ScheduledTask['schedule']) => {
    if (!schedule.enabled) return 'Disabled';
    
    switch (schedule.interval) {
      case '30seconds':
        return 'Every 30 seconds';
      case 'minute':
        return 'Every minute';
      case 'minutes':
        return `Every ${schedule.minuteInterval || 5} minutes`;
      case 'hourly':
        return 'Every hour';
      case 'daily':
        return schedule.time ? `Daily at ${schedule.time}` : 'Daily';
      case 'weekly':
        return schedule.time ? `Weekly at ${schedule.time}` : 'Weekly';
      default:
        return schedule.interval;
    }
  };

  const filteredTasks = activeTab === 'agents' ? tasks : [];

  // Show execution history page
  if (currentView === 'execution-history' && selectedTaskId) {
    return (
      <TaskExecutionHistory
        taskId={selectedTaskId}
        onBack={handleBackToTasks}
      />
    );
  }

  // Show main tasks page
  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-white to-sakura-50 dark:from-gray-900 dark:to-gray-800">
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Scheduled Tasks
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage and monitor your automated workflows across all ClaraVerse features
          </p>
        </div>

        {/* Scheduler Status */}
        <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${schedulerStatus.isRunning ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  Scheduler Status: {schedulerStatus.isRunning ? 'Running' : 'Stopped'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {schedulerStatus.isRunning 
                    ? `${schedulerStatus.activeExecutions} active executions` 
                    : 'No scheduled tasks will run'
                  }
                  {schedulerStatus.error && ` • ${schedulerStatus.error}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!schedulerStatus.isRunning && (
                <button
                  onClick={async () => {
                    console.log('🚀 Manually starting scheduler...');
                    const result = await schedulerIPC.start();
                    console.log('📊 Start result:', result);
                    await loadSchedulerStatus();
                  }}
                  className="px-3 py-1 text-xs bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400 rounded transition-colors"
                  title="Start scheduler"
                >
                  Start
                </button>
              )}
              <button
                onClick={loadSchedulerStatus}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                title="Refresh status"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

          {/* Tabs */}
          <div className="mb-6">
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="-mb-px flex space-x-8">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <div key={tab.id} className="relative group">
                      <button
                        onClick={() => !tab.disabled && setActiveTab(tab.id)}
                        disabled={tab.disabled}
                        className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
                          tab.disabled
                            ? 'border-transparent text-gray-400 cursor-not-allowed dark:text-gray-500'
                            : activeTab === tab.id
                            ? 'border-sakura-500 text-sakura-600 dark:text-sakura-400'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        {tab.label}
                        {tab.count > 0 && !tab.disabled && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            activeTab === tab.id
                              ? 'bg-sakura-100 text-sakura-800 dark:bg-sakura-900/20 dark:text-sakura-300'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {tab.count}
                          </span>
                        )}
                      </button>
                      
                      {/* Tooltip for disabled tabs */}
                      {tab.disabled && (
                        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                          Dev is working on it
                          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Task List */}
          <div className="space-y-4">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No scheduled tasks
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {activeTab === 'agents' 
                    ? 'Create agents with scheduling enabled to see them here.'
                    : `No scheduled tasks for ${tabs.find(t => t.id === activeTab)?.label.toLowerCase()}.`
                  }
                </p>
                {activeTab === 'agents' && (
                  <button
                    onClick={() => onPageChange('agents')}
                    className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sakura-600 hover:bg-sakura-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sakura-500"
                  >
                    <Bot className="w-4 h-4 mr-2" />
                    Go to Agents
                  </button>
                )}
              </div>
            ) : (
              filteredTasks.map((task) => (
                <div key={task.id} className="space-y-4">
                  <div className="glassmorphic rounded-lg p-6 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {task.agentName}
                          </h3>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(task.schedule)}`}>
                          {task.schedule.enabled ? (task.schedule.status || 'Active') : 'Disabled'}
                        </span>
                      </div>
                      
                      {task.agentDescription && (
                        <p className="text-gray-600 dark:text-gray-400 mb-3">
                          {task.agentDescription}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>
                            {formatScheduleDescription(task.schedule)}
                          </span>
                        </div>
                        
                        {task.schedule.nextRun && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>Next: {formatNextRun(task.schedule.nextRun)}</span>
                          </div>
                        )}
                        
                        {task.schedule.lastRun && (
                          <div className="flex items-center gap-1">
                            <span>Last: {formatTime(task.schedule.lastRun)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleToggleTask(task.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          task.schedule.enabled 
                            ? 'bg-green-100 text-green-600 hover:bg-green-200 dark:bg-green-900/20 dark:text-green-400' 
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400'
                        }`}
                        title={task.schedule.enabled ? 'Disable task' : 'Enable task'}
                      >
                        {task.schedule.enabled ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      </button>
                      
                      <button
                        onClick={() => handleViewResults(task.id)}
                        className="p-2 rounded-lg bg-purple-100 text-purple-600 hover:bg-purple-200 dark:bg-purple-900/20 dark:text-purple-400 transition-colors"
                        title="View execution results"
                      >
                        <BarChart3 className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 transition-colors"
                        title="Delete task"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      
                      <button
                        onClick={loadTasksData}
                        className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 transition-colors"
                        title="Refresh"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
};

export default Tasks;
