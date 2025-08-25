import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Save, Play, AlertCircle, FileText, Upload, Image } from 'lucide-react';
import { AgentFlow, ScheduledTask, ScheduledInputValue } from '../types/agent/types';
import { agentWorkflowStorage } from '../services/agentWorkflowStorage';
import { schedulerStorage } from '../services/schedulerStorage';

interface ScheduleModalProps {
  agentFlow: AgentFlow;
  onClose: () => void;
  onSaved: () => void;
  existingTask?: ScheduledTask;
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({ 
  agentFlow, 
  onClose, 
  onSaved, 
  existingTask 
}) => {
  // Schedule configuration state
  const [interval, setInterval] = useState<'30seconds' | 'minute' | 'minutes' | 'hourly' | 'daily' | 'weekly'>(
    existingTask?.schedule.interval || 'daily'
  );
  const [time, setTime] = useState(existingTask?.schedule.time || '09:00');
  const [minuteInterval, setMinuteInterval] = useState(existingTask?.schedule.minuteInterval || 5);
  const [enabled, setEnabled] = useState(existingTask?.schedule.enabled ?? true);

  // Input configuration state (same as AgentRunnerSDK)
  const [inputValues, setInputValues] = useState<ScheduledInputValue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load input nodes and existing values
  useEffect(() => {
    const loadInputs = () => {
      // Extract input nodes from agent flow
      const inputNodes = agentFlow.nodes.filter((node: any) => 
        node.type === 'input' || 
        node.type === 'image-input' || 
        node.type === 'pdf-input' || 
        node.type === 'file-upload'
      );

      // Initialize input values
      const initialValues: ScheduledInputValue[] = inputNodes.map((node: any) => {
        // Check if existing task has value for this input
        const existingValue = existingTask?.inputs.find(input => input.nodeId === node.id);
        
        return {
          nodeId: node.id,
          nodeName: node.name || `Input ${node.id}`,
          value: existingValue?.value || '',
          type: getInputTypeFromNodeType(node.type),
          fileMetadata: existingValue?.fileMetadata
        };
      });

      setInputValues(initialValues);
    };

    loadInputs();
  }, [agentFlow, existingTask]);

  const getInputTypeFromNodeType = (nodeType: string): 'text' | 'file' | 'number' => {
    if (nodeType.includes('image') || nodeType.includes('pdf') || nodeType.includes('file')) {
      return 'file';
    }
    if (nodeType.includes('number')) {
      return 'number';
    }
    return 'text';
  };

  const handleInputChange = async (nodeId: string, value: string | File) => {
    if (value instanceof File) {
      // Convert file to base64 for storage
      const processedValue = await processFileForStorage(value);
      
      setInputValues(prev => prev.map(input => 
        input.nodeId === nodeId 
          ? { 
              ...input, 
              value: processedValue,
              fileMetadata: {
                name: value.name,
                type: value.type,
                size: value.size
              }
            } 
          : input
      ));
    } else {
      setInputValues(prev => prev.map(input => 
        input.nodeId === nodeId ? { ...input, value } : input
      ));
    }
  };

  const processFileForStorage = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (file.type.startsWith('image/')) {
        // Convert image to base64
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      } else if (file.type === 'application/pdf') {
        // Convert PDF to base64
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      } else {
        // Convert text file to string
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsText(file);
      }
    });
  };

  const calculateNextRun = (): string => {
    const now = new Date();
    let nextRun = new Date(now);

    switch (interval) {
      case '30seconds':
        nextRun.setSeconds(nextRun.getSeconds() + 30);
        break;
      
      case 'minute':
        nextRun.setMinutes(nextRun.getMinutes() + 1);
        break;
      
      case 'minutes':
        nextRun.setMinutes(nextRun.getMinutes() + minuteInterval);
        break;
      
      case 'hourly':
        nextRun.setHours(nextRun.getHours() + 1);
        break;
      
      case 'daily':
        const [hours, minutes] = time.split(':').map(Number);
        nextRun.setHours(hours, minutes, 0, 0);
        
        // If time has passed today, schedule for tomorrow
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        break;
      
      case 'weekly':
        const [weeklyHours, weeklyMinutes] = time.split(':').map(Number);
        nextRun.setHours(weeklyHours, weeklyMinutes, 0, 0);
        nextRun.setDate(nextRun.getDate() + 7);
        break;
    }

    return nextRun.toISOString();
  };

  const handleSave = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Validate that all required inputs have values
      const requiredInputs = inputValues.filter(input => input.value === '' || input.value === null);
      if (requiredInputs.length > 0) {
        setError(`Please provide values for all inputs: ${requiredInputs.map(i => i.nodeName).join(', ')}`);
        return;
      }

      const scheduledTask: ScheduledTask = {
        id: existingTask?.id || `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        agentFlowId: agentFlow.id,
        agentName: agentFlow.name,
        agentDescription: agentFlow.description,
        schedule: {
          enabled,
          interval,
          time: ['daily', 'weekly'].includes(interval) ? time : undefined,
          minuteInterval: interval === 'minutes' ? minuteInterval : undefined,
          nextRun: enabled ? calculateNextRun() : undefined,
          lastRun: existingTask?.schedule.lastRun,
          status: 'idle'
        },
        inputs: inputValues,
        metadata: {
          createdAt: existingTask?.metadata.createdAt || new Date().toISOString(),
          createdBy: 'user', // TODO: Get actual user ID
          totalRuns: existingTask?.metadata.totalRuns || 0,
          successRuns: existingTask?.metadata.successRuns || 0,
          lastError: existingTask?.metadata.lastError
        }
      };

      await schedulerStorage.saveScheduledTask(scheduledTask);
      
      // Also update the agent flow's schedule property
      const updatedAgentFlow = { ...agentFlow };
      updatedAgentFlow.schedule = scheduledTask.schedule;
      await agentWorkflowStorage.saveWorkflow(updatedAgentFlow);

      onSaved();
    } catch (error) {
      console.error('Failed to save scheduled task:', error);
      setError(error instanceof Error ? error.message : 'Failed to save scheduled task');
    } finally {
      setIsLoading(false);
    }
  };

  const getNextRunPreview = (): string => {
    if (!enabled) return 'Disabled';
    
    const nextRun = new Date(calculateNextRun());
    const now = new Date();
    const diff = nextRun.getTime() - now.getTime();
    
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    // For very short intervals, show seconds
    if (interval === '30seconds') {
      return `In ${seconds} seconds (${nextRun.toLocaleTimeString()})`;
    }
    
    if (interval === 'minute') {
      return `In ${Math.max(1, minutes)} minute(s) (${nextRun.toLocaleTimeString()})`;
    }
    
    if (interval === 'minutes') {
      return `In ${Math.max(1, minutes)} minute(s) (${nextRun.toLocaleTimeString()})`;
    }
    
    if (hours < 24) {
      return `In ${hours}h ${minutes % 60}m (${nextRun.toLocaleString()})`;
    } else {
      const days = Math.floor(hours / 24);
      return `In ${days} day(s) (${nextRun.toLocaleString()})`;
    }
  };

  const renderInputField = (input: ScheduledInputValue) => {
    if (input.type === 'file') {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-3 border-2 border-dashed border-gray-300 dark:border-purple-600/30 rounded-lg hover:border-gray-400 dark:hover:border-purple-500/50 transition-colors">
            <Upload className="w-5 h-5 text-gray-400 dark:text-purple-400" />
            <input
              type="file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleInputChange(input.nodeId, file);
              }}
              className="flex-1 text-sm text-gray-600 dark:text-purple-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 dark:file:bg-purple-800/40 file:text-gray-700 dark:file:text-purple-200 hover:file:bg-gray-200 dark:hover:file:bg-purple-700/50"
            />
          </div>
          {input.fileMetadata && (
            <div className="text-xs text-gray-500 dark:text-purple-400 flex items-center gap-1">
              {input.type === 'file' && input.fileMetadata.type.startsWith('image/') ? (
                <Image className="w-3 h-3" />
              ) : (
                <FileText className="w-3 h-3" />
              )}
              {input.fileMetadata.name} ({(input.fileMetadata.size / 1024).toFixed(1)} KB)
            </div>
          )}
        </div>
      );
    }

    return (
      <input
        type={input.type === 'number' ? 'number' : 'text'}
        value={input.value as string}
        onChange={(e) => handleInputChange(input.nodeId, e.target.value)}
        placeholder={`Enter ${input.nodeName.toLowerCase()}...`}
        className="w-full px-3 py-2 border border-gray-300 dark:border-purple-600/30 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-purple-900/20 text-gray-900 dark:text-purple-100 placeholder-gray-500 dark:placeholder-purple-400"
      />
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900/90 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700/50 w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-sakura-500 to-pink-500 rounded-xl flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {existingTask ? 'Edit Schedule' : 'Schedule Agent'}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Configure inputs and schedule for "{agentFlow.name}"
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex max-h-[calc(90vh-140px)]">
          {/* Inputs Panel */}
          <div className="w-1/2 p-6 border-r border-gray-200 dark:border-gray-700/50 overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Play className="w-5 h-5" />
              Input Configuration
            </h3>
            
            {inputValues.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p>This agent has no input parameters</p>
              </div>
            ) : (
              <div className="space-y-4">
                {inputValues.map((input) => (
                  <div key={input.nodeId} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {input.nodeName}
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                        ({input.type})
                      </span>
                    </label>
                    {renderInputField(input)}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Schedule Panel */}
          <div className="w-1/2 p-6 overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Schedule Configuration
            </h3>

            <div className="space-y-6">
              {/* Enable/Disable */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable Scheduling
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sakura-300 dark:peer-focus:ring-sakura-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-sakura-600"></div>
                </label>
              </div>

              {/* Interval */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-purple-300">
                  Run Every
                </label>
                <select
                  value={interval}
                  onChange={(e) => setInterval(e.target.value as '30seconds' | 'minute' | 'minutes' | 'hourly' | 'daily' | 'weekly')}
                  disabled={!enabled}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-purple-600/30 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-purple-900/20 text-gray-900 dark:text-purple-100 disabled:opacity-50"
                >
                  <option value="30seconds">30 Seconds</option>
                  <option value="minute">Minute</option>
                  <option value="minutes">X Minutes</option>
                  <option value="hourly">Hour</option>
                  <option value="daily">Day</option>
                  <option value="weekly">Week</option>
                </select>
              </div>

              {/* Minute Interval Input (for 'minutes' option) */}
              {interval === 'minutes' && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-purple-300">
                    Every X Minutes
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="59"
                    value={minuteInterval}
                    onChange={(e) => setMinuteInterval(Number(e.target.value))}
                    disabled={!enabled}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-purple-600/30 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-purple-900/20 text-gray-900 dark:text-purple-100 disabled:opacity-50"
                    placeholder="5"
                  />
                  <p className="text-xs text-gray-500 dark:text-purple-400">
                    Enter a number between 1 and 59 minutes
                  </p>
                </div>
              )}

              {/* Time */}
              {['daily', 'weekly'].includes(interval) && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-purple-300">
                    At Time
                  </label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    disabled={!enabled}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-purple-600/30 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-purple-900/20 text-gray-900 dark:text-purple-100 disabled:opacity-50"
                  />
                </div>
              )}

              {/* Next Run Preview */}
              <div className="p-4 bg-gray-50 dark:bg-purple-800/30 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 dark:text-purple-300 mb-2">
                  Next Run
                </h4>
                <p className="text-sm text-gray-600 dark:text-purple-400">
                  {getNextRunPreview()}
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-500/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500" />
                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700/50 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="px-6 py-2 bg-gradient-to-r from-sakura-500 to-pink-500 text-white rounded-lg hover:from-sakura-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                {existingTask ? 'Update Schedule' : 'Save Schedule'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleModal;
