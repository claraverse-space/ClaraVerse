import { registerNodeExecutor, NodeExecutionContext, NodeExecutor } from './NodeExecutorRegistry';

const evaluateExpression = (data: any, expression: string) => {
  if (!expression) return '';
  
  try {
    return new Function('data', `
      try {
        with (data) {
          return ${expression};
        }
      } catch (e) {
        return undefined;
      }
    `)(data);
  } catch (error) {
    return '';
  }
};

const executeTextPreview = async (context: NodeExecutionContext) => {
  const { node, inputs } = context;
  
  try {
    // Get the input text
    const inputText = inputs.text || inputs['text-in'] || '';
    if (!inputText) return '';

    // Parse JSON
    const jsonData = JSON.parse(inputText);
    
    // Get the stored expression path
    const expression = node.data.config?.jsonKey || '';
    if (!expression) return '';

    // Evaluate the expression
    const result = evaluateExpression(jsonData, expression);
    
    // Format the result
    return typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result || '');
  } catch (error) {
    return '';
  }
};

// Create and export the executor
export const textPreviewExecutor: NodeExecutor = {
  execute: executeTextPreview
};

// Register the executor with the transformed node type from NodeRegistry
registerNodeExecutor('textInputPreviewNode', textPreviewExecutor);