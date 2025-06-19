const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Import the LlamaSwapService
const LlamaSwapService = require('./electron/llamaSwapService.cjs');

async function testConfigRegeneration() {
  console.log('Starting config regeneration test...');
  
  try {
    // Create a new instance of LlamaSwapService
    const llamaSwapService = new LlamaSwapService();
    
    // Generate the config
    console.log('Generating config...');
    const result = await llamaSwapService.generateConfig();
    
    console.log('Config generation result:', result);
    
    // Check if the config file was created/updated
    const configPath = path.join(__dirname, 'config.yaml');
    if (fs.existsSync(configPath)) {
      console.log('Config file exists at:', configPath);
      
      // Read and display the config content
      const configContent = fs.readFileSync(configPath, 'utf8');
      console.log('\n--- Config Content ---');
      console.log(configContent);
      console.log('--- End Config ---\n');
      
      // Check for --ctx-size in embedding models
      const lines = configContent.split('\n');
      let inEmbeddingModel = false;
      let foundCtxSize = false;
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check if we're entering an embedding model section
        if (line.includes('embedding') && line.includes('model_name:')) {
          inEmbeddingModel = true;
          console.log(`Found embedding model at line ${i + 1}: ${line.trim()}`);
        }
        
        // Check if we're leaving the model section
        if (inEmbeddingModel && line.match(/^\s*-\s+model_name:/) && !line.includes('embedding')) {
          inEmbeddingModel = false;
        }
        
        // Check for --ctx-size parameter in embedding models
        if (inEmbeddingModel && line.includes('--ctx-size')) {
          foundCtxSize = true;
          console.log(`❌ Found --ctx-size in embedding model at line ${i + 1}: ${line.trim()}`);
        }
      }
      
      if (!foundCtxSize) {
        console.log('✅ No --ctx-size parameters found in embedding models');
      }
      
    } else {
      console.log('❌ Config file was not created');
    }
    
  } catch (error) {
    console.error('Error during config regeneration:', error);
  }
}

// Run the test
testConfigRegeneration().then(() => {
  console.log('Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
}); 