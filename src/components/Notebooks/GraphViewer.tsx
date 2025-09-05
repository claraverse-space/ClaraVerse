import React, { useState, useEffect } from 'react';
import { Network, ZoomIn, ZoomOut, RefreshCw, AlertCircle, Globe, Grid3X3, Maximize2 } from 'lucide-react';
import { claraNotebookService, GraphData } from '../../services/claraNotebookService';

interface GraphViewerProps {
  notebookId: string;
  onClose?: () => void;
  onViewFull?: () => void;
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

const GraphViewer: React.FC<GraphViewerProps> = ({ notebookId, onViewFull }) => {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isBackendHealthy, setIsBackendHealthy] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphData['nodes'][0] | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'nodes' | 'html'>('nodes');
  const [htmlContent, setHtmlContent] = useState<string | null>(null);
  const [isLoadingHtml, setIsLoadingHtml] = useState(false);

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

  // Load HTML content when switching to HTML view
  useEffect(() => {
    if (viewMode === 'html' && isBackendHealthy && !htmlContent) {
      loadHtmlGraph();
    }
  }, [viewMode, isBackendHealthy, htmlContent]);

  const loadHtmlGraph = async () => {
    if (!isBackendHealthy) {
      setError('Notebook backend is not available');
      return;
    }

    setIsLoadingHtml(true);
    try {
      const response = await fetch(claraNotebookService.getGraphHtmlUrl(notebookId));
      if (!response.ok) {
        throw new Error(`Failed to load HTML graph: ${response.statusText}`);
      }
      const html = await response.text();
      setHtmlContent(html);
    } catch (err) {
      console.error('Failed to load HTML graph:', err);
      setError(err instanceof Error ? err.message : 'Failed to load HTML graph');
    } finally {
      setIsLoadingHtml(false);
    }
  };

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
      // Set empty graph data as fallback
      setGraphData({ nodes: [], edges: [] });
    } finally {
      setIsLoading(false);
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.1, 2));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 0.5));
  };

  // Get unique node types for filtering
  const getNodeTypes = () => {
    if (!graphData) return [];
    const types = new Set(graphData.nodes.map(node => node.type));
    return Array.from(types);
  };

  // Filter nodes based on type
  const getFilteredNodes = () => {
    if (!graphData) return [];
    if (filterType === 'all') return graphData.nodes;
    return graphData.nodes.filter(node => node.type === filterType);
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
    const colors: Record<string, string> = {
      'entity': 'bg-blue-500',
      'person': 'bg-green-500',
      'organization': 'bg-blue-600',
      'location': 'bg-red-500',
      'concept': 'bg-gray-500',
      'event': 'bg-sakura-500',
      'default': 'bg-gray-500'
    };
    return colors[nodeType.toLowerCase()] || colors.default;
  };

  return (
    <div className="h-full flex flex-col bg-transparent">
      {/* Compact Header */}
      <div className="flex-shrink-0 p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Network className="w-4 h-4 text-sakura-500" />
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">Graph</h3>
          </div>
          
            {/* Compact Controls */}
            <div className="flex items-center gap-1">
              {/* View Full Button */}
              <button
                onClick={() => onViewFull?.()}
                className="p-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs transition-colors"
                title="View Full Graph"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
              
              {/* View Mode Toggle */}
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded p-0.5">
                <button
                  onClick={() => setViewMode('nodes')}
                  className={`p-1 rounded text-xs transition-colors ${
                    viewMode === 'nodes'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                  title="Grid View"
                >
                  <Grid3X3 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => setViewMode('html')}
                  className={`p-1 rounded text-xs transition-colors ${
                    viewMode === 'html'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                  title="Interactive View"
                >
                  <Globe className="w-3 h-3" />
                </button>
              </div>            {viewMode === 'nodes' && (
              <>
                {/* Type Filter */}
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded text-xs border border-gray-200 dark:border-gray-600"
                >
                  <option value="all">All</option>
                  {getNodeTypes().map(type => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>

                {/* Zoom */}
                <div className="flex bg-gray-100 dark:bg-gray-700 rounded">
                  <button
                    onClick={handleZoomOut}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-l transition-colors"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3 h-3" />
                  </button>
                  <button
                    onClick={handleZoomIn}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-r transition-colors"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>
                </div>
              </>
            )}
            
            <button
              onClick={loadGraphData}
              disabled={!isBackendHealthy}
              className="p-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs">
            <div className="flex items-center">
              <AlertCircle className="h-3 w-3 text-red-600 dark:text-red-400 mr-1" />
              <p className="text-red-800 dark:text-red-200 flex-1">{error}</p>
            </div>
          </div>
        )}
      </div>

      {/* Content - Optimized for sidebar layout */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-6 h-6 border-2 border-sakura-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-gray-600 dark:text-gray-400 text-xs">Loading...</p>
            </div>
          </div>
        ) : viewMode === 'html' ? (
          <div className="h-full w-full">
            {isLoadingHtml ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-6 h-6 border-2 border-sakura-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <p className="text-gray-600 dark:text-gray-400 text-xs">Loading interactive graph...</p>
                </div>
              </div>
            ) : htmlContent ? (
              <iframe
                srcDoc={htmlContent}
                className="w-full h-full border-0"
                title="Interactive Knowledge Graph"
                sandbox="allow-scripts allow-same-origin"
              />
            ) : (
              <div className="flex items-center justify-center h-full p-4">
                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-400 text-xs mb-2">Failed to load interactive graph</p>
                  <button
                    onClick={loadHtmlGraph}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Responsive Nodes Grid */}
            <div className="flex-1 overflow-y-auto p-3">
              {getFilteredNodes().length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center p-4">
                    <Network className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                      No nodes to display
                    </h4>
                    <p className="text-gray-600 dark:text-gray-400 text-xs">
                      {filterType === 'all' 
                        ? "Upload documents to generate the graph."
                        : `No "${filterType}" nodes found.`
                      }
                    </p>
                  </div>
                </div>
              ) : (
                <div 
                  className="grid grid-cols-1 gap-2"
                  style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
                >
                  {getFilteredNodes().map((node) => (
                    <div
                      key={node.id}
                      onClick={() => setSelectedNode(selectedNode?.id === node.id ? null : node)}
                      className={`p-2 rounded-lg cursor-pointer transition-all duration-200 border ${
                        selectedNode?.id === node.id
                          ? 'bg-sakura-50 dark:bg-sakura-900/20 border-sakura-200 dark:border-sakura-700'
                          : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${getNodeColor(node.type)}`}></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                              {node.type}
                            </span>
                          </div>
                          <h4 className="font-medium text-gray-900 dark:text-white text-xs mb-1 line-clamp-2">
                            {node.label}
                          </h4>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400">
                            {getFilteredEdges().filter(edge => 
                              edge.source === node.id || edge.target === node.id
                            ).length} connections
                          </div>
                          
                          {/* Expanded details for selected node */}
                          {selectedNode?.id === node.id && (
                            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                              {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
                                <div className="mb-2">
                                  <div className="text-[10px] font-medium text-gray-900 dark:text-white mb-1">Properties</div>
                                  <div className="space-y-1">
                                    {Object.entries(selectedNode.properties).slice(0, 3).map(([key, value]) => (
                                      <div key={key} className="text-[10px]">
                                        <span className="text-gray-600 dark:text-gray-400 capitalize">{key}:</span>
                                        <span className="text-gray-900 dark:text-white ml-1 break-words">
                                          {String(renderSafeValue(value)).slice(0, 50)}
                                          {String(renderSafeValue(value)).length > 50 ? '...' : ''}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Connected nodes */}
                              <div>
                                <div className="text-[10px] font-medium text-gray-900 dark:text-white mb-1">Connected to</div>
                                <div className="space-y-1">
                                  {getFilteredEdges()
                                    .filter(edge => edge.source === selectedNode.id || edge.target === selectedNode.id)
                                    .slice(0, 3)
                                    .map((edge, index) => {
                                      const connectedNodeId = edge.source === selectedNode.id ? edge.target : edge.source;
                                      const connectedNode = getFilteredNodes().find(n => n.id === connectedNodeId);
                                      
                                      return (
                                        <div key={index} className="p-1 bg-gray-50 dark:bg-gray-700 rounded text-[10px]">
                                          <div className="font-medium text-gray-900 dark:text-white truncate">
                                            {connectedNode?.label || connectedNodeId}
                                          </div>
                                          <div className="text-gray-600 dark:text-gray-400">
                                            via {edge.relationship}
                                          </div>
                                        </div>
                                      );
                                    })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Compact Connections Footer */}
            {getFilteredEdges().length > 0 && (
              <div className="flex-shrink-0 p-3 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                <div className="text-[10px] font-medium text-gray-900 dark:text-white mb-1">
                  Relationships ({getFilteredEdges().length})
                </div>
                <div className="space-y-1 max-h-20 overflow-y-auto">
                  {getFilteredEdges().slice(0, 5).map((edge, index) => {
                    const sourceNode = getFilteredNodes().find(n => n.id === edge.source);
                    const targetNode = getFilteredNodes().find(n => n.id === edge.target);
                    
                    return (
                      <div key={index} className="text-[10px] text-gray-600 dark:text-gray-400">
                        <span className="font-medium">{sourceNode?.label || edge.source}</span>
                        <span className="mx-1">→</span>
                        <span className="font-medium">{targetNode?.label || edge.target}</span>
                        <span className="text-gray-500 dark:text-gray-500 ml-1">({edge.relationship})</span>
                      </div>
                    );
                  })}
                  {getFilteredEdges().length > 5 && (
                    <div className="text-[10px] text-gray-500 dark:text-gray-400">
                      ... and {getFilteredEdges().length - 5} more
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Compact Footer */}
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="text-[10px] text-gray-600 dark:text-gray-400">
          {graphData && (
            <>
              {getFilteredNodes().length} nodes, {getFilteredEdges().length} connections
            </>
          )}
        </div>
        <div className="text-[10px] text-gray-500 dark:text-gray-400">
          {Math.round(zoom * 100)}%
        </div>
      </div>
    </div>
  );
};

export default GraphViewer; 