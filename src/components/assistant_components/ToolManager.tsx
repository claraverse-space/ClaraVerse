import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X, Code, Play, AlertCircle, ChevronDown, Wand2, Book, Lightbulb } from 'lucide-react';
import { db } from '../../db';
import { OllamaClient, ChatMessage } from '../../utils';
import type { Tool } from '../../db';

interface ToolManagerProps {
  client: OllamaClient;
  model: string;
}

interface OnboardingStep {
  title: string;
  description: string;
  example?: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: "What are Custom Tools?",
    description: "Custom tools are functions that you can create to extend the AI's capabilities. They can perform specific tasks like fetching data, processing information, or interacting with external services.",
  },
  {
    title: "Creating a Tool",
    description: "To create a tool, you need to provide a clear description of what you want it to do. The AI will help you generate the tool's code and configuration.",
    example: "Example: Create a tool that fetches the current weather for a given city"
  },
  {
    title: "Tool Parameters",
    description: "Tools can accept parameters (inputs) that they need to perform their task. Make sure to specify what inputs your tool needs.",
    example: "Example parameters: city (string), units (string - 'metric' or 'imperial')"
  },
  {
    title: "Testing Tools",
    description: "After creating a tool, you can test it to make sure it works as expected. Use the play button to run a test with sample data.",
  }
];

const TOOL_CREATION_PROMPT = `You are a tool creation assistant. Help create a tool definition that follows this format:

{
  "name": "tool_name_in_snake_case",
  "description": "Clear description of what the tool does",
  "parameters": [
    {
      "name": "parameter_name",
      "type": "string|number|boolean|object|array",
      "description": "Parameter description",
      "required": true|false
    }
  ],
  "implementation": "async function implementation(args) {\\n  // Function code here\\n}"
}

The implementation should be a valid async JavaScript function that can be executed in a browser environment.
Make sure the function handles errors appropriately and returns results in a consistent format.`;

const DEFAULT_TIME_TOOL = {
  name: "get_time",
  description: "Get the current time in a specified timezone",
  parameters: [
    {
      name: "timezone",
      type: "string",
      description: "The timezone to get time for (e.g., 'America/New_York', 'Europe/London', 'Asia/Tokyo'). Defaults to local timezone if not specified.",
      required: false
    },
    {
      name: "format",
      type: "string",
      description: "The format to return the time in ('12h' or '24h'). Defaults to '24h'.",
      required: false
    }
  ],
  implementation: `async function implementation(args) {
  try {
    const options = {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: args.format === '12h',
      timeZone: args.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
    };

    const formatter = new Intl.DateTimeFormat('en-US', options);
    const time = formatter.format(new Date());

    return {
      time: time,
      timezone: options.timeZone,
      format: args.format || '24h'
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(\`Failed to get time: \${error.message}\`);
    }
    throw new Error('Failed to get time: Unknown error');
  }
}`,
  isEnabled: true
};

interface TestParameters {
  [key: string]: string | number | boolean;
}

const DEFAULT_TOOL_SKELETON = `{
  "name": "example_tool",
  "description": "A tool that does something useful",
  "parameters": [
    {
      "name": "input_text",
      "type": "string",
      "description": "The text to process",
      "required": true
    }
  ],
  "implementation": "async function implementation(args) {\\n  try {\\n    // Your code here\\n    const result = args.input_text.toUpperCase();\\n    return result;\\n  } catch (error) {\\n    throw new Error(\`Tool execution failed: \${error.message}\`);\\n  }\\n}"
}`;

