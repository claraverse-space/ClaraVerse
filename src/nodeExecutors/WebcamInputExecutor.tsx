import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeWebcamInput = async (context: NodeExecutionContext) => {
  const { node, updateNodeOutput } = context;
  
  try {
    // Request webcam stream (video only)
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = document.createElement('video');
    video.srcObject = stream;
    
    // Wait for the video metadata to load so that dimensions are available
    await new Promise((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        resolve(true);
      };
    });
    
    // Wait a short time for the video to get a frame (100ms)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Create a canvas to capture the current frame
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error("Unable to get canvas context");
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageDataUrl = canvas.toDataURL('image/png');
    
    // Stop the video stream to free resources
    stream.getTracks().forEach(track => track.stop());
    
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
      updateNodeOutput(node.id, errorMsg);
    }
    return errorMsg;
  }
};

registerNodeExecutor('webcamInputNode', {
  execute: executeWebcamInput
});
