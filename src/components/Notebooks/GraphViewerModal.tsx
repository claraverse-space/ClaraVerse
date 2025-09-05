import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Network, 
  ZoomIn, 
  ZoomOut, 
  RefreshCw, 
  AlertCircle, 
  Globe, 
  Grid3X3, 
  Maximize2,
  Download,
  Settings,
  Search,
  Info,
  Eye,
  EyeOff,
  HelpCircle,
  Filter,
  Layout,
  Minimize2,
  ChevronRight,
  Home,
  Target,
  Layers,
  RotateCcw
} from 'lucide-react';
import { claraNotebookService, GraphData } from '../../services/claraNotebookService';
import ThreeJSGraph from './ThreeJSGraph';

interface GraphViewerModalProps {
  notebookId: string;
  onClose: () => void;
  initialViewMode?: 'nodes' | 'html';
}

// Helper function to safely render unknown values
const renderSafeValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value.toString();
  if (typeof value === 'boolean') return value.toString();
  try {
    return String(value);
  } catch {
    return '';
  }
};

const GraphViewerModal: React.FC<GraphViewerModalProps> = ({ 
  notebookId, 
  onClose, 
  initialViewMode = 'html' 
}) => {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isBackendHealthy, setIsBackendHealthy] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphData['nodes'][0] | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'nodes' | 'html'>(initialViewMode);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Advanced view options
  const [showNodeLabels, setShowNodeLabels] = useState(true);
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [nodeSize, setNodeSize] = useState(1);
  const [edgeThickness, setEdgeThickness] = useState(1);

  // Enhanced UX states
  const [showHelp, setShowHelp] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'force' | 'hierarchical' | 'circular'>('force');
  const [isInteractiveMode, setIsInteractiveMode] = useState(true);
  const [selectedNodeHistory, setSelectedNodeHistory] = useState<string[]>([]);
  const [showStats, setShowStats] = useState(true);
  const [highlightConnections, setHighlightConnections] = useState(true);
  const [showTooltips, setShowTooltips] = useState(true);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  // Subscribe to backend health changes
  useEffect(() => {
    const unsubscribe = claraNotebookService.onHealthChange(setIsBackendHealthy);
    return unsubscribe;
  }, []);

  // Load graph data when component mounts or when backend becomes healthy
  useEffect(() => {
    if (isBackendHealthy) {
      loadGraphData();
    }
  }, [notebookId, isBackendHealthy]);

  // Handle fullscreen toggle
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
      if (e.key === 'F11') {
        e.preventDefault();
        setIsFullscreen(!isFullscreen);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isFullscreen, onClose]);

  // Handle body overflow when in fullscreen
  useEffect(() => {
    if (isFullscreen) {
      // Prevent body scroll when in fullscreen
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'auto';
      };
    }
  }, [isFullscreen]);

  const loadGraphData = async () => {
    if (!isBackendHealthy) {
      setError('Notebook backend is not available');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await claraNotebookService.getGraphData(notebookId);
      setGraphData(data);
    } catch (err) {
      console.error('Failed to load graph data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load graph data');
      setGraphData({ nodes: [], edges: [] });
    } finally {
      setIsLoading(false);
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.1, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 0.2));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  const handleExportGraph = () => {
    // TODO: Implement graph export functionality
    console.log('Export graph functionality to be implemented');
  };

  // Get unique node types for filtering
  const getNodeTypes = () => {
    if (!graphData) return [];
    const types = new Set(graphData.nodes.map(node => node.type));
    return Array.from(types);
  };

  // Filter nodes based on type and search
  const getFilteredNodes = () => {
    if (!graphData) return [];
    let filtered = graphData.nodes;
    
    if (filterType !== 'all') {
      filtered = filtered.filter(node => node.type === filterType);
    }
    
    if (searchQuery) {
      filtered = filtered.filter(node => 
        renderSafeValue(node.properties?.name || node.id)
          .toLowerCase()
          .includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered;
  };

  // Get edges for filtered nodes
  const getFilteredEdges = () => {
    if (!graphData) return [];
    const filteredNodes = getFilteredNodes();
    const nodeIds = new Set(filteredNodes.map(node => node.id));
    return graphData.edges.filter(edge => 
      nodeIds.has(edge.source) && nodeIds.has(edge.target)
    );
  };

  const getNodeColor = (nodeType: string) => {
    // Predefined colors for known types
    const colors: Record<string, string> = {
      'entity': 'bg-blue-500',
      'person': 'bg-green-500',
      'organization': 'bg-blue-600',
      'location': 'bg-red-500',
      'concept': 'bg-gray-500',
      'event': 'bg-purple-500',
      'processor': 'bg-red-600',
      'memory': 'bg-purple-600',
      'network': 'bg-green-600',
      'storage': 'bg-blue-500',
      'ai': 'bg-orange-500'
    };

    // If we have a predefined color, use it
    const predefinedColor = colors[nodeType.toLowerCase()];
    if (predefinedColor) {
      return predefinedColor;
    }

    // Generate consistent color based on node type string (same algorithm as ThreeJSGraph)
    const dynamicColors = [
      'bg-red-500',     // 0xe74c3c
      'bg-blue-500',    // 0x3498db  
      'bg-green-500',   // 0x2ecc71
      'bg-orange-500',  // 0xf39c12
      'bg-purple-500',  // 0x9b59b6
      'bg-teal-500',    // 0x1abc9c
      'bg-orange-600',  // 0xe67e22
      'bg-slate-600',   // 0x34495e
      'bg-teal-600',    // 0x16a085
      'bg-green-600',   // 0x27ae60
      'bg-blue-600',    // 0x2980b9
      'bg-purple-600',  // 0x8e44ad
      'bg-slate-800',   // 0x2c3e50
      'bg-yellow-500',  // 0xf1c40f
      'bg-orange-700',  // 0xd35400
      'bg-red-700',     // 0xc0392b
      'bg-gray-500',    // 0x7f8c8d
      'bg-gray-400',    // 0x95a5a6
      'bg-gray-100',    // 0xecf0f1
      'bg-gray-300'     // 0xbdc3c7
    ];

    let hash = 0;
    for (let i = 0; i < nodeType.length; i++) {
      const char = nodeType.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    const colorIndex = Math.abs(hash) % dynamicColors.length;
    return dynamicColors[colorIndex];
  };

  // Enhanced helper functions for better UX
  const getNodeColorHex = (nodeType: string) => {
    // Predefined colors for known types
    const colors: Record<string, string> = {
      'entity': '#3b82f6',
      'person': '#10b981', 
      'organization': '#2563eb',
      'location': '#ef4444',
      'concept': '#6b7280',
      'event': '#8b5cf6',
      'processor': '#dc2626',
      'memory': '#9333ea',
      'network': '#059669',
      'storage': '#3b82f6',
      'ai': '#f59e0b'
    };

    // If we have a predefined color, use it
    const predefinedColor = colors[nodeType.toLowerCase()];
    if (predefinedColor) {
      return predefinedColor;
    }

    // Generate consistent color based on node type string (same algorithm as ThreeJSGraph)
    const dynamicColors = [
      '#e74c3c', // Red
      '#3498db', // Blue  
      '#2ecc71', // Green
      '#f39c12', // Orange
      '#9b59b6', // Purple
      '#1abc9c', // Turquoise
      '#e67e22', // Carrot
      '#34495e', // Wet Asphalt
      '#16a085', // Green Sea
      '#27ae60', // Nephritis
      '#2980b9', // Belize Hole
      '#8e44ad', // Wisteria
      '#2c3e50', // Midnight Blue
      '#f1c40f', // Sun Flower
      '#d35400', // Pumpkin
      '#c0392b', // Pomegranate
      '#7f8c8d', // Asbestos
      '#95a5a6', // Concrete
      '#ecf0f1', // Clouds
      '#bdc3c7'  // Silver
    ];

    let hash = 0;
    for (let i = 0; i < nodeType.length; i++) {
      const char = nodeType.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    const colorIndex = Math.abs(hash) % dynamicColors.length;
    return dynamicColors[colorIndex];
  };

  const getGraphStats = () => {
    if (!graphData) return { nodes: 0, edges: 0, types: 0, maxConnections: 0 };
    
    const nodeTypes = new Set(graphData.nodes.map(n => n.type));
    const connectionCounts = graphData.nodes.map(node => 
      graphData.edges.filter(edge => edge.source === node.id || edge.target === node.id).length
    );
    
    return {
      nodes: graphData.nodes.length,
      edges: graphData.edges.length,
      types: nodeTypes.size,
      maxConnections: Math.max(...connectionCounts, 0)
    };
  };

  const getMostConnectedNodes = (limit = 5) => {
    if (!graphData) return [];
    
    return graphData.nodes
      .map(node => ({
        ...node,
        connections: graphData.edges.filter(edge => 
          edge.source === node.id || edge.target === node.id
        ).length
      }))
      .sort((a, b) => b.connections - a.connections)
      .slice(0, limit);
  };

  const resetToOverview = () => {
    setSelectedNode(null);
    setSelectedNodeHistory([]);
    setSearchQuery('');
    setFilterType('all');
    setZoom(1);
  };

  const getContainerClasses = () => {
    return isFullscreen 
      ? "fixed top-16 left-20 right-0 bottom-0 z-[9999] bg-black/95 backdrop-blur-xl"
      : "fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 pt-20";
  };

  const getModalClasses = () => {
    return isFullscreen
      ? "w-full h-full bg-white dark:bg-gray-900 flex flex-col"
      : "w-[calc(100vw-2rem)] h-[calc(100vh-6rem)] max-w-7xl glassmorphic bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700/30 flex flex-col overflow-hidden";
  };

  const modalContent = (
    <div className={getContainerClasses()}>
      <div className={getModalClasses()}>
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-850 glassmorphic">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl shadow-lg">
              <Network className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Knowledge Graph
                </h2>
                {selectedNode && (
                  <>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                    <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                      {renderSafeValue(selectedNode.properties?.name || selectedNode.id)}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-4 mt-1">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Interactive visualization of your document relationships
                </p>
                {selectedNode && (
                  <button
                    onClick={resetToOverview}
                    className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors"
                  >
                    <Home className="w-3 h-3" />
                    Back to Overview
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Stats */}
            {showStats && viewMode === 'html' && (
              <div className="hidden md:flex items-center gap-4 px-3 py-2 bg-white/50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="text-xs">
                  <span className="text-gray-500">Nodes:</span>
                  <span className="ml-1 font-semibold text-gray-900 dark:text-white">{getGraphStats().nodes}</span>
                </div>
                <div className="text-xs">
                  <span className="text-gray-500">Connections:</span>
                  <span className="ml-1 font-semibold text-gray-900 dark:text-white">{getGraphStats().edges}</span>
                </div>
                <div className="text-xs">
                  <span className="text-gray-500">Types:</span>
                  <span className="ml-1 font-semibold text-gray-900 dark:text-white">{getGraphStats().types}</span>
                </div>
              </div>
            )}

            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode('nodes')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'nodes'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
                title="Grid View"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('html')}
                className={`p-2 rounded transition-colors ${
                  viewMode === 'html'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
                title="Interactive 3D View"
              >
                <Globe className="w-4 h-4" />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1">
              {/* Help white text in dark mode   */}
              <button
                onClick={() => setShowHelp(!showHelp)}
                className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                title="Help & Controls"
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              {/* Settings */}
              {/* <button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-lg transition-colors ${
                  showSettings 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
                title="View Settings"
              >
                <Settings className="w-4 h-4" />
              </button> */}

              {/* Fullscreen */}
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                title={isFullscreen ? "Exit Fullscreen (F11)" : "Fullscreen (F11)"}
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>

              {/* Export */}
              <button
                onClick={handleExportGraph}
                className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                title="Export Graph"
              >
                <Download className="w-4 h-4" />
              </button>

              {/* Close */}
              <button
                onClick={onClose}
                className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Help Panel */}
        {showHelp && (
          <div className="flex-shrink-0 p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4 text-blue-600" />
                  Navigation
                </h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• <kbd className="px-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Click</kbd> node to focus</li>
                  <li>• <kbd className="px-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Drag</kbd> to rotate view</li>
                  <li>• <kbd className="px-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Scroll</kbd> to zoom</li>
                  <li>• <kbd className="px-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Right-click</kbd> to pan</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-green-600" />
                  Focus Mode
                </h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Selected node: <span className="text-blue-600 dark:text-blue-400">Bright & Large</span></li>
                  <li>• Connected nodes: <span className="text-green-600 dark:text-green-400">Highlighted</span></li>
                  <li>• Other nodes: <span className="text-gray-500">Dimmed</span></li>
                  <li>• Click empty space to reset</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-purple-600" />
                  Quick Actions
                </h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• <kbd className="px-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">F11</kbd> Fullscreen</li>
                  <li>• <kbd className="px-1 bg-gray-200 dark:bg-gray-700 rounded text-xs">Esc</kbd> Exit/Close</li>
                  <li>• Use search to find nodes</li>
                  <li>• Filter by node type</li>
                </ul>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  💡 <strong>Tip:</strong> Use the grid view for detailed node exploration, 3D view for relationship discovery
                </p>
                <button
                  onClick={() => setShowHelp(false)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                >
                  Hide Help
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Controls Bar */}
        {viewMode === 'nodes' && (
          <div className="flex-shrink-0 flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search nodes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 border border-gray-200 dark:border-gray-600 text-sm w-48"
                />
              </div>

              {/* Type Filter */}
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg border border-gray-200 dark:border-gray-600 text-sm"
              >
                <option value="all">All Types</option>
                {getNodeTypes().map(type => (
                  <option key={type} value={type}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              {/* Zoom Controls */}
              <div className="flex bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <button
                  onClick={handleZoomOut}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-l-lg transition-colors"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={handleResetZoom}
                  className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-sm font-medium border-x border-gray-200 dark:border-gray-600"
                  title="Reset Zoom"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  onClick={handleZoomIn}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-r-lg transition-colors"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>

              {/* Refresh */}
              <button
                onClick={loadGraphData}
                disabled={!isBackendHealthy}
                className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && viewMode === 'nodes' && (
          <div className="flex-shrink-0 p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Node Size
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={nodeSize}
                  onChange={(e) => setNodeSize(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Edge Thickness
                </label>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={edgeThickness}
                  onChange={(e) => setEdgeThickness(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showNodeLabels"
                  checked={showNodeLabels}
                  onChange={(e) => setShowNodeLabels(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="showNodeLabels" className="text-sm text-gray-700 dark:text-gray-300">
                  Node Labels
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showEdgeLabels"
                  checked={showEdgeLabels}
                  onChange={(e) => setShowEdgeLabels(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="showEdgeLabels" className="text-sm text-gray-700 dark:text-gray-300">
                  Edge Labels
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="flex-shrink-0 p-4 bg-red-50 dark:bg-red-900/20 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3" />
              <p className="text-red-800 dark:text-red-200 flex-1">{error}</p>
              <button
                onClick={loadGraphData}
                className="ml-3 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-8 h-8 border-3 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400 text-lg font-medium">Loading graph...</p>
                <p className="text-gray-500 dark:text-gray-500 text-sm mt-2">
                  Building knowledge connections from your documents
                </p>
              </div>
            </div>
          ) : viewMode === 'html' ? (
            <div className="h-full w-full">
              <ThreeJSGraph
                graphData={graphData}
                onNodeSelect={(node) => {
                  setSelectedNode(node);
                  // Add to history if not already the last item
                  if (selectedNodeHistory[selectedNodeHistory.length - 1] !== node.id) {
                    setSelectedNodeHistory(prev => [...prev.slice(-4), node.id]);
                  }
                }}
                onNodeDeselect={() => {
                  setSelectedNode(null);
                }}
                selectedNodeId={selectedNode?.id}
                className="w-full h-full"
              />
            </div>
          ) : (
            <div className="h-full flex">
              {/* Nodes Grid */}
              <div className="flex-1 overflow-auto p-6">
                {getFilteredNodes().length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center p-8">
                      <Network className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                        {graphData?.nodes.length === 0 ? 'No graph data available' : 'No nodes match your filters'}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        {graphData?.nodes.length === 0 
                          ? "Upload documents and query the notebook to generate the knowledge graph."
                          : "Try adjusting your search terms or filters."
                        }
                      </p>
                      {graphData?.nodes.length === 0 && (
                        <button
                          onClick={onClose}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                          Back to Notebook
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div 
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4"
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
                  >
                    {getFilteredNodes().map((node) => (
                      <div
                        key={node.id}
                        onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
                        className={`group p-4 rounded-xl cursor-pointer transition-all duration-200 border backdrop-blur-sm ${
                          selectedNode?.id === node.id
                            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 shadow-lg scale-105'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 hover:shadow-md hover:scale-102'
                        }`}
                        style={{
                          transform: selectedNode?.id === node.id ? `scale(${1.05 * nodeSize})` : `scale(${nodeSize})`,
                        }}
                      >
                        <div className="flex items-start gap-3 mb-3">
                          <div 
                            className={`w-3 h-3 rounded-full mt-1 flex-shrink-0 ${getNodeColor(node.type)} shadow-sm`}
                            style={{ transform: `scale(${nodeSize})` }}
                          ></div>
                          <div className="flex-1 min-w-0">
                            {showNodeLabels && (
                              <>
                                <div className="font-semibold text-gray-900 dark:text-white text-sm mb-1 truncate">
                                  {renderSafeValue(node.properties?.name || node.id)}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 capitalize">
                                  {node.type}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {selectedNode?.id === node.id && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 border-t border-gray-200 dark:border-gray-600 pt-3">
                            {Object.entries(node.properties || {}).slice(0, 3).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="font-medium capitalize">{key}:</span>
                                <span className="truncate ml-2">{renderSafeValue(value)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Node Details Sidebar */}
              {selectedNode && (
                <div className="w-80 bg-gray-50 dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-6 overflow-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Node Details</h3>
                    <button
                      onClick={() => setSelectedNode(null)}
                      className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                      <p className="text-gray-900 dark:text-white break-words">
                        {renderSafeValue(selectedNode.properties?.name || selectedNode.id)}
                      </p>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
                      <p className="text-gray-900 dark:text-white capitalize">{selectedNode.type}</p>
                    </div>
                    
                    {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
                      <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Properties</label>
                        <div className="space-y-2">
                          {Object.entries(selectedNode.properties).map(([key, value]) => (
                            <div key={key} className="text-sm">
                              <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">
                                {key}:
                              </span>
                              <p className="text-gray-900 dark:text-white break-words ml-2">
                                {renderSafeValue(value)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Enhanced Footer Stats */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-850 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-6 text-sm">
            {/* Basic Stats */}
            <div className="flex items-center gap-4">
              <span className="text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-white">{getFilteredNodes().length}</strong>
                {getFilteredNodes().length !== getGraphStats().nodes && (
                  <span className="text-gray-500">/{getGraphStats().nodes}</span>
                )} nodes
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-white">{getFilteredEdges().length}</strong>
                {getFilteredEdges().length !== getGraphStats().edges && (
                  <span className="text-gray-500">/{getGraphStats().edges}</span>
                )} connections
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-white">{getGraphStats().types}</strong> types
              </span>
            </div>

            {/* Active Filters */}
            <div className="flex items-center gap-2">
              {searchQuery && (
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs">
                  Search: "{searchQuery}"
                </span>
              )}
              {filterType !== 'all' && (
                <span className="px-2 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 rounded text-xs">
                  Type: {filterType}
                </span>
              )}
              {selectedNode && (
                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded text-xs">
                  Focused: {renderSafeValue(selectedNode.properties?.name || selectedNode.id)}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Most Connected Node */}
            {viewMode === 'html' && getMostConnectedNodes(1)[0] && (
              <div className="hidden lg:flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span>Hub:</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {renderSafeValue(getMostConnectedNodes(1)[0].properties?.name || getMostConnectedNodes(1)[0].id)}
                </span>
                <span className="text-blue-600 dark:text-blue-400">
                  ({getMostConnectedNodes(1)[0].connections} connections)
                </span>
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {/* View Mode Indicator */}
              <div className="text-xs text-gray-500 dark:text-gray-400">
                <span className="capitalize font-medium text-gray-700 dark:text-gray-300">
                  {viewMode === 'html' ? '3D View' : 'Grid View'}
                </span>
              </div>
              
              {/* Keyboard Shortcuts */}
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">F11</kbd>
                <span>Fullscreen</span>
                <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">Esc</kbd>
                <span>Close</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Use portal for fullscreen to ensure it appears above all other elements
  if (isFullscreen) {
    return createPortal(modalContent, document.body);
  }

  return modalContent;
};

export default GraphViewerModal;
