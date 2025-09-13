/**
 * Test script to execute ComfyUI workflows via API
 * This will help us understand the workflow format and API before building the node
 */

import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';

class ComfyUIWorkflowTester {
  constructor(serverAddress = '127.0.0.1:8188') {
    this.serverAddress = serverAddress;
    this.clientId = this.generateClientId();
  }

  generateClientId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  async connectWebSocket() {
    const ws = new WebSocket(`ws://${this.serverAddress}/ws?clientId=${this.clientId}`);
    
    return new Promise((resolve, reject) => {
      ws.on('open', () => {
        console.log('✅ WebSocket connected to ComfyUI');
        resolve(ws);
      });
      
      ws.on('error', (error) => {
        console.error('❌ WebSocket connection failed:', error.message);
        reject(error);
      });
    });
  }

  async queuePrompt(prompt) {
    const response = await fetch(`http://${this.serverAddress}/prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: prompt,
        client_id: this.clientId
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to queue prompt: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    return result;
  }

  async getHistory(promptId) {
    const response = await fetch(`http://${this.serverAddress}/history/${promptId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get history: ${response.status} ${response.statusText}`);
    }

    const history = await response.json();
    return history;
  }

  async getImage(filename, subfolder, type) {
    const params = new URLSearchParams();
    params.append('filename', filename);
    params.append('subfolder', subfolder);
    params.append('type', type);

    const response = await fetch(`http://${this.serverAddress}/view?${params}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get image: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async executeWorkflow(workflowData, options = {}) {
    const {
      timeout = 120000, // 2 minutes default timeout
      onProgress = (message) => console.log(`📈 ${message}`),
      saveOutput = true,
      outputDir = './comfyui-output'
    } = options;

    try {
      onProgress('Connecting to ComfyUI...');
      
      // Test connection first
      const testResponse = await fetch(`http://${this.serverAddress}/system_stats`);
      if (!testResponse.ok) {
        throw new Error(`ComfyUI server not accessible at ${this.serverAddress}`);
      }
      
      onProgress('ComfyUI server is accessible');

      // Connect WebSocket for real-time updates
      const ws = await this.connectWebSocket();
      
      // Set up promise to track completion
      const executionPromise = new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          ws.close();
          reject(new Error('Workflow execution timed out'));
        }, timeout);

        ws.on('message', async (data) => {
          try {
            const message = JSON.parse(data.toString());
            
            if (message.type === 'status') {
              onProgress(`Status: ${JSON.stringify(message.data)}`);
            } else if (message.type === 'progress') {
              const { value, max } = message.data;
              const percentage = Math.round((value / max) * 100);
              onProgress(`Progress: ${percentage}% (${value}/${max})`);
            } else if (message.type === 'executing') {
              if (message.data.node) {
                onProgress(`Executing node: ${message.data.node}`);
              } else {
                onProgress('Execution completed');
                clearTimeout(timeoutId);
                
                // Get the prompt ID from the last queued prompt
                const history = await this.getHistory(this.lastPromptId);
                resolve(history);
              }
            }
          } catch (error) {
            clearTimeout(timeoutId);
            reject(error);
          }
        });

        ws.on('error', (error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
      });

      // Queue the workflow
      onProgress('Queueing workflow...');
      const queueResult = await this.queuePrompt(workflowData);
      this.lastPromptId = queueResult.prompt_id;
      
      onProgress(`Workflow queued with ID: ${this.lastPromptId}`);

      // Wait for completion
      const history = await executionPromise;
      ws.close();

      onProgress('Workflow execution completed!');

      // Process results
      const results = [];
      const historyData = history[this.lastPromptId];
      
      if (historyData && historyData.outputs) {
        for (const [nodeId, output] of Object.entries(historyData.outputs)) {
          if (output.images) {
            for (const imageInfo of output.images) {
              onProgress(`Found output image: ${imageInfo.filename}`);
              
              if (saveOutput) {
                // Download the image
                const imageBuffer = await this.getImage(
                  imageInfo.filename,
                  imageInfo.subfolder,
                  imageInfo.type
                );
                
                // Save to output directory
                if (!fs.existsSync(outputDir)) {
                  fs.mkdirSync(outputDir, { recursive: true });
                }
                
                const outputPath = path.join(outputDir, imageInfo.filename);
                fs.writeFileSync(outputPath, imageBuffer);
                onProgress(`Saved image to: ${outputPath}`);
                
                results.push({
                  nodeId,
                  filename: imageInfo.filename,
                  localPath: outputPath,
                  imageBuffer
                });
              } else {
                results.push({
                  nodeId,
                  filename: imageInfo.filename,
                  subfolder: imageInfo.subfolder,
                  type: imageInfo.type
                });
              }
            }
          }
        }
      }

