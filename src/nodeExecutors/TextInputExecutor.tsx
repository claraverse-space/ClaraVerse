import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeTextInput = async (context: NodeExecutionContext) => {
  const { node, inputs } = context;
  
  // Check for runtime input first (provided by the app runner)
  // The special key 'inputText' will be set by AppRunner for user-provided inputs
  if (inputs && inputs.inputText !== undefined) {
    return inputs.inputText;
  }
  
  // Fall back to static config (used during app creation and testing)
  const config = node.data.config || {};
  return config.text || '';
};

registerNodeExecutor('textInputNode', {
  execute: executeTextInput
});
