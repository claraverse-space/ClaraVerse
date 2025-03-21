// tools_ollama.js

// This tool checks if a website is up by sending an HTTP GET request.
// It returns the HTTP status code or an error message.
export const tools = [
    {
      name: 'check_website_status',
      description: 'Checks if the specified website is up by fetching the URL and returning the status code.',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'The URL of the website to check (e.g., "https://example.com")' }
        },
        required: ['url']
      },
      // This "execute" function will be called when Ollama makes a tool call for "checkWebsiteStatus"
      execute: async function(args) {
        try {
          // If you are running in an environment where fetch is not available globally,
          // consider using a library like node-fetch.
          const response = await fetch(args.url);
          return `The website responded with status code ${response.status}.`;
        } catch (error) {
          return `Error fetching ${args.url}: ${error.message}`;
        }
      }
    }
  ];
  

