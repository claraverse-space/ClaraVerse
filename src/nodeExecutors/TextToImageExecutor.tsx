import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';
import { Client, BasePipe } from '@stable-canvas/comfyui-client';
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

    const configUrl = await db.getAPIConfig();
    let comfyuiBaseUrl = configUrl?.comfyui_base_url;
    if (!comfyuiBaseUrl) {
      console.warn('No comfyui_base_url found; using default 127.0.0.1:8188');
      comfyuiBaseUrl = '127.0.0.1:8188';
    }
    console.log('API Config' + configUrl);
    

    let url = comfyuiBaseUrl;
    if (comfyuiBaseUrl.includes('http://') || comfyuiBaseUrl.includes('https://')) {
      url = comfyuiBaseUrl.split('//')[1];
    }

    console.log('ComfyUI base URL:', url);

    if (updateNodeOutput) {
      updateNodeOutput(node.id, { 
        type: 'status', 
        message: `Connecting to ComfyUI at ${url}...` 
      });
    }

    // Create ComfyUI client with validated config
    const client = new Client({ 
      api_host: url,
      ssl: true,
    });

    // Connect and wait for ready state
    client.connect();
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 15000);
      const checkConnection = setInterval(() => {
        if (client.socket?.readyState === WebSocket.OPEN) {
          clearInterval(checkConnection);
          clearTimeout(timeout);
          resolve(true);
        }
      }, 100);
    });

    // Update user about connection status
    if (updateNodeOutput) {
      updateNodeOutput(node.id, { type: 'status', message: 'Connecting to ComfyUI...' });
    }

    // Update status during generation
    if (updateNodeOutput) {
      updateNodeOutput(node.id, {
        type: 'status',
        message: 'Generating image...'
      });
    }

    // Build and execute pipeline
    const pipeline = new BasePipe()
      .with(client)
      .model(config.model)
      .prompt(input)
      .negative(config.negativePrompt || '')
      .size(config.width || 512, config.height || 512)
      .steps(config.steps || 20)
      .cfg(config.guidance || 7)
      .sampler(config.sampler || 'euler')
      .scheduler(config.scheduler || 'normal')
      .seed();

    const result = await pipeline.save().wait();
    
    // Convert image buffer to base64 using Uint8Array
    const imageBuffer = new Uint8Array(result.images[0].data);
    const base64 = Buffer.from(imageBuffer).toString('base64');
    const imageDataUrl = `data:image/png;base64,${base64}`;

    // Just update the node's visual state, don't send to chat
    if (updateNodeOutput) {
      updateNodeOutput(node.id, imageDataUrl);
    }

    // Pass the image data to connected nodes
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

registerNodeExecutor('textToImageNode', {
  execute: executeTextToImage
});
