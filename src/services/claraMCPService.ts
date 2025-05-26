/**
 * Clara MCP Service
 * 
 * This service handles Model Context Protocol (MCP) integration for Clara Assistant.
 * It manages MCP servers, discovers available tools and resources, and executes tool calls.
 */

import { 
  ClaraMCPServer, 
  ClaraMCPTool, 
  ClaraMCPResource, 
  ClaraMCPToolCall, 
  ClaraMCPToolResult 
} from '../types/clara_assistant_types';

/**
 * MCP Client for communicating with MCP servers
 */
export class ClaraMCPService {
  private servers: Map<string, ClaraMCPServer> = new Map();
  private tools: Map<string, ClaraMCPTool> = new Map();
  private resources: Map<string, ClaraMCPResource> = new Map();
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the MCP service
   */
  public async initialize(): Promise<void> {
    try {
      console.log('🔧 Initializing Clara MCP Service...');
      await this.refreshServers();
      
      // If no servers exist, set up a test GitHub server
      if (this.servers.size === 0) {
        console.log('📦 No MCP servers found, setting up test GitHub server...');
        await this.setupTestGitHubServer();
      }
      
      await this.discoverToolsAndResources();
      this.isInitialized = true;
      console.log('✅ Clara MCP Service initialized successfully');
      console.log(`📊 MCP Status: ${this.servers.size} servers, ${this.tools.size} tools, ${this.resources.size} resources`);
    } catch (error) {
      console.error('❌ Failed to initialize Clara MCP Service:', error);
    }
  }

  /**
   * Refresh the list of MCP servers from the backend
   */
  public async refreshServers(): Promise<void> {
    try {
      console.log('🔄 Refreshing MCP servers...');
      if (!window.mcpService) {
        console.warn('⚠️ MCP service not available in window object');
        return;
      }

      const servers = await window.mcpService.getServers();
      this.servers.clear();
      
      console.log(`📡 Retrieved ${servers.length} servers from backend:`, servers.map(s => ({ 
        name: s.name, 
        isRunning: s.isRunning, 
        status: s.status,
        config: s.config,
        enabled: s.config?.enabled
      })));
      
      for (const server of servers) {
        console.log(`💾 Loading server: ${server.name}`, {
          isRunning: server.isRunning,
          status: server.status,
          config: server.config,
          enabled: server.config?.enabled
        });
        this.servers.set(server.name, server);
      }
      
      console.log(`💾 Loaded ${servers.length} MCP servers into service`);
    } catch (error) {
      console.error('❌ Failed to refresh MCP servers:', error);
    }
  }

  /**
   * Discover available tools and resources from running MCP servers
   */
  public async discoverToolsAndResources(): Promise<void> {
    console.log('🔍 Starting tool and resource discovery...');
    this.tools.clear();
    this.resources.clear();

    // Get servers that are either running OR enabled (for testing)
    const availableServers = Array.from(this.servers.values()).filter(
      server => server.isRunning || server.config?.enabled !== false
    );

    const runningServers = availableServers.filter(
      server => server.isRunning && server.status === 'running'
    );

    console.log(`🏃 Found ${runningServers.length} running servers and ${availableServers.length} available servers out of ${this.servers.size} total servers`);
    console.log('🏃 Running servers:', runningServers.map(s => ({ name: s.name, status: s.status })));
    console.log('📋 Available servers:', availableServers.map(s => ({ name: s.name, status: s.status, isRunning: s.isRunning, enabled: s.config?.enabled })));

    // Process running servers first
    for (const server of runningServers) {
      try {
        console.log(`🔧 Discovering capabilities for running server: ${server.name}`);
        await this.discoverServerCapabilities(server);
      } catch (error) {
        console.warn(`⚠️ Failed to discover capabilities for running server ${server.name}:`, error);
      }
    }

    // For testing: also process enabled but not running servers
    const enabledButNotRunning = availableServers.filter(
      server => !server.isRunning && server.config?.enabled !== false
    );

    if (enabledButNotRunning.length > 0) {
      console.log(`🧪 Adding tools for ${enabledButNotRunning.length} enabled but not running servers (testing mode)`);
      for (const server of enabledButNotRunning) {
        try {
          console.log(`🔧 Discovering capabilities for enabled server: ${server.name} (not running)`);
          await this.discoverServerCapabilities(server);
        } catch (error) {
          console.warn(`⚠️ Failed to discover capabilities for enabled server ${server.name}:`, error);
        }
      }
    }

    console.log(`✅ Discovery complete: ${this.tools.size} tools and ${this.resources.size} resources`);
    if (this.tools.size > 0) {
      console.log('🛠️ Available tools:', Array.from(this.tools.keys()));
    }
  }

