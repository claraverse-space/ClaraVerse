import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeTextInput = async (context: NodeExecutionContext) => {
  const { node } = context;
  const config = node.data.config || {};
  return config.text || '';
};

registerNodeExecutor('textInputNode', {
  execute: executeTextInput
});
