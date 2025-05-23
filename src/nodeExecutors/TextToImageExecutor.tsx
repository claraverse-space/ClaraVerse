import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';
import { Buffer } from 'buffer';
import { db } from '../db';

const executeTextToImage = async (context: NodeExecutionContext) => {
  const { node, inputs, updateNodeOutput } = context;
  const config = node.data.config || {};

  try {
    // Early validation of required config
    if (!config.comfyuiUrl?.trim()) {
      throw new Error('ComfyUI URL is required. Please configure the node settings.');
    }
    if (!config.model?.trim()) {
      throw new Error('Model selection is required. Please configure the node settings.');
    }
    const input = inputs.text || inputs['text-in'] || '';
    if (!input?.trim()) {
      throw new Error('No text input provided');
    }

    // Build comfyui-api base url
    let comfyuiBaseUrl = config.comfyuiUrl;
    if (!comfyuiBaseUrl.startsWith('http')) comfyuiBaseUrl = 'http://' + comfyuiBaseUrl;
    comfyuiBaseUrl = comfyuiBaseUrl.replace(/:(\d+)$/, ':8189');

    // Build workflow JSON
    const workflow_id = 'default';
    const prompt = {
      model: config.model,
      prompt: input,
      negative: config.negativePrompt || '',
      width: config.width || 512,
      height: config.height || 512,
      steps: config.steps || 20,
      cfg: config.guidance || 7,
      sampler: config.sampler || 'euler',
      scheduler: config.scheduler || 'normal',
    };

    if (updateNodeOutput) {
      updateNodeOutput(node.id, { type: 'status', message: `Connecting to comfyui-api at ${comfyuiBaseUrl}...` });
    }

    // Submit workflow
    const resp = await fetch(`${comfyuiBaseUrl}/v1/workflows/${workflow_id}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workflow_id, prompt }),
    });
    if (!resp.ok) throw new Error(await resp.text());
    const data = await resp.json();
    const runId = data.id || data.run_id;

    if (updateNodeOutput) {
      updateNodeOutput(node.id, { type: 'status', message: 'Generating image...' });
    }

    // Poll for result
    let result = null;
    for (let i = 0; i < 150; i++) { // up to 5 minutes
      await new Promise(res => setTimeout(res, 2000));
      const pollResp = await fetch(`${comfyuiBaseUrl}/v1/workflows/${workflow_id}/runs/${runId}`);
      if (!pollResp.ok) throw new Error(await pollResp.text());
      const pollData = await pollResp.json();
      if (pollData.status === 'COMPLETED') {
        result = pollData;
        break;
      } else if (pollData.status === 'ERROR') {
        throw new Error('Generation failed: ' + (pollData.error || 'Unknown error'));
      }
    }
    if (!result) throw new Error('Generation timed out');
    // Assume result.images is an array of base64 strings or URLs
    const base64Images = result.images || [];
    const imageDataUrl = base64Images[0];
    if (updateNodeOutput) {
      updateNodeOutput(node.id, imageDataUrl);
    }
    return imageDataUrl;
  } catch (error) {
    console.error('Error in Text-to-Image generation:', error);
    const errorMsg = `Error: ${error instanceof Error ? error.message : String(error)}`;
    if (updateNodeOutput) {
      updateNodeOutput(node.id, errorMsg);
    }
    return errorMsg;
  }
};

registerNodeExecutor('TextToImage', executeTextToImage);
