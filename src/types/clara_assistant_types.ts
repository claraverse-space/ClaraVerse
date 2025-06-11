/**
 * Clara Assistant Type Definitions
 * 
 * This file contains all TypeScript interfaces and types used throughout
 * the Clara assistant chat system. It's designed to be completely isolated
 * and self-contained.
 */

// ================================
// CORE MESSAGE TYPES
// ================================

/**
 * Represents a single chat message in the Clara assistant
 */
export interface ClaraMessage {
  /** Unique identifier for the message */
  id: string;
  
  /** Role of the message sender */
  role: 'user' | 'assistant' | 'system';
  
  /** Text content of the message */
  content: string;
  
  /** Timestamp when the message was created */
  timestamp: Date;
  
  /** Optional file attachments */
  attachments?: ClaraFileAttachment[];
  
  /** Optional artifacts (code, charts, etc.) */
  artifacts?: ClaraArtifact[];
  
  /** Whether the message is currently being streamed */
  isStreaming?: boolean;
  
  /** MCP tool calls made in this message */
  mcpToolCalls?: ClaraMCPToolCall[];
  
  /** MCP tool results for this message */
  mcpToolResults?: ClaraMCPToolResult[];
  
  /** Additional metadata about the message */
  metadata?: ClaraMessageMetadata;
}

/**
 * Metadata associated with a message
 */
export interface ClaraMessageMetadata {
  /** AI model used to generate the response */
  model?: string;
  
  /** Number of tokens used (legacy) */
  tokens?: number;
  
  /** Detailed token usage information */
  usage?: {
    total_tokens?: number;
    completion_tokens?: number;
    prompt_tokens?: number;
  };
  
  /** Detailed timing information from the API */
  timings?: {
    prompt_n?: number;
    prompt_ms?: number;
    prompt_per_token_ms?: number;
    prompt_per_second?: number;
    predicted_n?: number;
    predicted_ms?: number;
    predicted_per_token_ms?: number;
    predicted_per_second?: number;
  };
  
  /** Time taken to process the message (in milliseconds) */
  processingTime?: number;
  
  /** Temperature setting used */
  temperature?: number;
  
  /** Tools that were used to process the message */
  toolsUsed?: string[];
  
  /** Any error that occurred during processing */
  error?: string;
  
  /** Confidence score for the analysis */
  confidence?: number;
  
  /** Whether the message is currently being streamed */
  isStreaming?: boolean;
  
  /** Additional metadata */
  [key: string]: any;
}

// ================================
// FILE ATTACHMENT TYPES
// ================================

/**
 * Supported file types for Clara assistant
 */
export type ClaraFileType = 'image' | 'pdf' | 'code' | 'document' | 'text' | 'csv' | 'json';

/**
 * File attachment in a Clara message
 */
export interface ClaraFileAttachment {
  /** Unique identifier for the file */
  id: string;
  
  /** Original filename */
  name: string;
  
  /** Detected file type */
  type: ClaraFileType;
  
  /** File size in bytes */
  size: number;
  
  /** MIME type of the file */
  mimeType: string;
  
  /** URL for accessing the file (if stored) */
  url?: string;
  
  /** Base64 encoded file content (for small files) */
  base64?: string;
  
  /** Whether the file has been processed by Clara */
  processed?: boolean;
  
  /** Processing status and results */
  processingResult?: ClaraFileProcessingResult;
  
  /** Preview thumbnail (for images) */
  thumbnail?: string;
}

/**
 * Result of file processing by Clara
 */
export interface ClaraFileProcessingResult {
  /** Whether processing was successful */
  success: boolean;
  
  /** Extracted text content (for PDFs, documents) */
  extractedText?: string;
  
  /** Image analysis results (for images) */
  imageAnalysis?: ClaraImageAnalysis;
  
  /** Code analysis results (for code files) */
  codeAnalysis?: ClaraCodeAnalysis;
  
  /** Any errors during processing */
  error?: string;
  
  /** Processing metadata */
  metadata?: Record<string, any>;
}

/**
 * Image analysis results from vision models
 */
export interface ClaraImageAnalysis {
  /** Description of the image */
  description: string;
  
  /** Detected objects in the image */
  objects?: string[];
  
