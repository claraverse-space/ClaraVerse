import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeTextOutput = async (context: NodeExecutionContext) => {
  const { node, inputs, updateNodeOutput } = context;
  
  const input = inputs.text || inputs['text-in'] || inputs.default || '';
  const output = typeof input === 'string' ? input : JSON.stringify(input);
  
  if (updateNodeOutput) {
    updateNodeOutput(node.id, output);
  }
  
  return output;
};

registerNodeExecutor('textOutputNode', {
  execute: executeTextOutput
});
