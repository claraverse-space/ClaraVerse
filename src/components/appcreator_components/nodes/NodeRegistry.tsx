import TextInputNode from './TextInputNode';
import ImageInputNode from './ImageInputNode';
import LLMPromptNode from './LLMPromptNode';
import TextOutputNode from './TextOutputNode';
import ConditionalNode from './ConditionalNode';
import ApiCallNode from './ApiCallNode';
import TextCombinerNode from './TextCombinerNode';
import MarkdownOutputNode from './MarkdownOutputNode';
import StaticTextNode from './StaticTextNode';
import ImageTextLlmNode from './ImageTextLlmNode';
import GetClipboardTextNode from './GetClipboardTextNode';
import ConcatTextNode from './ConcatTextNode';

// Type for our node registry
export interface NodeTypeDefinition {
  type: string;
  component: React.ComponentType<any>;
}

// Map of all node types
const NODE_TYPES = {
  textInputNode: TextInputNode,
  imageInputNode: ImageInputNode,
  llmPromptNode: LLMPromptNode,
  textOutputNode: TextOutputNode,
  conditionalNode: ConditionalNode,
  apiCallNode: ApiCallNode,
  textCombinerNode: TextCombinerNode,
  markdownOutputNode: MarkdownOutputNode,
  staticTextNode: StaticTextNode,
  imageTextLlmNode: ImageTextLlmNode, 
  getClipboardTextNode: GetClipboardTextNode, 
  concatTextNode: ConcatTextNode,
};

console.log("Registered node types:", Object.keys(NODE_TYPES)); // Add this debug line

// Get a specific node by type
export const getNodeType = (type: string) => {
  return NODE_TYPES[type as keyof typeof NODE_TYPES];
};

// Get all nodes as a record for ReactFlow
export const getAllNodeTypes = () => {
  return NODE_TYPES;
};

// Register a new node type
export const registerNodeType = (type: string, component: React.ComponentType<any>) => {
  (NODE_TYPES as any)[type] = component;
};
