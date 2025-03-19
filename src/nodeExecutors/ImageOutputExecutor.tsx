import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeImageOutput = async (context: NodeExecutionContext) => {
  const { node, inputs, updateNodeOutput } = context;
  
  try {
    const imageInput = inputs['image-in'] || inputs.default || '';
    
    // Update node's visual output
    if (updateNodeOutput) {
      updateNodeOutput(node.id, imageInput);
    }
    
    return imageInput;
  } catch (error) {
    console.error('Error in image output:', error);
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
};

registerNodeExecutor('imageOutputNode', {
  execute: executeImageOutput
});
