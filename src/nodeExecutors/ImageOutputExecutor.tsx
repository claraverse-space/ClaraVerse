import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeImageOutput = async (context: NodeExecutionContext) => {
  const { node, inputs, updateNodeOutput } = context;
  
  try {
    const imageInput = inputs['image-in'] || inputs.default || '';
    
    // Update node's visual output
    if (!node.data.config) node.data.config = {};
    node.data.config.outputImage = imageInput;
    
    if (updateNodeOutput) {
      updateNodeOutput(node.id, imageInput);
    }
    
    return imageInput;
  } catch (error) {
    console.error('Error in image output:', error);
    const errorMsg = `Error: ${error instanceof Error ? error.message : String(error)}`;
    if (updateNodeOutput) {
      updateNodeOutput(node.id, errorMsg);
    }
    return errorMsg;
  }
};

registerNodeExecutor('imageOutputNode', {
  execute: executeImageOutput
});
