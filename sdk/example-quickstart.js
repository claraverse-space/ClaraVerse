import { ClaraFlowRunner } from './dist/index.esm.js';

// Example from the README - Complete workflow example
async function quickstartExample() {
  console.log('🚀 Clara Flow SDK v1.1.0 - Quickstart Example');
  
  // 1. Get your flow JSON (export from Clara Studio)
  const flowData = {
    "format": "clara-sdk",
    "version": "1.1.0",
    "flow": {
      "id": "quickstart-flow",
      "name": "Quickstart Workflow",
      "nodes": [
        {
          "id": "input-1",
          "type": "input",
          "name": "User Input",
          "data": { "value": "Hello Clara!" },
          "inputs": [],
          "outputs": [{"id": "output", "name": "Value", "type": "output"}]
        },
        {
          "id": "output-1",
          "type": "output", 
          "name": "Final Result",
          "inputs": [{"id": "input", "name": "Input", "type": "input"}],
          "outputs": []
        }
      ],
      "connections": [
        {
          "sourceNodeId": "input-1",
          "sourcePortId": "output",
          "targetNodeId": "output-1",
          "targetPortId": "input"
        }
      ]
    }
  };

  // 2. Create runner instance
  const runner = new ClaraFlowRunner({
    enableLogging: true,
    logLevel: 'info'
  });

  console.log('✅ Clara Flow Runner created successfully!');

  try {
    // 3. Execute the flow
    const result = await runner.executeFlow(flowData, {
      "User Input": "Hello from the new Clara SDK v1.1.0!"
    });

    console.log('🎉 Flow executed successfully!');
    console.log('📊 Results:', result);
    
    // Show logs
    const logs = runner.getLogs();
    console.log('\n📋 Execution Logs:');
    logs.forEach(log => {
      console.log(`[${log.level.toUpperCase()}] ${log.message}`);
    });

  } catch (error) {
    console.error('❌ Flow execution failed:', error.message);
  }
}

// Advanced example with validation
async function advancedExample() {
  console.log('\n🔧 Advanced Features Example');
  
  const flowData = {
    "format": "clara-sdk",
    "version": "1.1.0", 
    "flow": {
      "id": "advanced-flow",
      "name": "Advanced Demo",
      "nodes": [
        {
          "id": "input-1",
          "type": "input",
          "name": "Text Input",
          "data": { "value": "test" },
          "outputs": [{"id": "output", "name": "Value"}]
        },
        {
          "id": "input-2", 
          "type": "input",
          "name": "Number Input",
          "data": { "value": "42" },
          "outputs": [{"id": "output", "name": "Value"}]
        },
        {
          "id": "output-1",
          "type": "output",
          "name": "Text Result", 
          "inputs": [{"id": "input", "name": "Input"}]
        },
        {
          "id": "output-2",
          "type": "output",
          "name": "Number Result",
          "inputs": [{"id": "input", "name": "Input"}]
        }
      ],
      "connections": [
        {
          "sourceNodeId": "input-1",
          "sourcePortId": "output", 
          "targetNodeId": "output-1",
          "targetPortId": "input"
        },
        {
          "sourceNodeId": "input-2",
          "sourcePortId": "output",
          "targetNodeId": "output-2", 
          "targetPortId": "input"
        }
      ]
    }
  };

  const runner = new ClaraFlowRunner({
    enableLogging: true,
    timeout: 30000
  });

  // Validate before execution
  console.log('🔍 Validating flow...');
  const validation = runner.validateFlow(flowData);
  console.log('Validation result:', validation);

  if (!validation.isValid) {
    console.error('❌ Flow validation failed:', validation.errors);
    return;
  }

  console.log('✅ Flow validation passed!');

  // Batch processing example
  const inputSets = [
    { "Text Input": "Hello", "Number Input": 1 },
    { "Text Input": "World", "Number Input": 2 },
    { "Text Input": "SDK", "Number Input": 3 }
  ];

  console.log('🔄 Running batch processing...');
  
  const results = await runner.executeBatch(flowData, inputSets, {
    concurrency: 2,
    onProgress: (progress) => {
      console.log(`Progress: ${progress.completed}/${progress.total} (${Math.round(progress.progress * 100)}%)`);
    }
  });

  console.log('📊 Batch results:', results);
}

// Run examples
console.log('🎯 Clara Flow SDK Examples\n');

await quickstartExample();
await advancedExample();

console.log('\n✨ All examples completed successfully!');
console.log('📖 Check the README.md for more detailed documentation.');
console.log('🚀 Ready to publish Clara Flow SDK v1.1.0!'); 