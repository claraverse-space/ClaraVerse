import React, { useEffect, useState } from 'react';
import { ImagePlus, Camera, Brain, GripVertical, TextCursorInput, Type, FileOutput, SplitSquareVertical, Globe, TextQuote, FileText, MessageSquareText } from 'lucide-react';

export interface ToolItem {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  lightColor: string;
  darkColor: string;
  category: 'input' | 'process' | 'output' | 'function';
}

interface ToolSidebarProps {
  tools?: ToolItem[];
  onDragStart: (event: React.DragEvent<HTMLDivElement>, tool: ToolItem) => void;
}

const DEFAULT_TOOLS = [
  // Input tools
  {
    id: 'textInputNode',
    name: 'Text Input',
    description: 'Allow users to enter text input',
    icon: TextCursorInput,
    color: 'bg-blue-500',
    bgColor: 'bg-blue-100',
    lightColor: '#3B82F6',
    darkColor: '#1D4ED8',
    category: 'input'
  },
  {
    id: 'imageInputNode',
    name: 'Image Input',
    description: 'Allow users to upload an image',
    icon: Camera,
    color: 'bg-pink-500',
    bgColor: 'bg-pink-100',
    lightColor: '#EC4899',
    darkColor: '#BE185D',
    category: 'input'
  },
  // Processing tools
  {
    id: 'staticTextNode',
    name: 'Static Text',
    description: 'Fixed text content that does not change',
    icon: TextQuote,
    color: 'bg-red-500',
    bgColor: 'bg-red-100',
    lightColor: '#F87171',
    darkColor: '#DC2626',
    category: 'process'
  },
  {
    id: 'textCombinerNode',
    name: 'Text Combiner',
    description: 'Combine input text with additional text',
    icon: Type,
    color: 'bg-indigo-500',
    bgColor: 'bg-indigo-100',
    lightColor: '#6366F1',
    darkColor: '#4338CA',
    category: 'process'
  },
  {
    id: 'conditionalNode',
    name: 'Condition',
    description: 'Branch workflow based on conditions',
    icon: SplitSquareVertical,
    color: 'bg-yellow-500',
    bgColor: 'bg-yellow-100',
    lightColor: '#FBBF24',
    darkColor: '#D97706',
    category: 'process'
  },
  {
    id: 'apiCallNode',
    name: 'API Call',
    description: 'Call external API endpoints',
    icon: Globe,
    color: 'bg-green-500',
    bgColor: 'bg-green-100',
    lightColor: '#34D399',
    darkColor: '#059669',
    category: 'function'
  },
  {
    id: 'llmPromptNode',
    name: 'LLM Prompt',
    description: 'Process text with a language model',
    icon: Brain,
    color: 'bg-purple-500',
    bgColor: 'bg-purple-100',
    lightColor: '#8B5CF6',
    darkColor: '#6D28D9',
    category: 'function'
  },
  {
    id: 'imageTextLlmNode',
    name: 'Image + Text LLM',
    description: 'Process image and text with a vision model',
    icon: ImagePlus,
    color: 'bg-violet-500',
    bgColor: 'bg-violet-100',
    lightColor: '#8B5CF6',
    darkColor: '#7C3AED',
    category: 'function'
  },
  // Output tools
  {
    id: 'textOutputNode',
    name: 'Text Output',
    description: 'Display text output to the user',
    icon: FileOutput,
    color: 'bg-orange-500',
    bgColor: 'bg-orange-100',
    lightColor: '#F97316',
    darkColor: '#C2410C',
    category: 'output'
  },
  {
    id: 'markdownOutputNode',
    name: 'Markdown Output',
    description: 'Display formatted markdown output',
    icon: FileText,
    color: 'bg-teal-500',
    bgColor: 'bg-teal-100',
    lightColor: '#14B8A6',
    darkColor: '#0D9488',
    category: 'output'
  },
  {
    id: 'getClipboardTextNode',
    name: 'Get Clipboard Text',
    description: 'Retrieve text from system clipboard',
    icon: Clipboard,
    color: 'bg-emerald-500',
    bgColor: 'bg-emerald-100',
    lightColor: '#10B981',
    darkColor: '#059669',
    category: 'input'
  },

];

const ToolSidebar = ({ tools, onDragStart }: ToolSidebarProps) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [displayedTools, setDisplayedTools] = useState<ToolItem[]>([]);
  
  // Use the provided tools or fall back to the default tools
  const allTools = tools || DEFAULT_TOOLS;
  
  useEffect(() => {
    let filtered = allTools;
    
    // Apply category filter if not "all"
    if (activeCategory !== 'all') {
      filtered = filtered.filter(tool => tool.category === activeCategory);
    }
    
    // Apply search filter if there's a search term
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(tool => 
        tool.name.toLowerCase().includes(lowerSearch) || 
        tool.description.toLowerCase().includes(lowerSearch)
      );
    }
    
    setDisplayedTools(filtered);
  }, [activeCategory, searchTerm, allTools]);
  
  const categories = [
    { id: 'all', label: 'All' },
    { id: 'input', label: 'Input' },
    { id: 'process', label: 'Process' },
    { id: 'function', label: 'Function' },
    { id: 'output', label: 'Output' }
  ];
  
  return (
    <div className="w-64 border-r border-gray-200 dark:border-gray-700 p-4 flex flex-col h-full">
      <h2 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Tools</h2>
      
      {/* Search input */}
      <div className="relative mb-4">
        <input
          type="text"
          placeholder="Search tools..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      {/* Categories */}
      <div className="flex flex-wrap gap-2 mb-4">
        {categories.map(category => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={`px-3 py-1 text-xs rounded-full ${
              activeCategory === category.id
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            {category.label}
          </button>
        ))}
      </div>
      
      {/* Tools list */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {displayedTools.map((tool) => (
          <div
            key={tool.id}
            draggable
            onDragStart={(e) => onDragStart(e, tool)}
            className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 cursor-grab transition-all hover:shadow-md"
          >
            <div className={`p-2 rounded-lg ${tool.color} text-white`}>
              <tool.icon className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white">{tool.name}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">{tool.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ToolSidebar;