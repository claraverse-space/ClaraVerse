#!/usr/bin/env node

/**
 * LLMNodeCreator.mjs
 *
 * This CLI tool scaffolds a new node by generating code using the OpenAI API.
 * It:
 *  - Reads your API key from a .env file
 *  - Sends a prompt (with examples) to generate node UI and executor code in JSON
 *  - Prints the generated code and integration instructions
 *  - Writes the output to a file in the current working directory
 */

import dotenv from "dotenv";
dotenv.config();

import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";
import * as fs from "fs";
import path from "path";
import inquirer from "inquirer";

// Define a Zod schema for the expected response structure.
const NodeCodeSchema = z.object({
  nodeUI: z.string(),
  nodeExecutor: z.string(),
});

// Initialize the OpenAI client using your API key from .env.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateNodeCode(prompt) {
  try {
    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "You are a code generator for a node-based application.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: zodResponseFormat(NodeCodeSchema, "nodeData"),
    });
    return completion.choices[0].message.parsed;
  } catch (error) {
    console.error("Error generating node code:", error);
    return null;
  }
}

async function main() {
  // Prompt the user for the new node details.
  const answers = await inquirer.prompt([
    {
      type: "input",
      name: "nodeName",
      message: "Enter the new node name (e.g., myNewNode):",
    },
    {
      type: "input",
      name: "displayName",
      message: "Enter the display name for your node (e.g., My New Node):",
    },
    {
      type: "input",
      name: "description",
      message: "Enter a short description for your node:",
    },
  ]);

  const { nodeName, displayName, description } = answers;
  const componentName = nodeName.charAt(0).toUpperCase() + nodeName.slice(1);

  // Example code to include in the prompt.
  const exampleCode = `
--- Example UI Component (ImageInputNode) ---
import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { useTheme } from '../../../hooks/useTheme';
import { Image, Upload } from 'lucide-react';

const ImageInputNode = ({ data, isConnectable, isRunnerMode = false }) => {
  const { isDark } = useTheme();
  const tool = data.tool;
  const Icon = tool.icon;
  const nodeColor = isDark ? tool.darkColor : tool.lightColor;
  const [image, setImage] = useState(data.runtimeImage || data.config?.image || null);

  const handleImageUpload = (e) => {
    e.stopPropagation();
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const imageData = event.target.result;
          setImage(imageData);
          if (isRunnerMode) {
            data.runtimeImage = imageData;
          } else {
            if (!data.config) data.config = {};
            data.config.image = imageData;
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="node-container">
      <div className="node-header">Image Input</div>
      <div className="node-content">
        {image ? <img src={image} alt="Uploaded" /> : <label>Upload Image<input type="file" onChange={handleImageUpload} /></label>}
      </div>
      <Handle type="source" position={Position.Bottom} isConnectable={isConnectable} />
    </div>
  );
};

export default ImageInputNode;

--- Example Executor (executeImageInput) ---
import { registerNodeExecutor, NodeExecutionContext } from './NodeExecutorRegistry';

const executeImageInput = async (context) => {
  const { node } = context;
  const config = node.data.config || {};
  return config.image || null;
};

registerNodeExecutor('imageInputNode', {
  execute: executeImageInput
});
--- End Example ---
`;

  // Build the prompt that instructs the AI.
  const prompt = `
Below is an example of a node UI component and its executor code:

${exampleCode}

Now, generate complete code for a new node.
The new node should be named "${componentName}" and its UI should simply display "Hello, world!".
Its executor should return the string "Hello, world!" as output.
Return the output in JSON with the following structure:
{
  "nodeUI": "/* complete React component code here */",
  "nodeExecutor": "/* complete executor registration code here */"
}
`;

  console.log("Sending prompt to OpenAI API...\n");
  const result = await generateNodeCode(prompt);

  if (!result) {
    console.error("Failed to generate code. Please check your API key and prompt.");
    return;
  }

  const { nodeUI, nodeExecutor } = result;

  console.log("----- Generated Node UI Code -----\n");
  console.log(nodeUI);
  console.log("\n----- Generated Node Executor Code -----\n");
  console.log(nodeExecutor);

  // Write the generated code to an output file in the current directory.
  const outputFile = path.join(process.cwd(), `${componentName}_node_code.txt`);
  fs.writeFileSync(
    outputFile,
    `----- Node UI Code -----\n${nodeUI}\n\n----- Node Executor Code -----\n${nodeExecutor}\n`
  );
  console.log(`\nThe generated code has been saved to ${outputFile}\n`);

  // Print final integration instructions.
  console.log(`New node files created:
- src/nodes/${componentName}.tsx
- src/nodeExecutors/${componentName}Executor.ts

Next steps:

1. Node Registry:
   Open your NodeRegistry.ts and add:
   -------------------------------------
   import ${componentName} from './nodes/${componentName}';
   ...
   export const nodeTypes = {
     ...,
     ${nodeName}: ${componentName},
   };
   -------------------------------------

2. Toolbox Configuration:
   Open your toolbox configuration file and add the following tool item:
   -------------------------------------
   {
     id: '${nodeName}',
     name: '${displayName}',
     description: '${description}',
     icon: YourIcon,  // Import an appropriate icon
     color: 'bg-blue-500',
     bgColor: 'bg-blue-100',
     lightColor: '#3B82F6',
     darkColor: '#60A5FA',
     category: 'process',
     inputs: ['inputType'],
     outputs: ['outputType']
   }
   -------------------------------------

3. Drop Handler Mapping:
   Ensure your onDrop handler maps '${nodeName}' to '${nodeName}':
   -------------------------------------
   case '${nodeName}':
     nodeType = '${nodeName}';
     break;
   -------------------------------------

4. Executor Registration:
   Open your central executor registration file (e.g., index.tsx) and add:
   -------------------------------------
   import './nodeExecutors/${componentName}Executor';
   -------------------------------------

Happy coding!
`);
}

main();