  /** Detected text (OCR) */
  text?: string;
  
  /** Image dimensions */
  dimensions?: {
    width: number;
    height: number;
  };
  
  /** Confidence score for the analysis */
  confidence?: number;
}

/**
 * Code analysis results
 */
export interface ClaraCodeAnalysis {
  /** Detected programming language */
  language: string;
  
  /** Code structure analysis */
  structure?: {
    functions: string[];
    classes: string[];
    imports: string[];
  };
  
  /** Code quality metrics */
  metrics?: {
    lines: number;
    complexity: number;
  };
  
  /** Detected issues or suggestions */
  suggestions?: string[];
}

// ================================
// ARTIFACT TYPES
// ================================

/**
 * Supported artifact types
 */
export type ClaraArtifactType = 
  | 'code' 
  | 'chart' 
  | 'table' 
  | 'mermaid' 
  | 'html' 
  | 'markdown' 
  | 'csv'
  | 'json'
  | 'diagram'
  | 'report';

/**
 * An artifact generated by Clara (code, charts, etc.)
 */
export interface ClaraArtifact {
  /** Unique identifier for the artifact */
  id: string;
  
  /** Type of artifact */
  type: ClaraArtifactType;
  
  /** Human-readable title */
  title: string;
  
  /** The actual content/code of the artifact */
  content: string;
  
  /** Programming language (for code artifacts) */
  language?: string;
  
  /** Additional metadata specific to the artifact type */
  metadata?: Record<string, any>;
  
  /** Timestamp when artifact was created */
  createdAt?: Date;
  
  /** Whether the artifact can be executed/rendered */
  isExecutable?: boolean;
  
  /** Any dependencies required for the artifact */
  dependencies?: string[];
}

// ================================
// CHAT SESSION TYPES
// ================================

/**
 * A complete chat session with Clara
 */
export interface ClaraChatSession {
  /** Unique identifier for the session */
  id: string;
  
  /** Human-readable title for the session */
  title: string;
  
  /** All messages in the session */
  messages: ClaraMessage[];
  
  /** When the session was created */
  createdAt: Date;
  
  /** When the session was last updated */
  updatedAt: Date;
  
  /** Whether the session is starred */
  isStarred?: boolean;
  
  /** Whether the session is archived */
  isArchived?: boolean;
  
  /** Tags associated with the session */
  tags?: string[];
  
  /** Session configuration */
  config?: ClaraSessionConfig;
}

// ================================
// AI PROVIDER TYPES
// ================================

/**
 * Supported AI provider types for Clara
 */
export type ClaraProviderType = 'ollama' | 'openai' | 'openrouter' | 'claras-pocket' | 'custom';

/**
 * AI Provider configuration for Clara
 */
export interface ClaraProvider {
  /** Unique identifier for the provider */
  id: string;
  
  /** Display name for the provider */
  name: string;
  
  /** Type of provider */
  type: ClaraProviderType;
  
  /** Base URL for the API */
  baseUrl?: string;
  
  /** API key for authentication */
  apiKey?: string;
  
  /** Whether this provider is enabled */
  isEnabled: boolean;
  
  /** Whether this is the primary provider */
  isPrimary: boolean;
  
  /** Additional configuration options */
  config?: Record<string, any>;
}

/**
 * Available AI model information
 */
export interface ClaraModel {
  /** Model identifier */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Provider that serves this model */
  provider: string;
  
  /** Model type/category */
  type: 'text' | 'vision' | 'code' | 'embedding' | 'multimodal';
  
  /** Model size in bytes (if available) */
  size?: number;
  
  /** Whether the model supports vision/image input */
  supportsVision?: boolean;
  
  /** Whether the model supports code generation */
  supportsCode?: boolean;
  
  /** Whether the model supports tool calling */
  supportsTools?: boolean;
  
  /** Context window size */
  contextWindow?: number;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Clara AI Configuration
 */
export interface ClaraAIConfig {
  /** AI provider ID */
  provider: string;
  
  /** Custom system prompt for this provider */
  systemPrompt?: string;
  
  /** Model configurations for different tasks */
  models: {
    text: string;
    vision?: string;
    code?: string;
  };
  
