import { useEffect, useRef, useState } from 'react';

export interface ThreeJSGraphMessage {
  type: 'nodeSelected' | 'nodeDeselected' | 'graphLoaded' | 'error';
  data?: any;
}

export const useThreeJSGraph = (
  containerRef: React.RefObject<HTMLIFrameElement>,
  graphData: any,
  onNodeSelect?: (nodeData: any) => void
) => {
  const [isReady, setIsReady] = useState(false);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  useEffect(() => {
    const iframe = containerRef.current;
    if (!iframe) return;

    const handleMessage = (event: MessageEvent<ThreeJSGraphMessage>) => {
      if (event.source !== iframe.contentWindow) return;

      const { type, data } = event.data;

      switch (type) {
        case 'graphLoaded':
          setIsReady(true);
          break;
        case 'nodeSelected':
          setSelectedNode(data);
          onNodeSelect?.(data);
          break;
        case 'nodeDeselected':
          setSelectedNode(null);
          onNodeSelect?.(null);
          break;
        case 'error':
          console.error('Three.js graph error:', data);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [containerRef, onNodeSelect]);

  const sendDataToGraph = (data: any) => {
    const iframe = containerRef.current;
    if (iframe && isReady) {
      iframe.contentWindow?.postMessage({
        type: 'updateGraph',
        data
      }, '*');
    }
  };

  const centerOnNode = (nodeId: string) => {
    const iframe = containerRef.current;
    if (iframe && isReady) {
      iframe.contentWindow?.postMessage({
        type: 'centerOnNode',
        data: { nodeId }
      }, '*');
    }
  };

  const resetView = () => {
    const iframe = containerRef.current;
    if (iframe && isReady) {
      iframe.contentWindow?.postMessage({
        type: 'resetView',
        data: {}
      }, '*');
    }
  };

  return {
    isReady,
    selectedNode,
    sendDataToGraph,
    centerOnNode,
    resetView
  };
};
