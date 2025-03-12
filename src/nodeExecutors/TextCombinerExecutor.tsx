import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeTextCombiner = async (context: NodeExecutionContext) => {
  const { node, inputs, updateNodeOutput } = context;
  
  const textInput = inputs.text || inputs['text-in'] || inputs.default || '';
  const config = node.data.config || {};
  const additionalText = config.additionalText || '';
  const combined = `${textInput}${additionalText}`;
  
  // Update the node's visual state with the input text
  if (updateNodeOutput) {
    updateNodeOutput(node.id, textInput);
  }
  
  return combined;
};

registerNodeExecutor('textCombinerNode', {
  execute: executeTextCombiner
});
