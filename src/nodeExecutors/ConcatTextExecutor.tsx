import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeConcatText = async (context: NodeExecutionContext) => {
  const { node, inputs, updateNodeOutput } = context;
  
  // Get the inputs from the two different handles
  // Try both accessing by handle ID directly and by looking for keys that contain the handle ID
  let topInput = '';
  let bottomInput = '';
  
  // First try direct access by handle ID
  if (inputs['top-in'] !== undefined) {
    topInput = inputs['top-in'] || '';
  } else {
    // Look for any connection to the top-in handle
    const topConnection = Object.entries(inputs).find(([key, _]) => 
      key.includes('top-in') || key.endsWith('top-in')
    );
    if (topConnection) {
      topInput = topConnection[1] || '';
    }
  }
  
  if (inputs['bottom-in'] !== undefined) {
    bottomInput = inputs['bottom-in'] || '';
  } else {
    // Look for any connection to the bottom-in handle
    const bottomConnection = Object.entries(inputs).find(([key, _]) => 
      key.includes('bottom-in') || key.endsWith('bottom-in')
    );
    if (bottomConnection) {
      bottomInput = bottomConnection[1] || '';
    }
  }
  
  // Log for debugging
  console.log('ConcatTextExecutor inputs:', { 
    topInput, bottomInput, 
    allInputs: inputs,
    nodeId: node.id
  });
  
  // Get configuration for order (default to top first if not specified)
  const config = node.data.config || {};
  const topFirst = config.topFirst !== undefined ? config.topFirst : true;
  
  // Combine the texts based on the specified order
  const result = topFirst 
    ? `${topInput}${bottomInput}` 
    : `${bottomInput}${topInput}`;
  
  // Update the node's visual state with the inputs for preview
  if (updateNodeOutput) {
    updateNodeOutput(node.id, {
      topInput,
      bottomInput
    });
  }
  
  return result;
};

registerNodeExecutor('concatTextNode', {
  execute: executeConcatText
});
