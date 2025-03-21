#!/usr/bin/env node

import { Ollama } from 'ollama';
import * as childProcess from 'child_process';
import readline from 'readline';

let globallPrompt = ""

async function getNewCode( prompt, code) {

  const nodejsEvalTool = {
    type: 'function',
    function: {
      name: 'nodejs_eval',
      description: 'Executes arbitrary JavaScript code on the Node.js eval, so always provide a code that can run in eval function and alwasy try for human format and only supports js only no const token',
      parameters: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string', description: 'The JavaScript code to execute in eval and never use const' }
        }
      }
    }
  };


  const ollama = new Ollama({
    host: 'https://login.badboysm890.in/ollama'
  });

  prompt = "for the query "+globallPrompt+" ..this was the code generated "+ code + " and the error was "+ prompt+ " please try to fix this code to run in but the prompble is i want this code to be fixed nothing else i can accept "

  let messages = [{
    role: 'user',
    content: prompt
  }];

   const response = await  ollama.chat({
     model: "qwen2.5:14b",
     messages: messages,
     tools: [nodejsEvalTool]
   });

   console.log('Ollama response:', response.message.tool_calls);

    if (response.message.tool_calls) {
      // Process tool calls if present.
      console.log('Tool calls:', response.message.tool_calls[0].function.arguments);

    }

}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Define the nodejs_eval function (tool implementation)
// ─────────────────────────────────────────────────────────────────────────────
function nodejsEval(args) {
  const { code } = args;
  try {
    const safeCode = code.replace(/"/g, '\\"');
    const output = eval(`(function() { return ${safeCode}; })()`);
    console.log('Output:', output);
    return output;
  } catch (err) {
    // call the getNewCode function to get the new code
    getNewCode(err.message, code);

    return `Error executing code: ${err.message}`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Define the nodejs_eval tool following the same structure as the add/subtract tools
// ─────────────────────────────────────────────────────────────────────────────
const nodejsEvalTool = {
  type: 'function',
  function: {
    name: 'nodejs_eval',
    description: 'Executes arbitrary JavaScript code on the Node.js eval, so always provide a code that can run in eval function and alwasy try for human format and only supports js only no const token',
    parameters: {
      type: 'object',
      required: ['code'],
      properties: {
        code: { type: 'string', description: 'The JavaScript code to execute in eval and never use const' }
      }
    }
  }
};

// Mapping of available functions (tools) for the agent to call.
const availableFunctions = {
  nodejs_eval: nodejsEval
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Main function: prompt for input, send query to Ollama, process tool calls, and get final answer
// ─────────────────────────────────────────────────────────────────────────────
async function run(model) {
  // Create an Ollama client using your base URL.
  const ollama = new Ollama({
    host: 'https://login.badboysm890.in/ollama'
  });

  // Set up readline to ask the user for the JavaScript code to run.
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question("Enter your JavaScript code to execute: ", async (userCode) => {
    // Build the initial message.
    globallPrompt = userCode
    const messages = [{
      role: 'user',
      content: `Please try to answer or process this :\n${userCode}`
    }];
    console.log('Prompt:', messages[0].content);

    // Send the initial query along with the tool definition.
    const response = await ollama.chat({
      model: model,
      messages: messages,
      tools: [nodejsEvalTool]
    });
    console.log('Ollama response:', response.message.content);

    // Process tool calls if present.
    if (response.message.tool_calls) {
      for (const toolCall of response.message.tool_calls) {
        const functionName = toolCall.function.name;
        let args = toolCall.function.arguments;
        // If the arguments are a string, attempt to parse them.
        if (typeof args === 'string') {
          try {
            args = JSON.parse(args);
          } catch (err) {
            // Use the raw string if parsing fails.
          }
        }
        const functionToCall = availableFunctions[functionName];
        if (functionToCall) {
          console.log(`Calling function: ${functionName}`);
          console.log('Arguments:', args);
          const output = functionToCall(args);
          console.log('Function output:', output);
          // Append the model's response and the tool's output to the conversation.
          messages.push(response.message);
          messages.push({
            role: 'tool',
            content: output.toString()+ "\n" + "convert this to human readable format as the query was "+ '/n' + userCode
          });
        } else {
          console.log('Function', functionName, 'not found');
        }
      }
      // Get the final response from Ollama that incorporates the tool outputs.
      const finalResponse = await ollama.chat({
        model: model,
        messages: messages
      });
      console.log('Final response:', finalResponse.message.content);
    } else {
      console.log('No tool calls returned from model.');
    }
    rl.close();
  });
}

// Run the agent using your model "qwen2.5:14b".
run('qwen2.5:14b').catch(error => console.error("An error occurred:", error));
