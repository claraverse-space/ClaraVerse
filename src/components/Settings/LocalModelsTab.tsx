import React, { useState } from 'react';
import { Brain, Zap } from 'lucide-react';
import ModelManager from '../ModelManager';
import GPUDiagnostics from '../GPUDiagnostics';

const LocalModelsTab: React.FC = () => {
  const [activeModelTab, setActiveModelTab] = useState<'models' | 'gpu-diagnostics'>('models');

  const ModelTabItem = ({ id, label, isActive }: { id: typeof activeModelTab, label: string, isActive: boolean }) => (
    <button
      onClick={() => setActiveModelTab(id)}
      className={`px-4 py-2 rounded-lg transition-colors font-medium ${isActive
          ? 'bg-sakura-500 text-white'
          : 'text-gray-700 dark:text-gray-200 hover:bg-sakura-100 dark:hover:bg-gray-800'
        }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      {/* Model Manager Header with Sub-tabs */}
      <div className="glassmorphic rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-sakura-500" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Local Models
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage your locally installed AI models and hardware acceleration
              </p>
            </div>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700 -mb-6 pb-4">
          <ModelTabItem
            id="models"
            label="Models"
            isActive={activeModelTab === 'models'}
          />
          <ModelTabItem
            id="gpu-diagnostics"
            label="Hardware Acceleration"
            isActive={activeModelTab === 'gpu-diagnostics'}
          />
        </div>
      </div>

      {/* Model Tab Content */}
      {activeModelTab === 'models' && (
        <ModelManager />
      )}

      {/* GPU Diagnostics Tab Content */}
      {activeModelTab === 'gpu-diagnostics' && (
        <div className="glassmorphic rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Zap className="w-6 h-6 text-amber-500" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Hardware Acceleration
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Monitor GPU detection and optimize performance for faster inference
              </p>
            </div>
          </div>

          <GPUDiagnostics />
        </div>
      )}
    </div>
  );
};

export default LocalModelsTab; 