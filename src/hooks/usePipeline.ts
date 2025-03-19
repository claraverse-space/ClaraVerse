// hooks/usePipeline.ts
import { useState } from 'react';
import { BasePipe, EfficientPipe } from '@stable-canvas/comfyui-client';

interface PipelineParams {
  client: any;
  selectedModel: string;
  prompt: string;
  negativeTags: string[];
  steps: number;
  guidanceScale: number;
  width: number;
  height: number;
  selectedLora?: string;
}

export const usePipeline = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<{ value: number; max: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runPipeline = async (params: PipelineParams) => {
    const {
      client,
      selectedModel,
      prompt,
      negativeTags,
      steps,
      guidanceScale,
      width,
      height,
      selectedLora,
    } = params;
    
    setIsGenerating(true);
    setError(null);
    try {
      // Build the pipeline based on whether lora is used or not.
      const pipeline = selectedLora
        ? new EfficientPipe()
            .with(client)
            .model(selectedModel)
            .prompt(prompt)
            .negative(negativeTags.join(', '))
            .size(width, height)
            .steps(steps)
            .cfg(guidanceScale)
            .lora(selectedLora)
        : new BasePipe()
            .with(client)
            .model(selectedModel)
            .prompt(prompt)
            .negative(negativeTags.join(', '))
            .size(width, height)
            .steps(steps)
            .cfg(guidanceScale);
      
      // Optionally attach progress event listeners, if needed.
      pipeline.on('progress', (data: { value: number; max: number }) => {
        setProgress({ value: data.value, max: data.max });
      });
      
      // Execute pipeline (you can also include a timeout here if needed)
      const result = await pipeline.save().wait();
      return result;
    } catch (err: any) {
      setError(err.message || 'Unknown error');
      throw err;
    } finally {
      setProgress(null);
      setIsGenerating(false);
    }
  };

  return { runPipeline, isGenerating, progress, error };
};