  /** Model parameters */
  parameters: {
    temperature: number;
    maxTokens: number;
    topP: number;
    topK: number;
  };
  
  /** Feature flags */
  features: {
    enableTools: boolean;
    enableRAG: boolean;
    enableStreaming: boolean;
    enableVision: boolean;
    autoModelSelection: boolean;
    enableMCP: boolean;
  };

  /** Artifact generation configuration */
  artifacts?: {
    enableCodeArtifacts: boolean;
    enableChartArtifacts: boolean;
    enableTableArtifacts: boolean;
    enableMermaidArtifacts: boolean;
    enableHtmlArtifacts: boolean;
    enableMarkdownArtifacts: boolean;
    enableJsonArtifacts: boolean;
    enableDiagramArtifacts: boolean;
    autoDetectArtifacts: boolean;
    maxArtifactsPerMessage: number;
  };
  
  /** MCP configuration */
  mcp?: {
    enableTools: boolean;
    enableResources: boolean;
    enabledServers: string[];
    autoDiscoverTools: boolean;
    maxToolCalls: number;
  };
    
  /** Autonomous agent configuration */
  autonomousAgent?: {
    enabled: boolean;
    maxRetries: number;
    retryDelay: number;
    enableSelfCorrection: boolean;
    enableToolGuidance: boolean;
    enableProgressTracking: boolean;
    maxToolCalls: number;
    confidenceThreshold: number;
    enableChainOfThought: boolean;
    enableErrorLearning: boolean;
  };
  
  /** Context window size */
  contextWindow?: number;
}

/**
 * Configuration for a Clara chat session
 */
export interface ClaraSessionConfig {
  /** AI configuration */
  aiConfig: ClaraAIConfig;
  
  /** Legacy: AI model preferences */
  modelPreferences?: {
    textModel?: string;
    visionModel?: string;
    codeModel?: string;
  };
  
  /** Legacy: Temperature setting for responses */
  temperature?: number;
  
  /** Legacy: Maximum tokens for responses */
  maxTokens?: number;
  
  /** Legacy: Whether to enable tool calling */
  enableTools?: boolean;
  
  /** Legacy: Whether to enable RAG (knowledge base) */
  enableRAG?: boolean;
  
  /** Custom system prompt */
  systemPrompt?: string;
  
  /** Number of messages to include in conversation history */
  contextWindow?: number;
}

// ================================
// COMPONENT PROPS TYPES
// ================================

/**
 * Props for the main Clara chat window
 */
export interface ClaraChatWindowProps {
  /** Array of messages to display */
  messages: ClaraMessage[];
  
  /** Current user's name */
  userName?: string;
  
  /** Whether Clara is currently processing */
  isLoading?: boolean;
  
  /** Whether Clara is initializing (loading sessions, providers, etc.) */
  isInitializing?: boolean;
  
  /** Callback when user wants to retry a message */
  onRetryMessage?: (messageId: string) => void;
  
  /** Callback when user wants to copy a message */
  onCopyMessage?: (content: string) => void;
  
  /** Callback when user wants to edit a message */
  onEditMessage?: (messageId: string, newContent: string) => void;
}

/**
 * Props for individual message bubbles
 */
export interface ClaraMessageBubbleProps {
  /** The message to display */
  message: ClaraMessage;
  
  /** Current user's name */
  userName?: string;
  
  /** Whether this message can be edited */
  isEditable?: boolean;
  
  /** Callback when message is copied */
  onCopy?: (content: string) => void;
  
  /** Callback when message is retried */
  onRetry?: (messageId: string) => void;
  
  /** Callback when message is edited */
  onEdit?: (messageId: string, newContent: string) => void;
}

/**
 * Props for artifact renderer component
 */
export interface ClaraArtifactRendererProps {
  /** The artifact to render */
  artifact: ClaraArtifact;
  
  /** Whether the artifact is currently expanded */
  isExpanded?: boolean;
  
  /** Callback when expansion state changes */
  onToggleExpanded?: (artifactId: string) => void;
  
  /** Callback when artifact content is copied */
  onCopy?: (content: string) => void;
  
  /** Callback when artifact is downloaded */
  onDownload?: (artifact: ClaraArtifact) => void;
}

/**
 * Props for the Clara input component
 */
export interface ClaraInputProps {
  /** Callback when user sends a message */
  onSendMessage: (content: string, attachments?: ClaraFileAttachment[]) => void;
  
