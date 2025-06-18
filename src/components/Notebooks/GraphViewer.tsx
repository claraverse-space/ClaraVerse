import React, { useState, useEffect } from 'react';
import { X, Network, ZoomIn, ZoomOut, RefreshCw, AlertCircle, Eye, EyeOff, Globe, Grid3X3 } from 'lucide-react';
import { claraNotebookService, GraphData } from '../../services/claraNotebookService';

interface GraphViewerProps {
  notebookId: string;
  onClose: () => void;
}

// Helper function to safely render unknown values
const renderSafeValue = (value: unknown): React.ReactNode => {
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

const GraphViewer: React.FC<GraphViewerProps> = ({ notebookId, onClose }) => {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isBackendHealthy, setIsBackendHealthy] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphData['nodes'][0] | null>(null);
  const [showNodeDetails, setShowNodeDetails] = useState(true);
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

  const handleReset = () => {
    setZoom(1);
    setSelectedNode(null);
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
      'organization': 'bg-purple-500',
      'location': 'bg-red-500',
      'concept': 'bg-yellow-500',
      'event': 'bg-pink-500',
      'default': 'bg-gray-500'
    };
    return colors[nodeType.toLowerCase()] || colors.default;
  };

  const renderGraphVisualization = () => {
    const filteredNodes = getFilteredNodes();
    const filteredEdges = getFilteredEdges();

    if (filteredNodes.length === 0) {
      return (
        <div className="text-center p-8">
          <Network className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No nodes to display
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            {filterType === 'all' 
              ? "Upload documents and chat with the notebook to generate the knowledge graph."
              : `No nodes of type "${filterType}" found.`
            }
          </p>
        </div>
      );
    }

    return (
      <div className="h-full flex">
        {/* Graph Area */}
        <div className="flex-1 relative overflow-auto bg-gray-50 dark:bg-gray-900">
          <div 
            className="p-8 min-h-full"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          >
            {/* Simple grid layout for nodes */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                           {filteredNodes.map((node) => (
               <div
                 key={node.id}
                 onClick={() => setSelectedNode(node)}
                 className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                   selectedNode?.id === node.id
                     ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                     : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                 } bg-white dark:bg-gray-800 shadow-sm hover:shadow-md`}
               >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-3 h-3 rounded-full ${getNodeColor(node.type)}`}></div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      {node.type}
                    </span>
                  </div>
                  <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-1 line-clamp-2">
                    {node.label}
                  </h4>
                  {node.properties?.description && (
                    <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-3">
                      {renderSafeValue(node.properties.description)}
                    </p>
                  )}
                  
                  {/* Connection count */}
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {filteredEdges.filter(edge => 
                      edge.source === node.id || edge.target === node.id
                    ).length} connections
                  </div>
                </div>
              ))}
            </div>

            {/* Connections visualization */}
            {filteredEdges.length > 0 && (
              <div className="mt-8 glassmorphic-card rounded-lg p-6 shadow-sm">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                  Relationships ({filteredEdges.length})
                </h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {filteredEdges.slice(0, 50).map((edge, index) => {
                    const sourceNode = filteredNodes.find(n => n.id === edge.source);
                    const targetNode = filteredNodes.find(n => n.id === edge.target);
                    
                    return (
                      <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="font-medium text-gray-900 dark:text-white truncate">
                              {sourceNode?.label || edge.source}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">→</span>
                            <span className="font-medium text-gray-900 dark:text-white truncate">
                              {targetNode?.label || edge.target}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {edge.relationship}
                          </div>
                        </div>
                        {edge.properties?.weight && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {typeof edge.properties.weight === 'number' 
                              ? edge.properties.weight.toFixed(2)
                              : renderSafeValue(edge.properties.weight)
                            }
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {filteredEdges.length > 50 && (
                    <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-2">
                      ... and {filteredEdges.length - 50} more relationships
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Node Details Panel */}
        {showNodeDetails && selectedNode && (
          <div className="w-80 border-l border-gray-200 dark:border-gray-700 glassmorphic-card p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-medium text-gray-900 dark:text-white">Node Details</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-3 h-3 rounded-full ${getNodeColor(selectedNode.type)}`}></div>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {selectedNode.label}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  {selectedNode.type}
                </div>
              </div>

              {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Properties</h4>
                  <div className="space-y-2">
                    {Object.entries(selectedNode.properties).map(([key, value]) => (
                      <div key={key} className="text-sm">
                                                 <div className="text-gray-600 dark:text-gray-400 capitalize">{key}:</div>
                         <div className="text-gray-900 dark:text-white break-words">
                           {renderSafeValue(value)}
                         </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Connected nodes */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Connections</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {filteredEdges
                    .filter(edge => edge.source === selectedNode.id || edge.target === selectedNode.id)
                    .map((edge, index) => {
                      const connectedNodeId = edge.source === selectedNode.id ? edge.target : edge.source;
                      const connectedNode = filteredNodes.find(n => n.id === connectedNodeId);
                      
                      return (
                        <div key={index} className="p-2 glassmorphic-card rounded text-sm">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {connectedNode?.label || connectedNodeId}
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400">
                            via {edge.relationship}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="glassmorphic-card rounded-lg shadow-xl w-full max-w-7xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Network className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Knowledge Graph
            </h2>
            {!isBackendHealthy && (
              <div className="flex items-center text-yellow-600 dark:text-yellow-400">
                <AlertCircle className="w-4 h-4 mr-1" />
                <span className="text-sm">Backend unavailable</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* View Mode Toggle - Centered */}
            <div className="flex items-center justify-center flex-1">
              <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                <button
                  onClick={() => setViewMode('nodes')}
                  className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                    viewMode === 'nodes' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  title="Node Grid View"
                >
                  <Grid3X3 className="w-4 h-4" />
                  <span>Nodes</span>
                </button>
                <button
                  onClick={() => setViewMode('html')}
                  className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                    viewMode === 'html' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                  title="Interactive Graph View"
                >
                  <Globe className="w-4 h-4" />
                  <span>Graph</span>
                </button>
              </div>
            </div>

            {/* Right side controls */}
            <div className="flex items-center gap-2">
              {/* Filter dropdown - only show in nodes view */}
              {viewMode === 'nodes' && graphData && graphData.nodes.length > 0 && (
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Types</option>
                  {getNodeTypes().map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              )}
              
              {/* Node details toggle - only show in nodes view */}
              {viewMode === 'nodes' && (
                <button
                  onClick={() => setShowNodeDetails(!showNodeDetails)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title={showNodeDetails ? "Hide details" : "Show details"}
                >
                  {showNodeDetails ? (
                    <EyeOff className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  )}
                </button>
              )}
              
              {/* Zoom controls - only show in nodes view */}
              {viewMode === 'nodes' && (
                <>
                  <button
                    onClick={handleZoomOut}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Zoom out"
                  >
                    <ZoomOut className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                  
                  <span className="text-sm text-gray-600 dark:text-gray-400 px-2">
                    {Math.round(zoom * 100)}%
                  </span>
                  
                  <button
                    onClick={handleZoomIn}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Zoom in"
                  >
                    <ZoomIn className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                  
                  <button
                    onClick={handleReset}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="Reset view"
                  >
                    <RefreshCw className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="px-6 py-3 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
            <div className="flex items-center">
              <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mr-2" />
              <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
              {isBackendHealthy && (
                <button
                  onClick={loadGraphData}
                  className="ml-auto text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 text-sm underline"
                >
                  Try again
                </button>
              )}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 relative overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400">Loading knowledge graph...</p>
              </div>
            </div>
          ) : viewMode === 'html' ? (
            <div className="h-full w-full">
              {isLoadingHtml ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">Loading interactive graph...</p>
                  </div>
                </div>
              ) : htmlContent ? (
                <iframe
                  srcDoc={htmlContent}
                  className="w-full h-full border-0"
                  title="Interactive Knowledge Graph"
                  sandbox="allow-scripts allow-same-origin"
                  onLoad={() => {
                    console.log('Graph HTML loaded successfully');
                  }}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <p className="text-gray-600 dark:text-gray-400">Failed to load interactive graph</p>
                    <button
                      onClick={loadHtmlGraph}
                      className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            renderGraphVisualization()
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {graphData && (
              <>
                Showing {getFilteredNodes().length} of {graphData.nodes.length} nodes, 
                {getFilteredEdges().length} of {graphData.edges.length} connections
                {filterType !== 'all' && ` (filtered by ${filterType})`}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadGraphData}
              disabled={!isBackendHealthy}
              className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GraphViewer; 