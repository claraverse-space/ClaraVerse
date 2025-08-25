/**
 * Test Agent Executor Node Integration
 * 
 * Simple test to verify that the Agent Executor node is properly integrated
 * and can be used in the Agent Studio workflow system.
 */

// Test configuration for Agent Executor node
export const testAgentExecutorWorkflow = {
  id: 'test-agent-executor',
  name: 'Test Agent Executor',
  description: 'Test workflow for Agent Executor node',
  icon: '🤖',
  version: '1.0.0',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  nodes: [
    {
      id: 'input-1',
      type: 'input',
      name: 'Task Instructions',
      position: { x: 100, y: 100 },
      data: {
        inputType: 'string',
        label: 'Task Instructions',
        placeholder: 'Enter task for the agent to complete...',
        defaultValue: 'Analyze the current weather and provide a summary with recommendations for outdoor activities.',
        required: true
      },
      inputs: [],
      outputs: [
        { id: 'value', name: 'Value', type: 'output', dataType: 'string' }
      ]
    },
    {
      id: 'agent-1',
      type: 'agent-executor',
      name: 'AI Agent',
      position: { x: 400, y: 100 },
      data: {
        provider: 'claras-pocket', // Default to local provider
        textModel: '', // Will be set dynamically
        visionModel: '',
        codeModel: '',
        enabledMCPServers: ['web-search', 'filesystem'], // Enable some common tools
        instructions: '', // Will come from input
        temperature: 0.7,
        maxTokens: 2000,
        maxRetries: 3,
        enableSelfCorrection: true,
        enableChainOfThought: true,
        enableToolGuidance: true,
        maxToolCalls: 10,
        confidenceThreshold: 0.7
      },
      inputs: [
        { id: 'instructions', name: 'Instructions', type: 'input', dataType: 'string', required: true },
        { id: 'context', name: 'Context', type: 'input', dataType: 'string', required: false }
      ],
      outputs: [
        { id: 'result', name: 'Result', type: 'output', dataType: 'string' },
        { id: 'toolResults', name: 'Tool Results', type: 'output', dataType: 'array' },
        { id: 'executionLog', name: 'Execution Log', type: 'output', dataType: 'string' },
        { id: 'success', name: 'Success', type: 'output', dataType: 'boolean' },
        { id: 'metadata', name: 'Metadata', type: 'output', dataType: 'object' }
      ]
    },
    {
      id: 'output-1',
      type: 'output',
      name: 'Agent Result',
      position: { x: 700, y: 50 },
      data: {
        format: 'text',
        label: 'Agent Result'
      },
      inputs: [
        { id: 'value', name: 'Value', type: 'input', dataType: 'string', required: true }
      ],
      outputs: []
    },
    {
      id: 'output-2',
      type: 'output',
      name: 'Execution Log',
      position: { x: 700, y: 150 },
      data: {
        format: 'text',
        label: 'Execution Log'
      },
      inputs: [
        { id: 'value', name: 'Value', type: 'input', dataType: 'string', required: true }
      ],
      outputs: []
    }
  ],
  connections: [
    {
      id: 'conn-1',
      sourceNodeId: 'input-1',
      sourcePortId: 'value',
      targetNodeId: 'agent-1',
      targetPortId: 'instructions'
    },
    {
      id: 'conn-2',
      sourceNodeId: 'agent-1',
      sourcePortId: 'result',
      targetNodeId: 'output-1',
      targetPortId: 'value'
    },
    {
      id: 'conn-3',
      sourceNodeId: 'agent-1',
      sourcePortId: 'executionLog',
      targetNodeId: 'output-2',
      targetPortId: 'value'
    }
  ],
  variables: [],
  settings: {
    name: 'Test Agent Executor',
    description: 'Test workflow for Agent Executor node integration',
    version: '1.0.0',
    timeout: 60000,
    retryPolicy: {
      maxRetries: 3,
      backoffStrategy: 'exponential' as const,
      delay: 1000
    },
    errorHandling: {
      onError: 'stop' as const
    }
  },
  isTemplate: false,
  tags: ['test', 'agent', 'executor', 'ai']
};

/**
 * Test the Agent Executor node with a simple task
 */
export const testAgentExecutorExecution = async () => {
  console.log('🧪 Testing Agent Executor Node Integration...');
  
  try {
    // Import the node executor for testing
    const { NodeExecutor } = await import('../../sdk/src/nodeExecutor.js');
    const logger = {
      debug: console.log,
      info: console.log,
      warn: console.warn,
      error: console.error
    };
    
    const executor = new NodeExecutor(logger, null);
    
    // Test data
    const nodeData = {
      type: 'agent-executor',
      name: 'Test Agent',
      data: {
        provider: 'claras-pocket',
        textModel: 'llama3.2:latest',
        enabledMCPServers: ['web-search'],
        instructions: 'Test task for agent execution',
        temperature: 0.7,
        maxTokens: 1000,
        maxRetries: 2,
        enableSelfCorrection: true,
        enableChainOfThought: true
      }
    };
    
    const inputs = {
      instructions: 'What is the current date and time? Provide a brief analysis of what activities might be good for this time of day.'
    };
    
    console.log('🔄 Executing Agent Executor node...');
    const result = await executor.executeNode(nodeData, inputs);
    
    console.log('✅ Agent Executor test completed!');
    console.log('📊 Result:', result);
    
    return {
      success: true,
      result,
      message: 'Agent Executor node test completed successfully'
    };
    
  } catch (error) {
    console.error('❌ Agent Executor test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Agent Executor node test failed'
    };
  }
};

// Make test available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).testAgentExecutor = testAgentExecutorExecution;
  (window as any).agentExecutorWorkflow = testAgentExecutorWorkflow;
  
  console.log('🧪 Agent Executor test functions available:');
  console.log('  - window.testAgentExecutor() - Run execution test');
  console.log('  - window.agentExecutorWorkflow - Sample workflow');
}