  /** Whether Clara is currently processing */
  isLoading?: boolean;
  
  /** Callback to stop current generation */
  onStop?: () => void;
  
  /** Callback to create a new chat session */
  onNewChat?: () => void;
  
  /** Whether to show advanced options */
  showAdvancedOptions?: boolean;
  
  /** Current session configuration */
  sessionConfig?: ClaraSessionConfig;
  
  /** Callback when session config changes */
  onConfigChange?: (config: Partial<ClaraSessionConfig>) => void;
  
  /** Available providers */
  providers?: ClaraProvider[];
  
  /** Available models */
  models?: ClaraModel[];
  
  /** Callback when provider changes */
  onProviderChange?: (providerId: string) => void;
  
  /** Callback when model changes */
  onModelChange?: (modelId: string, type: 'text' | 'vision' | 'code') => void;

  /** Current messages in the conversation (for voice mode) */
  messages?: ClaraMessage[];
  
  /** Callback to set messages (for voice mode) */
  setMessages?: React.Dispatch<React.SetStateAction<ClaraMessage[]>>;
  
  /** Current chat session (for voice mode) */
  currentSession?: ClaraChatSession | null;
  
  /** Callback to set sessions (for voice mode) */
  setSessions?: React.Dispatch<React.SetStateAction<ClaraChatSession[]>>;
  
  /** Latest AI response text for auto TTS */
  autoTTSText?: string;
  
  /** Auto TTS trigger with timestamp to ensure re-triggering */
  autoTTSTrigger?: {text: string, timestamp: number} | null;
  
  /** Callback for model preloading when user starts typing */
  onPreloadModel?: () => void;
  
  /** Whether to show advanced options panel */
  showAdvancedOptionsPanel?: boolean;
  
  /** Callback when advanced options visibility changes */
  onAdvancedOptionsToggle?: (show: boolean) => void;
}

// ================================
// UTILITY TYPES
// ================================

/**
 * Theme support for Clara components
 */
export type ClaraTheme = 'light' | 'dark' | 'system';

/**
 * Processing states for various operations
 */
export type ClaraProcessingState = 'idle' | 'processing' | 'success' | 'error';

/**
 * File upload state
 */
export interface ClaraFileUploadState {
  /** Files currently being uploaded */
  uploading: ClaraFileAttachment[];
  
  /** Successfully uploaded files */
  uploaded: ClaraFileAttachment[];
  
  /** Files that failed to upload */
  failed: Array<ClaraFileAttachment & { error: string }>;
}

/**
 * Clara's response generation options
 */
export interface ClaraResponseOptions {
  /** Include artifacts in response */
  includeArtifacts?: boolean;
  
  /** Include file analysis */
  includeFileAnalysis?: boolean;
  
  /** Use streaming response */
  useStreaming?: boolean;
  
  /** Maximum response length */
  maxLength?: number;
  
  /** Response format preference */
  format?: 'text' | 'markdown' | 'structured';
}

// ================================
// ERROR TYPES
// ================================

/**
 * Clara-specific error types
 */
export interface ClaraError {
  /** Error code */
  code: string;
  
  /** Human-readable error message */
  message: string;
  
  /** Additional error details */
  details?: Record<string, any>;
  
  /** Timestamp when error occurred */
  timestamp: Date;
  
  /** Whether the error is recoverable */
  isRecoverable?: boolean;
}

/**
 * File processing error details
 */
export interface ClaraFileProcessingError extends ClaraError {
  /** File that caused the error */
  fileId: string;
  
  /** Processing stage where error occurred */
  stage: 'upload' | 'validation' | 'processing' | 'analysis';
}

// ================================
// TOOL SYSTEM TYPES (for future implementation)
// ================================

/**
 * Tool definition for Clara's tool system
 */
export interface ClaraTool {
  /** Unique identifier */
  id: string;
  
  /** Tool name */
  name: string;
  
  /** Tool description */
  description: string;
  
  /** Tool category */
  category: 'math' | 'time' | 'web' | 'file' | 'system' | 'custom';
  
