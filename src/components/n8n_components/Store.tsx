// Store.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Store as StoreIcon, Search, Database, Globe2, FileText, Zap, MessageSquare, GitBranch, BarChart2, Boxes, ChevronDown } from 'lucide-react';
import WorkflowCard from './WorkflowCard';
import WorkflowModal from './WorkflowModal';

interface Workflow {
  category: string;
  name: string;
  description: string;
  nodeCount: number;
  tags: string[];
  jsonLink: string;
}

interface StoreProps {
  onBack: () => void;
}

const ITEMS_PER_PAGE = 12; // Number of items to load each time

// Category icon and display name mapping with colors
const categoryConfig: Record<string, { icon: React.ReactNode; displayName: string; color: string }> = {
  'data-integration': { 
    icon: <Database className="w-4 h-4" />, 
    displayName: 'Data Integration',
    color: 'from-blue-400 to-blue-500'
  },
  'api-webhooks': { 
    icon: <Globe2 className="w-4 h-4" />, 
    displayName: 'API & Webhooks',
    color: 'from-green-400 to-green-500'
  },
  'document-processing': { 
    icon: <FileText className="w-4 h-4" />, 
    displayName: 'Document Processing',
    color: 'from-purple-400 to-purple-500'
  },
  'automation': { 
    icon: <Zap className="w-4 h-4" />, 
    displayName: 'Automation',
    color: 'from-yellow-400 to-yellow-500'
  },
  'communication': { 
    icon: <MessageSquare className="w-4 h-4" />, 
    displayName: 'Communication',
    color: 'from-pink-400 to-pink-500'
  },
  'data-transformation': { 
    icon: <GitBranch className="w-4 h-4" />, 
    displayName: 'Data Transformation',
    color: 'from-indigo-400 to-indigo-500'
  },
  'analytics': { 
    icon: <BarChart2 className="w-4 h-4" />, 
    displayName: 'Analytics',
    color: 'from-orange-400 to-orange-500'
  },
};

const getCategoryDisplay = (category: string): { icon: React.ReactNode; displayName: string; color: string } => {
  return categoryConfig[category] || { 
    icon: <Boxes className="w-4 h-4" />, 
    displayName: category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
    color: 'from-gray-400 to-gray-500'
  };
};

// Shuffle array function
const shuffleArray = <T,>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const Store: React.FC<StoreProps> = ({ onBack }) => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [displayedWorkflows, setDisplayedWorkflows] = useState<Workflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observer = useRef<IntersectionObserver | null>(null);
  const lastWorkflowElementRef = useCallback((node: HTMLDivElement) => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        setPage(prevPage => prevPage + 1);
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore]);

  useEffect(() => {
    fetch('/workflows/n8n_workflows_full.json')
      .then(response => response.json())
      .then((data: Workflow[]) => setWorkflows(data))
      .catch(error => console.error('Error loading workflows:', error));
  }, []);

  useEffect(() => {
    const filteredWorkflows = workflows.filter(workflow => {
      const lowerSearch = searchTerm.toLowerCase();
      const matchesSearch =
        workflow.name.toLowerCase().includes(lowerSearch) ||
        workflow.description.toLowerCase().includes(lowerSearch) ||
        workflow.tags.some(tag => tag.toLowerCase().includes(lowerSearch));
      const matchesCategory = !selectedCategory || workflow.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    // Shuffle the workflows if no category is selected
    const processedWorkflows = selectedCategory ? filteredWorkflows : shuffleArray(filteredWorkflows);

    // Reset pagination when filters change
    setPage(1);
    setDisplayedWorkflows(processedWorkflows.slice(0, ITEMS_PER_PAGE));
    setHasMore(processedWorkflows.length > ITEMS_PER_PAGE);
  }, [workflows, searchTerm, selectedCategory]);

  useEffect(() => {
    if (page === 1) return;

    setLoading(true);
    const filteredWorkflows = workflows.filter(workflow => {
      const lowerSearch = searchTerm.toLowerCase();
      const matchesSearch =
        workflow.name.toLowerCase().includes(lowerSearch) ||
        workflow.description.toLowerCase().includes(lowerSearch) ||
        workflow.tags.some(tag => tag.toLowerCase().includes(lowerSearch));
      const matchesCategory = !selectedCategory || workflow.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

    // Shuffle the workflows if no category is selected
    const processedWorkflows = selectedCategory ? filteredWorkflows : shuffleArray(filteredWorkflows);
    
    const newWorkflows = processedWorkflows.slice(0, page * ITEMS_PER_PAGE);
    setDisplayedWorkflows(newWorkflows);
    setHasMore(processedWorkflows.length > page * ITEMS_PER_PAGE);
    setLoading(false);
  }, [page, workflows, searchTerm, selectedCategory]);

  const categories = Array.from(new Set(workflows.map(w => w.category)));

  return (
    <div className="flex-1 flex flex-col">
      {/* Header/Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200/50 dark:border-gray-700/50 bg-white/80 dark:bg-black/50 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-gray-100/80 dark:hover:bg-gray-900/50 text-gray-600 dark:text-gray-300 backdrop-blur-sm"
            title="Back to n8n"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="relative">
            <div className="flex items-center gap-2 px-4 py-1.5 bg-white/90 dark:bg-black/80 backdrop-blur-sm rounded-full">
              <StoreIcon className="w-5 h-5 text-pink-500 dark:text-pink-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                ClaraVerse Store
              </span>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search workflows..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 w-64 bg-gray-50/80 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-400 dark:focus:ring-pink-400"
            />
          </div>
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="appearance-none pl-9 pr-8 py-2 bg-gray-50/80 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-400 dark:focus:ring-pink-400 min-w-[180px]"
            >
              <option value="">All Categories</option>
              {categories.map(category => {
                const { displayName } = getCategoryDisplay(category);
                return (
                  <option key={category} value={category}>
                    {displayName}
                  </option>
                );
              })}
            </select>
            <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-gray-400">
              {selectedCategory ? getCategoryDisplay(selectedCategory).icon : <Boxes className="w-4 h-4" />}
            </div>
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-gray-400">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Workflows Grid */}
      <div className="flex-1 p-6 overflow-auto bg-gradient-to-br from-gray-50/50 to-white/50 dark:from-black/50 dark:to-gray-900/50 backdrop-blur-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedWorkflows.map((workflow, index) => (
            <div
              key={workflow.name}
              ref={index === displayedWorkflows.length - 1 ? lastWorkflowElementRef : undefined}
            >
              <WorkflowCard
                workflow={workflow}
                onClick={() => setSelectedWorkflow(workflow)}
              />
            </div>
          ))}
        </div>

        {loading && (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">
            Loading more workflows...
          </div>
        )}

        {displayedWorkflows.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            No workflows found matching your criteria
          </div>
        )}
      </div>

      {/* Workflow Details Modal */}
      {selectedWorkflow && (
        <WorkflowModal
          workflow={selectedWorkflow}
          onClose={() => setSelectedWorkflow(null)}
        />
      )}
    </div>
  );
};

export default Store;