      return {
        success: true,
        promptId: this.lastPromptId,
        results,
        executionTime: Date.now() - this.startTime
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        promptId: this.lastPromptId || null
      };
    }
  }

  // Helper method to load workflow from file
  loadWorkflowFromFile(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Workflow file not found: ${filePath}`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    try {
      const workflowData = JSON.parse(fileContent);
      
      // Handle both ComfyUI API format and ComfyUI UI export format
      if (workflowData.workflow && workflowData.prompt) {
        // UI export format - use the prompt
        return workflowData.prompt;
      } else if (workflowData.prompt) {
        // API format with prompt wrapper
        return workflowData.prompt;
      } else {
        // Direct prompt format
        return workflowData;
      }
    } catch (error) {
      throw new Error(`Invalid JSON in workflow file: ${error.message}`);
    }
  }
}

// Example usage function
async function testWorkflow() {
  const tester = new ComfyUIWorkflowTester('127.0.0.1:8188');
  
  // Example simple workflow (text-to-image with SDXL)
  const simpleWorkflow = {
    "3": {
      "inputs": {
        "seed": 42,
        "steps": 20,
        "cfg": 8.0,
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
        "ckpt_name": "sd_xl_base_1.0.safetensors"
      },
      "class_type": "CheckpointLoaderSimple"
    },
    "5": {
      "inputs": {
        "width": 1024,
        "height": 1024,
        "batch_size": 1
      },
      "class_type": "EmptyLatentImage"
    },
    "6": {
      "inputs": {
        "text": "beautiful landscape, mountains, sunset, detailed, high quality",
        "clip": ["4", 1]
      },
      "class_type": "CLIPTextEncode"
    },
    "7": {
      "inputs": {
        "text": "blurry, low quality, distorted",
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
        "filename_prefix": "ComfyUI",
        "images": ["8", 0]
      },
      "class_type": "SaveImage"
    }
  };

  console.log('🧪 Testing ComfyUI Workflow Execution');
  console.log('=====================================');
  
  const result = await tester.executeWorkflow(simpleWorkflow, {
    timeout: 180000, // 3 minutes
    onProgress: (message) => console.log(`📈 ${message}`),
    saveOutput: true,
    outputDir: './test-output'
  });

  if (result.success) {
    console.log('\n✅ Workflow executed successfully!');
    console.log(`📊 Execution time: ${result.executionTime}ms`);
    console.log(`🆔 Prompt ID: ${result.promptId}`);
    console.log(`🖼️  Generated ${result.results.length} images:`);
    
    result.results.forEach((img, index) => {
      console.log(`   ${index + 1}. ${img.filename} (saved to: ${img.localPath})`);
    });
  } else {
    console.log('\n❌ Workflow execution failed:');
    console.log(`💥 Error: ${result.error}`);
    if (result.promptId) {
      console.log(`🆔 Prompt ID: ${result.promptId}`);
    }
  }

  return result;
}

// Test with a workflow file if provided
async function testWorkflowFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    console.log('❌ Please provide a valid workflow file path');
    console.log('Usage: node test-comfyui-workflow.js <workflow.json>');
    return;
  }

  const tester = new ComfyUIWorkflowTester('127.0.0.1:8188');
  
  try {
    console.log(`📂 Loading workflow from: ${filePath}`);
    const workflowData = tester.loadWorkflowFromFile(filePath);
    
    console.log('🧪 Testing ComfyUI Workflow Execution');
    console.log('=====================================');
    
    const result = await tester.executeWorkflow(workflowData, {
      timeout: 300000, // 5 minutes for complex workflows
      onProgress: (message) => console.log(`📈 ${message}`),
      saveOutput: true,
      outputDir: './workflow-output'
    });

    if (result.success) {
      console.log('\n✅ Workflow executed successfully!');
      console.log(`📊 Execution time: ${result.executionTime}ms`);
      console.log(`🆔 Prompt ID: ${result.promptId}`);
      console.log(`🖼️  Generated ${result.results.length} images:`);
      
      result.results.forEach((img, index) => {
        console.log(`   ${index + 1}. ${img.filename} (saved to: ${img.localPath})`);
      });
    } else {
      console.log('\n❌ Workflow execution failed:');
      console.log(`💥 Error: ${result.error}`);
      if (result.promptId) {
        console.log(`🆔 Prompt ID: ${result.promptId}`);
      }
    }

    return result;
  } catch (error) {
    console.error('❌ Failed to load or execute workflow:', error.message);
    return { success: false, error: error.message };
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const workflowFile = process.argv[2];
  
  if (workflowFile) {
    testWorkflowFile(workflowFile);
  } else {
    testWorkflow();
  }
}

export { ComfyUIWorkflowTester };
