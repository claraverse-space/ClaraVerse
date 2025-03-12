import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeStaticText = async (context: NodeExecutionContext) => {
  const { node } = context;
  const config = node.data.config || {};
  return config.staticText || '';
};

registerNodeExecutor('staticTextNode', {
  execute: executeStaticText
});
