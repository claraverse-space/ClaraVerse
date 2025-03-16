import React from 'react';
import { ChevronDown, ChevronUp, Plus, X } from 'lucide-react';

export interface Resolution {
  label: string;
  width: number;
  height: number;
}

interface SettingsDrawerProps {
  drawerRef?: React.Ref<HTMLDivElement>;
  showSettings: boolean;
  expandedSections: {
    model: boolean;
    lora: boolean;
    vae: boolean;
    negative: boolean;
    resolution: boolean;
  };
  toggleSection: (section: 'model' | 'lora' | 'vae' | 'negative' | 'resolution') => void;
  sdModels: string[];
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  loras: string[];
  selectedLora: string;
  setSelectedLora: (lora: string) => void;
  loraStrength: number;
  setLoraStrength: (value: number) => void;
  vaes: string[];
  selectedVae: string;
  setSelectedVae: (vae: string) => void;
  negativeTags: string[];
  negativeInput: string;
  setNegativeInput: (value: string) => void;
  handleNegativeTagAdd: () => void;
  handleNegativeTagRemove: (tag: string) => void;
  handleNegativeInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  steps: number;
  setSteps: (value: number) => void;
  guidanceScale: number;
  setGuidanceScale: (value: number) => void;
  resolutions: Resolution[];
  selectedResolution: Resolution;
  setSelectedResolution: (resolution: Resolution) => void;
  customWidth: number;
  setCustomWidth: (value: number) => void;
  customHeight: number;
  setCustomHeight: (value: number) => void;
}

const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  drawerRef,
  showSettings,
  expandedSections,
  toggleSection,
  sdModels,
  selectedModel,
  setSelectedModel,
  loras,
  selectedLora,
  setSelectedLora,
  loraStrength,
  setLoraStrength,
  vaes,
  selectedVae,
  setSelectedVae,
  negativeTags,
  negativeInput,
  setNegativeInput,
  handleNegativeTagAdd,
  handleNegativeTagRemove,
  handleNegativeInputKeyDown,
  steps,
  setSteps,
  guidanceScale,
  setGuidanceScale,
  resolutions,
  selectedResolution,
  setSelectedResolution,
  customWidth,
  setCustomWidth,
  customHeight,
  setCustomHeight
}) => {
  return (
    <div
      ref={drawerRef}
      className={`w-80 glassmorphic border-l border-gray-200 dark:border-gray-700 fixed right-0 top-16 bottom-0 transform transition-transform duration-300 ${
        showSettings ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="p-6 space-y-6 h-full overflow-y-auto">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">Generation Settings</h3>
        {/* Model Selection */}
        <div className="space-y-4 border-b border-gray-200 dark:border-gray-700 pb-4">
          <button
            onClick={() => toggleSection('model')}
            className="flex items-center justify-between w-full"
          >
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Model</span>
            {expandedSections.model ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          {expandedSections.model && (
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
            >
              <option value="">-- Select a Model --</option>
              {sdModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
        </div>
        {/* LoRA Selection */}
        <div className="space-y-4 border-b border-gray-200 dark:border-gray-700 pb-4">
          <button
            onClick={() => toggleSection('lora')}
            className="flex items-center justify-between w-full"
          >
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">LoRA</span>
            {expandedSections.lora ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          {expandedSections.lora && (
            <div className="space-y-3">
              <select
                value={selectedLora}
                onChange={(e) => setSelectedLora(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
              >
                <option value="">-- No LoRA --</option>
                {loras.map((loraName) => (
                  <option key={loraName} value={loraName}>
                    {loraName}
                  </option>
                ))}
              </select>
              {selectedLora && (
                <div className="space-y-2">
                  <label className="block text-sm text-gray-700 dark:text-gray-300">
                    Strength: {loraStrength.toFixed(2)}
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={loraStrength}
                    onChange={(e) => setLoraStrength(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          )}
        </div>
        {/* VAE Selection */}
        <div className="space-y-4 border-b border-gray-200 dark:border-gray-700 pb-4">
          <button
            onClick={() => toggleSection('vae')}
            className="flex items-center justify-between w-full"
          >
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              VAE Model
            </span>
            {expandedSections.vae ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          {expandedSections.vae && (
            <select
              value={selectedVae}
              onChange={(e) => setSelectedVae(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
            >
              <option value="">-- No VAE --</option>
              {vaes.map((vaeName) => (
                <option key={vaeName} value={vaeName}>
                  {vaeName}
                </option>
              ))}
            </select>
          )}
        </div>
        {/* Negative Prompts */}
        <div className="space-y-4 border-b border-gray-200 dark:border-gray-700 pb-4">
          <button
            onClick={() => toggleSection('negative')}
            className="flex items-center justify-between w-full"
          >
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Negative Prompts
            </span>
            {expandedSections.negative ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          {expandedSections.negative && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={negativeInput}
                  onChange={(e) => setNegativeInput(e.target.value)}
                  onKeyDown={handleNegativeInputKeyDown}
                  placeholder="Add negative prompt..."
                  className="flex-1 px-3 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                />
                <button
                  onClick={handleNegativeTagAdd}
                  className="p-2 rounded-lg bg-sakura-500 text-white hover:bg-sakura-600"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {negativeTags.map((tag, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">{tag}</span>
                    <button onClick={() => handleNegativeTagRemove(tag)} className="p-0.5 hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {/* Steps and Guidance Scale */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Steps: {steps}
          </label>
          <input
            type="range"
            min="1"
            max="100"
            value={steps}
            onChange={(e) => setSteps(parseInt(e.target.value))}
            className="w-full"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Guidance Scale: {guidanceScale.toFixed(1)}
          </label>
          <input
            type="range"
            min="1"
            max="10"
            step="0.1"
            value={guidanceScale}
            onChange={(e) => setGuidanceScale(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
        {/* Resolution Settings */}
        <div className="space-y-4">
          <button
            onClick={() => toggleSection('resolution')}
            className="flex items-center justify-between w-full"
          >
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Resolution</span>
            {expandedSections.resolution ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          {expandedSections.resolution && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {resolutions.map((res) => (
                  <button
                    key={res.label}
                    onClick={() => setSelectedResolution(res)}
                    className={`p-2 rounded-lg text-sm text-center transition-colors ${
                      selectedResolution.label === res.label
                        ? 'bg-sakura-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <div>{res.label}</div>
                    {res.label !== 'Custom' && (
                      <div className="text-xs opacity-75">
                        {res.width}×{res.height}
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {selectedResolution.label === 'Custom' && (
                <div className="mt-4 space-y-2">
                  <div>
                    <label className="block text-sm text-gray-700 dark:text-gray-300">Custom Width</label>
                    <input
                      type="number"
                      value={customWidth}
                      onChange={(e) => setCustomWidth(parseInt(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-700 dark:text-gray-300">Custom Height</label>
                    <input
                      type="number"
                      value={customHeight}
                      onChange={(e) => setCustomHeight(parseInt(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-white/50 border border-gray-200 focus:outline-none focus:border-sakura-300 dark:bg-gray-800/50 dark:border-gray-700 dark:text-gray-100"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsDrawer;
