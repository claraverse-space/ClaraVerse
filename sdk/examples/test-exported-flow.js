#!/usr/bin/env node

/**
 * Test script to run the exported Testing_flow_sdk.json with Clara Flow SDK
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ClaraFlowRunner } from '../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testExportedFlow() {
  console.log('🧪 Testing Clara Flow SDK with exported flow...\n');

  try {
    // Load the exported flow
    const flowPath = join(__dirname, 'Testing_flow_sdk.json');
    const exportedData = JSON.parse(readFileSync(flowPath, 'utf8'));
    
    console.log('📄 Loaded export format:', exportedData.format);
    console.log('📄 Export version:', exportedData.version);
    console.log('📄 Flow name:', exportedData.flow.name);
    console.log('📄 Description:', exportedData.flow.description);
    console.log('📄 Nodes:', exportedData.flow.nodes.length);
    console.log('📄 Connections:', exportedData.flow.connections.length);
    console.log('📄 Custom Nodes:', exportedData.customNodes.length);
    console.log('');

    // Extract the flow data for the SDK (merge flow and customNodes)
    const flowData = {
      ...exportedData.flow,
      customNodes: exportedData.customNodes
    };

    // Create SDK instance with logging enabled
    const runner = new ClaraFlowRunner({
      enableLogging: true,
      logLevel: 'debug',
      timeout: 30000
    });

    console.log('🚀 Starting flow execution...\n');

    // Execute the flow (no inputs needed since the input nodes have default values)
    const result = await runner.executeFlow(flowData, {});

    console.log('\n✅ Flow execution completed!');
    console.log('📊 Results:', JSON.stringify(result, null, 2));

    // Get execution logs
    const logs = runner.getLogs();
    console.log('\n📝 Execution Logs:');
    logs.forEach(log => {
      const timestamp = new Date(log.timestamp).toLocaleTimeString();
      console.log(`[${timestamp}] ${log.level.toUpperCase()}: ${log.message}`);
      if (log.data && Object.keys(log.data).length > 0) {
        console.log('   Data:', JSON.stringify(log.data, null, 2));
      }
    });

    console.log('\n🎉 Test completed successfully!');
    
    return result;

  } catch (error) {
    console.error('\n❌ Test failed:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    // Show logs even on failure
    try {
      const runner = new ClaraFlowRunner();
      const logs = runner.getLogs();
      if (logs.length > 0) {
        console.log('\n📝 Error Logs:');
        logs.forEach(log => {
          const timestamp = new Date(log.timestamp).toLocaleTimeString();
          console.log(`[${timestamp}] ${log.level.toUpperCase()}: ${log.message}`);
        });
      }
    } catch (logError) {
      // Ignore log errors
    }
    
    process.exit(1);
  }
}

// Test with different input scenarios
async function runTestScenarios() {
  console.log('🔬 Running multiple test scenarios...\n');

  const flowPath = join(__dirname, 'Testing_flow_sdk.json');
  const exportedData = JSON.parse(readFileSync(flowPath, 'utf8'));
  
  // Extract the flow data for the SDK
  const flowData = {
    ...exportedData.flow,
    customNodes: exportedData.customNodes
  };

  const scenarios = [
    {
      name: 'Default Values',
      description: 'Using the default values in the input nodes',
      inputs: {}
    },
    {
      name: 'Custom Inputs',
      description: 'Overriding with custom input values',
      inputs: {
        'input1': 'Hello ',
        'input2': 'World!'
      }
    },
    {
      name: 'Empty Inputs',
      description: 'Testing with empty inputs',
      inputs: {
        'input1': '',
        'input2': ''
      }
    }
  ];

  for (const scenario of scenarios) {
    console.log(`\n📋 Scenario: ${scenario.name}`);
    console.log(`📝 Description: ${scenario.description}`);
    console.log('─'.repeat(50));

    try {
      const runner = new ClaraFlowRunner({
        enableLogging: true,
        logLevel: 'info'
      });

      const result = await runner.executeFlow(flowData, scenario.inputs);
      console.log('✅ Result:', JSON.stringify(result, null, 2));

    } catch (error) {
      console.log('❌ Failed:', error.message);
    }
  }
}

// Run the tests
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🎯 Clara Flow SDK - Exported Flow Test\n');
  
  // Test basic execution
  await testExportedFlow();
  
  // Test different scenarios
  await runTestScenarios();
  
  console.log('\n🏁 All tests completed!');
} 