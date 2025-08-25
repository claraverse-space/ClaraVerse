import React, { useState } from 'react';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Play, 
  Calendar,
  RefreshCw,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { ScheduledTask, ScheduledTaskExecution } from '../types/agent/types';

interface TaskExecutionDetailsProps {
  task: ScheduledTask;
  executions: ScheduledTaskExecution[];
  onRefresh: () => void;
}

const TaskExecutionDetails: React.FC<TaskExecutionDetailsProps> = ({ task, executions, onRefresh }) => {
  const [selectedExecution, setSelectedExecution] = useState<ScheduledTaskExecution | null>(null);

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
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <Play className="w-4 h-4 text-blue-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
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

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border-l-4 border-purple-500">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-lg font-medium text-gray-900 dark:text-white">
          Execution History ({executions.length})
        </h4>
        <button
          onClick={onRefresh}
          className="p-2 rounded-lg bg-purple-100 text-purple-600 hover:bg-purple-200 dark:bg-purple-900/20 dark:text-purple-400 transition-colors"
          title="Refresh executions"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Executions List */}
      {executions.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-500 dark:text-gray-400">
            No executions yet. Enable scheduling to see execution results.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {executions.map((execution) => (
            <div key={execution.id} className="space-y-2">
              {/* Execution Summary */}
              <div
                className="bg-white dark:bg-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                onClick={() => setSelectedExecution(
                  selectedExecution?.id === execution.id ? null : execution
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(execution.status)}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {formatDateTime(execution.startTime)}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(execution.status)}`}>
                          {execution.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Duration: {formatDuration(execution.duration)}
                        {execution.error && (
                          <span className="text-red-500 ml-2">• Error: {execution.error}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Click for details
                    </span>
                    {selectedExecution?.id === execution.id ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                </div>
              </div>

              {/* Execution Details (Expanded) */}
              {selectedExecution?.id === execution.id && (
                <div className="bg-white dark:bg-gray-700 rounded-lg p-4 ml-4 border-l-2 border-gray-200 dark:border-gray-600">
                  {/* Execution Info Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div className="bg-gray-50 dark:bg-gray-600 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Started</span>
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {formatDateTime(execution.startTime)}
                      </span>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-600 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Ended</span>
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {execution.endTime ? formatDateTime(execution.endTime) : 'Running...'}
                      </span>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-600 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-900 dark:text-white">Duration</span>
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {formatDuration(execution.duration)}
                      </span>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-600 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
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
                    <div className="mb-4">
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Inputs</h5>
                      <div className="bg-gray-50 dark:bg-gray-600 rounded-lg p-3">
                        <div className="space-y-1">
                          {execution.inputs.map((input, index) => (
                            <div key={index} className="flex items-start gap-3">
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-0 flex-shrink-0">
                                {input.nodeName}:
                              </span>
                              <span className="text-sm text-gray-600 dark:text-gray-400 break-all">
                                {typeof input.value === 'string' ? input.value : JSON.stringify(input.value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Outputs */}
                  {execution.outputs && Object.keys(execution.outputs).length > 0 && (
                    <div className="mb-4">
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Outputs</h5>
                      <div className="bg-gray-50 dark:bg-gray-600 rounded-lg p-3">
                        <pre className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap overflow-auto">
                          {JSON.stringify(execution.outputs, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {execution.error && (
                    <div className="mb-4">
                      <h5 className="text-sm font-medium text-red-900 dark:text-red-400 mb-2">Error</h5>
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
                        <p className="text-sm text-red-600 dark:text-red-400">
                          {execution.error}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Logs */}
                  {execution.logs && execution.logs.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Execution Logs</h5>
                      <div className="bg-gray-50 dark:bg-gray-600 rounded-lg p-3 max-h-64 overflow-auto">
                        <div className="space-y-1">
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
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskExecutionDetails;
