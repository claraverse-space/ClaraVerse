import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';
import { Client, BasePipe } from '@stable-canvas/comfyui-client';
import { Buffer } from 'buffer';

const executeTextToImage = async (context: NodeExecutionContext) => {
  const { node, inputs, updateNodeOutput } = context;
  const config = node.data.config || {};
  
  try {
    const input = inputs.text || inputs['text-in'] || '';
    if (!input) {
      throw new Error('No text input provided');
    }

    // Required parameters
    const model = config.model;
    const steps = config.steps || 20;
    const guidance = config.guidance || 7;
    const width = config.width || 512;
    const height = config.height || 512;
    const negativePrompt = config.negativePrompt || '';
    const sampler = config.sampler || 'euler';
    const scheduler = config.scheduler || 'normal';

    if (!model) {
      throw new Error('No model selected. Please configure the node with a model.');
    }
    
    if (!config.comfyuiUrl) {
      throw new Error('ComfyUI URL not configured. Please set the URL in node settings.');
    }

    // Create ComfyUI client
    const url = config.comfyuiUrl.endsWith('/') ? config.comfyuiUrl.slice(0, -1) : config.comfyuiUrl;
    const client = new Client({ 
      api_host: url.replace(/^https?:\/\//, ''),
      ssl: url.startsWith('https')
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

    // Build and execute pipeline
    const pipeline = new BasePipe()
      .with(client)
      .model(model)
      .prompt(input)
      .negative(negativePrompt)
      .size(width, height)
      .steps(steps)
      .cfg(guidance)
      .sampler(sampler)
      .scheduler(scheduler)
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
