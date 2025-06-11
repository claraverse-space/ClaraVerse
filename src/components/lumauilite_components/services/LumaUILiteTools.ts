import { LiteProjectFile } from '../../LumaUILite';

export interface ToolResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export interface LumaUILiteToolsConfig {
  projectFiles: LiteProjectFile[];
  onUpdateFile: (fileId: string, content: string) => void;
  onCreateFile: (file: Omit<LiteProjectFile, 'id' | 'lastModified'>) => void;
  onDeleteFile: (fileId: string) => void;
  onFileSelect: (path: string, content: string) => void;
  onTerminalWrite?: (message: string) => void;
  projectName?: string;
}

export default class LumaUILiteTools {
  private config: LumaUILiteToolsConfig;

  constructor(config: LumaUILiteToolsConfig) {
    this.config = config;
  }

  updateConfig(config: Partial<LumaUILiteToolsConfig>) {
    this.config = { ...this.config, ...config };
  }

  // Log to terminal if available
  private log(message: string) {
    if (this.config.onTerminalWrite) {
      this.config.onTerminalWrite(message);
    }
  }

  // File Operations
  async createFile(path: string, content: string = ''): Promise<ToolResult> {
    try {
      // Check if file already exists
      const existingFile = this.config.projectFiles.find(f => f.path === path);
      if (existingFile) {
        this.log(`\x1b[31m❌ File already exists: ${path}\x1b[0m\n`);
        return {
          success: false,
          message: `File already exists: ${path}`,
          error: 'FILE_EXISTS'
        };
      }

      // Determine file properties
      const fileName = path.split('/').pop() || path;
      const extension = fileName.includes('.') ? fileName.split('.').pop() : undefined;
      const mimeType = this.getMimeType(extension);
      const isImage = this.isImageFile(extension);

      // Create new file
      const newFile: Omit<LiteProjectFile, 'id' | 'lastModified'> = {
        name: fileName,
        path,
        content,
        type: 'file',
        mimeType,
        size: content.length,
        isImage,
        extension
      };

      this.config.onCreateFile(newFile);

      // Auto-select the new file
      this.config.onFileSelect(path, content);

      this.log(`\x1b[32m✅ Created file: ${path}\x1b[0m\n`);

      return {
        success: true,
        message: `File created successfully: ${path}`,
        data: { path, content, size: content.length }
      };
    } catch (error) {
      const errorMsg = `Failed to create file ${path}: ${error}`;
      this.log(`\x1b[31m❌ ${errorMsg}\x1b[0m\n`);
      return { success: false, message: errorMsg, error: String(error) };
    }
  }

  async readFile(path: string): Promise<ToolResult> {
    try {
      const file = this.config.projectFiles.find(f => f.path === path && f.type === 'file');
      
      if (!file) {
        this.log(`\x1b[31m❌ File not found: ${path}\x1b[0m\n`);
        return {
          success: false,
          message: `File not found: ${path}`,
          error: 'FILE_NOT_FOUND'
        };
      }

      if (file.content === undefined) {
        this.log(`\x1b[31m❌ File content not available: ${path}\x1b[0m\n`);
        return {
          success: false,
          message: `File content not available: ${path}`,
          error: 'NO_CONTENT'
        };
      }

      this.log(`\x1b[32m✅ Read file: ${path} (${file.content.length} bytes)\x1b[0m\n`);

      return {
        success: true,
        message: `File read successfully: ${path}`,
        data: { path, content: file.content, size: file.content.length }
      };
    } catch (error) {
      const errorMsg = `Failed to read file ${path}: ${error}`;
      this.log(`\x1b[31m❌ ${errorMsg}\x1b[0m\n`);
      return { success: false, message: errorMsg, error: String(error) };
    }
  }

