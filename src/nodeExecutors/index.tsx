// Import all executors so they self-register
import './TextInputExecutor';
import './ImageInputExecutor';
import './LlmPromptExecutor';
import './ImageLlmPromptExecutor';
import './ImageUploadLlmExecutor';
import './TextOutputExecutor';
import './TextCombinerExecutor';
import './ConditionalExecutor';
import './ApiCallExecutor';
import './MarkdownOutputExecutor';
import './StaticTextExecutor';
import './ImageDescriptionOutputExecutor';

// Export the registry API - only need this once
export * from './NodeExecutorRegistry';
