import { Ollama } from 'ollama';
import { tools as registeredTools } from './tools_ollama.js';
import readline from 'readline';

// Use your custom Ollama URL
const OLLAMA_BASE_URL = "https://login.badboysm890.in/ollama";
const ollama = new Ollama({ host: OLLAMA_BASE_URL });

// Build a mapping from tool name to its execute function for easier lookup later
const toolExecutionMap = registeredTools.reduce((map, tool) => {
  map[tool.name] = tool.execute;
  return map;
}, {});

// Function to process Ollama's response and call the appropriate tool if needed
async function chatWithOllama(userInput) {
  const messages = [{ role: 'user', content: userInput }];

  // Send the message along with the tool definitions to Ollama
  const response = await ollama.chat({
    model: 'qwen2.5:14b',
    messages: messages,
    tools: registeredTools,  // dynamically register all tools from our module
  });

   console.log("🟡 tools", registeredTools);
  console.log("🟡 Ollama Response:", response);

  // Check if Ollama decided to call a tool
  if (response.message.tool_calls) {
    for (const toolCall of response.message.tool_calls) {
      const { name, arguments: args } = toolCall.function;
      const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;

      // Look up and call the appropriate tool's execute function
      if (toolExecutionMap[name]) {
        const result = await toolExecutionMap[name](parsedArgs);
        console.log(`🟢 Function Called: ${name} with args`, parsedArgs, "→ Result:", result);

        // Add the function result as a tool message for further context
        messages.push({ role: 'tool', name, content: result.toString() });

        // Get the final response from Ollama after providing the tool output
        const finalResponse = await ollama.chat({
          model: 'qwen2.5:14b',
          messages: messages,
        });
        console.log("🟢 Final Response:", finalResponse.message.content);
      } else {
        console.log(`🔴 Unknown function: ${name}`);
      }
    }
  } else {
    console.log("🟢 Ollama Answer (No Function Calling Needed):", response.message.content);
  }
}

// Set up readline for terminal input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question("How can I help you? ", (userQuery) => {
  chatWithOllama(userQuery)
    .then(() => rl.close())
    .catch(err => {
      console.error(err);
      rl.close();
    });
});
