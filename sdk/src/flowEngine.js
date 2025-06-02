/**
 * Flow Engine - Handles flow execution with proper node ordering and data flow
 * Updated to match Agent Builder UI execution logic exactly
 */

export class FlowEngine {
  constructor(logger, nodeExecutor, validator) {
    this.logger = logger;
    this.nodeExecutor = nodeExecutor;
    this.validator = validator;
  }

  /**
   * Execute a complete flow
   * @param {Object} flowData - Flow definition
   * @param {Object} inputs - Input values for the flow
   * @returns {Promise<Object>} Flow execution result
   */
  async executeFlow(flowData, inputs = {}) {
    const { nodes, connections } = flowData;

    if (!nodes || nodes.length === 0) {
      throw new Error('Flow has no nodes to execute');
    }

    this.logger.info('Starting flow execution', { nodeCount: nodes.length, connectionCount: connections?.length || 0 });

    try {
      // Get execution order using the same topological sort as the UI
      const executionOrder = this.getExecutionOrder(nodes, connections || []);
      this.logger.info('Execution order determined', { 
        order: executionOrder.map(n => `${n.name} (${n.type})`).join(' → ')
      });
      
      // Initialize results storage (like localResults in UI)
      const nodeResults = new Map();
      
      // Map flow inputs to input nodes (same as UI logic)
      const flowInputMapping = this.mapFlowInputsToNodes(inputs, nodes);
      for (const [nodeId, inputValue] of Object.entries(flowInputMapping)) {
        nodeResults.set(nodeId, inputValue);
      }

      // Execute nodes in order (exactly like UI)
      for (const node of executionOrder) {
        await this.executeNodeInFlow(node, nodes, connections || [], nodeResults);
      }

      // Collect outputs (same as UI)
      const outputs = this.collectFlowOutputs(nodes, nodeResults);
      
      this.logger.info('Flow execution completed successfully', { outputs });
      return outputs;

    } catch (error) {
      this.logger.error('Flow execution failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get execution order using Kahn's algorithm (same as Agent Builder UI)
   * @param {Array} nodes - Flow nodes
   * @param {Array} connections - Flow connections
   * @returns {Array} Ordered list of nodes
   */
  getExecutionOrder(nodes, connections) {
    const inDegree = {};
    const adjList = {};
    
    // Initialize (same as UI)
    nodes.forEach(node => {
      inDegree[node.id] = 0;
      adjList[node.id] = [];
    });
    
    // Build adjacency list and count incoming edges (same as UI)
    connections.forEach(conn => {
      adjList[conn.sourceNodeId].push(conn.targetNodeId);
      inDegree[conn.targetNodeId]++;
    });
    
    // Topological sort using Kahn's algorithm (same as UI)
    const queue = [];
    const result = [];
    
    // Start with nodes that have no incoming edges
    Object.keys(inDegree).forEach(nodeId => {
      if (inDegree[nodeId] === 0) {
        queue.push(nodeId);
      }
    });
    
    while (queue.length > 0) {
      const nodeId = queue.shift();
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        result.push(node);
      }
      
      adjList[nodeId].forEach(targetId => {
        inDegree[targetId]--;
        if (inDegree[targetId] === 0) {
          queue.push(targetId);
        }
      });
    }
    
    return result;
  }

  /**
   * Map flow inputs to input nodes (same logic as UI)
   * @param {Object} inputs - Flow inputs
   * @param {Array} nodes - Flow nodes
   * @returns {Object} Mapped inputs
   */
  mapFlowInputsToNodes(inputs, nodes) {
    const mapped = {};

    // Find input nodes and map values (same as UI logic)
    for (const node of nodes) {
      if (node.type === 'input') {
        // Try different input mapping strategies (same as UI)
        const inputValue = inputs[node.id] || 
                          inputs[node.name] || 
                          inputs[node.data?.label] ||
                          node.data?.value ||
                          node.data?.defaultValue;
        
        if (inputValue !== undefined) {
          mapped[node.id] = inputValue;
        }
      }
    }

    this.logger.debug('Flow inputs mapped', { mapped });
    return mapped;
  }

  /**
   * Get inputs for a node from connected outputs (exact same logic as UI)
   * @param {string} nodeId - Target node ID
   * @param {Array} nodes - All nodes
   * @param {Array} connections - All connections
   * @param {Map} nodeResults - Current node results
   * @returns {Object} Node inputs
   */
  getNodeInputs(nodeId, nodes, connections, nodeResults) {
    const inputs = {};
    
    this.logger.debug(`Getting inputs for node ${nodeId}`);
    
    // Find the target node to understand its input definitions (same as UI)
    const targetNode = nodes.find(n => n.id === nodeId);
    
    connections.forEach(conn => {
      if (conn.targetNodeId === nodeId) {
        const sourceNodeResult = nodeResults.get(conn.sourceNodeId);
        
        if (sourceNodeResult !== undefined) {
          // Extract the specific output port value from the source result (same as UI)
          let sourceValue = sourceNodeResult;
          
          // If the source result is an object and we have a specific source port, extract that value
          if (typeof sourceNodeResult === 'object' && sourceNodeResult !== null && conn.sourcePortId) {
            // Find the source node to understand its output structure
            const sourceNode = nodes.find(n => n.id === conn.sourceNodeId);
            if (sourceNode) {
              const sourceOutput = sourceNode.outputs?.find(output => output.id === conn.sourcePortId);
              if (sourceOutput && sourceNodeResult.hasOwnProperty(sourceOutput.id)) {
                sourceValue = sourceNodeResult[sourceOutput.id];
                this.logger.debug(`Extracted specific output port ${conn.sourcePortId}: ${sourceValue}`);
              }
            }
          }
          
          // Map the target port ID to the logical input name (same as UI)
          if (targetNode) {
            const targetInput = targetNode.inputs?.find(input => input.id === conn.targetPortId);
            if (targetInput) {
              // Use the logical input name from the node definition
              const logicalName = targetInput.id;
              inputs[logicalName] = sourceValue;
              
              // Also add common fallback mappings for execution functions (same as UI)
              if (logicalName === 'input' || targetInput.name?.toLowerCase().includes('input')) {
                inputs.input = sourceValue;
              }
              if (logicalName === 'user' || targetInput.name?.toLowerCase().includes('user')) {
                inputs.user = sourceValue;
              }
              if (logicalName === 'system' || targetInput.name?.toLowerCase().includes('system')) {
                inputs.system = sourceValue;
              }
              if (logicalName === 'context' || targetInput.name?.toLowerCase().includes('context')) {
                inputs.context = sourceValue;
              }
              if (logicalName === 'text' || targetInput.name?.toLowerCase().includes('text')) {
                inputs.text = sourceValue;
                inputs.input = sourceValue; // Text nodes often expect 'input'
              }
            }
          }
          
          // Fallback: also store with the original port ID (same as UI)
          inputs[conn.targetPortId] = sourceValue;
        }
      }
    });
    
    this.logger.debug(`Final inputs for ${nodeId}:`, inputs);
    return inputs;
  }

  /**
   * Execute a single node within the flow context (same as UI logic)
   * @param {Object} node - Node to execute
   * @param {Array} nodes - All nodes
   * @param {Array} connections - All connections
   * @param {Map} nodeResults - Node results storage
   */
  async executeNodeInFlow(node, nodes, connections, nodeResults) {
    this.logger.debug(`Executing node: ${node.name} (${node.type})`);

    try {
      // Get inputs for this node using current results (same as UI)
      const nodeInputs = this.getNodeInputs(node.id, nodes, connections, nodeResults);
      
      // For input nodes, check if we already have a result stored
      if (node.type === 'input' && nodeResults.has(node.id)) {
        // Use the stored input value
        const storedValue = nodeResults.get(node.id);
        this.logger.debug(`Using stored input value for ${node.name}:`, storedValue);
        nodeResults.set(node.id, storedValue);
        return;
      }
      
      // Execute the node (same as UI)
      const result = await this.nodeExecutor.executeNode(node, nodeInputs);
      
      // Store result for dependent nodes (same as UI)
      nodeResults.set(node.id, result);
      
      this.logger.debug(`Node execution completed: ${node.name}`, { result });

    } catch (error) {
      this.logger.error(`Node execution failed: ${node.name}`, { error: error.message });
      throw new Error(`Node '${node.name}' (${node.id}) execution failed: ${error.message}`);
    }
  }

  /**
   * Collect flow outputs from output nodes (same logic as UI)
   * @param {Array} nodes - Flow nodes
   * @param {Map} nodeResults - Node results storage
   * @returns {Object} Flow outputs
   */
  collectFlowOutputs(nodes, nodeResults) {
    const outputs = {};

    // Collect from output nodes (same as UI)
    for (const node of nodes) {
      if (node.type === 'output') {
        const result = nodeResults.get(node.id);
        if (result !== undefined) {
          const outputKey = node.data?.label || node.name || node.id;
          outputs[outputKey] = result;
        }
      }
    }

    // If no output nodes, return all node results (same as UI)
    if (Object.keys(outputs).length === 0) {
      const results = {};
      for (const [nodeId, result] of nodeResults) {
        const node = nodes.find(n => n.id === nodeId);
        if (node && node.type !== 'input') {
          results[node.name || nodeId] = result;
        }
      }
      return results;
    }

    return outputs;
  }

  /**
   * Validate flow before execution
   * @param {Object} flowData - Flow definition
   * @returns {Object} Validation result
   */
  validateFlow(flowData) {
    return this.validator.validateFlow(flowData);
  }

  /**
   * Get execution statistics for a flow
   * @param {Object} flowData - Flow definition
   * @returns {Object} Flow statistics
   */
  getFlowStats(flowData) {
    const { nodes = [], connections = [] } = flowData;
    
    const inputNodes = nodes.filter(n => n.type === 'input').length;
    const outputNodes = nodes.filter(n => n.type === 'output').length;
    const processingNodes = nodes.length - inputNodes - outputNodes;
    
    return {
      totalNodes: nodes.length,
      inputNodes,
      outputNodes,
      processingNodes,
      connections: connections.length,
      complexity: this.calculateFlowComplexity(nodes, connections)
    };
  }

  /**
   * Calculate flow complexity score
   * @param {Array} nodes - Flow nodes
   * @param {Array} connections - Flow connections
   * @returns {number} Complexity score
   */
  calculateFlowComplexity(nodes, connections) {
    // Simple complexity calculation based on nodes and connections
    const nodeComplexity = nodes.length;
    const connectionComplexity = connections.length * 0.5;
    const branchingFactor = Math.max(1, connections.length / Math.max(1, nodes.length));
    
    return Math.round(nodeComplexity + connectionComplexity + branchingFactor);
  }

  /**
   * Create a subflow from a portion of the main flow
   * @param {Object} flowData - Main flow data
   * @param {Array} nodeIds - Node IDs to include in subflow
   * @returns {Object} Subflow data
   */
  createSubflow(flowData, nodeIds) {
    const { nodes, connections, customNodes } = flowData;
    
    // Filter nodes
    const subflowNodes = nodes.filter(node => nodeIds.includes(node.id));
    
    // Filter connections that are between selected nodes
    const subflowConnections = connections.filter(conn => 
      nodeIds.includes(conn.sourceNodeId) && nodeIds.includes(conn.targetNodeId)
    );

    return {
      ...flowData,
      nodes: subflowNodes,
      connections: subflowConnections,
      customNodes: customNodes || []
    };
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use getExecutionOrder instead
   */
  determineExecutionOrder(executionGraph) {
    // Convert Map format to array format
    const nodes = Array.from(executionGraph.keys()).map(nodeId => ({ id: nodeId }));
    const connections = [];
    
    for (const [nodeId, nodeInfo] of executionGraph) {
      for (const dep of nodeInfo.dependencies) {
        connections.push({ sourceNodeId: dep, targetNodeId: nodeId });
      }
    }
    
    return this.getExecutionOrder(nodes, connections).map(node => node.id);
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use mapFlowInputsToNodes instead
   */
  mapFlowInputs(inputs, nodes) {
    return this.mapFlowInputsToNodes(inputs, nodes);
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use collectFlowOutputs instead
   */
  collectNodeInputs(nodeInfo, nodeResults) {
    // This is the old method that had the bug
    // Now it properly handles input node results
    const inputs = {};

    for (const [targetPort, connectionInfo] of nodeInfo.inputs) {
      const { sourceNodeId, sourcePortId } = connectionInfo;
      const sourceResult = nodeResults.get(sourceNodeId);

      if (sourceResult !== undefined) {
        // For input nodes, the result is typically a simple value
        // For other nodes, check if result has the specific port property
        if (typeof sourceResult === 'object' && sourceResult !== null && !Array.isArray(sourceResult)) {
          // If it's an object, try to get the specific port value
          if (sourceResult.hasOwnProperty(sourcePortId)) {
            inputs[targetPort] = sourceResult[sourcePortId];
          } else if (sourcePortId === 'output' && Object.keys(sourceResult).length === 1) {
            // If looking for 'output' port and object has only one property, use that value
            inputs[targetPort] = Object.values(sourceResult)[0];
          } else {
            // Use the entire result as fallback
            inputs[targetPort] = sourceResult;
          }
        } else {
          // For primitive values (strings, numbers, booleans) or arrays, use directly
          inputs[targetPort] = sourceResult;
        }
      }
    }

    return inputs;
  }
} 