import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeConditional = async (context: NodeExecutionContext) => {
  const { node, inputs, updateNodeOutput } = context;
  
  const textInput = inputs.text || inputs['text-in'] || inputs.default || '';
  const config = node.data.config || {};
  const condition = config.condition || '';
  
  // Update the node's input text for display purposes
  if (updateNodeOutput) {
    updateNodeOutput(node.id, textInput);
  }

  if (!condition) {
    return textInput; // No condition, just pass through
  }

  let result = false;
  
  try {
    // Simple contains check
    if (condition.includes('contains(')) {
      const match = condition.match(/contains\(['"](.+)['"]\)/);
      const searchTerm = match ? match[1] : '';
      if (searchTerm) {
        result = String(textInput).includes(searchTerm);
      }
    } else {
      // Direct substring check
      result = String(textInput).includes(condition);
    }
  } catch (error) {
    console.error("Error evaluating condition:", error);
    return textInput; // On error, just pass through
  }

  // Store the result for branch selection
  config.result = result;
  
  // The actual flow branching happens at the ReactFlow level
  // We're just passing through the input text
  return textInput;
};

registerNodeExecutor('conditionalNode', {
  execute: executeConditional
});