  async updateFile(path: string, content: string): Promise<ToolResult> {
    try {
      const file = this.config.projectFiles.find(f => f.path === path && f.type === 'file');
      
      if (!file) {
        this.log(`\x1b[31m❌ File not found: ${path}\x1b[0m\n`);
        return {
          success: false,
          message: `File not found: ${path}`,
          error: 'FILE_NOT_FOUND'
        };
      }

      // Update the file content
      this.config.onUpdateFile(file.id, content);

      // Auto-select the updated file
      this.config.onFileSelect(path, content);

      this.log(`\x1b[32m✅ Updated file: ${path}\x1b[0m\n`);

      return {
        success: true,
        message: `File updated successfully: ${path}`,
        data: { path, content, size: content.length }
      };
    } catch (error) {
      const errorMsg = `Failed to update file ${path}: ${error}`;
      this.log(`\x1b[31m❌ ${errorMsg}\x1b[0m\n`);
      return { success: false, message: errorMsg, error: String(error) };
    }
  }

  async editFile(path: string, content: string): Promise<ToolResult> {
    return this.updateFile(path, content);
  }

  async editFileSection(path: string, oldText: string, newText: string): Promise<ToolResult> {
    try {
      const file = this.config.projectFiles.find(f => f.path === path && f.type === 'file');
      
      if (!file || !file.content) {
        this.log(`\x1b[31m❌ File not found or has no content: ${path}\x1b[0m\n`);
        return {
          success: false,
          message: `File not found or has no content: ${path}`,
          error: 'FILE_NOT_FOUND'
        };
      }

      // Check if the old text exists in the file
      if (!file.content.includes(oldText)) {
        const errorMsg = `Text not found in file ${path}. The old_text parameter must match exactly.`;
        this.log(`\x1b[31m❌ ${errorMsg}\x1b[0m\n`);
        this.log(`\x1b[90m💡 Looking for: "${oldText.substring(0, 100)}..."\x1b[0m\n`);
        return { success: false, message: errorMsg, error: 'TEXT_NOT_FOUND' };
      }

      // Replace the text
      const newContent = file.content.replace(oldText, newText);
      
      // Update the file content
      this.config.onUpdateFile(file.id, newContent);

      // Auto-select the updated file
      this.config.onFileSelect(path, newContent);

      this.log(`\x1b[32m✅ Section edited in file: ${path}\x1b[0m\n`);
      this.log(`\x1b[90m🔄 Replaced ${oldText.length} chars with ${newText.length} chars\x1b[0m\n`);

      return {
        success: true,
        message: `File section updated successfully: ${path}`,
        data: { path, oldText, newText, newContent, size: newContent.length }
      };
    } catch (error) {
      const errorMsg = `Failed to edit file section ${path}: ${error}`;
      this.log(`\x1b[31m❌ ${errorMsg}\x1b[0m\n`);
      return { success: false, message: errorMsg, error: String(error) };
    }
  }

  async deleteFile(path: string): Promise<ToolResult> {
    try {
      const file = this.config.projectFiles.find(f => f.path === path && f.type === 'file');
      
      if (!file) {
        this.log(`\x1b[31m❌ File not found: ${path}\x1b[0m\n`);
        return {
          success: false,
          message: `File not found: ${path}`,
          error: 'FILE_NOT_FOUND'
        };
      }

      this.config.onDeleteFile(file.id);

      this.log(`\x1b[32m✅ Deleted file: ${path}\x1b[0m\n`);

      return {
        success: true,
        message: `File deleted successfully: ${path}`,
        data: { path }
      };
    } catch (error) {
      const errorMsg = `Failed to delete file ${path}: ${error}`;
      this.log(`\x1b[31m❌ ${errorMsg}\x1b[0m\n`);
      return { success: false, message: errorMsg, error: String(error) };
    }
  }

