import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Loader2, Bot, Trash2, Settings, ChevronDown, Wand2, Scissors, Copy, CheckCircle, AlertCircle, Zap, Brain, Target, Sparkles } from 'lucide-react';
import { LiteProjectFile } from '../LumaUILite';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import LumaUILiteAPIClient, { ChatMessage as LiteChatMessage, ChatMessage } from './services/LumaUILiteAPIClient';
import LumaUILiteTools, { createLumaUILiteTools } from './services/LumaUILiteTools';
import AISettingsModal from './AISettingsModal';
import { useProviders } from '../../contexts/ProvidersContext';
import { Provider } from '../../db';

// Message types for our chat interface
interface Message {
  id: string;
  type: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: Date;
  files?: string[];
  tool_calls?: any[];
  tool_call_id?: string;
}

// Tool execution tracking
interface ToolExecution {
  id: string;
  functionName: string;
  parameters: Record<string, any>;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: string;
  error?: string;
  startTime: Date;
  endTime?: Date;
}

// AI Parameters interface
interface AIParameters {
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  maxIterations: number;
}

// Default AI parameters
const defaultParameters: AIParameters = {
  temperature: 0.7,
  maxTokens: 16000,
  topP: 0.9,
  frequencyPenalty: 0,
  presencePenalty: 0,
  maxIterations: 10
};

// Chat window props
interface LumaUILiteChatWindowProps {
  projectFiles: LiteProjectFile[];
  onUpdateFile: (fileId: string, content: string) => void;
  onCreateFile: (file: Omit<LiteProjectFile, 'id' | 'lastModified'>) => void;
  onDeleteFile: (fileId: string) => void;
  selectedFile?: string | null;
  onFileSelect: (path: string, content: string) => void;
  projectId: string;
  projectName: string;
}

// Tool definitions for LumaUI-lite - comprehensive toolkit inspired by lumaTools.ts
const LITE_TOOLS = [
  // Core File Operations
  {
    id: "create_file",
    name: "create_file",
    description: "Create a completely new file with the specified content. Use this only for files that don't exist yet.",
    parameters: [
      { name: "path", type: "string", description: "The file path to create (e.g., 'src/components/NewComponent.tsx')", required: true },
      { name: "content", type: "string", description: "The complete content to write to the new file", required: false }
    ]
  },
  {
    id: "read_file", 
    name: "read_file",
    description: "Read the complete contents of an existing file. Always use this BEFORE editing any file to understand the current structure and content.",
    parameters: [
      { name: "path", type: "string", description: "The file path to read (e.g., 'src/components/Header.tsx')", required: true }
    ]
  },
  {
    id: "edit_file",
    name: "edit_file", 
    description: "FULL FILE REPLACEMENT: Update an entire file with new content. Use for major restructuring or complete rewrites.",
    parameters: [
      { name: "path", type: "string", description: "The file path to edit", required: true },
      { name: "content", type: "string", description: "The COMPLETE file content - this replaces the entire file", required: true }
    ]
  },
  {
    id: "edit_file_section",
    name: "edit_file_section",
    description: "PRECISE EDITING: Replace a specific section of text in a file. Use exact text matching - the old_text must match EXACTLY.",
    parameters: [
      { name: "path", type: "string", description: "The file path to edit", required: true },
      { name: "old_text", type: "string", description: "The exact text to replace (must match exactly including whitespace)", required: true },
      { name: "new_text", type: "string", description: "The new text to replace the old text with", required: true }
    ]
  },
  {
    id: "delete_file",
    name: "delete_file",
    description: "Delete an existing file from the project.",
    parameters: [
      { name: "path", type: "string", description: "The file path to delete", required: true }
    ]
  },
  // Directory Operations
  {
    id: "create_directory",
    name: "create_directory",
    description: "Create a new directory in the project structure.",
    parameters: [
      { name: "path", type: "string", description: "The directory path to create (e.g., 'src/components')", required: true }
    ]
  },
  {
    id: "list_directory", 
    name: "list_directory",
    description: "List all files and directories in a specific directory. Use '.' for root directory.",
    parameters: [
      { name: "path", type: "string", description: "The directory path to list (default: '.')", required: false }
    ]
  },
  // File Management
  {
    id: "list_files",
    name: "list_files",
    description: "List all files and directories in the project to understand the project structure. Alias for list_directory with root path.",
    parameters: []
  },
  {
    id: "get_all_files",
    name: "get_all_files", 
    description: "Get a comprehensive list of all files in the project with detailed information.",
    parameters: []
  },
  // Project Information
  {
    id: "get_project_info",
    name: "get_project_info",
    description: "Get detailed information about the project including package.json data, file counts, and project structure.",
    parameters: []
  },
  {
    id: "get_file_structure",
    name: "get_file_structure",
    description: "Get a detailed overview of the project's file structure and organization.",
    parameters: []
  },
  {
    id: "search_files",
    name: "search_files", 
    description: "Search for files by name, path, or content. Useful for finding specific files or code patterns.",
    parameters: [
      { name: "pattern", type: "string", description: "The search pattern to look for in file names, paths, or content", required: true }
    ]
  },
  // Development Operations (Simulated for LumaUI-lite)
  {
    id: "run_command",
    name: "run_command",
    description: "Simulate running a command. Note: LumaUI-lite runs in browser, so commands are simulated for learning purposes.",
    parameters: [
      { name: "command", type: "string", description: "The command to simulate (e.g., 'npm')", required: true },
      { name: "args", type: "array", description: "Command arguments (e.g., ['install', 'lodash'])", required: false }
    ]
  },
  {
    id: "install_package",
    name: "install_package",
    description: "Simulate installing an npm package. This will show what would happen in a real environment.", 
    parameters: [
      { name: "package", type: "string", description: "The package name to install", required: true },
      { name: "dev", type: "boolean", description: "Install as dev dependency", required: false }
    ]
  },
  // Unix-style aliases for familiarity
  {
    id: "ls",
    name: "ls",
    description: "Unix-style command to list directory contents. Same as list_directory.",
    parameters: [
      { name: "path", type: "string", description: "The directory path to list (default: '.')", required: false }
    ]
  },
  {
    id: "cat",
    name: "cat", 
    description: "Unix-style command to read file contents. Same as read_file.",
    parameters: [
      { name: "path", type: "string", description: "The file path to read", required: true }
    ]
  },
  // Template Generation
  {
    id: "create_landing_page",
    name: "create_landing_page",
    description: "Create a beautiful, responsive landing page template with secure Tailwind CSS implementation. Perfect for demonstrating the fixed COEP/security issues.",
    parameters: []
  },
  {
    id: "mkdir",
    name: "mkdir",
    description: "Unix-style command to create directories. Same as create_directory.",
    parameters: [
      { name: "path", type: "string", description: "The directory path to create", required: true }
    ]
  },
  {
    id: "touch",
    name: "touch",
    description: "Unix-style command to create empty files. Same as create_file with no content.",
    parameters: [
      { name: "path", type: "string", description: "The file path to create", required: true }
    ]
  }
];

// Convert tools to OpenAI format
const convertToOpenAITools = (tools: any[]) => {
  return tools.map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: tool.parameters.reduce((acc: any, param: any) => {
          const property: any = {
            type: param.type,
            description: param.description
          };
          
          // Add items property for array types (required by OpenAI JSON Schema)
          if (param.type === "array") {
            property.items = {
              type: "string" // Default to string items, can be customized per tool if needed
            };
          }
          
          acc[param.name] = property;
          return acc;
        }, {}),
        required: tool.parameters.filter((p: any) => p.required).map((p: any) => p.name)
      }
    }
  }));
};

