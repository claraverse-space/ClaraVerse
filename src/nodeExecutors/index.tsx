// Import all executors so they self-register
import './TextInputExecutor';
import './ImageInputExecutor';
import './LlmPromptExecutor';
import './TextOutputExecutor';
import './TextCombinerExecutor';
import './ConditionalExecutor';
import './ApiCallExecutor';
import './MarkdownOutputExecutor';
import './StaticTextExecutor';
import './ImageTextLlmExecutor'; // Add our new executor
import './GetClipboardTextExecutor'; // Add our new executor
import './ConcatTextExecutor'; // Add our new executor

// Export the registry API - only need this once
export * from './NodeExecutorRegistry';
