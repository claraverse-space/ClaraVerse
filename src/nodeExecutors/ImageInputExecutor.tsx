import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeImageInput = async (context: NodeExecutionContext) => {
  const { node } = context;
  // Check both data.runtimeImage and config storage
  return node.data.runtimeImage || node.data.config?.runtimeImage || node.data.config?.image || null;
};

registerNodeExecutor('imageInputNode', {
  execute: executeImageInput
});
