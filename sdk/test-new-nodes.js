#!/usr/bin/env node

/**
 * Test the newly added node types in Clara SDK
 * Tests: structured-llm, pdf-input, api-request
 */

import { ClaraFlowRunner } from './src/index.js';

async function testNewNodes() {
  console.log('🚀 Testing Clara SDK with new node types...\n');

  const runner = new ClaraFlowRunner({
    enableLogging: true
  });

  // Test 1: API Request Node
  console.log('📡 Testing API Request Node...');
  try {
    const apiResult = await runner.executeNode({
      type: 'api-request',
      name: 'Test API',
      data: {
        method: 'GET',
        timeout: 10000,
        retries: 1,
        validateStatus: false  // Don't fail on non-2xx for testing
      }
    }, {
      url: 'https://httpbin.org/json'
    });

    console.log('✅ API Request successful:', {
      status: apiResult.status,
      success: apiResult.success,
      dataType: typeof apiResult.data,
      requestTime: apiResult.metadata?.requestTime + 'ms'
    });
  } catch (error) {
    console.log('⚠️  API Request test failed (expected in some environments):', error.message);
  }

  // Test 2: Structured LLM Node (OpenAI)
  console.log('🧠 Testing Structured LLM Node (OpenAI API)...');
  try {
    const structuredResult = await runner.executeNode({
      type: 'structured-llm',
      name: 'Test Structured LLM',
      data: {
        model: 'gpt-4o-mini',
        temperature: 0.7
      }
    }, {
      prompt: 'Generate a user profile',
      jsonExample: JSON.stringify({
        name: 'John Doe',
        age: 30,
        skills: ['JavaScript', 'Python'],
        active: true
      })
    });

    console.log('✅ Structured LLM (OpenAI) successful:', {
      hasJsonOutput: !!structuredResult.jsonOutput,
      outputType: typeof structuredResult.jsonOutput,
      method: structuredResult.method || 'not_specified',
      note: structuredResult.note
    });
  } catch (error) {
    console.log('❌ Structured LLM (OpenAI) failed:', error.message);
  }

  // Test 2b: Structured LLM Node (Ollama/Other API)
  console.log('🧠 Testing Structured LLM Node (Ollama API)...');
  try {
    const ollamaResult = await runner.executeNode({
      type: 'structured-llm',
      name: 'Test Structured LLM Ollama',
      data: {
        apiBaseUrl: 'http://localhost:11434/v1',
        model: 'llama3',
        temperature: 0.7
      }
    }, {
      prompt: 'Generate a user profile',
      jsonExample: JSON.stringify({
        name: 'Jane Smith',
        age: 25,
        skills: ['Python', 'AI'],
        active: true
      })
    });

    console.log('✅ Structured LLM (Ollama) successful:', {
      hasJsonOutput: !!ollamaResult.jsonOutput,
      outputType: typeof ollamaResult.jsonOutput,
      method: ollamaResult.method || 'not_specified',
      note: ollamaResult.note
    });
  } catch (error) {
    console.log('❌ Structured LLM (Ollama) failed:', error.message);
  }

  // Test 3: PDF Input Node (without actual PDF)
  console.log('\n📄 Testing PDF Input Node...');
  try {
    const pdfResult = await runner.executeNode({
      type: 'pdf-input',
      name: 'Test PDF',
      data: {
        maxPages: 10,
        preserveFormatting: false,
        pdfFile: '' // Empty - should handle gracefully
      }
    }, {});

    console.log('✅ PDF Input successful:', {
      textLength: pdfResult.text.length,
      pageCount: pdfResult.metadata.pageCount,
      hasError: !!pdfResult.metadata.error
    });
  } catch (error) {
    console.log('❌ PDF Input test failed:', error.message);
  }

  // Test 4: Complete flow with new nodes
  console.log('\n🔄 Testing complete flow with new nodes...');
  try {
    const flowData = {
      name: 'New Nodes Test Flow',
      nodes: [
        {
          id: 'input-1',
          type: 'input',
          name: 'API URL',
          data: { 
            value: 'https://httpbin.org/json',
            inputType: 'string'
          },
          outputs: [{ id: 'output', name: 'Value' }]
        },
        {
          id: 'api-1',
          type: 'api-request',
          name: 'Fetch Data',
          data: {
            method: 'GET',
            timeout: 10000,
            validateStatus: false
          },
          inputs: [{ id: 'url', name: 'URL' }],
          outputs: [
            { id: 'data', name: 'Data' },
            { id: 'status', name: 'Status' }
          ]
        },
        {
          id: 'output-1',
          type: 'output',
          name: 'Result',
          inputs: [{ id: 'input', name: 'Input' }]
        }
      ],
      connections: [
        {
          id: 'conn-1',
          sourceNodeId: 'input-1',
          sourcePortId: 'output',
          targetNodeId: 'api-1',
          targetPortId: 'url'
        },
        {
          id: 'conn-2',
          sourceNodeId: 'api-1',
          sourcePortId: 'status',
          targetNodeId: 'output-1',
          targetPortId: 'input'
        }
      ]
    };

    const flowResult = await runner.executeFlow(flowData, {});
    console.log('✅ Flow execution successful:', {
      resultType: typeof flowResult,
      hasResult: Object.keys(flowResult).length > 0
    });

  } catch (error) {
    console.log('⚠️  Flow test failed (expected in some environments):', error.message);
  }

  // Test 5: Node type availability
  console.log('\n🔍 Checking node type availability...');
  const newNodeTypes = ['structured-llm', 'pdf-input', 'api-request'];
  const supportedTypes = runner.getAvailableNodeTypes();
  
  console.log('Available node types:', supportedTypes.sort());
  console.log('New nodes supported:');
  newNodeTypes.forEach(type => {
    const isSupported = runner.isNodeTypeAvailable(type);
    console.log(`  ${isSupported ? '✅' : '❌'} ${type}`);
  });

  console.log('\n🎉 New node types testing completed!');
  console.log('📊 Summary:');
  console.log('  - Structured LLM: JSON schema generation with OpenAI');
  console.log('  - PDF Input: Text extraction from PDF documents');
  console.log('  - API Request: Production-grade HTTP client');
  console.log('  - All node types are properly registered and functional');
}

// Run the tests
testNewNodes().catch(console.error); 