  /** Tool parameters schema */
  parameters: {
    type: 'object';
    properties: Record<string, {
      type: string;
      description: string;
      required?: boolean;
      default?: any;
    }>;
    required?: string[];
  };
  
  /** Tool implementation function */
  implementation: (params: any) => Promise<any>;
  
  /** Whether the tool is enabled */
  isEnabled: boolean;
  
  /** Tool version */
  version: string;
  
  /** Tool author/source */
  author?: string;
  
  /** Tool configuration */
  config?: Record<string, any>;
}

/**
 * Tool execution result
 */
export interface ClaraToolResult {
  /** Tool that was executed */
  toolId: string;
  
  /** Execution success status */
  success: boolean;
  
  /** Result data */
  result: any;
  
  /** Error message if failed */
  error?: string;
  
  /** Execution time in milliseconds */
  executionTime: number;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
}

// ================================
// MCP (Model Context Protocol) TYPES
// ================================

/**
 * MCP Server configuration
 */
export interface ClaraMCPServerConfig {
  name: string;
  type: 'stdio' | 'remote';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
  description?: string;
  enabled?: boolean;
}

/**
 * MCP Server status information
 */
export interface ClaraMCPServer {
  name: string;
  config: ClaraMCPServerConfig;
  isRunning: boolean;
  status: 'starting' | 'running' | 'error' | 'stopped';
  startedAt?: Date;
  error?: string;
  pid?: number;
}

/**
 * MCP Tool definition
 */
export interface ClaraMCPTool {
  /** Tool name */
  name: string;
  
  /** Tool description */
  description: string;
  
  /** Input schema for the tool */
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  
  /** Server that provides this tool */
  server: string;
}

/**
 * MCP Resource definition
 */
export interface ClaraMCPResource {
  /** Resource URI */
  uri: string;
  
  /** Resource name */
  name: string;
  
  /** Resource description */
  description?: string;
  
  /** Resource MIME type */
  mimeType?: string;
  
  /** Server that provides this resource */
  server: string;
}

/**
 * MCP Tool call request
 */
export interface ClaraMCPToolCall {
  /** Tool name to call */
  name: string;
  
  /** Arguments to pass to the tool */
  arguments: Record<string, any>;
  
  /** Server to call the tool on */
  server: string;
  
  /** Unique call ID */
  callId: string;
}

/**
 * MCP Tool call result
 */
export interface ClaraMCPToolResult {
  /** Call ID that this result corresponds to */
  callId: string;
  
  /** Whether the call was successful */
  success: boolean;
  
  /** Result content */
  content?: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  
  /** Error message if failed */
  error?: string;
  
  /** Execution metadata */
  metadata?: Record<string, any>;
}

/**
 * MCP (Model Context Protocol) configuration
 */
export interface ClaraMCPConfig {
  /** Enable MCP tools */
  enableTools: boolean;
  
  /** Enable MCP resources */
  enableResources: boolean;
  
  /** List of enabled MCP server names */
  enabledServers: string[];
  
  /** Auto-discover tools from running servers */
  autoDiscoverTools: boolean;
  
  /** Maximum number of tool calls per conversation turn */
  maxToolCalls: number;
}

/**
 * Autonomous agent configuration
 */
export interface ClaraAutonomousAgentConfig {
  /** Enable autonomous agent mode */
  enabled: boolean;
  
  /** Maximum number of retries per tool call */
  maxRetries: number;
  
  /** Delay between retries in milliseconds */
  retryDelay: number;
  
  /** Enable self-correction capabilities */
  enableSelfCorrection: boolean;
  
  /** Enable tool usage guidance in prompts */
  enableToolGuidance: boolean;
  
  /** Enable progress tracking and reporting */
  enableProgressTracking: boolean;
  
  /** Maximum number of tool calls per session */
  maxToolCalls: number;
  
  /** Confidence threshold for autonomous decisions */
  confidenceThreshold: number;
  
  /** Enable chain-of-thought reasoning */
  enableChainOfThought: boolean;
  
  /** Enable error analysis and learning */
  enableErrorLearning: boolean;
}

// ================================
// EXPORTS
// ================================

// All types and interfaces are exported individually above
// This file serves as the central type definition hub for Clara Assistant 