export const ToolManager: React.FC<ToolManagerProps> = ({ client, model: defaultModel }) => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [userPrompt, setUserPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(defaultModel);
  const [mode, setMode] = useState<'automated' | 'manual'>('manual');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [currentOnboardingStep, setCurrentOnboardingStep] = useState(0);
  const [testParams, setTestParams] = useState<TestParameters>({});
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editingTool, setEditingTool] = useState<Tool | null>(null);
  const [showWIPModal, setShowWIPModal] = useState(false);
  const [manualToolData, setManualToolData] = useState({
    name: '',
    description: '',
    parameters: '',
    implementation: ''
  });

  useEffect(() => {
    loadTools();
    loadModels();
  }, []);

  const loadModels = async () => {
    try {
      const models = await client.listModels();
      const modelNames = models.map((m: any) => m.name || m.id);
      setAvailableModels(modelNames);
      if (modelNames.length > 0 && !modelNames.includes(selectedModel)) {
        setSelectedModel(modelNames[0]);
      }
    } catch (err: unknown) {
      console.error('Error loading models:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred while loading models');
    }
  };

  const loadTools = async () => {
    try {
      const tools = await db.getAllTools();
      
      // If no tools exist, create the default time tool
      if (tools.length === 0) {
        try {
          await db.addTool(DEFAULT_TIME_TOOL);
          const updatedTools = await db.getAllTools();
          setTools(updatedTools);
        } catch (err: unknown) {
          console.error('Error creating default tool:', err);
          setError(err instanceof Error ? err.message : 'An unknown error occurred while creating default tool');
        }
      } else {
        setTools(tools);
      }
    } catch (err: unknown) {
      console.error('Error loading tools:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred while loading tools');
    }
  };

  const generateTool = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: TOOL_CREATION_PROMPT },
        { role: 'user', content: userPrompt }
      ];

      const response = await client.sendChat(selectedModel, messages);
      const content = response.message?.content;

      try {
        // Try to parse the response as JSON
        const toolDefinition = JSON.parse(content || '');
        await db.addTool({
          ...toolDefinition,
          isEnabled: true
        });
        await loadTools();
        setIsCreating(false);
        setUserPrompt('');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Invalid tool definition generated. Please try again.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while generating the tool');
    } finally {
      setIsGenerating(false);
    }
  };

  const testTool = async (tool: Tool) => {
    setTestResult(null);
    try {
      // Create a safe test environment with proper async handling
      const funcBody = `return (async () => {
        ${tool.implementation}
        return await implementation(args);
      })();`;
      const testFunc = new Function('args', funcBody);
      
      // Use provided test parameters or generate defaults
      const testArgs = tool.parameters.reduce((acc, param) => {
        if (testParams[param.name] !== undefined && testParams[param.name] !== '') {
          acc[param.name] = testParams[param.name];
        }
        return acc;
      }, {} as Record<string, unknown>);

      console.log('Testing tool with args:', testArgs);
      const result = await testFunc(testArgs);
      console.log('Test result:', result);

      if (result === undefined) {
        throw new Error('Tool returned undefined. Make sure the function returns a value.');
      }

      setTestResult(
        `Test successful!\n\nInput Parameters:\n${
          Object.entries(testArgs)
            .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
            .join('\n')
        }\n\nResult:\n${JSON.stringify(result, null, 2)}`
      );
    } catch (err: unknown) {
      console.error('Test error:', err);
      setTestResult(`Test failed: ${err instanceof Error ? err.message : 'Unknown error occurred during test'}`);
    }
  };

  const toggleTool = async (id: string, isEnabled: boolean) => {
    try {
      await db.updateTool(id, { isEnabled });
      await loadTools();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while updating the tool');
    }
  };

  const deleteTool = async (id: string) => {
    if (confirm('Are you sure you want to delete this tool?')) {
      try {
        await db.deleteTool(id);
        await loadTools();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred while deleting the tool');
      }
    }
  };

  const renderOnboarding = () => {
    const step = ONBOARDING_STEPS[currentOnboardingStep];
    return (
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            <span>{step.title}</span>
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">
              Step {currentOnboardingStep + 1} of {ONBOARDING_STEPS.length}
            </span>
            <button
              onClick={() => setShowOnboarding(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-300 mb-4">{step.description}</p>
        {step.example && (
          <div className="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg text-sm text-gray-600 dark:text-gray-300">
            {step.example}
          </div>
        )}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => setCurrentOnboardingStep(prev => Math.max(0, prev - 1))}
            disabled={currentOnboardingStep === 0}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => {
              if (currentOnboardingStep === ONBOARDING_STEPS.length - 1) {
                setShowOnboarding(false);
                setIsCreating(true);
              } else {
                setCurrentOnboardingStep(prev => prev + 1);
              }
            }}
            className="px-4 py-2 text-sm font-medium text-white bg-sakura-500 rounded-lg hover:bg-sakura-600"
          >
            {currentOnboardingStep === ONBOARDING_STEPS.length - 1 ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Custom Tools
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setMode('automated')}
              className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 transition-colors ${
                mode === 'automated'
                  ? 'bg-white dark:bg-gray-700 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              <Wand2 className="w-4 h-4" />
              Automated
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 transition-colors ${
                mode === 'manual'
                  ? 'bg-white dark:bg-gray-700 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300'
              }`}
            >
              <Code className="w-4 h-4" />
              Manual
            </button>
          </div>
          <button
            onClick={() => {
              if (mode === 'manual') {
                setShowOnboarding(true);
                setCurrentOnboardingStep(0);
              } else {
                setIsCreating(true);
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-sakura-500 text-white hover:bg-sakura-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Tool
          </button>
          <button
            onClick={() => {
              setShowOnboarding(true);
              setCurrentOnboardingStep(0);
            }}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            title="Help"
          >
            <Book className="w-5 h-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 text-red-800 bg-red-100 rounded-lg">
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {showOnboarding && renderOnboarding()}

      {isCreating && (
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Create New Tool</h4>
          
          {mode === 'automated' ? (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 dark:bg-yellow-900/50 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  🚧 The automated tool creation mode is currently under development. Please use the manual mode to create tools.
                </p>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={() => setMode('manual')}
                  className="px-3 py-1.5 text-sm rounded-lg bg-sakura-500 text-white hover:bg-sakura-600 transition-colors"
                >
                  Switch to Manual Mode
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tool Name (snake_case)
                </label>
                <input
                  type="text"
                  value={manualToolData.name}
                  onChange={(e) => setManualToolData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="my_custom_tool"
                  className="w-full px-3 py-2 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-sm font-mono"
                />
                <p className="mt-1 text-xs text-gray-500">Example: fetch_weather_data</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={manualToolData.description}
                  onChange={(e) => setManualToolData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="A clear description of what your tool does..."
                  className="w-full min-h-[60px] p-3 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">Example: Fetches current weather data for a given city using the OpenWeather API</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Parameters (JSON)
                </label>
                <textarea
                  value={manualToolData.parameters}
                  onChange={(e) => setManualToolData(prev => ({ ...prev, parameters: e.target.value }))}
                  placeholder='[
  {
    "name": "city",
    "type": "string",
    "description": "City name",
    "required": true
  }
]'
                  className="w-full min-h-[120px] p-3 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Implementation
                </label>
                <div className="relative">
                  <button
                    onClick={() => {
                      const skeleton = DEFAULT_TOOL_SKELETON;
                      try {
                        const parsed = JSON.parse(skeleton);
                        setManualToolData(prev => ({
                          ...prev,
                          implementation: parsed.implementation
                        }));
                      } catch (e) {
                        console.error('Failed to parse skeleton:', e);
                      }
                    }}
                    className="absolute right-2 top-2 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                  >
                    Insert Example
                  </button>
                  <textarea
                    value={manualToolData.implementation}
                    onChange={(e) => setManualToolData(prev => ({ ...prev, implementation: e.target.value }))}
                    placeholder="async function implementation(args) {
  try {
    // Your code here
    return result;
  } catch (error) {
    throw new Error(`Tool execution failed: ${error.message}`);
  }
}"
                    className="w-full min-h-[200px] p-3 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setManualToolData({
                      name: '',
                      description: '',
                      parameters: '',
                      implementation: ''
                    });
                  }}
                  className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      const parameters = JSON.parse(manualToolData.parameters);
                      const toolDefinition = {
                        name: manualToolData.name,
                        description: manualToolData.description,
                        parameters,
                        implementation: manualToolData.implementation,
                        isEnabled: true
                      };
                      await db.addTool(toolDefinition);
                      await loadTools();
                      setIsCreating(false);
                      setManualToolData({
                        name: '',
                        description: '',
                        parameters: '',
                        implementation: ''
                      });
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to create tool');
                    }
                  }}
                  disabled={!manualToolData.name || !manualToolData.description || !manualToolData.parameters || !manualToolData.implementation}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-sakura-500 text-white hover:bg-sakura-600 transition-colors disabled:opacity-50"
                >
                  <Code className="w-4 h-4" />
                  Create Tool
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-4">
        {tools.map(tool => (
          <div
            key={tool.id}
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="text-sm font-medium">{tool.name}</h4>
                <p className="text-xs text-gray-500">{tool.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingTool(tool);
                    setEditingCode(tool.implementation);
                  }}
                  className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => testTool(tool)}
                  className="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <Play className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toggleTool(tool.id, !tool.isEnabled)}
                  className={`p-1.5 ${
                    tool.isEnabled
                      ? 'text-green-500 hover:text-green-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => deleteTool(tool.id)}
                  className="p-1.5 text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mt-2">
              <h5 className="text-xs font-medium mb-1">Parameters:</h5>
              <div className="space-y-2">
                {tool.parameters.map((param, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <label className="text-xs font-mono flex-shrink-0">
                      {param.name}
                      <span className="text-gray-500 ml-1">({param.type})</span>
                      {param.required && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </label>
                    {param.type === 'boolean' ? (
                      <input
                        type="checkbox"
                        checked={!!testParams[param.name]}
                        onChange={(e) => setTestParams(prev => ({
                          ...prev,
                          [param.name]: e.target.checked
                        }))}
                        className="ml-2"
                      />
                    ) : param.type === 'number' ? (
                      <input
                        type="number"
                        value={String(testParams[param.name] || '')}
                        onChange={(e) => setTestParams(prev => ({
                          ...prev,
                          [param.name]: e.target.value ? parseFloat(e.target.value) : ''
                        }))}
                        className="flex-1 px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50"
                      />
                    ) : (
                      <input
                        type="text"
                        value={String(testParams[param.name] || '')}
                        onChange={(e) => setTestParams(prev => ({
                          ...prev,
                          [param.name]: e.target.value
                        }))}
                        placeholder={param.description}
                        className="flex-1 px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {testResult && (
              <div className="mt-2 p-2 text-xs font-mono bg-gray-50 dark:bg-gray-800 rounded whitespace-pre-wrap">
                {testResult}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Code Editor Modal */}
      {editingTool && editingCode !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => {
            setEditingTool(null);
            setEditingCode(null);
          }} />
          <div className="relative w-full max-w-3xl bg-white dark:bg-gray-900 rounded-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium">Edit Tool Implementation</h3>
              <button
                onClick={() => {
                  setEditingTool(null);
                  setEditingCode(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4">
              <textarea
                value={editingCode}
                onChange={(e) => setEditingCode(e.target.value)}
                className="w-full h-96 p-4 font-mono text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setEditingTool(null);
                  setEditingCode(null);
                }}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (editingTool && editingCode) {
                    try {
                      await db.updateTool(editingTool.id, {
                        implementation: editingCode
                      });
                      await loadTools();
                      setEditingTool(null);
                      setEditingCode(null);
                    } catch (err: unknown) {
                      setError(err instanceof Error ? err.message : 'An unknown error occurred while updating the tool');
                    }
                  }
                }}
                className="px-4 py-2 text-sm text-white bg-sakura-500 rounded-lg hover:bg-sakura-600"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 