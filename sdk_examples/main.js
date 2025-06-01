import { PersonalAIFlow } from './Personal_AI_flow.js';
import readline from 'readline';

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to ask questions
function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function runPersonalAIApp() {
  console.log('🤖 Welcome to Clara Personal AI Chat!');
  console.log('═══════════════════════════════════════');
  
  try {
    // Get system message input
    console.log('\n📝 First, let\'s set up Clara\'s personality:');
    const systemMessage = await askQuestion('Enter system message (or press Enter for default): ');
    
    // Get user message input
    console.log('\n💬 Now, what would you like to say to Clara?');
    const userMessage = await askQuestion('Enter your message: ');
    
    console.log('\n🔄 Processing your request...\n');
    
    // Create flow instance
    const flow = new PersonalAIFlow();
    
    // Prepare inputs - these correspond to the input nodes in your flow
    const inputs = {};
    
    // If system message is provided, use it; otherwise use the default from the flow
    if (systemMessage.trim()) {
      inputs.system = systemMessage;
    }
    
    // Always use the user input
    inputs.input = userMessage || "Hello Clara!";
    
    // Execute the flow
    const result = await flow.execute(inputs);
    
    // Display the result
    console.log('✨ Clara\'s Response:');
    console.log('══════════════════════');
    console.log(result);
    console.log('══════════════════════\n');
    
    // Ask if user wants to continue
    const continueChat = await askQuestion('Would you like to chat more? (y/n): ');
    
    if (continueChat.toLowerCase() === 'y' || continueChat.toLowerCase() === 'yes') {
      console.log('\n🔄 Starting new conversation...\n');
      await runPersonalAIApp(); // Recursive call for continuous chat
    } else {
      console.log('\n👋 Thanks for chatting with Clara! Goodbye!');
      rl.close();
    }
    
  } catch (error) {
    console.error('❌ Error occurred:', error.message);
    console.log('\n🔧 Please check your configuration and try again.');
    rl.close();
  }
}

// Start the app
runPersonalAIApp();