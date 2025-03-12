import { Node, Edge } from 'reactflow';
import { getNodeExecutor, hasNodeExecutor } from './nodeExecutors/NodeExecutorRegistry';

interface ExecutionPlan {
  nodes: Record<string, any>;
  edges: Record<string, any>;
  nodeInputs: Record<string, any>;
  executionOrder: string[];
}

export const generateExecutionPlan = (nodes: Node[], edges: Edge[]): ExecutionPlan => {
  const nodeMap: Record<string, any> = {};
  const edgeMap: Record<string, any> = {};
  const nodeInputs: Record<string, any> = {};
  const visited: Record<string, boolean> = {};
  const executionOrder: string[] = [];

  // Build node and edge maps for quick lookup
  nodes.forEach(node => {
    nodeMap[node.id] = node;
    nodeInputs[node.id] = {};
  });

  edges.forEach(edge => {
    if (!edgeMap[edge.target]) {
      edgeMap[edge.target] = [];
    }
    edgeMap[edge.target].push(edge);
  });

  // Helper function for depth-first traversal
  const visit = (nodeId: string) => {
    if (visited[nodeId]) return;
    visited[nodeId] = true;

    // Visit all parents first
    edges
      .filter(edge => edge.target === nodeId)
      .forEach(edge => {
        visit(edge.source);
      });

    // Add node to execution order after all dependencies are resolved
    executionOrder.push(nodeId);
  };

  // Start traversal from nodes without outgoing edges (terminal nodes)
  const terminalNodes = nodes.filter(
    node => !edges.some(edge => edge.source === node.id)
  );

  // If there are no terminal nodes, start from any node
  if (terminalNodes.length > 0) {
    terminalNodes.forEach(node => visit(node.id));
  } else if (nodes.length > 0) {
    visit(nodes[0].id);
  }

  // If not all nodes were visited, visit remaining nodes
  nodes.forEach(node => {
    if (!visited[node.id]) {
      visit(node.id);
    }
  });

  return {
    nodes: nodeMap,
    edges: edgeMap,
    nodeInputs,
    executionOrder
  };
};

export const executeFlow = async (
  plan: ExecutionPlan,
  updateNodeOutput: (nodeId: string, output: any) => void
) => {
  console.log('Executing flow with plan:', plan);

  // Map to store the output of each node
  const nodeOutputs: Record<string, any> = {};

  // Execute nodes in order
  for (const nodeId of plan.executionOrder) {
    const node = plan.nodes[nodeId];
    
    try {
      console.log(`Executing node: ${nodeId}, type: ${node.type}`);
      
      // Get all inputs for this node
      if (plan.edges[nodeId]) {
        for (const edge of plan.edges[nodeId]) {
          const sourceNodeId = edge.source;
          const sourceOutput = nodeOutputs[sourceNodeId];
          
          // Handle different input types based on source handle
          if (edge.sourceHandle) {
            plan.nodeInputs[nodeId][edge.sourceHandle] = sourceOutput;
          } else {
            plan.nodeInputs[nodeId][edge.targetHandle || 'default'] = sourceOutput;
          }
        }
      }
      
      // Look up the executor for this node type
      if (hasNodeExecutor(node.type)) {
        const executor = getNodeExecutor(node.type);
        const result = await executor?.execute({
          node,
          inputs: plan.nodeInputs[nodeId],
          updateNodeOutput
        });
        
        nodeOutputs[nodeId] = result;
        console.log(`Node ${nodeId} executed successfully with result:`, result);
      } else {
        throw new Error(`No executor found for node type: ${node.type}`);
      }
    } catch (error) {
      console.error(`Error executing node ${nodeId}:`, error);
      nodeOutputs[nodeId] = `Error: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  return nodeOutputs;
};