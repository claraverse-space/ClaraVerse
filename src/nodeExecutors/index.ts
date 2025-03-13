// Import all node executors here to ensure they're registered

import './TextInputExecutor';
import './TextOutputExecutor';
import './TextCombinerExecutor';
import './MarkdownOutputExecutor';
import './StaticTextExecutor';
import './ApiCallExecutor';
import './ConditionalExecutor';
import './ImageTextLlmExecutor';
import './GetClipboardTextExecutor';
import './ConcatTextExecutor';


// This file is imported by main.tsx to ensure all executors are registered
// before the application starts running
