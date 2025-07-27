/**
 * Clara Flow SDK v2.0 - Quick Start Example
 * This example demonstrates how easy it is to use the SDK
 */

import { ClaraFlowRunner } from './dist/index.js';

console.log('🚀 Clara Flow SDK v2.0 - Quick Start Example\n');

// Create runner
const runner = new ClaraFlowRunner({
  enableLogging: true
});

// Simple workflow - just 3 lines to define!
const workflow = {
  nodes: [
    {
      id: 'greeting',
      type: 'input',
      name: 'Greeting',
      data: { value: 'Hello' },
      outputs: [{ id: 'output', name: 'Output' }]
    },
    {
      id: 'name',
      type: 'input', 
      name: 'Name',
      data: { value: 'World' },
      outputs: [{ id: 'output', name: 'Output' }]
    },
    {
      id: 'combine',
      type: 'combine-text',
      name: 'Combine',
      data: { separator: ', ' },
      inputs: [
        { id: 'text1', name: 'Text1' },
        { id: 'text2', name: 'Text2' }
      ],
      outputs: [{ id: 'output', name: 'Output' }]
    },
    {
      id: 'result',
      type: 'output',
      name: 'Final Result',
      inputs: [{ id: 'input', name: 'Input' }]
    }
  ],
  connections: [
    { sourceNodeId: 'greeting', sourcePortId: 'output', targetNodeId: 'combine', targetPortId: 'text1' },
    { sourceNodeId: 'name', sourcePortId: 'output', targetNodeId: 'combine', targetPortId: 'text2' },
    { sourceNodeId: 'combine', sourcePortId: 'output', targetNodeId: 'result', targetPortId: 'input' }
  ]
};

// Execute workflow - just 1 line!
const result = await runner.execute(workflow, {
  greeting: 'Welcome',
  name: 'Clara SDK v2.0!'
});

console.log('\n🎉 Result:', result.result?.output || result['result']?.output);
console.log('\n✨ That\'s it! Your first Clara workflow is complete.');
console.log('\n📚 Check README.md for more examples and features.'); 