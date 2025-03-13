import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeStaticText = async (context: NodeExecutionContext) => {
  const { node, updateNodeOutput } = context;
  
  // Get the static text from the node's configuration
  const config = node.data.config || {};
  const staticText = config.staticText || '';
  
  // Update the node's visual state with the static text
  if (updateNodeOutput) {
    updateNodeOutput(node.id, staticText);
  }
  
  // Return the static text
  return staticText;
};

registerNodeExecutor('staticTextNode', {
  execute: executeStaticText
});
