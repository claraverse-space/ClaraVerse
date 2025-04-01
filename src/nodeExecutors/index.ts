// Import all node executors here to ensure they're registered

import './TextInputExecutor';
import './TextOutputExecutor';
import './MarkdownOutputExecutor';
import './StaticTextExecutor';
import './ApiCallExecutor';
import './ImageTextLlmExecutor';
import './GetClipboardTextExecutor';
import './ConcatTextExecutor';
import './WebcamInputExecutor';
import './BaseLlmExecutor';
import './ImageInputExecutor';
import './structuredLlmExecutor';
import './TextToImageExecutor';
import './ImageOutputExecutor';
import './TextImageToImageExecutor';
import './ImageResizeExecutor';
import './JsonToCsvExecutor';
import './RagExecutor';

// This file is imported by main.tsx to ensure all executors are registered
// before the application starts running
