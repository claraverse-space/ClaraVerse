import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeGetClipboardText = async (context: NodeExecutionContext) => {
  const { node, updateNodeOutput } = context;
  
  try {
    // Read text from clipboard
    const clipboardText = await navigator.clipboard.readText();
    
    // Update the node's visual state
    if (updateNodeOutput) {
      updateNodeOutput(node.id, clipboardText);
    }
    
    return clipboardText;
  } catch (error) {
    console.error('Error accessing clipboard:', error);
    return 'Error: Could not access clipboard. Please ensure clipboard permissions are granted.';
  }
};

registerNodeExecutor('getClipboardTextNode', {
  execute: executeGetClipboardText
});