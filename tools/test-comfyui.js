// test-comfy.js

import { Client, BasePipe } from "@stable-canvas/comfyui-client";

async function testComfy() {
  // Change host/port as needed:
  const client = new Client({
    api_host: 'login.badboysm890.in/comfyui', // ComfyUI's WebSocket server
    secure: false               // false = ws://, true = wss://
  });

  try {
    // Connect the client (establish a WebSocket)
    await client.connect();
    console.log('Connected to ComfyUI!');

    // Build a simple pipeline
    const pipe = new BasePipe()
      .with(client)
      .model('sd_xl_base.ckpt') // or adjust to match an actual model in ComfyUI
      .prompt('A beautiful sunset over a mountain range')
      .save(); // save() adds an output node in Comfy's pipeline

    // Wait for the job to finish and get the resulting images
    const { images } = await pipe.wait();
    console.log(`Received ${images.length} image(s) from ComfyUI.`);
    
    // Images are returned as data URLs
    images.forEach((img, idx) => {
      console.log(`Image #${idx+1} data URL length:`, img.dataUrl.length);
      // Optionally, you could decode the base64 data and write it to a file
      // e.g. fs.writeFileSync(`output${idx}.png`, Buffer.from(img.dataUrl.split(",")[1], 'base64'));
    });

  } catch (error) {
    console.error('Error during generation:', error);
  } finally {
    // Close the socket
    client.close();
  }
}

testComfy();
