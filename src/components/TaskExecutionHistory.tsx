import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft,
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Play, 
  Calendar,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  FileText,
  BarChart3
} from 'lucide-react';
import { schedulerStorage } from '../services/schedulerStorage';
import { ScheduledTask, ScheduledTaskExecution } from '../types/agent/types';

interface TaskExecutionHistoryProps {
  taskId: string;
  onBack: () => void;
}

const TaskExecutionHistory: React.FC<TaskExecutionHistoryProps> = ({ taskId, onBack }) => {
  const [task, setTask] = useState<ScheduledTask | null>(null);
  const [executions, setExecutions] = useState<ScheduledTaskExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExecution, setSelectedExecution] = useState<ScheduledTaskExecution | null>(null);

  useEffect(() => {
    loadTaskAndExecutions();
  }, [taskId]);

  const loadTaskAndExecutions = async () => {
    try {
      setLoading(true);
      
      // Load task details
      const taskData = await schedulerStorage.getScheduledTask(taskId);
      setTask(taskData);
      
      // Load executions
      const executionData = await schedulerStorage.getTaskExecutions(taskId, 100);
      setExecutions(executionData);
    } catch (error) {
      console.error('Failed to load task execution history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (duration?: number): string => {
    if (!duration) return 'N/A';
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const formatDateTime = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'running':
        return <Play className="w-5 h-5 text-blue-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'running':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      default:
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
    }
  };

  const getExecutionStats = () => {
    const total = executions.length;
    const completed = executions.filter(e => e.status === 'completed').length;
    const failed = executions.filter(e => e.status === 'error').length;
    const running = executions.filter(e => e.status === 'running').length;
    
    return { total, completed, failed, running };
  };

  const stats = getExecutionStats();

  if (loading) {
    return (
      <div className="flex-1 flex flex-col bg-gradient-to-br from-white to-sakura-50 dark:from-gray-900 dark:to-gray-800">
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500 dark:text-gray-400">Loading execution history...</div>
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex-1 flex flex-col bg-gradient-to-br from-white to-sakura-50 dark:from-gray-900 dark:to-gray-800">
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Task Not Found
            </h4>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              The requested task could not be found.
            </p>
            <button
              onClick={onBack}
              className="px-4 py-2 bg-sakura-500 text-white rounded-lg hover:bg-sakura-600 transition-colors"
            >
              Back to Tasks
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-br from-white to-sakura-50 dark:from-gray-900 dark:to-gray-800 h-[calc(100vh-4rem)] overflow-hidden">
      <div className="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={onBack}
            className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Execution History
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              {task.agentName}
            </p>
          </div>
        </div>

        {/* Task Summary Card */}
        <div className="glassmorphic rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {task.agentName}
              </h3>
              {task.agentDescription && (
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {task.agentDescription}
                </p>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {stats.total}
                  </div>
                  <div className="text-sm text-blue-600 dark:text-blue-400">Total</div>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {stats.completed}
                  </div>
                  <div className="text-sm text-green-600 dark:text-green-400">Completed</div>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {stats.failed}
                  </div>
                  <div className="text-sm text-red-600 dark:text-red-400">Failed</div>
                </div>
                <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                    {stats.running}
                  </div>
                  <div className="text-sm text-yellow-600 dark:text-yellow-400">Running</div>
                </div>
              </div>
            </div>
            <button
              onClick={loadTaskAndExecutions}
              className="p-2 rounded-lg bg-sakura-100 text-sakura-600 hover:bg-sakura-200 dark:bg-sakura-900/20 dark:text-sakura-400 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Executions List */}
      <div className="flex-1 overflow-hidden">
        {executions.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <BarChart3 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h4 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                No Executions Yet
              </h4>
              <p className="text-gray-600 dark:text-gray-400">
                This task hasn't been executed yet. Enable scheduling to see execution results.
              </p>
            </div>
          </div>
        ) : (
          <div className="h-full overflow-y-auto p-6">
            <div className="space-y-4">
              {executions.map((execution) => (
                <div key={execution.id} className="glassmorphic rounded-lg overflow-hidden">
                  {/* Execution Summary */}
                  <div
                    className="p-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    onClick={() => setSelectedExecution(
                      selectedExecution?.id === execution.id ? null : execution
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {getStatusIcon(execution.status)}
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-lg font-semibold text-gray-900 dark:text-white">
                              {formatDateTime(execution.startTime)}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getStatusColor(execution.status)}`}>
                              {execution.status}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Duration: {formatDuration(execution.duration)}
                            {execution.error && (
                              <span className="text-red-500 ml-2">• Error: {execution.error}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {selectedExecution?.id === execution.id ? 'Hide Details' : 'View Details'}
                        </span>
                        {selectedExecution?.id === execution.id ? (
                          <ChevronDown className="w-5 h-5 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Execution Details (Expanded) - Scrollable */}
                  {selectedExecution?.id === execution.id && (
                    <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 max-h-96 overflow-y-auto">
                      <div className="p-6">
                        {/* Execution Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                          <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Calendar className="w-4 h-4 text-gray-500" />
                              <span className="text-sm font-medium text-gray-900 dark:text-white">Started</span>
                            </div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {formatDateTime(execution.startTime)}
                            </span>
                          </div>

                          <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Calendar className="w-4 h-4 text-gray-500" />
                              <span className="text-sm font-medium text-gray-900 dark:text-white">Ended</span>
                            </div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {execution.endTime ? formatDateTime(execution.endTime) : 'Running...'}
                            </span>
                          </div>

                          <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              <Clock className="w-4 h-4 text-gray-500" />
                              <span className="text-sm font-medium text-gray-900 dark:text-white">Duration</span>
                            </div>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {formatDuration(execution.duration)}
                            </span>
                          </div>

                          <div className="bg-white dark:bg-gray-700 rounded-lg p-4">
                            <div className="flex items-center gap-2 mb-2">
                              {getStatusIcon(execution.status)}
                              <span className="text-sm font-medium text-gray-900 dark:text-white">Status</span>
                            </div>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(execution.status)}`}>
                              {execution.status}
                            </span>
                          </div>
                        </div>

                        {/* Inputs */}
                        {execution.inputs && execution.inputs.length > 0 && (
                          <div className="mb-6">
                            <h5 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Inputs</h5>
                            <div className="bg-white dark:bg-gray-700 rounded-lg p-4 max-h-40 overflow-y-auto">
                              <div className="space-y-3">
                                {execution.inputs.map((input, index) => (
                                  <div key={index} className="flex flex-col gap-1">
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      {input.nodeName}:
                                    </span>
                                    <div className="bg-gray-50 dark:bg-gray-600 rounded p-3">
                                      <span className="text-sm text-gray-600 dark:text-gray-400 break-all">
                                        {typeof input.value === 'string' ? input.value : JSON.stringify(input.value, null, 2)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Outputs */}
                        {execution.outputs && Object.keys(execution.outputs).length > 0 && (
                          <div className="mb-6">
                            <h5 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Outputs</h5>
                            <div className="bg-white dark:bg-gray-700 rounded-lg p-4 max-h-60 overflow-y-auto">
                              <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                                {JSON.stringify(execution.outputs, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}

                        {/* Error */}
                        {execution.error && (
                          <div className="mb-6">
                            <h5 className="text-lg font-medium text-red-900 dark:text-red-400 mb-3">Error</h5>
                            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 max-h-32 overflow-y-auto">
                              <p className="text-sm text-red-600 dark:text-red-400">
                                {execution.error}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Logs */}
                        {execution.logs && execution.logs.length > 0 && (
                          <div>
                            <h5 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Execution Logs</h5>
                            <div className="bg-white dark:bg-gray-700 rounded-lg p-4 max-h-48 overflow-y-auto">
                              <div className="space-y-2">
                                {execution.logs.map((log, index) => (
                                  <div key={index} className="text-sm">
                                    <span className="text-gray-500 dark:text-gray-400">
                                      [{log.timestamp ? formatDateTime(log.timestamp) : 'N/A'}]
                                    </span>
                                    <span className={`ml-2 ${
                                      log.level === 'error' ? 'text-red-600 dark:text-red-400' :
                                      log.level === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                                      'text-gray-600 dark:text-gray-400'
                                    }`}>
                                      {log.message}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskExecutionHistory;
