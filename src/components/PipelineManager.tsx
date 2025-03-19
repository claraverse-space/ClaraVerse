// components/PipelineManager.tsx
import React from 'react';
import { usePipeline } from '../hooks/usePipeline';

interface PipelineManagerProps {
  client: any;
  selectedModel: string;
  prompt: string;
  negativeTags: string[];
  steps: number;
  guidanceScale: number;
  width: number;
  height: number;
  selectedLora?: string;
  onResult: (result: any) => void;
}

const PipelineManager: React.FC<PipelineManagerProps> = ({
  client,
  selectedModel,
  prompt,
  negativeTags,
  steps,
  guidanceScale,
  width,
  height,
  selectedLora,
  onResult,
}) => {
  const { runPipeline, isGenerating, progress, error } = usePipeline();

  const handleRunPipeline = async () => {
    try {
      const result = await runPipeline({
        client,
        selectedModel,
        prompt,
        negativeTags,
        steps,
        guidanceScale,
        width,
        height,
        selectedLora,
      });
      onResult(result);
    } catch (err) {
      console.error('Pipeline error:', err);
    }
  };

  return (
    <div>
      <button onClick={handleRunPipeline} disabled={isGenerating}>
        {isGenerating ? 'Generating...' : 'Run Pipeline'}
      </button>
      {progress && <p>{`Progress: ${progress.value} / ${progress.max}`}</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
    </div>
  );
};

export default PipelineManager;