const OPENAI_TOOLS = convertToOpenAITools(LITE_TOOLS);

// Convert Provider from main settings to LumaUI-lite format
interface LiteProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  models: string[];
}

// Settings persistence
const STORAGE_KEY_LITE = 'lumaui-lite-chat-settings';

interface ChatSettings {
  providerId: string;
  model: string;
  parameters: AIParameters;
}

const saveChatSettings = (settings: ChatSettings) => {
  localStorage.setItem(STORAGE_KEY_LITE, JSON.stringify(settings));
};

const loadChatSettings = (): ChatSettings | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_LITE);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

// System prompt for LumaUI-lite
const SYSTEM_PROMPT = `You are an expert web developer working with LumaUI-lite, a simple single-page application builder.

**PROJECT CONTEXT:**
- Project: {{PROJECT_NAME}}
- Current files: {{FILE_LIST}}
- Selected file: {{SELECTED_FILE}}

**AVAILABLE TOOLS:**
You have access to file operation tools to help users build their applications:
- create_file: Create new files with specified content
- edit_file: Replace entire file content (use for major changes)
- read_file: Read current file content before making changes
- list_files: Get overview of project structure
- delete_file: Remove files that are no longer needed

**YOUR ROLE:**
1. Help users build and modify their single-page applications
2. Read existing files before making changes to understand the current structure
3. Create clean, modern, responsive code using HTML, CSS, and JavaScript
4. Follow best practices for web development
5. Always explain what you're doing and why

**CODE QUALITY:**
- Write semantic HTML with proper structure
- Use modern CSS with flexbox/grid for layouts
- Include responsive design considerations
- Write clean, commented JavaScript
- Ensure accessibility best practices

**WORKFLOW:**
1. Always read files before editing to understand current structure
2. Make one change at a time and explain what you're doing
3. Test your understanding by reading files when needed
4. Ask clarifying questions if requirements are unclear

Be helpful, professional, and focus on creating high-quality web applications!`;

interface AIReflection {
  id: string;
  step: number;
  toolResults: string[];
  currentSituation: string;
  nextSteps: string[];
  reasoning: string;
  confidence: number; // 0-100
  shouldContinue: boolean;
  timestamp: Date;
}

interface PlanningExecution {
  id: string;
  status: 'planning' | 'executing' | 'reflecting' | 'completed';
  currentStep: number;
  totalSteps: number;
  reflections: AIReflection[];
  startTime: Date;
  endTime?: Date;
}

