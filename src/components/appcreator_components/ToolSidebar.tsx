import React, { useEffect, useState } from 'react';
import { Grid as GridIcon, List as ListIcon } from 'lucide-react';

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
  tools: ToolItem[];
  onDragStart: (event: React.DragEvent<HTMLDivElement>, tool: ToolItem) => void;
}

const ToolSidebar = ({ tools, onDragStart }: ToolSidebarProps) => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [displayedTools, setDisplayedTools] = useState<ToolItem[]>([]);
  const [viewMode, setViewMode] = useState<'small' | 'large'>('large');

  useEffect(() => {
    let filtered = tools;

    if (activeCategory !== 'all') {
      filtered = filtered.filter(tool => tool.category === activeCategory);
    }

    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(
        tool =>
          tool.name.toLowerCase().includes(lowerSearch) ||
          tool.description.toLowerCase().includes(lowerSearch)
      );
    }

    setDisplayedTools(filtered);
  }, [activeCategory, searchTerm, tools]);

  const categoryOptions = [
    { id: 'all', label: 'All' },
    { id: 'input', label: 'Input' },
    { id: 'process', label: 'Process' },
    { id: 'function', label: 'Function' },
    { id: 'output', label: 'Output' },
  ];

  return (
    <div className="w-full border-r border-gray-200 dark:border-gray-700 p-4 flex flex-col h-full">
      {/* Header with title and view toggle icons */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white">Tools</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setViewMode('small')}
            className={`p-2 rounded ${
              viewMode === 'small'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <GridIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('large')}
            className={`p-2 rounded ${
              viewMode === 'large'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            <ListIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative mb-4">
        <input
          type="text"
          placeholder="Search tools..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Category Filter Dropdown */}
      <div className="mb-4">
        <select
          value={activeCategory}
          onChange={(e) => setActiveCategory(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        >
          {categoryOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tools List */}
      {viewMode === 'small' ? (
        <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-4">
          {displayedTools.map((tool) => (
            <div
              key={tool.id}
              draggable
              onDragStart={(e) => onDragStart(e, tool)}
              className="flex flex-col items-center justify-center p-4 rounded-lg bg-white dark:bg-gray-800 shadow border border-gray-200 dark:border-gray-700 cursor-grab transition transform hover:scale-105 hover:shadow-lg"
            >
              <div className={`flex items-center justify-center w-10 h-10 rounded-full ${tool.color} text-white mb-2`}>
                <tool.icon className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white text-center">
                {tool.name}
              </h4>
            </div>
          ))}
        </div>
      ) : (
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
      )}
    </div>
  );
};

export default ToolSidebar;
