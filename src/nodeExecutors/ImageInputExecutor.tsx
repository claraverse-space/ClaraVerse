import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeImageInput = async (context: NodeExecutionContext) => {
  const { node } = context;
  const config = node.data.config || {};
  return config.image || null;
};

registerNodeExecutor('imageInputNode', {
  execute: executeImageInput
});