  /**
   * Discover capabilities from a specific MCP server (dynamic tool discovery)
   */
  private async discoverServerCapabilities(server: ClaraMCPServer): Promise<void> {
    // Dynamic MCP tool discovery using the MCP protocol
    try {
      if (!window.mcpService?.executeToolCall) {
        throw new Error('MCP service not available in window object');
      }
      // Compose a tool call for 'tools/list' (MCP standard)
      const callId = `list_tools_${server.name}_${Date.now()}`;
      const toolCall = {
        name: 'tools/list',
        arguments: {},
        server: server.name,
        callId
      };
      // Send the request to the MCP server
      const response = await window.mcpService.executeToolCall(toolCall);
      if (response && response.success && Array.isArray(response.content)) {
        // The result should be an array of tool definitions
        const tools = response.content.find((c: any) => c.type === 'json' || c.type === 'object' || c.type === 'text');
        let toolList = [];
        if (tools && tools.data) {
          // If type: 'json', parse data
          try {
            toolList = typeof tools.data === 'string' ? JSON.parse(tools.data) : tools.data;
          } catch (e) {
            toolList = [];
          }
        } else if (tools && tools.text) {
          // If type: 'text', try to parse as JSON
          try {
            toolList = JSON.parse(tools.text);
          } catch (e) {
            toolList = [];
          }
        }
        if (Array.isArray(toolList)) {
          for (const tool of toolList) {
            if (tool && tool.name && tool.inputSchema) {
              this.tools.set(`${server.name}:${tool.name}`, {
                ...tool,
                server: server.name
              });
            }
          }
          console.log(`✅ Dynamically discovered ${toolList.length} tools from MCP server '${server.name}'`);
          return;
        }
      }
      throw new Error('No valid tool list returned from server');
    } catch (error) {
      console.warn(`⚠️ Dynamic tool discovery failed for server ${server.name}:`, error);
      // Optionally, fallback to hardcoded tools for known servers (legacy/test only)
      if (server.name === 'github') {
        this.addGitHubTools(server.name);
      } else if (server.name === 'filesystem') {
        this.addFileSystemTools(server.name);
      } else if (server.name === 'brave-search') {
        this.addSearchTools(server.name);
      } else if (server.name === 'puppeteer') {
        this.addWebScrapingTools(server.name);
      } else {
        console.log(`❓ Unknown server type: ${server.name}, no tools added`);
      }
    }
  }