const LumaUILiteChatWindow: React.FC<LumaUILiteChatWindowProps> = ({
  projectFiles,
  onUpdateFile,
  onCreateFile,
  onDeleteFile,
  selectedFile,
  onFileSelect,
  projectId,
  projectName
}) => {
  // Get providers from context
  const { providers, loading: providersLoading } = useProviders();
  // Default welcome message
  const defaultMessages: Message[] = [
    {
      id: '1',
      type: 'assistant',
      content: '🚀 **Welcome to LumaUI-lite AI Assistant!**\n\nI can help you build and modify your single-page application. Here\'s what I can do:\n\n✨ **Create new files** (HTML, CSS, JS)\n🔧 **Edit existing files** with improvements\n📖 **Read and analyze** your current code\n🗂️ **Manage project structure**\n\n**Example requests:**\n- "Create a navigation menu in my HTML"\n- "Add responsive CSS for mobile devices"\n- "Build a contact form with validation"\n- "Improve the styling of my homepage"\n\nJust tell me what you want to build or improve!',
      timestamp: new Date()
    }
  ];

  // State management
  const [messages, setMessages] = useState<Message[]>(defaultMessages);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [currentTask, setCurrentTask] = useState('');
  const [currentToolExecution, setCurrentToolExecution] = useState<ToolExecution | null>(null);

  // Provider and model state
  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [parameters, setParameters] = useState<AIParameters>(defaultParameters);
  const [apiClient, setApiClient] = useState<LumaUILiteAPIClient | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Auto mode state
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [showPlanning, setShowPlanning] = useState(false);
  const [currentPlanning, setCurrentPlanning] = useState<PlanningExecution | null>(null);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Initialize tools with all required callbacks
  const liteTools = useMemo(() => createLumaUILiteTools({
    projectFiles,
    onUpdateFile: (fileId: string, content: string) => {
      onUpdateFile(fileId, content);
      // Trigger immediate save notification
      console.log('🔄 File updated, auto-save will trigger...');
    },
    onCreateFile: (file: Omit<LiteProjectFile, 'id' | 'lastModified'>) => {
      onCreateFile(file);
      // Trigger immediate save notification
      console.log('🔄 File created, auto-save will trigger...');
    },
    onDeleteFile,
    onFileSelect,
    onTerminalWrite: (message: string) => {
      console.log('[Terminal]', message);
    },
    projectName: projectName || 'Untitled'
  }), [projectFiles, onUpdateFile, onCreateFile, onDeleteFile, onFileSelect, projectName]);

  // Initialize with first available provider when providers load
  useEffect(() => {
    if (providers.length > 0 && !selectedProviderId) {
      const enabledProvider = providers.find(p => p.isEnabled) || providers[0];
      setSelectedProviderId(enabledProvider.id);
      
      const savedSettings = loadChatSettings();
      if (savedSettings) {
        setSelectedProviderId(savedSettings.providerId);
        setSelectedModel(savedSettings.model);
        setParameters(savedSettings.parameters);
      }
    }
  }, [providers, selectedProviderId]);

  // Fetch models when provider changes
  useEffect(() => {
    const fetchModels = async () => {
      const provider = providers.find(p => p.id === selectedProviderId);
      if (provider && provider.baseUrl) {
        try {
          const client = new LumaUILiteAPIClient(provider.baseUrl, {
            apiKey: provider.apiKey || '',
            providerId: provider.id
          });
          const models = await client.listModels();
          const modelNames = models.map(m => m.name || m.id);
          setAvailableModels(modelNames);
          
          // Auto-select first model if none selected
          if (modelNames.length > 0 && !selectedModel) {
            setSelectedModel(modelNames[0]);
          }
        } catch (error) {
          console.error('Error fetching models:', error);
          setAvailableModels([]);
        }
      }
    };

    if (selectedProviderId && providers.length > 0) {
      fetchModels();
    }
  }, [selectedProviderId, providers, selectedModel]);

  // Initialize API client when provider changes
  useEffect(() => {
    const provider = providers.find(p => p.id === selectedProviderId);
    if (provider && provider.baseUrl) {
      const client = new LumaUILiteAPIClient(provider.baseUrl, {
        apiKey: provider.apiKey || '',
        providerId: provider.id
      });
      setApiClient(client);
    }
  }, [selectedProviderId, providers]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Get current provider
  const currentProvider = providers.find(p => p.id === selectedProviderId);

  // Format file list for context
  const filesList = projectFiles.map(f => `${f.path} (${f.type})`).join('\n  ');
  const selectedFileContext = selectedFile 
    ? `Currently selected: ${selectedFile}` 
    : 'No file currently selected';

  // Handle settings changes
  const handleProviderChange = (providerId: string) => {
    setSelectedProviderId(providerId);
    setSelectedModel(''); // Reset model when provider changes
    saveSettings();
  };

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    saveSettings();
  };

  const handleParametersChange = (newParams: AIParameters) => {
    setParameters(newParams);
    saveSettings();
  };

  const saveSettings = () => {
    const settings: ChatSettings = {
      providerId: selectedProviderId,
      model: selectedModel,
      parameters
    };
    saveChatSettings(settings);
  };

  // Execute tools with retry logic like main LumaUI
  const executeTools = async (toolCalls: any[], retryCount: number = 0): Promise<any[]> => {
    if (!liteTools) return [];
    
    const results = [];
    const maxRetries = 2;
    
    for (const toolCall of toolCalls) {
      const { function: func } = toolCall;
      const functionName = func.name;
      let parameters;
      let lastError: string = '';
      let success = false;
      
      try {
        parameters = typeof func.arguments === 'string' 
          ? JSON.parse(func.arguments) 
          : func.arguments;
      } catch (error) {
        results.push({
          id: toolCall.id,
          result: `❌ Failed to parse tool arguments: ${error}`,
          success: false
        });
        continue;
      }

      // Retry logic for each tool
      for (let attempt = 0; attempt <= maxRetries && !success; attempt++) {
        try {
      // Create tool execution tracking
      const execution: ToolExecution = {
        id: toolCall.id,
        functionName,
        parameters,
            status: attempt === 0 ? 'executing' : 'pending',
        startTime: new Date()
      };
      
      setCurrentToolExecution(execution);

          // Brief delay to show starting state (shorter on retries)
          await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 300 : 150));

          // Update to executing state
          execution.status = 'executing';
          setCurrentToolExecution({...execution});

        let result;
        
        // Use tool registry for comprehensive tool support
        if (liteTools[functionName]) {
          result = await liteTools[functionName](parameters);
        } else {
          result = { success: false, message: `Unknown tool: ${functionName}`, error: 'TOOL_NOT_FOUND' };
            break; // Don't retry missing tool errors
        }

          if (result.success) {
            const filePath = result.data?.path || parameters.path || 'completed';
            execution.status = 'completed';
        execution.endTime = new Date();
            execution.result = `✅ ${functionName}: ${filePath}${attempt > 0 ? ` (succeeded on attempt ${attempt + 1})` : ''}`;
            
            success = true;

            // Format result for chat with enhanced content like main LumaUI
            let toolResultContent = execution.result;
        
        // Add detailed content for specific tools
        if (functionName === 'read_file' && result.data?.content) {
              toolResultContent = `✅ ${functionName}: ${filePath}\n\nFile content:\n\`\`\`\n${result.data.content}\n\`\`\``;
            } else if (functionName === 'list_files' && result.data) {
              toolResultContent = `✅ ${functionName}: ${filePath}\n\nFiles:\n${JSON.stringify(result.data, null, 2)}`;
            } else if (functionName === 'get_all_files' && result.data) {
              toolResultContent = `✅ ${functionName}: completed\n\nProject structure:\n${JSON.stringify(result.data, null, 2)}`;
        } else if (functionName === 'get_project_info' && result.data) {
              toolResultContent = `✅ ${functionName}: completed\n\nProject info:\n${JSON.stringify(result.data, null, 2)}`;
        }

        results.push({
          id: toolCall.id,
          result: toolResultContent,
              success: true
            });
            
            // Update file selection if a file was created/edited
            if (result.data?.path && (functionName === 'create_file' || functionName === 'edit_file' || functionName === 'edit_file_section')) {
              if (onFileSelect && result.data?.content) {
                onFileSelect(result.data.path, result.data.content);
              } else if (onFileSelect && parameters.content) {
                onFileSelect(result.data.path, parameters.content);
              }
            }
            
            setCurrentToolExecution({...execution});
            await new Promise(resolve => setTimeout(resolve, 500));
            
          } else {
            lastError = result.message || result.error || 'Unknown error';
            
            if (attempt === maxRetries) {
              // Final attempt failed
        execution.status = 'failed';
        execution.endTime = new Date();
              execution.error = lastError;
              execution.result = `❌ ${functionName}: ${lastError} (failed after ${maxRetries + 1} attempts)`;
              
              // Include detailed error information for debugging
              let errorResultContent = execution.result;
              if (result.data || result.message) {
                errorResultContent += `\n\nError details: ${JSON.stringify({ data: result.data, message: result.message }, null, 2)}`;
              }

        results.push({
          id: toolCall.id,
                result: errorResultContent,
          success: false
        });

              setCurrentToolExecution({...execution});
              await new Promise(resolve => setTimeout(resolve, 1500));
            } else {
              // Brief delay before retry
              await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
            }
          }

        } catch (error) {
          lastError = error instanceof Error ? error.message : String(error);
          
          if (attempt === maxRetries) {
            const execution: ToolExecution = {
              id: toolCall.id,
              functionName: functionName,
              parameters: {},
              status: 'failed',
              startTime: new Date(),
              endTime: new Date(),
              error: lastError
            };

            setCurrentToolExecution(execution);
            
            results.push({
              id: toolCall.id,
              result: `❌ ${functionName}: ${lastError} (failed after ${maxRetries + 1} attempts)`,
              success: false
            });

            await new Promise(resolve => setTimeout(resolve, 1500));
          } else {
            // Brief delay before retry
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
          }
        }
      }
    }

    // Hide tool execution when all tools are done
    setCurrentToolExecution(null);
    return results;
  };

  // Enhanced system prompt for auto mode planning - matches main LumaUI
  const INITIAL_PLANNING_SYSTEM_PROMPT = `You are Clara's strategic planning module. Before executing any tools, you must analyze the project structure and create a comprehensive execution plan.

Your response must be a JSON object with this exact structure:
{
  "projectAnalysis": "Analysis of current project structure, files, and architecture",
  "userRequestBreakdown": "Breakdown of what the user is asking for",
  "executionPlan": [
    {
      "step": 1,
      "action": "read_file",
      "target": "src/App.tsx",
      "purpose": "Understand current app structure before adding new component"
    },
    {
      "step": 2,
      "action": "create_file", 
      "target": "src/components/LoginForm.tsx",
      "purpose": "Create the main login component with form structure"
    }
  ],
  "estimatedSteps": 5,
  "dependencies": ["react-hook-form", "zod"],
  "potentialChallenges": ["Existing routing might need updates", "Styling consistency"],
  "confidence": 90
}

INITIAL PLANNING RULES:
1. Analyze the complete project structure first
2. Break down the user's request into logical steps
3. Plan the EXACT sequence of tool calls needed
4. Identify dependencies that need to be installed
5. Consider existing code patterns and architecture
6. Plan for potential challenges and how to handle them
7. Be specific about file paths and tool actions
8. Estimate total number of steps realistically

TOOL ACTIONS AVAILABLE:
- read_file: Read existing files to understand current code
- create_file: Create new files with complete content
- edit_file_section: Make targeted edits to existing files
- install_package: Install npm dependencies
- run_command: Execute shell commands
- list_files: Explore directory structure

PLANNING STRATEGY:
1. Always read existing files BEFORE making changes
2. Install dependencies BEFORE using them in code
3. Create files in logical order (utilities first, then components)
4. Plan for integration with existing code patterns
5. Consider responsive design and accessibility from the start

Be thorough and strategic in your planning.`;

  const REFLECTION_PLANNING_SYSTEM_PROMPT = `You are an AI execution analyst reviewing tool execution results and planning next steps.

**ROLE**: Execution Reflection Assistant
**TASK**: Analyze tool results and determine next steps

**CONTEXT**:
- Current Step: {{STEP}}
- Original Request: {{ORIGINAL_REQUEST}}
- Tool Results: {{TOOL_RESULTS}}

**ANALYSIS REQUIREMENTS**:
1. **Result Analysis**: What was accomplished
2. **Progress Assessment**: How close to completion
3. **Next Steps**: What should happen next
4. **Continuation Decision**: Should continue or stop

**RESPONSE FORMAT** (JSON):
{
  "currentSituation": "Brief summary of current state",
  "toolResults": ["what each tool accomplished"],
  "nextSteps": ["specific next actions needed"],
  "reasoning": "Why these next steps are needed",
  "confidence": 85,
  "shouldContinue": true,
  "progressPercentage": 60
}

Be precise and decisive. Focus on practical next steps.`;

  // Auto mode planning and execution functions
  const performInitialPlanning = async (
    userQuery: string,
    projectTree: string,
    filesList: string
  ): Promise<any | null> => {
    if (!apiClient || !selectedModel) return null;

    try {
      setCurrentTask('🧠 Analyzing project and creating execution plan...');
      
      const planningPrompt = `${INITIAL_PLANNING_SYSTEM_PROMPT}

**PROJECT STRUCTURE**:
${projectTree}

**FILE LIST**:
${filesList}

**USER REQUEST**:
${userQuery}

Create a strategic execution plan for this request.`;

      const response = await apiClient.sendChat(
        selectedModel,
        [
          { role: 'system', content: planningPrompt },
          { role: 'user', content: userQuery }
        ],
        {
          temperature: parameters.temperature,
          max_tokens: parameters.maxTokens,
          top_p: parameters.topP,
          frequency_penalty: parameters.frequencyPenalty,
          presence_penalty: parameters.presencePenalty
        }
      );

      if (!response.message?.content) {
        return null;
      }

      // Try to parse JSON response
      let planningData;
      try {
        const jsonMatch = response.message.content.match(/```json\n([\s\S]*?)\n```/) || response.message.content.match(/\{[\s\S]*\}/);
        planningData = JSON.parse(jsonMatch ? jsonMatch[1] || jsonMatch[0] : response.message.content);
      } catch (parseError) {
        console.warn('Could not parse planning JSON, using text response');
        return null;
      }

      // Add planning message to chat
      const planningMessage: Message = {
        id: `planning-${Date.now()}`,
        type: 'assistant',
        content: `🧠 **Strategic Execution Plan Created**

**Project Analysis:**
${planningData.projectAnalysis}

**Request Breakdown:**
${planningData.userRequestBreakdown}

**Execution Plan (${planningData.estimatedSteps} steps):**
${planningData.executionPlan?.map((step: any, index: number) => 
  `${index + 1}. **${step.action}** → \`${step.target}\`\n   ${step.purpose}`
).join('\n\n')}

**Dependencies:** ${planningData.dependencies?.join(', ') || 'None'}
**Confidence:** ${planningData.confidence}%

Now executing plan systematically...`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, planningMessage]);
      return planningData;

    } catch (error) {
      console.error('Planning failed:', error);
      return null;
    }
  };

  const performAIReflection = async (
    toolResults: Array<{id: string, result: string, success: boolean}>,
    step: number,
    originalQuery: string
  ): Promise<AIReflection> => {
    // Create a fallback reflection in case of any failures
    const createFallbackReflection = (reason: string): AIReflection => ({
      id: `reflection-fallback-${Date.now()}`,
      step,
      toolResults: toolResults.map(r => r.result),
      currentSituation: `Tool execution completed (${reason})`,
      nextSteps: ['Continue with autonomous execution'],
      reasoning: `Fallback reflection: ${reason}`,
      confidence: 60,
      shouldContinue: true,
      timestamp: new Date()
    });

    if (!apiClient || !selectedModel) {
      console.warn('⚠️ No API client or model available for reflection');
      return createFallbackReflection('No API client available');
    }

    try {
      const reflectionPrompt = REFLECTION_PLANNING_SYSTEM_PROMPT
        .replace('{{STEP}}', step.toString())
        .replace('{{ORIGINAL_REQUEST}}', originalQuery)
        .replace('{{TOOL_RESULTS}}', toolResults.map(r => `${r.id}: ${r.success ? '✅' : '❌'} ${r.result}`).join('\n'));

      console.log('🧠 Sending reflection request...');
      
      const response = await apiClient.sendChat(
        selectedModel,
        [
          { role: 'system', content: reflectionPrompt },
          { role: 'user', content: 'Analyze the results and plan next steps.' }
        ],
        {
          temperature: parameters.temperature,
          max_tokens: Math.min(parameters.maxTokens, 4000), // Limit tokens for reflection
          top_p: parameters.topP,
          frequency_penalty: parameters.frequencyPenalty,
          presence_penalty: parameters.presencePenalty
        }
      );

      if (!response.message?.content) {
        console.warn('⚠️ Empty reflection response');
        return createFallbackReflection('Empty response from AI');
      }

      console.log('🧠 Reflection response received:', response.message.content.substring(0, 200) + '...');

      // Try to parse JSON response
      let reflectionData;
      try {
        const jsonMatch = response.message.content.match(/```json\n([\s\S]*?)\n```/) || response.message.content.match(/\{[\s\S]*\}/);
        const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : response.message.content;
        reflectionData = JSON.parse(jsonText);
        console.log('✅ Successfully parsed reflection JSON');
      } catch (parseError) {
        console.warn('⚠️ Could not parse reflection JSON, using fallback:', parseError);
        return createFallbackReflection('JSON parsing failed');
      }

      // Validate and return structured reflection
      const reflection: AIReflection = {
        id: `reflection-${Date.now()}`,
        step,
        toolResults: reflectionData.toolResults || toolResults.map(r => r.result),
        currentSituation: reflectionData.currentSituation || 'Analyzing progress...',
        nextSteps: Array.isArray(reflectionData.nextSteps) ? reflectionData.nextSteps : ['Continue execution'],
        reasoning: reflectionData.reasoning || 'Following execution plan',
        confidence: typeof reflectionData.confidence === 'number' ? reflectionData.confidence : 70,
        shouldContinue: reflectionData.shouldContinue !== false, // Default to true unless explicitly false
        timestamp: new Date()
      };

      console.log('✅ Reflection created successfully:', {
        shouldContinue: reflection.shouldContinue,
        confidence: reflection.confidence
      });

      return reflection;

    } catch (error) {
      console.error('❌ Reflection failed with error:', error);
      return createFallbackReflection(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Parse and execute tools from AI response
  const parseAndExecuteTools = async (response: string): Promise<Array<{id: string, result: string, success: boolean}>> => {
    const results: Array<{id: string, result: string, success: boolean}> = [];
    
    // Simple regex-based tool detection (can be enhanced)
    const toolMatches = response.match(/\*\*Tool:\s*(\w+)\*\*[\s\S]*?\*\*Parameters:\*\*([\s\S]*?)(?=\*\*Tool:|$)/g);
    
    if (toolMatches) {
      for (const match of toolMatches) {
        const toolNameMatch = match.match(/\*\*Tool:\s*(\w+)\*\*/);
        const parametersMatch = match.match(/\*\*Parameters:\*\*([\s\S]*?)(?=\*\*|$)/);
        
        if (toolNameMatch && parametersMatch) {
          const toolName = toolNameMatch[1];
          const parametersText = parametersMatch[1].trim();
          
          try {
            // Try to parse parameters (simple key: value format)
            const parameters: any = {};
            const paramLines = parametersText.split('\n').filter(line => line.includes(':'));
            paramLines.forEach(line => {
              const [key, ...valueParts] = line.split(':');
              if (key && valueParts.length > 0) {
                parameters[key.trim()] = valueParts.join(':').trim();
              }
            });

            // Execute tool using existing LITE_TOOLS
            const tool = LITE_TOOLS.find(t => t.name === toolName);
            if (tool && liteTools[toolName]) {
              const result = await liteTools[toolName](parameters);
              results.push({
                id: `tool-${Date.now()}`,
                result: typeof result === 'string' ? result : JSON.stringify(result),
                success: true
              });
            } else {
              results.push({
                id: `error-${Date.now()}`,
                result: `Tool ${toolName} not found`,
                success: false
              });
            }
          } catch (error) {
            console.error('Tool execution error:', error);
            results.push({
              id: `error-${Date.now()}`,
              result: `Error executing ${toolName}: ${error}`,
              success: false
            });
          }
        }
      }
    }

    return results;
  };

  // Enhanced message handler with auto mode support
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !isReadyToChat) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setIsLoading(true);
    setCurrentTask('Analyzing request...');

    try {
      if (!isAutoMode) {
        // Regular single response mode with OpenAI function calling
        setCurrentTask('Getting AI response...');
        
        // Create file tree for context
        const filesList = projectFiles.map(f => `${f.path} (${f.type})`).join('\n  ');
        const projectTree = createFileTree(projectFiles);

        const systemPrompt = `You are Clara, an expert AI coding assistant specialized in web development and project management. You help users build applications by managing files, writing code, and providing development guidance.

**CURRENT PROJECT CONTEXT:**
- Project: ${projectName}
- Files: ${projectFiles.length} total files
- Selected File: ${selectedFile || 'No file selected'}

**PROJECT STRUCTURE:**
${projectTree}

**FILE LIST:**
${filesList}

**YOUR CAPABILITIES:**
You have access to a comprehensive set of tools for file and project management. Always use the appropriate tools to help users with their requests. You can:

🔧 **File Operations**: Create, read, edit, and delete files
📁 **Directory Management**: Create directories and explore project structure  
🔍 **Code Analysis**: Search files and analyze project structure
💾 **Project Info**: Get detailed project information and file structure
🛠️ **Development**: Simulate package installation and commands

**DEVELOPMENT APPROACH:**
1. **Read First**: Always read existing files before making changes
2. **Understand Context**: Analyze the current project structure and patterns
3. **Plan Changes**: Think through the implications of modifications
4. **Implement Systematically**: Make changes in logical order
5. **Verify Results**: Check that changes work as expected

**CODING STANDARDS:**
- Write clean, readable, and well-documented code
- Follow existing code patterns and conventions
- Use appropriate modern web development practices
- Ensure responsive design and accessibility
- Include proper error handling

**COMMUNICATION:**
- Explain what you're doing and why
- Provide context for your decisions
- Ask for clarification when needed
- Show the results of tool operations

Ready to help build amazing web applications!`;

        const response = await apiClient!.sendChat(
          selectedModel!,
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: currentInput }
          ],
          {
            temperature: parameters.temperature,
            max_tokens: parameters.maxTokens,
            top_p: parameters.topP,
            frequency_penalty: parameters.frequencyPenalty,
            presence_penalty: parameters.presencePenalty,
            tools: OPENAI_TOOLS
          }
        );

        if (!response.message?.content && !response.message?.tool_calls) {
          throw new Error('No response from AI');
        }

        // Add assistant message with tool calls if present
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: response.message.content || (response.message.tool_calls ? `Using ${response.message.tool_calls.length} tool${response.message.tool_calls.length > 1 ? 's' : ''}...` : ''),
          timestamp: new Date(),
          tool_calls: response.message.tool_calls
        };

        setMessages(prev => [...prev, assistantMessage]);

        // Execute tools if present
        if (response.message.tool_calls && response.message.tool_calls.length > 0) {
          setCurrentTask(`Executing ${response.message.tool_calls.length} operation${response.message.tool_calls.length > 1 ? 's' : ''}...`);
          const toolResults = await executeTools(response.message.tool_calls);
          
          // Show tool results in UI
          const toolMessage: Message = {
            id: (Date.now() + 2).toString(),
            type: 'tool',
            content: toolResults.map(r => r.result).join('\n'),
            timestamp: new Date(),
            files: response.message.tool_calls
              .filter((tc: any) => tc.function.name === 'create_file' || tc.function.name === 'edit_file')
              .map((tc: any) => {
                const params = typeof tc.function.arguments === 'string' 
                  ? JSON.parse(tc.function.arguments) 
                  : tc.function.arguments;
                return params.path;
              })
              .filter(Boolean)
          };
          
          setMessages(prev => [...prev, toolMessage]);
        }

      } else {
        // Auto mode - strategic planning and execution
        await handleAutoModeExecution(currentInput);
      }

    } catch (error) {
      console.error('Failed to send message:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1000).toString(),
        type: 'assistant',
        content: `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setCurrentTask('');
      setShowPlanning(false);
      setCurrentPlanning(null);
    }
  };

  const handleAutoModeExecution = async (userQuery: string) => {
    try {
      setShowPlanning(true);
      
      // Build project context
      const filesList = projectFiles.map(f => `${f.path} (${f.type})`).join('\n  ');
      const projectTree = createFileTree(projectFiles);
      
      // STEP 1: Initial Strategic Planning
      setCurrentTask('🧠 Creating strategic execution plan...');
      
      const initialPlan = await performInitialPlanning(userQuery, projectTree, filesList);
      
      // Initialize planning execution tracking
      let currentPlanning: PlanningExecution = {
        id: `planning_${Date.now()}`,
        status: 'planning',
        currentStep: 0,
        totalSteps: parameters.maxIterations,
        reflections: [],
        startTime: new Date()
      };
      setCurrentPlanning(currentPlanning);

      // STEP 2: Execute plan with auto tool calling
      let conversationIteration = 0;
      let totalToolCalls = 0;
      const maxToolCalls = Math.min(20, Math.max(1, parameters.maxIterations));
      const maxConversationTurns = Math.min(10, Math.max(3, Math.ceil(maxToolCalls / 2)));

      console.log('🎯 Auto mode limits:', {
        maxToolCalls,
        maxConversationTurns,
        userSetting: parameters.maxIterations
      });

      // Build system prompt for auto mode with function calling
      const systemPrompt = `You are Clara, an expert AI coding assistant with comprehensive tool access. Execute the user's request systematically using your available functions.

**CURRENT PROJECT CONTEXT:**
- Project: ${projectName}
- Files: ${projectFiles.length} total files
- Selected File: ${selectedFile || 'No file selected'}

**PROJECT STRUCTURE:**
${projectTree}

**FILE LIST:**
${filesList}

**EXECUTION STRATEGY:**
${initialPlan ? `
STRATEGIC PLAN:
- Analysis: ${initialPlan.projectAnalysis}
- Estimated Steps: ${initialPlan.estimatedSteps}
- Dependencies: ${initialPlan.dependencies?.join(', ') || 'None'}
- Execution Plan: ${initialPlan.executionPlan?.map((step: any) => `${step.step}. ${step.action} → ${step.target} (${step.purpose})`).join(', ') || 'Adaptive approach'}

Follow this plan systematically, but adapt as needed based on actual results.
` : 'ADAPTIVE APPROACH: Analyze the request and execute tools in logical sequence.'}

**EXECUTION PRINCIPLES:**
1. **Read First**: Always read existing files before making changes
2. **Understand Context**: Analyze current project structure and patterns
3. **Plan Systematically**: Execute tools in logical order
4. **Verify Progress**: Check results after each operation
5. **Be Thorough**: Complete the full request systematically
6. **Autonomous Operation**: Continue working until the task is complete or you determine no further action is needed

**TOOL USAGE:**
- Use the function calling system to execute tools
- Be precise with file paths and parameters
- Explain what you're doing and why
- Continue until the request is fully satisfied
- If you complete the task, provide a final summary

**AUTONOMOUS BEHAVIOR:**
- Work independently without waiting for user input
- Make decisions based on tool results and project context
- Continue executing tools until the task is complete
- Only stop when you've fully satisfied the user's request or reached a natural completion point

Ready to systematically execute your request autonomously!`;

      let conversationHistory: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuery }
      ];

      // Add initial planning context to system prompt if available
      if (initialPlan) {
        const planningContext = `

EXECUTION PLAN CONTEXT:
The following strategic plan has been created for this request:
- Project Analysis: ${initialPlan.projectAnalysis}
- Estimated Steps: ${initialPlan.estimatedSteps}
- Dependencies: ${initialPlan.dependencies?.join(', ') || 'None'}
- Execution Plan: ${initialPlan.executionPlan?.map((step: any) => `${step.step}. ${step.action} → ${step.target} (${step.purpose})`).join(', ') || 'Adaptive approach'}

Follow this plan systematically, but adapt as needed based on actual results.`;

        conversationHistory[0].content += planningContext;
      }

      // AUTONOMOUS EXECUTION LOOP - This is the key difference from regular chat
      while (conversationIteration < maxConversationTurns && totalToolCalls < maxToolCalls) {
        conversationIteration++;
        currentPlanning.currentStep = totalToolCalls;
        currentPlanning.status = 'executing';
        setCurrentPlanning({...currentPlanning});

        setCurrentTask(`🤖 Autonomous step ${conversationIteration}... (Tools: ${totalToolCalls}/${maxToolCalls})`);

        console.log('🔄 === STARTING AUTO MODE ITERATION ===', {
          iteration: conversationIteration,
          toolCalls: totalToolCalls,
          historyLength: conversationHistory.length,
          lastMessage: conversationHistory[conversationHistory.length - 1]?.role,
          loopConditions: {
            conversationCheck: conversationIteration < maxConversationTurns,
            toolCallCheck: totalToolCalls < maxToolCalls,
            willContinue: conversationIteration < maxConversationTurns && totalToolCalls < maxToolCalls
          }
        });

        // Get AI response with OpenAI function calling
        console.log('🤖 Sending request to AI...', {
          model: selectedModel,
          historyLength: conversationHistory.length,
          lastMessages: conversationHistory.slice(-3).map(m => ({ role: m.role, hasContent: !!m.content }))
        });
        
        const response = await apiClient!.sendChat(
          selectedModel!,
          conversationHistory,
          {
            temperature: parameters.temperature,
            max_tokens: parameters.maxTokens,
            top_p: parameters.topP,
            frequency_penalty: parameters.frequencyPenalty,
            presence_penalty: parameters.presencePenalty,
            tools: OPENAI_TOOLS
          }
        );

        console.log('🤖 AI Response received:', {
          hasContent: !!response.message?.content,
          hasToolCalls: !!response.message?.tool_calls,
          toolCallCount: response.message?.tool_calls?.length || 0,
          finishReason: response.finish_reason,
          contentPreview: response.message?.content?.substring(0, 100) + '...',
          responseStructure: {
            message: !!response.message,
            choices: !!response.choices,
            usage: !!response.usage
          }
        });

        // Check if AI wants to use tools
        if (response.message?.tool_calls && response.message.tool_calls.length > 0) {
          // Check if we would exceed tool call limit
          const newToolCallCount = totalToolCalls + response.message.tool_calls.length;
          if (newToolCallCount > maxToolCalls) {
            const limitMessage: Message = {
              id: `auto-limit-${Date.now()}`,
              type: 'assistant',
              content: `⚠️ **Tool call limit reached!** Would execute ${response.message.tool_calls.length} more tools, but limit is ${maxToolCalls}. Current count: ${totalToolCalls}.\n\nIncrease the limit in AI settings or break your request into smaller parts.`,
              timestamp: new Date()
            };
            setMessages(prev => [...prev, limitMessage]);
            break;
          }

          // Update tool call count
          totalToolCalls += response.message.tool_calls.length;

          // Add assistant message with tool calls
          const assistantMessage: Message = {
            id: `auto-assistant-${Date.now()}-${conversationIteration}`,
            type: 'assistant',
            content: response.message.content || `🔧 Using ${response.message.tool_calls.length} tool${response.message.tool_calls.length > 1 ? 's' : ''}...`,
            timestamp: new Date(),
            tool_calls: response.message.tool_calls
          };
          setMessages(prev => [...prev, assistantMessage]);

          // Add to conversation history (OpenAI format)
          conversationHistory.push({
            role: 'assistant',
            content: response.message.content || '',
            tool_calls: response.message.tool_calls
          });

          // Execute tools
          setCurrentTask(`⚡ Executing ${response.message.tool_calls.length} operation${response.message.tool_calls.length > 1 ? 's' : ''}... (Tool calls: ${totalToolCalls}/${maxToolCalls})`);
          
          console.log('🔧 About to execute tools:', {
            toolCallCount: response.message.tool_calls.length,
            toolCalls: response.message.tool_calls.map(tc => ({
              id: tc.id,
              function: tc.function.name,
              args: tc.function.arguments
            }))
          });
          
          const toolResults = await executeTools(response.message.tool_calls);
          
          console.log('🔧 Tool execution completed:', {
            resultCount: toolResults.length,
            successCount: toolResults.filter(r => r.success).length,
            failureCount: toolResults.filter(r => !r.success).length,
            results: toolResults.map(r => ({
              id: r.id,
              success: r.success,
              resultLength: r.result?.length || 0,
              resultPreview: r.result?.substring(0, 100) + '...'
            }))
          });
          
          // Add tool result messages following OpenAI format
          console.log('🔧 Adding tool results to conversation history...');
          for (const toolResult of toolResults) {
            const toolCall = response.message.tool_calls.find((tc: any) => tc.id === toolResult.id);
            const toolMessage = {
              role: 'tool' as const,
              tool_call_id: toolResult.id,
              name: toolCall?.function?.name || 'unknown',
              content: toolResult.result
            };
            
            // Add tool message to conversation history (OpenAI format)
            conversationHistory.push(toolMessage);
            
            console.log('🔧 Tool result added to conversation:', {
              toolId: toolResult.id,
              name: toolCall?.function?.name,
              success: toolResult.success,
              contentLength: toolResult.result?.length || 0,
              toolCallId: toolResult.id,
              conversationLength: conversationHistory.length
            });
          }
          
          console.log('🔧 Conversation history updated:', {
            totalMessages: conversationHistory.length,
            lastMessage: conversationHistory[conversationHistory.length - 1]?.role,
            toolResultsAdded: toolResults.length
          });

          // Show tool results in UI
          const toolMessage: Message = {
            id: `auto-tool-${Date.now()}-${conversationIteration}`,
            type: 'tool',
            content: toolResults.map((r: any) => r.result).join('\n'),
            timestamp: new Date(),
            files: response.message.tool_calls
              .filter((tc: any) => tc.function.name === 'create_file' || tc.function.name === 'edit_file')
              .map((tc: any) => {
                const params = typeof tc.function.arguments === 'string' 
                  ? JSON.parse(tc.function.arguments) 
                  : tc.function.arguments;
                return params.path;
              })
              .filter(Boolean)
          };
          setMessages(prev => [...prev, toolMessage]);

          // Perform AI reflection and planning after tool execution
          console.log('🧠 Starting AI reflection process...');
          currentPlanning.status = 'reflecting';
          setCurrentPlanning({...currentPlanning});
          
          console.log('🧠 Calling performAIReflection with:', {
            toolResultsCount: toolResults.length,
            conversationIteration,
            userQuery: userQuery.substring(0, 50) + '...'
          });
          
          const reflection = await performAIReflection(toolResults, conversationIteration, userQuery);
          
          console.log('🧠 Reflection completed:', {
            reflectionId: reflection.id,
            shouldContinue: reflection.shouldContinue,
            confidence: reflection.confidence,
            reasoning: reflection.reasoning.substring(0, 100) + '...'
          });
          
          // Add reflection to planning (performAIReflection now always returns a valid reflection)
          currentPlanning.reflections.push(reflection);
          setCurrentPlanning({...currentPlanning});
          
          console.log('🧠 AI Reflection:', {
            shouldContinue: reflection.shouldContinue,
            confidence: reflection.confidence,
            nextStepsCount: reflection.nextSteps.length,
            reasoning: reflection.reasoning
          });
          
          // If AI decides not to continue, break the loop
          if (!reflection.shouldContinue) {
            const completionMessage: Message = {
              id: `auto-complete-${Date.now()}`,
              type: 'assistant',
              content: `✅ **Task completed!** The AI has determined that the request has been fulfilled successfully.\n\n**Final Assessment:** ${reflection.currentSituation}`,
              timestamp: new Date()
            };
            setMessages(prev => [...prev, completionMessage]);
            break;
          }

          setCurrentTask('🧠 Analyzing next steps...');
          
          // Add a small delay to prevent overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // Continue the loop to get next AI response - THIS IS THE KEY AUTONOMOUS BEHAVIOR
          console.log('🔄 Preparing to continue autonomous execution...', {
            nextIteration: conversationIteration + 1,
            toolCallsUsed: totalToolCalls,
            maxToolCalls,
            maxConversationTurns,
            willContinue: (conversationIteration + 1) < maxConversationTurns && totalToolCalls < maxToolCalls,
            conversationHistoryLength: conversationHistory.length,
            currentPlanningStatus: currentPlanning.status
          });
          
          console.log('🔄 Loop will continue to next iteration...');
          
        } else {
          // No more tool calls, show final response and exit
          console.log('🏁 No more tool calls, completing auto mode');
          
          if (response.message?.content) {
            const finalMessage: Message = {
              id: `auto-final-${Date.now()}`,
              type: 'assistant',
              content: response.message.content,
              timestamp: new Date()
            };
            setMessages(prev => [...prev, finalMessage]);
          }
          break; // Exit the loop - task is complete
        }
      }

      // Complete planning execution
      if (currentPlanning) {
        currentPlanning.status = 'completed';
        currentPlanning.endTime = new Date();
        setCurrentPlanning({...currentPlanning});
      }

      // Show completion summary
      const completionSummary: Message = {
        id: `auto-summary-${Date.now()}`,
        type: 'assistant',
        content: `📊 **Auto Mode Session Summary**

• **Tool calls executed:** ${totalToolCalls}/${maxToolCalls}
• **Conversation turns:** ${conversationIteration}/${maxConversationTurns}
• **Status:** ${totalToolCalls >= maxToolCalls ? 'Tool limit reached' : conversationIteration >= maxConversationTurns ? 'Conversation limit reached' : 'Completed naturally'}
• **Reflections:** ${currentPlanning?.reflections.length || 0} strategic assessments

The AI worked autonomously to complete your request, executing tools and making decisions without requiring user input at each step.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, completionSummary]);

    } catch (error) {
      console.error('Auto mode execution failed:', error);
      const errorMessage: Message = {
        id: `auto-error-${Date.now()}`,
        type: 'assistant',
        content: `❌ Auto mode execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  // Create file tree visualization
  const createFileTree = (files: LiteProjectFile[]): string => {
    const tree: any = {};
    
    files.forEach(file => {
      const parts = file.path.split('/');
      let current = tree;
      
      parts.forEach((part: string, index: number) => {
        if (index === parts.length - 1) {
          current[part] = file.type === 'file' ? '📄' : '📁';
        } else {
          if (!current[part] || typeof current[part] === 'string') {
            current[part] = {};
          }
          current = current[part];
        }
      });
    });
    
    const renderTree = (obj: any, indent = ''): string => {
      return Object.entries(obj)
        .map(([key, value]) => {
          if (typeof value === 'string') {
            return `${indent}${value} ${key}`;
          } else {
            return `${indent}📁 ${key}/\n${renderTree(value, indent + '  ')}`;
          }
        })
        .join('\n');
    };
    
    return renderTree(tree);
  };

  // Check if ready to chat
  const isReadyToChat = apiClient && selectedModel && (currentProvider?.apiKey || ['ollama', 'custom'].includes(currentProvider?.type || ''));

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Clear chat
  const clearChat = () => {
    setMessages(defaultMessages);
  };

  // Format time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Copy to clipboard
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add a toast notification here
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  // Dynamic font size based on message length
  const getDynamicFontSize = (content: string) => {
    const length = content.length;
    
    // Base font size classes
    if (length < 100) return 'text-sm'; // 14px - short messages
    if (length < 300) return 'text-sm'; // 14px - medium messages  
    if (length < 600) return 'text-xs'; // 12px - longer messages
    if (length < 1200) return 'text-xs'; // 12px - very long messages
    return 'text-xs'; // 12px minimum - extremely long messages
  };

  // Dynamic line height based on font size
  const getDynamicLineHeight = (content: string) => {
    const length = content.length;
    
    if (length < 100) return 'leading-relaxed'; // 1.625
    if (length < 300) return 'leading-relaxed'; // 1.625
    if (length < 600) return 'leading-normal'; // 1.5
    if (length < 1200) return 'leading-normal'; // 1.5
    return 'leading-snug'; // 1.375 - tighter for very long text
  };

  return (
    <div className="h-full flex flex-col glassmorphic border-l border-white/20 dark:border-gray-700/50 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/20 dark:border-gray-700/50 shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-sakura-500" />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            AI Assistant
          </span>
          {isAutoMode && (
            <div className="flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-full text-xs font-medium">
              <Zap className="w-3 h-3" />
              Auto Mode
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-1">
          {/* Auto Mode Toggle */}
          <button
            onClick={() => setIsAutoMode(!isAutoMode)}
            className={`p-1.5 rounded-lg transition-all ${
              isAutoMode
                ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg'
                : 'text-gray-500 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20'
            }`}
            title={isAutoMode ? 'Disable Auto Mode' : 'Enable Auto Mode - AI will automatically execute multiple steps'}
          >
            {isAutoMode ? <Sparkles className="w-4 h-4" /> : <Brain className="w-4 h-4" />}
          </button>
          
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-1.5 text-gray-500 hover:text-sakura-500 hover:bg-sakura-50 dark:hover:bg-sakura-900/20 rounded-lg transition-colors"
            title="AI Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          
          <button
            onClick={clearChat}
            className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Clear Chat"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Auto Mode Status */}
      {isAutoMode && (currentTask || showPlanning) && (
        <div className="px-3 py-2 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border-b border-purple-200/30 dark:border-purple-700/30">
          <div className="flex items-center gap-2">
            {currentPlanning?.status === 'planning' && <Brain className="w-4 h-4 text-purple-600 animate-pulse" />}
            {currentPlanning?.status === 'executing' && <Target className="w-4 h-4 text-blue-600 animate-pulse" />}
            {currentPlanning?.status === 'reflecting' && <Sparkles className="w-4 h-4 text-indigo-600 animate-pulse" />}
            <span className="text-sm text-purple-700 dark:text-purple-300 font-medium">
              {currentTask || 'Processing...'}
            </span>
            {currentPlanning && (
              <div className="ml-auto text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                Step {currentPlanning.currentStep}/{currentPlanning.totalSteps}
              </div>
            )}
          </div>
          {currentPlanning && currentPlanning.reflections.length > 0 && (
            <div className="mt-1 text-xs text-purple-600 dark:text-purple-400">
              Latest: {currentPlanning.reflections[currentPlanning.reflections.length - 1].currentSituation}
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 space-y-4 min-h-0">
        {messages.map((message) => (
          <div key={message.id} className="group">
            {message.type === 'user' ? (
              <div className="flex justify-end">
                <div className="max-w-[90%] min-w-0 px-4 py-3 bg-gradient-to-r from-sakura-500 to-pink-500 text-white rounded-2xl rounded-br-md shadow-lg">
                  <p className={`${getDynamicFontSize(message.content)} ${getDynamicLineHeight(message.content)} whitespace-pre-wrap break-words overflow-wrap-anywhere`}>{message.content}</p>
                  <div className="text-xs opacity-70 mt-2">
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-start">
                <div className="max-w-[90%] min-w-0 px-4 py-3 glassmorphic-card border border-white/30 dark:border-gray-700/50 rounded-2xl rounded-bl-md shadow-lg">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-sakura-400 to-pink-400 flex items-center justify-center flex-shrink-0 mt-1">
                      <Bot className="w-3 h-3 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`prose prose-sm max-w-none text-gray-800 dark:text-gray-200 break-words overflow-wrap-anywhere ${getDynamicFontSize(message.content)}`}>
                        <ReactMarkdown
                          components={{
                            p: ({...props}: any) => <p className={`text-gray-800 dark:text-gray-200 mb-2 last:mb-0 break-words overflow-wrap-anywhere ${getDynamicLineHeight(message.content)}`} {...props} />,
                            h1: ({...props}: any) => <h1 className={`text-gray-800 dark:text-gray-100 font-bold mb-2 break-words overflow-wrap-anywhere ${message.content.length > 600 ? 'text-base' : 'text-lg'}`} {...props} />,
                            h2: ({...props}: any) => <h2 className={`text-gray-800 dark:text-gray-100 font-semibold mb-2 break-words overflow-wrap-anywhere ${message.content.length > 600 ? 'text-sm' : 'text-base'}`} {...props} />,
                            h3: ({...props}: any) => <h3 className={`text-gray-800 dark:text-gray-100 font-semibold mb-1 break-words overflow-wrap-anywhere ${message.content.length > 600 ? 'text-xs' : 'text-sm'}`} {...props} />,
                            li: ({...props}: any) => <li className={`text-gray-800 dark:text-gray-200 break-words overflow-wrap-anywhere ${getDynamicLineHeight(message.content)}`} {...props} />,
                            strong: ({...props}: any) => <strong className="text-gray-900 dark:text-gray-100 font-semibold break-words overflow-wrap-anywhere" {...props} />,
                            em: ({...props}: any) => <em className="text-gray-700 dark:text-gray-300 break-words overflow-wrap-anywhere" {...props} />,
                            code: ({inline, className, children, ...props}: any) => {
                              const match = /language-(\w+)/.exec(className || '');
                              return !inline && match ? (
                                <div className="overflow-x-auto">
                                  <SyntaxHighlighter
                                    style={vscDarkPlus as any}
                                    language={match[1]}
                                    PreTag="div"
                                    className={`rounded-lg my-2 max-w-full ${message.content.length > 600 ? 'text-xs' : 'text-sm'}`}
                                    wrapLongLines={true}
                                    {...props}
                                  >
                                    {String(children).replace(/\n$/, '')}
                                  </SyntaxHighlighter>
                                </div>
                              ) : (
                                <code className={`bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 px-1 py-0.5 rounded font-mono break-all ${message.content.length > 600 ? 'text-xs' : 'text-xs'}`} {...props}>
                                  {children}
                                </code>
                              );
                            }
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTime(message.timestamp)}
                        </div>
                        <button
                          onClick={() => copyToClipboard(message.content)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-all"
                          title="Copy message"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] px-4 py-3 glassmorphic-card border border-white/30 dark:border-gray-700/50 rounded-2xl rounded-bl-md">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-sakura-400 to-pink-400 flex items-center justify-center">
                  <Loader2 className="w-3 h-3 text-white animate-spin" />
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {currentTask || 'AI is thinking...'}
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Auto Mode Help */}
      {isAutoMode && messages.length <= 1 && (
        <div className="px-3 pb-2">
          <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-xl border border-purple-200/30 dark:border-purple-700/30">
            <div className="flex items-start gap-2">
              <Sparkles className="w-5 h-5 text-purple-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-1">
                  Auto Mode Enabled
                </h4>
                <p className="text-xs text-purple-600 dark:text-purple-400 leading-relaxed">
                  AI will automatically execute multiple steps to complete complex tasks. It will plan, execute tools, and reflect on progress until your request is fulfilled.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 border-t border-white/20 dark:border-gray-700/50 shrink-0">
        <div className="flex gap-2">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={isReadyToChat ? (isAutoMode ? "Describe what you want to build and I'll handle everything automatically..." : "Ask me to help build your application...") : "Configure AI settings first..."}
            disabled={!isReadyToChat || isLoading}
            className="flex-1 text-sm rounded-xl border border-white/30 dark:border-gray-700/50 px-4 py-3 glassmorphic-card focus:ring-2 focus:ring-sakura-500 focus:border-transparent resize-none min-h-[44px] max-h-32 disabled:opacity-50 text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
            rows={1}
            style={{ height: 'auto' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 128) + 'px';
            }}
          />
          
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading || !isReadyToChat}
            className={`p-3 text-white rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center ${
              isAutoMode 
                ? 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 shadow-purple-500/25'
                : 'bg-gradient-to-r from-sakura-500 to-pink-500 hover:from-sakura-600 hover:to-pink-600 shadow-sakura-500/25'
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isAutoMode ? (
              <Sparkles className="w-5 h-5" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        
        {!isReadyToChat && (
          <div className="mt-2 p-2 glassmorphic-card border border-amber-200/30 dark:border-amber-700/30 rounded-lg">
            <p className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <Settings className="w-3 h-3" />
              Please configure a provider and model in settings to start chatting
            </p>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <AISettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        providers={providers}
        selectedProviderId={selectedProviderId}
        selectedModel={selectedModel}
        parameters={parameters}
        availableModels={availableModels}
        onProviderSelect={handleProviderChange}
        onModelSelect={handleModelChange}
        onParametersChange={handleParametersChange}
      />
    </div>
  );
};

export default LumaUILiteChatWindow; 