import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';
import { Buffer } from "buffer";
const executeImageResize = async (context: NodeExecutionContext) => {
  const { node, inputs, updateNodeOutput } = context;
  const config = node.data.config || {};
  
  try {
    const imageInput = inputs.image || inputs['image-in'];
    if (!imageInput) {
      throw new Error('No image input provided');
    }

    // Create a canvas to resize the image
    const resizeImage = async (imageData: string | ArrayBuffer): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          // Calculate new dimensions based on mode
          let newWidth, newHeight;
          if (config.useManualSize) {
            newWidth = config.width || img.width;
            newHeight = config.height || img.height;
          } else {
            const percentage = config.percentage || 100;
            newWidth = (img.width * percentage) / 100;
            newHeight = (img.height * percentage) / 100;
          }
          
          canvas.width = newWidth;
          canvas.height = newHeight;
          
          // Draw resized image
          ctx.drawImage(img, 0, 0, newWidth, newHeight);
          
          // Instead of returning data URL, return clean base64
          const dataUrl = canvas.toDataURL('image/png');
          const base64Data = dataUrl.split(',')[1]; // Remove data URL prefix
          resolve(base64Data);
        };

        img.onerror = () => reject(new Error('Failed to load image'));

        // Handle different input types
        if (imageData instanceof ArrayBuffer) {
          const buffer = Buffer.from(imageData);
          const base64 = buffer.toString('base64');
          img.src = `data:image/png;base64,${base64}`;
        } else if (typeof imageData === 'string') {
          if (imageData.startsWith('data:image')) {
            img.src = imageData;
          } else {
            // Assume it's a base64 string
            img.src = `data:image/png;base64,${imageData}`;
          }
        }
      });
    };

    const resizedImage = await resizeImage(imageInput);

    // When updating node output for UI, convert back to data URL
    if (updateNodeOutput) {
      updateNodeOutput(node.id, `data:image/png;base64,${resizedImage}`);
    }

    // Return clean base64 string for the next node
    return resizedImage;
  } catch (error) {
    console.error('Error in image resize:', error);
    const errorMsg = `Error: ${error instanceof Error ? error.message : String(error)}`;
    if (updateNodeOutput) {
      updateNodeOutput(node.id, errorMsg);
    }
    return errorMsg;
  }
};

registerNodeExecutor('imageResizeNode', {
  execute: executeImageResize
});
