const { spawn } = require('child_process');
const path = require('path');

// Import the service
const LlamaSwapService = require('./electron/llamaSwapService.cjs');

async function testServiceStartup() {
    console.log('🧪 Testing llama-swap service startup with fixes...\n');
    
    // Create service instance
    const service = new LlamaSwapService();
    
    console.log('📊 Initial state:');
    console.log(`  isRunning: ${service.isRunning}`);
    console.log(`  isStarting: ${service.isStarting}`);
    console.log('');
    
    try {
        console.log('🚀 Test 1: Single start attempt');
        const result1 = await service.start();
        console.log('Result:', result1);
        console.log(`State after start: isRunning=${service.isRunning}, isStarting=${service.isStarting}\n`);
        
        // Wait a bit
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('🚀 Test 2: Second start attempt (should be prevented)');
        const result2 = await service.start();
        console.log('Result:', result2);
        console.log(`State after second start: isRunning=${service.isRunning}, isStarting=${service.isStarting}\n`);
        
        // Test concurrent starts
        console.log('🚀 Test 3: Concurrent start attempts');
        const promises = [
            service.start(),
            service.start(),
            service.start()
        ];
        
        const results = await Promise.all(promises);
        console.log('Concurrent results:', results);
        console.log(`State after concurrent starts: isRunning=${service.isRunning}, isStarting=${service.isStarting}\n`);
        
        // Cleanup
        console.log('🧹 Cleaning up...');
        await service.stop();
        console.log(`Final state: isRunning=${service.isRunning}, isStarting=${service.isStarting}`);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testServiceStartup().then(() => {
    console.log('✅ Test completed');
    process.exit(0);
}).catch(error => {
    console.error('💥 Test crashed:', error);
    process.exit(1);
}); 