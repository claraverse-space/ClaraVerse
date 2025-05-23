import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';
import { Buffer } from 'buffer';

const executeTextImageToImage = async (context: NodeExecutionContext) => {
  const { node, inputs, updateNodeOutput } = context;
  const config = node.data.config || {};

  try {
    const textInput = inputs.text || inputs['text-in'] || '';
    const imageInput = inputs.image || inputs['image-in'];
    if (!textInput) {
      throw new Error('No text input provided');
    }
    if (!imageInput) {
      throw new Error('No image input provided');
    }
    // Required parameters
    const model = config.model;
    const steps = config.steps || 20;
    const guidance = config.guidance || 7;
    const width = config.width || 512;
    const height = config.height || 512;
    const denoise = config.denoise || 0.7;
    const sampler = config.sampler || 'euler';
    const scheduler = config.scheduler || 'normal';
    if (!model) {
      throw new Error('No model selected. Please configure the node with a model.');
    }
    if (!config.comfyuiUrl) {
      throw new Error('ComfyUI URL not configured. Please set the URL in node settings.');
    }
    // comfyui-api base url
    let comfyuiBaseUrl = config.comfyuiUrl;
    if (!comfyuiBaseUrl.startsWith('http')) comfyuiBaseUrl = 'http://' + comfyuiBaseUrl;
    comfyuiBaseUrl = comfyuiBaseUrl.replace(/:(\d+)$/, ':8189');
    // Build workflow JSON
    const workflow_id = 'default';
    const prompt = {
      model,
      prompt: textInput,
      image: imageInput, // You may need to encode or handle image input as required by comfyui-api
      width,
      height,
      steps,
      cfg: guidance,
      denoise,
      sampler,
      scheduler,
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
    console.error('Error in Text-Image-to-Image generation:', error);
    const errorMsg = `Error: ${error instanceof Error ? error.message : String(error)}`;
    if (updateNodeOutput) {
      updateNodeOutput(node.id, errorMsg);
    }
    return errorMsg;
  }
};

registerNodeExecutor('TextImageToImage', executeTextImageToImage);
