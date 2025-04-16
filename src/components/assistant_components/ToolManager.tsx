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
  const [editingParameter, setEditingParameter] = useState<number | null>(null);
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

  const updateTool = async (updatedTool: Tool) => {
    try {
      if (!updatedTool.id) return;
      await db.updateTool(updatedTool.id, updatedTool);
      await loadTools(); // Reload tools after update
      setEditingTool(null);
      setEditingParameter(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while updating tool');
    }
  };

  const updateParameter = (index: number, field: string, value: string | boolean) => {
    if (!editingTool) return;
    
    const updatedParameters = [...editingTool.parameters];
    updatedParameters[index] = {
      ...updatedParameters[index],
      [field]: field === 'required' ? Boolean(value) : value
    };

    setEditingTool({
      ...editingTool,
      parameters: updatedParameters
    });
  };

  const addParameter = () => {
    if (!editingTool) return;
    
    setEditingTool({
      ...editingTool,
      parameters: [
        ...editingTool.parameters,
        {
          name: 'new_parameter',
          type: 'string',
          description: 'Parameter description',
          required: false
        }
      ]
    });
  };

  const removeParameter = (index: number) => {
    if (!editingTool) return;
    
    const updatedParameters = editingTool.parameters.filter((_, i) => i !== index);
    setEditingTool({
      ...editingTool,
      parameters: updatedParameters
    });
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

  const renderToolEditor = () => {
    if (!editingTool) return null;

    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tool Name
            </label>
            <input
              type="text"
              value={editingTool.name}
              onChange={(e) => setEditingTool({ ...editingTool, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={editingTool.description}
              onChange={(e) => setEditingTool({ ...editingTool, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Parameters
            </label>
            <div className="space-y-4">
              {editingTool.parameters.map((param, index) => (
                <div key={index} className="flex items-start space-x-4 p-4 border border-gray-200 dark:border-gray-700 rounded-md">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      value={param.name}
                      onChange={(e) => updateParameter(index, 'name', e.target.value)}
                      placeholder="Parameter name"
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded"
                    />
                    <select
                      value={param.type}
                      onChange={(e) => updateParameter(index, 'type', e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded"
                    >
                      <option value="string">string</option>
                      <option value="number">number</option>
                      <option value="boolean">boolean</option>
                      <option value="object">object</option>
                      <option value="array">array</option>
                    </select>
                    <input
                      type="text"
                      value={param.description}
                      onChange={(e) => updateParameter(index, 'description', e.target.value)}
                      placeholder="Parameter description"
                      className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded"
                    />
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={param.required}
                        onChange={(e) => updateParameter(index, 'required', e.target.checked)}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">Required</span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeParameter(index)}
                    className="p-1 text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={addParameter}
                className="flex items-center text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Parameter
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Implementation
            </label>
            <textarea
              value={editingTool.implementation}
              onChange={(e) => setEditingTool({ ...editingTool, implementation: e.target.value })}
              rows={10}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-white font-mono"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={() => setEditingTool(null)}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={() => updateTool(editingTool)}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Save Changes
          </button>
        </div>
      </div>
    );
  };

  const renderTools = () => {
    return (
      <div className="space-y-4">
        {tools.map((tool) => (
          <div
            key={tool.id}
            className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {tool.name}
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {tool.description}
                </p>
                <div className="mt-2">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Parameters:
                  </h4>
                  <ul className="mt-1 space-y-1">
                    {tool.parameters.map((param, index) => (
                      <li
                        key={index}
                        className="text-sm text-gray-500 dark:text-gray-400"
                      >
                        {param.name} ({param.type}){param.required ? ' *' : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setEditingTool(tool)}
                  className="p-1 text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                >
                  <Edit2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => toggleTool(tool.id!, !tool.isEnabled)}
                  className={`p-1 ${
                    tool.isEnabled
                      ? 'text-green-500 hover:text-green-600'
                      : 'text-gray-400 hover:text-gray-500'
                  }`}
                >
                  <Check className="w-5 h-5" />
                </button>
                <button
                  onClick={() => deleteTool(tool.id!)}
                  className="p-1 text-red-400 hover:text-red-500"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        ))}
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

      {editingTool ? (
        renderToolEditor()
      ) : (
        <>
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">
              Available Tools
            </h2>
            <button
              onClick={() => setIsCreating(true)}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <Plus className="w-4 h-4 mr-1" />
              New Tool
            </button>
          </div>
          {renderTools()}
        </>
      )}
    </div>
  );
}; 