  // Directory Operations (simulated for LumaUI-lite)
  async createDirectory(path: string): Promise<ToolResult> {
    try {
      // Check if directory already exists
      const existingDir = this.config.projectFiles.find(f => f.path === path && f.type === 'directory');
      if (existingDir) {
        this.log(`\x1b[31m❌ Directory already exists: ${path}\x1b[0m\n`);
        return {
          success: false,
          message: `Directory already exists: ${path}`,
          error: 'DIR_EXISTS'
        };
      }

      const dirName = path.split('/').pop() || path;

      // Create new directory
      const newDir: Omit<LiteProjectFile, 'id' | 'lastModified'> = {
        name: dirName,
        path,
        content: '',
        type: 'directory',
        mimeType: 'inode/directory',
        size: 0
      };

      this.config.onCreateFile(newDir);

      this.log(`\x1b[32m✅ Created directory: ${path}\x1b[0m\n`);

      return {
        success: true,
        message: `Directory created successfully: ${path}`,
        data: { path }
      };
    } catch (error) {
      const errorMsg = `Failed to create directory ${path}: ${error}`;
      this.log(`\x1b[31m❌ ${errorMsg}\x1b[0m\n`);
      return { success: false, message: errorMsg, error: String(error) };
    }
  }

  async listDirectory(path: string = '.'): Promise<ToolResult> {
    try {
      let items;
      
      if (path === '.') {
        // List root level items
        items = this.config.projectFiles.filter(f => !f.path.includes('/'));
      } else {
        // List items in specific directory
        items = this.config.projectFiles.filter(f => 
          f.path.startsWith(path + '/') && 
          f.path.split('/').length === path.split('/').length + 1
        );
      }

      const itemList = items.map(item => ({
        name: item.name,
        type: item.type,
        path: item.path,
        size: item.size || 0,
        lastModified: item.lastModified
      }));

      this.log(`\x1b[32m✅ Listed directory: ${path} (${itemList.length} items)\x1b[0m\n`);

      return {
        success: true,
        message: `Directory listing for ${path}`,
        data: { path, items: itemList }
      };
    } catch (error) {
      const errorMsg = `Failed to list directory ${path}: ${error}`;
      this.log(`\x1b[31m❌ ${errorMsg}\x1b[0m\n`);
      return { success: false, message: errorMsg, error: String(error) };
    }
  }

  // Utility Operations
  async listFiles(): Promise<ToolResult> {
    return this.listDirectory('.');
  }

  async getAllFiles(): Promise<ToolResult> {
    try {
      const allFiles = this.config.projectFiles.map(file => ({
        name: file.name,
        path: file.path,
        type: file.type,
        size: file.size || 0,
        extension: file.extension,
        lastModified: file.lastModified
      }));

      this.log(`\x1b[32m✅ Listed all files: ${allFiles.length} items\x1b[0m\n`);

      return {
        success: true,
        message: `Found ${allFiles.length} files and directories`,
        data: { files: allFiles, count: allFiles.length }
      };
    } catch (error) {
      const errorMsg = `Failed to get all files: ${error}`;
      this.log(`\x1b[31m❌ ${errorMsg}\x1b[0m\n`);
      return { success: false, message: errorMsg, error: String(error) };
    }
  }

  async getProjectInfo(): Promise<ToolResult> {
    try {
      const packageFile = this.config.projectFiles.find(f => f.path === 'package.json');
      let packageJson: any = {};
      
      if (packageFile && packageFile.content) {
        try {
          packageJson = JSON.parse(packageFile.content);
        } catch (e) {
          // Invalid JSON, use default
        }
      }

      const projectInfo = {
        name: packageJson.name || this.config.projectName || 'LumaUI-lite Project',
        version: packageJson.version || '1.0.0',
        description: packageJson.description || 'A LumaUI-lite project',
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {},
        scripts: packageJson.scripts || {},
        totalFiles: this.config.projectFiles.filter(f => f.type === 'file').length,
        totalSize: this.config.projectFiles.reduce((sum, f) => sum + (f.size || 0), 0)
      };

      this.log(`\x1b[32m✅ Retrieved project info: ${projectInfo.name}\x1b[0m\n`);

      return {
        success: true,
        message: 'Project information retrieved',
        data: projectInfo
      };
    } catch (error) {
      const errorMsg = `Failed to get project info: ${error}`;
      this.log(`\x1b[31m❌ ${errorMsg}\x1b[0m\n`);
      return { success: false, message: errorMsg, error: String(error) };
    }
  }