  /**
   * Add GitHub-specific tools
   */
  private addGitHubTools(serverName: string): void {
    const githubTools: ClaraMCPTool[] = [
      {
        name: 'search_repositories',
        description: 'Search for GitHub repositories',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            sort: { type: 'string', description: 'Sort order (stars, forks, updated)' },
            order: { type: 'string', description: 'Sort direction (asc, desc)' }
          },
          required: ['query']
        },
        server: serverName
      },
      {
        name: 'get_repository',
        description: 'Get information about a specific repository',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' }
          },
          required: ['owner', 'repo']
        },
        server: serverName
      },
      {
        name: 'list_issues',
        description: 'List issues in a repository',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            state: { type: 'string', description: 'Issue state (open, closed, all)' }
          },
          required: ['owner', 'repo']
        },
        server: serverName
      },
      {
        name: 'create_issue',
        description: 'Create a new issue in a repository',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            title: { type: 'string', description: 'Issue title' },
            body: { type: 'string', description: 'Issue body' }
          },
          required: ['owner', 'repo', 'title']
        },
        server: serverName
      },
      {
        name: 'get_file_contents',
        description: 'Get contents of a file or directory',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            path: { type: 'string', description: 'Path to file/directory' },
            branch: { type: 'string', description: 'Branch to get contents from' }
          },
          required: ['owner', 'repo', 'path']
        },
        server: serverName
      },
      {
        name: 'create_or_update_file',
        description: 'Create or update a single file in a repository',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            path: { type: 'string', description: 'Path where to create/update the file' },
            content: { type: 'string', description: 'Content of the file' },
            message: { type: 'string', description: 'Commit message' },
            branch: { type: 'string', description: 'Branch to create/update the file in' },
            sha: { type: 'string', description: 'SHA of file being replaced (for updates)' }
          },
          required: ['owner', 'repo', 'path', 'content', 'message', 'branch']
        },
        server: serverName
      },
      {
        name: 'create_pull_request',
        description: 'Create a new pull request',
        inputSchema: {
          type: 'object',
          properties: {
            owner: { type: 'string', description: 'Repository owner' },
            repo: { type: 'string', description: 'Repository name' },
            title: { type: 'string', description: 'PR title' },
            body: { type: 'string', description: 'PR description' },
            head: { type: 'string', description: 'Branch containing changes' },
            base: { type: 'string', description: 'Branch to merge into' },
            draft: { type: 'boolean', description: 'Create as draft PR' }
          },
          required: ['owner', 'repo', 'title', 'head', 'base']
        },
        server: serverName
      }
    ];

    for (const tool of githubTools) {
      this.tools.set(`${serverName}:${tool.name}`, tool);
    }
  }

  /**
   * Add filesystem-specific tools
   */
  private addFileSystemTools(serverName: string): void {
    const fsTools: ClaraMCPTool[] = [
      {
        name: 'read_file',
        description: 'Read the contents of a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to read' }
          },
          required: ['path']
        },
        server: serverName
      },
      {
        name: 'write_file',
        description: 'Write content to a file',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path to write' },
            content: { type: 'string', description: 'Content to write' }
          },
          required: ['path', 'content']
        },
        server: serverName
      },
      {
        name: 'list_directory',
        description: 'List contents of a directory',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Directory path to list' }
          },
          required: ['path']
        },
        server: serverName
      }
    ];

    for (const tool of fsTools) {
      this.tools.set(`${serverName}:${tool.name}`, tool);
    }
  }

  /**
   * Add search-specific tools
   */
  private addSearchTools(serverName: string): void {
    const searchTools: ClaraMCPTool[] = [
      {
        name: 'brave_web_search',
        description: 'Execute web searches with pagination and filtering',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search terms' },
            count: { type: 'number', description: 'Results per page (max 20)' },
            offset: { type: 'number', description: 'Pagination offset (max 9)' }
          },
          required: ['query']
        },
        server: serverName
      },
      {
        name: 'brave_local_search',
        description: 'Search for local businesses and services',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Local search terms' },
            count: { type: 'number', description: 'Number of results (max 20)' }
          },
          required: ['query']
        },
        server: serverName
      }
    ];

    for (const tool of searchTools) {
      this.tools.set(`${serverName}:${tool.name}`, tool);
    }
  }

  /**
   * Add web scraping tools
   */
  private addWebScrapingTools(serverName: string): void {
    const webTools: ClaraMCPTool[] = [
      {
        name: 'scrape_page',
        description: 'Scrape content from a web page',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to scrape' },
            selector: { type: 'string', description: 'CSS selector for specific content' }
          },
          required: ['url']
        },
        server: serverName
      },
      {
        name: 'screenshot_page',
        description: 'Take a screenshot of a web page',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to screenshot' },
            width: { type: 'number', description: 'Screenshot width' },
            height: { type: 'number', description: 'Screenshot height' }
          },
          required: ['url']
        },
        server: serverName
      }
    ];

    for (const tool of webTools) {
      this.tools.set(`${serverName}:${tool.name}`, tool);
    }
  }

  /**
   * Get all available MCP tools
   */
  public getAvailableTools(): ClaraMCPTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Get tools from specific servers
   */
  public getToolsFromServers(serverNames: string[]): ClaraMCPTool[] {
    return Array.from(this.tools.values()).filter(
      tool => serverNames.includes(tool.server)
    );
  }

  /**
   * Get all available MCP resources
   */
  public getAvailableResources(): ClaraMCPResource[] {
    return Array.from(this.resources.values());
  }

  /**
   * Get running MCP servers
   */
  public getRunningServers(): ClaraMCPServer[] {
    return Array.from(this.servers.values()).filter(
      server => server.isRunning && server.status === 'running'
    );
  }

  /**
   * Execute an MCP tool call
   */
  public async executeToolCall(toolCall: ClaraMCPToolCall): Promise<ClaraMCPToolResult> {
    try {
      console.log(`🔧 [MCP] Starting tool execution:`, toolCall);
      
      const tool = this.tools.get(`${toolCall.server}:${toolCall.name}`);
      if (!tool) {
        console.error(`❌ [MCP] Tool not found: ${toolCall.server}:${toolCall.name}`);
        console.log(`🔍 [MCP] Available tools:`, Array.from(this.tools.keys()));
        return {
          callId: toolCall.callId,
          success: false,
          error: `Tool ${toolCall.name} not found on server ${toolCall.server}`
        };
      }

      console.log(`✅ [MCP] Tool found:`, tool);

      const server = this.servers.get(toolCall.server);
      if (!server || !server.isRunning) {
        console.error(`❌ [MCP] Server not running: ${toolCall.server}`);
        console.log(`🔍 [MCP] Server status:`, server);
        console.log(`🔍 [MCP] Available servers:`, Array.from(this.servers.keys()));
        return {
          callId: toolCall.callId,
          success: false,
          error: `Server ${toolCall.server} is not running`
        };
      }

      console.log(`✅ [MCP] Server is running:`, server);

      // Use the backend MCP service to execute the tool call
      console.log(`🔍 [MCP] Checking window.mcpService:`, !!window.mcpService);
      console.log(`🔍 [MCP] Checking executeToolCall method:`, !!window.mcpService?.executeToolCall);
      
      if (window.mcpService?.executeToolCall) {
        try {
          console.log(`📡 [MCP] Calling backend MCP service with:`, toolCall);
          const result = await window.mcpService.executeToolCall(toolCall);
          console.log(`📥 [MCP] Backend result:`, result);
          return result;
        } catch (error) {
          console.error('❌ [MCP] Backend MCP execution failed, falling back to simulation:', error);
          // Fall back to simulation if backend fails
        }
      } else {
        console.warn('⚠️ [MCP] Backend MCP service not available, using simulation');
      }

      // Fallback to simulation if backend is not available
      console.log(`🎭 [MCP] Using simulation for tool:`, toolCall);
      const result = await this.simulateToolExecution(toolCall, tool);
      
      return {
        callId: toolCall.callId,
        success: true,
        content: [
          {
            type: 'text',
            text: result
          }
        ],
        metadata: {
          server: toolCall.server,
          tool: toolCall.name,
          executedAt: new Date().toISOString(),
          simulated: true // Mark as simulated
        }
      };
    } catch (error) {
      console.error(`❌ [MCP] Error executing MCP tool call ${toolCall.callId}:`, error);
      return {
        callId: toolCall.callId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Simulate tool execution (placeholder for actual MCP communication)
   */
  private async simulateToolExecution(toolCall: ClaraMCPToolCall, tool: ClaraMCPTool): Promise<string> {
    // This is a placeholder implementation
    // In a real implementation, this would send the tool call to the MCP server
    // and return the actual result
    
    const { name, arguments: args } = toolCall;
    
    switch (name) {
      case 'search_repositories':
        return `Found repositories matching "${args.query}": [Mock results for ${args.query}]`;
      
      case 'get_repository':
        return `Repository ${args.owner}/${args.repo}: [Mock repository information]`;
      
      case 'list_issues':
        return `Issues for ${args.owner}/${args.repo}: [Mock issue list]`;
      
      case 'create_issue':
        return `Created issue "${args.title}" in ${args.owner}/${args.repo}: [Mock issue details]`;
      
      case 'get_file_contents':
        return `Contents of ${args.path} in ${args.owner}/${args.repo}: [Mock file contents]`;
      
      case 'create_or_update_file':
        return `Created/updated file ${args.path} in ${args.owner}/${args.repo}: [Mock file operation result]`;
      
      case 'create_pull_request':
        return `Created pull request "${args.title}" in ${args.owner}/${args.repo}: [Mock PR details]`;
      
      case 'brave_web_search':
        return `Web search results for "${args.query}": [Mock search results for ${args.query}]`;
      
      case 'brave_local_search':
        return `Local search results for "${args.query}": [Mock local business results for ${args.query}]`;
      
      case 'read_file':
        return `Contents of ${args.path}: [Mock file contents]`;
      
      case 'scrape_page':
        return `Scraped content from ${args.url}: [Mock scraped content]`;
      
      default:
        return `Executed ${name} with arguments: ${JSON.stringify(args)}`;
    }
  }

  /**
   * Convert tool calls to OpenAI-compatible format for AI models
   */
  public convertToolsToOpenAIFormat(): any[] {
    const tools = this.getAvailableTools();
    
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: `mcp_${tool.server}_${tool.name}`,
        description: `[MCP:${tool.server}] ${tool.description}`,
        parameters: tool.inputSchema
      }
    }));
  }

  /**
   * Parse OpenAI tool calls back to MCP format
   */
  public parseOpenAIToolCalls(toolCalls: any[]): ClaraMCPToolCall[] {
    const mcpToolCalls: ClaraMCPToolCall[] = [];
    
    console.log(`🔍 [MCP-PARSE] Starting to parse ${toolCalls.length} tool calls`);
    
    for (const toolCall of toolCalls) {
      try {
        console.log(`🔍 [MCP-PARSE] Processing tool call:`, JSON.stringify(toolCall, null, 2));
        
        if (toolCall.function?.name?.startsWith('mcp_')) {
          const nameParts = toolCall.function.name.replace('mcp_', '').split('_');
          console.log(`🔍 [MCP-PARSE] Name parts:`, nameParts);
          
          if (nameParts.length >= 2) {
            const server = nameParts[0];
            const toolName = nameParts.slice(1).join('_');
            console.log(`🔍 [MCP-PARSE] Server: ${server}, Tool: ${toolName}`);
            
            // Parse arguments safely with better error handling
            let parsedArguments = {};
            try {
              const argsString = toolCall.function.arguments || '{}';
              console.log(`🔍 [MCP-PARSE] Raw arguments:`, argsString);
              console.log(`🔍 [MCP-PARSE] Arguments type:`, typeof argsString);
              
              if (typeof argsString === 'string') {
                const trimmedArgs = argsString.trim();
                console.log(`🔍 [MCP-PARSE] Trimmed arguments:`, trimmedArgs);
                
                if (trimmedArgs === '' || trimmedArgs === 'null' || trimmedArgs === 'undefined') {
                  parsedArguments = {};
                  console.log(`🔍 [MCP-PARSE] Empty/null arguments, using empty object`);
                } else {
                  parsedArguments = JSON.parse(trimmedArgs);
                  console.log(`🔍 [MCP-PARSE] Successfully parsed arguments:`, parsedArguments);
                }
              } else if (argsString && typeof argsString === 'object') {
                parsedArguments = argsString;
                console.log(`🔍 [MCP-PARSE] Using object arguments directly:`, parsedArguments);
              } else {
                parsedArguments = {};
                console.log(`🔍 [MCP-PARSE] Invalid arguments type, using empty object`);
              }
            } catch (parseError) {
              console.warn(`⚠️ Failed to parse tool arguments for ${toolCall.function.name}:`, parseError);
              console.warn(`⚠️ Raw arguments:`, toolCall.function.arguments);
              parsedArguments = {};
            }
            
            const mcpToolCall = {
              name: toolName,
              arguments: parsedArguments,
              server: server,
              callId: toolCall.id || `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
            };
            
            console.log(`🔍 [MCP-PARSE] Created MCP tool call:`, mcpToolCall);
            mcpToolCalls.push(mcpToolCall);
          } else {
            console.warn(`⚠️ Invalid MCP tool name format: ${toolCall.function.name}`);
          }
        } else {
          console.log(`🔍 [MCP-PARSE] Skipping non-MCP tool call: ${toolCall.function?.name}`);
        }
      } catch (error) {
        console.warn(`⚠️ Error parsing tool call:`, error, toolCall);
      }
    }
    
    console.log(`🔍 [MCP-PARSE] Finished parsing, created ${mcpToolCalls.length} MCP tool calls`);
    return mcpToolCalls;
  }

  /**
   * Check if MCP service is ready
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Set up a test GitHub MCP server
   */
  public async setupTestGitHubServer(): Promise<boolean> {
    try {
      if (!window.mcpService) {
        console.error('❌ MCP service not available in window object');
        return false;
      }

      console.log('🔧 Setting up test GitHub MCP server...');
      
      const githubServerConfig = {
        name: 'github',
        type: 'stdio' as const,
        command: 'npx',
        args: ['@modelcontextprotocol/server-github'],
        env: {
          GITHUB_PERSONAL_ACCESS_TOKEN: 'your-github-token-here'
        },
        description: 'GitHub repository and issue management',
        enabled: true
      };

      try {
        await window.mcpService.addServer(githubServerConfig);
        console.log('✅ GitHub MCP server added successfully');
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          console.log('ℹ️ GitHub MCP server already exists, skipping add');
        } else {
          throw error;
        }
      }

      // Try to start the server
      try {
        console.log('🚀 Attempting to start GitHub MCP server...');
        await window.mcpService.startServer('github');
        console.log('✅ GitHub MCP server started successfully');
      } catch (startError) {
        console.warn('⚠️ Failed to start GitHub MCP server (this is expected without proper credentials):', startError);
        // Continue anyway - we'll add tools in testing mode
      }
      
      // Refresh our local state
      await this.refreshServers();
      await this.discoverToolsAndResources();
      
      return true;
    } catch (error) {
      console.error('❌ Failed to setup GitHub MCP server:', error);
      return false;
    }
  }

  /**
   * Refresh all MCP data
   */
  public async refresh(): Promise<void> {
    await this.refreshServers();
    await this.discoverToolsAndResources();
  }
}

/**
 * Singleton instance of the Clara MCP Service
 */
export const claraMCPService = new ClaraMCPService(); 