/**
 * Clara Flow SDK - Main Entry Point
 * Lightweight JavaScript SDK for running Clara agent flows
 */

import { FlowValidator } from './validator.js';
import { NodeExecutor } from './nodeExecutor.js';
import { FlowEngine } from './flowEngine.js';
import { CustomNodeManager } from './customNodeManager.js';
import { Logger } from './logger.js';

/**
 * Main class for executing Clara flows
 */
export class ClaraFlowRunner {
  constructor(options = {}) {
    this.options = {
      enableLogging: options.enableLogging || false,
      timeout: options.timeout || 30000,
      sandbox: options.sandbox !== false, // default true
      maxNodes: options.maxNodes || 1000,
      maxDepth: options.maxDepth || 100,
      ...options
    };

    // Initialize components
    this.logger = new Logger(this.options.enableLogging);
    this.validator = new FlowValidator(this.logger);
    this.customNodeManager = new CustomNodeManager(this.logger, this.options.sandbox);
    this.nodeExecutor = new NodeExecutor(this.logger, this.customNodeManager);
    this.flowEngine = new FlowEngine(this.logger, this.nodeExecutor, this.validator);
    
    // Execution state
    this.isExecuting = false;
    this.currentExecution = null;
    this.executionLogs = [];
  }

  /**
   * Execute a complete flow with given inputs
   * @param {Object} flowData - The exported flow data (supports both Agent Studio export format and direct flow format)
   * @param {Object} inputs - Input values for the flow
   * @returns {Promise<Object>} Flow execution result
   */
  async executeFlow(flowData, inputs = {}) {
    if (this.isExecuting) {
      throw new Error('Another flow is already executing');
    }

    this.isExecuting = true;
    this.executionLogs = [];
    
    try {
      // Auto-detect and normalize format
      const normalizedFlowData = this.normalizeFlowFormat(flowData);
      
      this.logger.info('Starting flow execution', { 
        flowName: normalizedFlowData.name,
        nodeCount: normalizedFlowData.nodes?.length || 0,
        customNodeCount: normalizedFlowData.customNodes?.length || 0
      });

      // Validate flow structure
      const validation = this.validator.validateFlow(normalizedFlowData);
      if (!validation.isValid) {
        throw this.createError('VALIDATION_ERROR', `Flow validation failed: ${validation.errors.join(', ')}`);
      }

      // Register custom nodes
      if (normalizedFlowData.customNodes && normalizedFlowData.customNodes.length > 0) {
        await this.customNodeManager.registerNodes(normalizedFlowData.customNodes);
        this.logger.info(`Registered ${normalizedFlowData.customNodes.length} custom nodes`);
      }

      // Execute flow with timeout
      const executionPromise = this.flowEngine.executeFlow(normalizedFlowData, inputs);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(this.createError('TIMEOUT_ERROR', 'Flow execution timed out')), this.options.timeout);
      });

      const result = await Promise.race([executionPromise, timeoutPromise]);

      this.logger.info('Flow execution completed successfully', { result });
      return result;

    } catch (error) {
      this.logger.error('Flow execution failed', { error: error.message, stack: error.stack });
      throw error;
    } finally {
      this.isExecuting = false;
      this.currentExecution = null;
    }
  }

  /**
   * Normalize flow format to handle both Agent Studio export format and direct flow format
   * @private
   * @param {Object} flowData - Raw flow data
   * @returns {Object} Normalized flow data
   */
  normalizeFlowFormat(flowData) {
    // Check if this is an Agent Studio export format (has nested 'flow' property)
    if (flowData.format === 'clara-sdk' && flowData.flow) {
      this.logger.debug('Detected Agent Studio export format, extracting flow data');
      
      return {
        ...flowData.flow,
        version: flowData.version || flowData.flow.version || '1.0.0',
        connections: flowData.flow.connections || [],
        customNodes: flowData.customNodes || []
      };
    }
    
    // Check if this is a nested format without explicit format field
    if (flowData.flow && !flowData.name && !flowData.nodes) {
      this.logger.debug('Detected nested flow format, extracting flow data');
      
      return {
        ...flowData.flow,
        version: flowData.version || flowData.flow.version || '1.0.0',
        connections: flowData.flow.connections || [],
        customNodes: flowData.customNodes || []
      };
    }

    // Direct flow format - ensure all required fields exist
    return {
      ...flowData,
      version: flowData.version || '1.0.0',
      connections: flowData.connections || [],
      customNodes: flowData.customNodes || []
    };
  }

  /**
   * Execute a single node
   * @param {Object} nodeData - Node configuration
   * @param {Object} inputs - Input values for the node
   * @returns {Promise<any>} Node execution result
   */
  async executeNode(nodeData, inputs = {}) {
    this.logger.info('Executing single node', { nodeType: nodeData.type, nodeName: nodeData.name });
    
    try {
      const result = await this.nodeExecutor.executeNode(nodeData, inputs);
      this.logger.info('Node execution completed', { result });
      return result;
    } catch (error) {
      this.logger.error('Node execution failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Validate flow structure and dependencies
   * @param {Object} flowData - The flow data to validate
   * @returns {Object} Validation result
   */
  validateFlow(flowData) {
    return this.validator.validateFlow(flowData);
  }

  /**
   * Get detailed execution logs
   * @returns {Array} Array of log entries
   */
  getExecutionLogs() {
    return this.logger.getLogs();
  }

  /**
   * Get detailed execution logs (alias for getExecutionLogs)
   * @returns {Array} Array of log entries
   */
  getLogs() {
    return this.getExecutionLogs();
  }

  /**
   * Clear execution logs
   */
  clearLogs() {
    this.logger.clearLogs();
  }

  /**
   * Register a custom node type
   * @param {Object} nodeDefinition - Custom node definition
   */
  async registerCustomNode(nodeDefinition) {
    await this.customNodeManager.registerNode(nodeDefinition);
  }

  /**
   * Check if a node type is available
   * @param {string} nodeType - The node type to check
   * @returns {boolean} True if node type is available
   */
  isNodeTypeAvailable(nodeType) {
    return this.nodeExecutor.isNodeTypeSupported(nodeType) || 
           this.customNodeManager.hasNode(nodeType);
  }

  /**
   * Get available node types
   * @returns {Array} Array of available node types
   */
  getAvailableNodeTypes() {
    return [
      ...this.nodeExecutor.getSupportedNodeTypes(),
      ...this.customNodeManager.getRegisteredNodeTypes()
    ];
  }

  /**
   * Stop current execution (if running)
   */
  stop() {
    if (this.isExecuting && this.currentExecution) {
      this.currentExecution.abort();
      this.isExecuting = false;
      this.logger.info('Flow execution stopped by user');
    }
  }

  /**
   * Get execution statistics
   * @returns {Object} Execution statistics
   */
  getStats() {
    return {
      isExecuting: this.isExecuting,
      totalLogs: this.logger.getLogs().length,
      registeredCustomNodes: this.customNodeManager.getRegisteredNodeTypes().length,
      supportedBuiltinNodes: this.nodeExecutor.getSupportedNodeTypes().length
    };
  }

  /**
   * Create a typed error with additional context
   * @private
   */
  createError(type, message, context = {}) {
    const error = new Error(message);
    error.type = type;
    error.context = context;
    error.timestamp = new Date().toISOString();
    return error;
  }

  /**
   * Dispose of resources and cleanup
   */
  dispose() {
    this.stop();
    this.customNodeManager.dispose();
    this.logger.clearLogs();
  }
}

// Default export for CommonJS compatibility
export default ClaraFlowRunner;

// Version info
export const version = '1.0.0';
export const name = 'clara-flow-sdk';

// Re-export other classes for advanced usage
export { FlowValidator, NodeExecutor, FlowEngine, CustomNodeManager, Logger }; 