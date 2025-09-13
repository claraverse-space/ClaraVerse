/**
 * Simple test runner for ComfyUI workflows
 * Usage: 
 *   node run-test.js                    # Run with built-in simple workflow
 *   node run-test.js sample-workflow.json  # Run with custom workflow file
 */

import { ComfyUIWorkflowTester } from './test-comfyui-workflow.js';
import fs from 'fs';

async function main() {
  console.log('🎨 ComfyUI Workflow Test Runner');
  console.log('================================\n');

  // Check if ComfyUI is accessible
  const comfyUIUrl = '127.0.0.1:8188';
  console.log(`🔍 Checking ComfyUI server at ${comfyUIUrl}...`);
  
  try {
    const testResponse = await fetch(`http://${comfyUIUrl}/system_stats`);
    if (testResponse.ok) {
      const stats = await testResponse.json();
      console.log('✅ ComfyUI server is running');
      console.log(`📊 System stats:`, {
        system: stats.system || 'Unknown',
        python_version: stats.python_version || 'Unknown'
      });
    } else {
      throw new Error(`Server responded with ${testResponse.status}`);
    }
  } catch (error) {
    console.error('❌ ComfyUI server is not accessible');
    console.error(`💥 Error: ${error.message}`);
    console.log('\n💡 Make sure ComfyUI is running on http://127.0.0.1:8188');
    console.log('   Start ComfyUI with: python main.py --listen');
    process.exit(1);
  }

  // Get workflow file from command line or use default
  const workflowFile = process.argv[2];
  const tester = new ComfyUIWorkflowTester(comfyUIUrl);

  let workflowData;
  let workflowSource;

  if (workflowFile) {
    if (!fs.existsSync(workflowFile)) {
      console.error(`❌ Workflow file not found: ${workflowFile}`);
      process.exit(1);
    }
    
    try {
      workflowSource = `file: ${workflowFile}`;
      workflowData = tester.loadWorkflowFromFile(workflowFile);
      console.log(`📂 Loaded workflow from: ${workflowFile}`);
    } catch (error) {
      console.error(`❌ Failed to load workflow file: ${error.message}`);
      process.exit(1);
    }
  } else {
    workflowSource = 'built-in simple workflow';
    workflowData = {
      "3": {
        "inputs": {
          "seed": Math.floor(Math.random() * 1000000),
          "steps": 15,
          "cfg": 7.0,
          "sampler_name": "euler",
          "scheduler": "normal",
          "denoise": 1.0,
          "model": ["4", 0],
          "positive": ["6", 0],
          "negative": ["7", 0],
          "latent_image": ["5", 0]
        },
        "class_type": "KSampler"
      },
      "4": {
        "inputs": {
          "ckpt_name": "mistoonAnime_v30.safetensors"
        },
        "class_type": "CheckpointLoaderSimple"
      },
      "5": {
        "inputs": {
          "width": 512,
          "height": 512,
          "batch_size": 1
        },
        "class_type": "EmptyLatentImage"
      },
      "6": {
        "inputs": {
          "text": "a cute cat sitting on a windowsill, sunlight, cozy, detailed",
          "clip": ["4", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      "7": {
        "inputs": {
          "text": "blurry, low quality, distorted, ugly",
          "clip": ["4", 1]
        },
        "class_type": "CLIPTextEncode"
      },
      "8": {
        "inputs": {
          "samples": ["3", 0],
          "vae": ["4", 2]
        },
        "class_type": "VAEDecode"
      },
      "9": {
        "inputs": {
          "filename_prefix": "test_workflow",
          "images": ["8", 0]
        },
        "class_type": "SaveImage"
      }
    };
    console.log('🔧 Using built-in simple workflow');
  }

  console.log(`\n🚀 Starting workflow execution (${workflowSource})...`);
  console.log('='.repeat(60));

  const startTime = Date.now();
  
  const result = await tester.executeWorkflow(workflowData, {
    timeout: 300000, // 5 minutes
    onProgress: (message) => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] ${message}`);
    },
    saveOutput: true,
    outputDir: './workflow-test-output'
  });

  const totalTime = Date.now() - startTime;
  
  console.log('\n' + '='.repeat(60));
  
  if (result.success) {
    console.log('🎉 SUCCESS! Workflow completed successfully');
    console.log(`⏱️  Total execution time: ${Math.round(totalTime / 1000)}s`);
    console.log(`🆔 Prompt ID: ${result.promptId}`);
    
    if (result.results && result.results.length > 0) {
      console.log(`\n🖼️  Generated Images (${result.results.length}):`);
      result.results.forEach((img, index) => {
        console.log(`   ${index + 1}. ${img.filename}`);
        if (img.localPath) {
          console.log(`      💾 Saved to: ${img.localPath}`);
        }
      });
      
      console.log('\n💡 You can now use this workflow format in the ComfyUI Workflow node!');
    } else {
      console.log('\n⚠️  No images were generated (check workflow configuration)');
    }
  } else {
    console.log('💥 FAILED! Workflow execution failed');
    console.log(`❌ Error: ${result.error}`);
    if (result.promptId) {
      console.log(`🆔 Prompt ID: ${result.promptId}`);
    }
    
    console.log('\n🔧 Troubleshooting tips:');
    console.log('   - Check if all models referenced in the workflow exist');
    console.log('   - Verify the workflow JSON format is correct');
    console.log('   - Make sure ComfyUI has enough memory/VRAM');
    console.log('   - Check ComfyUI console for detailed error messages');
  }
  
  console.log('\n📋 Test Summary:');
  console.log(`   Source: ${workflowSource}`);
  console.log(`   ComfyUI: ${comfyUIUrl}`);
  console.log(`   Duration: ${Math.round(totalTime / 1000)}s`);
  console.log(`   Success: ${result.success ? '✅' : '❌'}`);
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  console.error('\n💥 Unhandled error:', error.message);
  console.error('🔍 Stack trace:', error.stack);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n\n🛑 Test interrupted by user');
  process.exit(0);
});

// Run the test
main().catch((error) => {
  console.error('\n💥 Test failed:', error.message);
  process.exit(1);
});
