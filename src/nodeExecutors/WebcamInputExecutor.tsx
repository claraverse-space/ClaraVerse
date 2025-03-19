import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeWebcamInput = async (context: NodeExecutionContext) => {
  const { node, updateNodeOutput } = context;
  
  try {
    // Request webcam stream (video only)
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = document.createElement('video');
    video.srcObject = stream;
    video.autoplay = true;
    
    // Wait for the video to be ready and playing
    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play().then(() => {
          // Wait an additional second for the camera to adjust exposure and focus
          setTimeout(resolve, 1000);
        });
      };
    });
    
    // Create a canvas to capture the current frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error("Unable to get canvas context");
    }

    // Draw the current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageDataUrl = canvas.toDataURL('image/png');
    
    // Stop the video stream
    stream.getTracks().forEach(track => track.stop());
    
    // Verify that we got valid image data (not a black frame)
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = imageDataUrl;
    });
    
    // Update node configuration and visual output
    if (!node.data.config) node.data.config = {};
    node.data.config.outputImage = imageDataUrl;
    
    if (updateNodeOutput) {
      updateNodeOutput(node.id, imageDataUrl);
    }
    
    return imageDataUrl;
    
  } catch (error) {
    console.error('Error capturing webcam image:', error);
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

registerNodeExecutor('webcamInputNode', {
  execute: executeWebcamInput
});
