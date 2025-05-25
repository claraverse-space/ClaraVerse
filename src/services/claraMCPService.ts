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
   * Discover capabilities from a specific MCP server
   */
  private async discoverServerCapabilities(server: ClaraMCPServer): Promise<void> {
    // For now, we'll add some common tools based on server type
    // In a full implementation, this would communicate with the actual MCP server
    // to discover its capabilities via the MCP protocol
    
    console.log(`🔍 Checking server type for ${server.name}...`);
    
    if (server.name === 'github') {
      console.log('📦 Adding GitHub tools...');
      this.addGitHubTools(server.name);
    } else if (server.name === 'filesystem') {
      console.log('📁 Adding filesystem tools...');
      this.addFileSystemTools(server.name);
    } else if (server.name === 'brave-search') {
      console.log('🔍 Adding search tools...');
      this.addSearchTools(server.name);
    } else if (server.name === 'puppeteer') {
      console.log('🌐 Adding web scraping tools...');
      this.addWebScrapingTools(server.name);
    } else {
      console.log(`❓ Unknown server type: ${server.name}, no tools added`);
    }
    
    // Add more server-specific tool discovery logic here
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
        name: 'web_search',
        description: 'Search the web using Brave Search',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            count: { type: 'number', description: 'Number of results to return' }
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
      const tool = this.tools.get(`${toolCall.server}:${toolCall.name}`);
      if (!tool) {
        return {
          callId: toolCall.callId,
          success: false,
          error: `Tool ${toolCall.name} not found on server ${toolCall.server}`
        };
      }

      const server = this.servers.get(toolCall.server);
      if (!server || !server.isRunning) {
        return {
          callId: toolCall.callId,
          success: false,
          error: `Server ${toolCall.server} is not running`
        };
      }

      // Use the backend MCP service to execute the tool call
      if (window.mcpService?.executeToolCall) {
        try {
          const result = await window.mcpService.executeToolCall(toolCall);
          return result;
        } catch (error) {
          console.error('Backend MCP execution failed, falling back to simulation:', error);
          // Fall back to simulation if backend fails
        }
      }

      // Fallback to simulation if backend is not available
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
      console.error(`Error executing MCP tool call ${toolCall.callId}:`, error);
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
      
      case 'web_search':
        return `Search results for "${args.query}": [Mock search results]`;
      
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
    
    for (const toolCall of toolCalls) {
      if (toolCall.function?.name?.startsWith('mcp_')) {
        const nameParts = toolCall.function.name.replace('mcp_', '').split('_');
        if (nameParts.length >= 2) {
          const server = nameParts[0];
          const toolName = nameParts.slice(1).join('_');
          
          mcpToolCalls.push({
            name: toolName,
            arguments: JSON.parse(toolCall.function.arguments || '{}'),
            server: server,
            callId: toolCall.id || `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          });
        }
      }
    }
    
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