  async searchFiles(pattern: string): Promise<ToolResult> {
    try {
      const matches: Array<{ path: string; type: string; content?: string; matchType: string }> = [];
      
      for (const file of this.config.projectFiles) {
        // Match by filename or path
        if (file.name.includes(pattern) || file.path.includes(pattern)) {
          matches.push({
            path: file.path,
            type: file.type,
            content: file.type === 'file' ? file.content : undefined,
            matchType: 'path'
          });
        }
        
        // Match by content (for non-image files)
        if (file.type === 'file' && file.content && !file.isImage && file.content.includes(pattern)) {
          const existingMatch = matches.find(m => m.path === file.path);
          if (!existingMatch) {
            matches.push({
              path: file.path,
              type: file.type,
              content: file.content,
              matchType: 'content'
            });
          } else {
            existingMatch.matchType = 'both';
          }
        }
      }

      this.log(`\x1b[32m✅ Search completed for pattern: ${pattern} (${matches.length} matches)\x1b[0m\n`);

      return {
        success: true,
        message: `Search completed for pattern: ${pattern}`,
        data: { pattern, matches, count: matches.length }
      };
    } catch (error) {
      const errorMsg = `Failed to search files: ${error}`;
      this.log(`\x1b[31m❌ ${errorMsg}\x1b[0m\n`);
      return { success: false, message: errorMsg, error: String(error) };
    }
  }

  async getFileStructure(): Promise<ToolResult> {
    try {
      const structure = {
        totalFiles: this.config.projectFiles.filter(f => f.type === 'file').length,
        totalDirectories: this.config.projectFiles.filter(f => f.type === 'directory').length,
        totalSize: this.config.projectFiles.reduce((sum, f) => sum + (f.size || 0), 0),
        files: this.config.projectFiles.map(f => ({
          name: f.name,
          path: f.path,
          type: f.type,
          size: f.size || 0,
          extension: f.extension,
          isImage: f.isImage || false
        }))
      };

      this.log(`\x1b[32m✅ Retrieved file structure: ${structure.totalFiles} files, ${structure.totalDirectories} directories\x1b[0m\n`);

      return {
        success: true,
        message: 'File structure retrieved',
        data: structure
      };
    } catch (error) {
      const errorMsg = `Failed to get file structure: ${error}`;
      this.log(`\x1b[31m❌ ${errorMsg}\x1b[0m\n`);
      return { success: false, message: errorMsg, error: String(error) };
    }
  }

  // Simulated Development Operations (since no WebContainer)
  async runCommand(command: string, args: string[] = []): Promise<ToolResult> {
    this.log(`\x1b[33m🔧 Simulated command: ${command} ${args.join(' ')}\x1b[0m\n`);
    this.log(`\x1b[90m💡 Note: LumaUI-lite runs in browser environment without command execution\x1b[0m\n`);
    
    // Simulate some common commands
    if (command === 'npm' && args[0] === 'install') {
      this.log(`\x1b[32m✅ Simulated npm install completed\x1b[0m\n`);
      return {
        success: true,
        message: `Simulated command: ${command} ${args.join(' ')}`,
        data: { command, args, simulated: true }
      };
    }
    
    if (command === 'npm' && args[0] === 'run') {
      this.log(`\x1b[32m✅ Simulated npm script execution\x1b[0m\n`);
      return {
        success: true,
        message: `Simulated script: ${args[1] || 'unknown'}`,
        data: { command, args, simulated: true }
      };
    }

    return {
      success: false,
      message: `Command execution not supported in LumaUI-lite: ${command}`,
      error: 'NOT_SUPPORTED'
    };
  }

  async installPackage(packageName: string, isDev: boolean = false): Promise<ToolResult> {
    return this.runCommand('npm', ['install', packageName, ...(isDev ? ['--save-dev'] : [])]);
  }

  async uninstallPackage(packageName: string): Promise<ToolResult> {
    return this.runCommand('npm', ['uninstall', packageName]);
  }

