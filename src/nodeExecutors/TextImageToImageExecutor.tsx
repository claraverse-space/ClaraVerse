import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';
import { Client, EfficientPipe } from '@stable-canvas/comfyui-client';
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

    // Create ComfyUI client
    const url = config.comfyuiUrl.endsWith('/') ? config.comfyuiUrl.slice(0, -1) : config.comfyuiUrl;
    const client = new Client({ 
      api_host: url.replace(/^https?:\/\//, ''),
      ssl: url.startsWith('https')
    });

    // Add event listeners for progress
    client.events.on('progress', (data) => {
      if (updateNodeOutput) {
        updateNodeOutput(node.id, {
          type: 'progress',
          value: data.value,
          max: data.max
        });
      }
    });

    client.events.on('execution_error', (data) => {
      if (updateNodeOutput) {
        updateNodeOutput(node.id, {
          type: 'error',
          message: data?.message || 'Unknown error'
        });
      }
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

    // Add helper function to get image dimensions
    const getImageDimensions = async (imageData: string | Buffer): Promise<{width: number, height: number}> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          console.log('Input image dimensions:', { width: img.width, height: img.height });
          resolve({ width: img.width, height: img.height });
        };
        if (imageData instanceof Buffer) {
          img.src = `data:image/png;base64,${imageData.toString('base64')}`;
        } else {
          img.src = imageData;
        }
      });
    };

    // Convert input image to buffer if it's base64
    let imageBuffer: Buffer;
    
    if (typeof imageInput === 'string' && imageInput.startsWith('data:image')) {
      const base64Data = imageInput.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else if (imageInput instanceof ArrayBuffer || imageInput instanceof Uint8Array) {
      imageBuffer = Buffer.from(imageInput);
    } else if (typeof imageInput === 'string') {
      imageBuffer = Buffer.from(imageInput, 'base64');
    } else {
      throw new Error('Invalid image format. Expected buffer, base64 string, or data URL');
    }

    // Get dimensions from input image
    const dimensions = await getImageDimensions(imageBuffer);

    // Create efficient pipeline with calculated dimensions
    const pipe = new EfficientPipe()
      .with(client)
      .model(model)
      .prompt(textInput)
      .size(dimensions.width, dimensions.height)  // Use calculated dimensions
      .steps(steps)
      .cfg(guidance)
      .denoise(denoise)
      .sampler(sampler)
      .scheduler(scheduler)
      .seed();

    // Add image to pipeline using only buffer
    pipe.image(imageBuffer);

    // Add optional components if configured
    if (config.lora) {
      pipe.lora(config.lora, { strength: config.loraStrength || 0.75 });
    }
    
    if (config.vae) {
      pipe.vae(config.vae);
    }

    if (config.controlNet) {
      pipe.cnet(config.controlNet, imageBuffer);
    }

    // Execute with timeout
    const pipelinePromise = pipe.save().wait();
    const result = await Promise.race([
      pipelinePromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Generation timed out")), 5 * 60 * 1000)
      )
    ]) as { images: any[] };

    // Convert result to base64
    const resultBuffer = new Uint8Array(result.images[0].data);
    const resultBase64 = Buffer.from(resultBuffer).toString('base64');
    const imageDataUrl = `data:image/png;base64,${resultBase64}`;

    // Clean up
    client.free({ free_memory: true, unload_models: true });
    client.close();

    // Send final output
    if (updateNodeOutput) {
      updateNodeOutput(node.id, {
        type: 'complete',
        data: imageDataUrl
      });
    }

    return imageDataUrl;

  } catch (error) {
    console.error('Error in Text & Image to Image generation:', error);
    const errorMsg = `Error: ${error instanceof Error ? error.message : String(error)}`;
    if (updateNodeOutput) {
      updateNodeOutput(node.id, {
        type: 'error',
        message: errorMsg
      });
    }
    return errorMsg;
  }
};

registerNodeExecutor('textImageToImageNode', {
  execute: executeTextImageToImage
});