  async runScript(scriptName: string): Promise<ToolResult> {
    return this.runCommand('npm', ['run', scriptName]);
  }

  // Helper: Get MIME type based on file extension
  private getMimeType(extension?: string): string {
    if (!extension) return 'text/plain';
    
    const mimeTypes: Record<string, string> = {
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'jsx': 'application/javascript',
      'ts': 'application/typescript',
      'tsx': 'application/typescript',
      'json': 'application/json',
      'md': 'text/markdown',
      'txt': 'text/plain',
      'xml': 'application/xml',
      'svg': 'image/svg+xml',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'ico': 'image/x-icon',
      'vue': 'text/x-vue',
      'scss': 'text/x-scss',
      'sass': 'text/x-sass',
      'less': 'text/x-less',
      'yaml': 'text/yaml',
      'yml': 'text/yaml',
      'toml': 'text/x-toml'
    };

    return mimeTypes[extension.toLowerCase()] || 'text/plain';
  }

  // Helper: Check if file is an image
  private isImageFile(extension?: string): boolean {
    if (!extension) return false;
    
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico', 'bmp', 'tiff', 'avif'];
    return imageExtensions.includes(extension.toLowerCase());
  }

  async createLandingPage(): Promise<ToolResult> {
    const projectName = this.config.projectName || 'My Project';
    const landingPageHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="styles.css">
</head>
<body class="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-800">
    <!-- Navigation -->
    <nav class="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
                <div class="flex items-center">
                    <i class="fas fa-rocket text-white text-2xl mr-3"></i>
                    <span class="text-white font-bold text-xl">${projectName}</span>
                </div>
                <div class="hidden md:block">
                    <div class="ml-10 flex items-baseline space-x-4">
                        <a href="#home" class="text-white hover:text-blue-200 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                            <i class="fas fa-home mr-1"></i> Home
                        </a>
                        <a href="#features" class="text-white hover:text-blue-200 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                            <i class="fas fa-star mr-1"></i> Features
                        </a>
                        <a href="#about" class="text-white hover:text-blue-200 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                            <i class="fas fa-info-circle mr-1"></i> About
                        </a>
                    </div>
                </div>
                <div class="md:hidden">
                    <button id="mobile-menu-button" class="text-white hover:text-blue-200">
                        <i class="fas fa-bars text-xl"></i>
                    </button>
                </div>
            </div>
        </div>
        <!-- Mobile menu -->
        <div id="mobile-menu" class="md:hidden hidden bg-white/10 backdrop-blur-md">
            <div class="px-2 pt-2 pb-3 space-y-1">
                <a href="#home" class="text-white block px-3 py-2 rounded-md text-base font-medium">
                    <i class="fas fa-home mr-2"></i> Home
                </a>
                <a href="#features" class="text-white block px-3 py-2 rounded-md text-base font-medium">
                    <i class="fas fa-star mr-2"></i> Features
                </a>
                <a href="#about" class="text-white block px-3 py-2 rounded-md text-base font-medium">
                    <i class="fas fa-info-circle mr-2"></i> About
                </a>
            </div>
        </div>
    </nav>

    <!-- Hero Section -->
    <section id="home" class="relative min-h-screen flex items-center justify-center px-4">
        <div class="absolute inset-0 bg-black/20"></div>
        <div class="relative z-10 text-center text-white max-w-4xl mx-auto">
            <div class="mb-8">
                <i class="fas fa-code text-6xl mb-6 text-blue-300"></i>
            </div>
            <h1 class="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent">
                ${projectName}
            </h1>
            <p class="text-xl md:text-2xl mb-8 text-blue-100 leading-relaxed">
                Create beautiful, responsive websites with modern web technologies. 
                Built with Tailwind CSS and Font Awesome for the best user experience.
            </p>
            <div class="flex flex-col sm:flex-row gap-4 justify-center">
                <button class="bg-white text-blue-600 px-8 py-4 rounded-full font-semibold text-lg hover:bg-blue-50 transition-all transform hover:scale-105 shadow-lg">
                    <i class="fas fa-play mr-2"></i> Get Started
                </button>
                <button class="border-2 border-white text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-white hover:text-blue-600 transition-all transform hover:scale-105">
                    <i class="fas fa-info-circle mr-2"></i> Learn More
                </button>
            </div>
        </div>
        
        <!-- Scroll indicator -->
        <div class="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white animate-bounce">
            <i class="fas fa-chevron-down text-2xl"></i>
        </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="py-20 bg-white/10 backdrop-blur-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center mb-16">
                <h2 class="text-4xl md:text-5xl font-bold text-white mb-4">
                    <i class="fas fa-star text-yellow-300 mr-3"></i>
                    Amazing Features
                </h2>
                <p class="text-xl text-blue-100 max-w-2xl mx-auto">
                    Discover what makes this platform special
                </p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div class="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-all transform hover:scale-105">
                    <div class="text-center">
                        <i class="fas fa-bolt text-4xl text-yellow-300 mb-4"></i>
                        <h3 class="text-xl font-semibold text-white mb-3">Lightning Fast</h3>
                        <p class="text-blue-100">Optimized performance with minimal footprint and local resources</p>
                    </div>
                </div>
                <div class="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-all transform hover:scale-105">
                    <div class="text-center">
                        <i class="fas fa-shield-alt text-4xl text-green-300 mb-4"></i>
                        <h3 class="text-xl font-semibold text-white mb-3">Secure & Safe</h3>
                        <p class="text-blue-100">Built with security in mind, no external dependencies that cause issues</p>
                    </div>
                </div>
                <div class="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-all transform hover:scale-105">
                    <div class="text-center">
                        <i class="fas fa-mobile-alt text-4xl text-blue-300 mb-4"></i>
                        <h3 class="text-xl font-semibold text-white mb-3">Responsive Design</h3>
                        <p class="text-blue-100">Looks great on all devices with mobile-first approach</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- About Section -->
    <section id="about" class="py-20">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center">
                <h2 class="text-4xl md:text-5xl font-bold text-white mb-8">
                    <i class="fas fa-info-circle text-blue-300 mr-3"></i>
                    About This Project
                </h2>
                <div class="max-w-3xl mx-auto">
                    <p class="text-xl text-blue-100 mb-8 leading-relaxed">
                        Welcome to your landing page! This project was created with LumaUI-lite, 
                        giving you a solid foundation to build upon. Start customizing by editing the 
                        HTML, CSS, and JavaScript files.
                    </p>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
                        <div class="text-center">
                            <i class="fas fa-code text-4xl text-green-300 mb-4"></i>
                            <h3 class="text-xl font-semibold text-white mb-2">Modern Code</h3>
                            <p class="text-blue-100">Built with latest web technologies</p>
                        </div>
                        <div class="text-center">
                            <i class="fas fa-mobile-alt text-4xl text-purple-300 mb-4"></i>
                            <h3 class="text-xl font-semibold text-white mb-2">Responsive</h3>
                            <p class="text-blue-100">Works perfectly on all devices</p>
                        </div>
                        <div class="text-center">
                            <i class="fas fa-rocket text-4xl text-pink-300 mb-4"></i>
                            <h3 class="text-xl font-semibold text-white mb-2">Fast & Light</h3>
                            <p class="text-blue-100">Optimized for performance</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer class="bg-black/30 backdrop-blur-md border-t border-white/20 py-12">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center">
                <div class="flex justify-center items-center mb-4">
                    <i class="fas fa-heart text-red-400 mx-2"></i>
                    <span class="text-white">Built with LumaUI-lite</span>
                    <i class="fas fa-heart text-red-400 mx-2"></i>
                </div>
                <p class="text-blue-200 text-sm">
                    © ${new Date().getFullYear()} ${projectName}. Ready to be customized by you!
                </p>
                <div class="flex justify-center space-x-6 mt-6">
                    <a href="#" class="text-blue-200 hover:text-white transition-colors">
                        <i class="fab fa-github text-2xl"></i>
                    </a>
                    <a href="#" class="text-blue-200 hover:text-white transition-colors">
                        <i class="fab fa-twitter text-2xl"></i>
                    </a>
                    <a href="#" class="text-blue-200 hover:text-white transition-colors">
                        <i class="fab fa-linkedin text-2xl"></i>
                    </a>
                </div>
            </div>
        </div>
    </footer>
    
    <script src="script.js"></script>
</body>
</html>`;

    // Create the landing page file
    const landingPageFile: LiteProjectFile = {
      id: `file-${Date.now()}`,
      name: 'index.html',
      path: 'index.html',
      content: landingPageHTML,
      type: 'file',
      mimeType: 'text/html',
      extension: 'html',
      lastModified: new Date()
    };

    // Update the existing index.html or create new one
    this.config.onCreateFile(landingPageFile);
    this.config.onFileSelect?.(landingPageFile.path, landingPageFile.content);

    this.log(`\x1b[32m✅ Created beautiful landing page with modern design!\x1b[0m\n`);
    this.log(`\x1b[36m🎨 Features included:\x1b[0m\n`);
    this.log(`\x1b[90m  • Glassmorphism navigation with mobile menu\x1b[0m\n`);
    this.log(`\x1b[90m  • Full-screen hero with gradient text\x1b[0m\n`);
    this.log(`\x1b[90m  • Font Awesome icons throughout\x1b[0m\n`);
    this.log(`\x1b[90m  • Backdrop blur effects\x1b[0m\n`);
    this.log(`\x1b[90m  • Smooth scrolling navigation\x1b[0m\n`);
    this.log(`\x1b[90m  • Responsive design with Tailwind CSS\x1b[0m\n`);

    return {
      success: true,
      message: 'Landing page created successfully with modern Tailwind CSS + Font Awesome design',
      data: { 
        fileName: landingPageFile.name, 
        path: landingPageFile.path,
        features: ['Glassmorphism design', 'Font Awesome icons', 'Gradient backgrounds', 'Mobile responsive', 'Smooth animations']
      }
    };
  }
}

// Tool registry for easy access - adapted for LumaUI-lite
export const createLumaUILiteTools = (config: LumaUILiteToolsConfig): Record<string, any> => {
  const tools = new LumaUILiteTools(config);

  return {
    // File operations
    create_file: (params: any) => tools.createFile(params.path, params.content || ''),
    read_file: (params: any) => tools.readFile(params.path),
    edit_file: (params: any) => tools.updateFile(params.path, params.content),
    edit_file_section: (params: any) => tools.editFileSection(params.path, params.old_text, params.new_text),
    update_file: (params: any) => tools.updateFile(params.path, params.content),
    delete_file: (params: any) => tools.deleteFile(params.path),
    
    // Directory operations
    create_directory: (params: any) => tools.createDirectory(params.path),
    list_directory: (params: any) => tools.listDirectory(params.path || '.'),
    list_files: (params: any) => tools.listDirectory(params.path || '.'), // Alias for list_directory
    
    // Container operations (simulated)
    run_command: (params: any) => tools.runCommand(params.command, params.args || []),
    install_package: (params: any) => tools.installPackage(params.package, params.dev || false),
    uninstall_package: (params: any) => tools.uninstallPackage(params.package),
    run_script: (params: any) => tools.runScript(params.script),
    
    // Utility operations
    get_project_info: () => tools.getProjectInfo(),
    search_files: (params: any) => tools.searchFiles(params.pattern),
    get_all_files: () => tools.getAllFiles(),
    get_file_structure: () => tools.getFileStructure(),
    
    // Additional aliases for common AI expectations
    ls: (params: any) => tools.listDirectory(params?.path || '.'),
    cat: (params: any) => tools.readFile(params.path),
    mkdir: (params: any) => tools.createDirectory(params.path),
    touch: (params: any) => tools.createFile(params.path, ''),
    
    // Direct access to tools instance for config updates
    _tools: tools,
    _updateConfig: tools.updateConfig.bind(tools),
    create_landing_page: () => tools.createLandingPage()
  };
}; 