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
    const landingPageHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Beautiful Landing Page - Tailwind CSS Test</title>
</head>
<body class="bg-gray-50">
    <!-- Navigation -->
    <nav class="bg-white shadow-lg">
        <div class="container mx-auto px-6 py-4">
            <div class="flex justify-between items-center">
                <div class="text-xl font-bold text-gray-800">LumaUI-lite</div>
                <div class="hidden md:flex space-x-6">
                    <a href="#" class="text-gray-600 hover:text-blue-600 transition">Home</a>
                    <a href="#" class="text-gray-600 hover:text-blue-600 transition">About</a>
                    <a href="#" class="text-gray-600 hover:text-blue-600 transition">Services</a>
                    <a href="#" class="text-gray-600 hover:text-blue-600 transition">Contact</a>
                </div>
            </div>
        </div>
    </nav>

    <!-- Hero Section -->
    <section class="bg-white py-20">
        <div class="container mx-auto px-6 text-center">
            <h1 class="text-4xl md:text-6xl font-bold text-gray-800 mb-6">
                Welcome to Our
                <span class="text-blue-600">Amazing</span>
                Platform
            </h1>
            <p class="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
                Create beautiful, responsive websites with our secure Tailwind CSS implementation. 
                No more COEP blocking issues!
            </p>
            <div class="space-x-4">
                <button class="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold transition shadow-lg">
                    Get Started
                </button>
                <button class="border border-gray-300 hover:bg-gray-100 text-gray-700 px-8 py-3 rounded-lg font-semibold transition">
                    Learn More
                </button>
            </div>
        </div>
    </section>

    <!-- Features Section -->
    <section class="py-20 bg-gray-50">
        <div class="container mx-auto px-6">
            <h2 class="text-3xl font-bold text-center text-gray-800 mb-12">
                Why Choose Our Platform?
            </h2>
            <div class="grid md:grid-cols-3 gap-8">
                <div class="bg-white p-6 rounded-xl shadow-lg text-center">
                    <div class="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span class="text-2xl">🚀</span>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-800 mb-3">Fast & Secure</h3>
                    <p class="text-gray-600">Built with security in mind. No external CDN dependencies that cause COEP issues.</p>
                </div>
                <div class="bg-white p-6 rounded-xl shadow-lg text-center">
                    <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span class="text-2xl">📱</span>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-800 mb-3">Responsive Design</h3>
                    <p class="text-gray-600">Looks great on all devices. Mobile-first approach ensures perfect compatibility.</p>
                </div>
                <div class="bg-white p-6 rounded-xl shadow-lg text-center">
                    <div class="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span class="text-2xl">⚡</span>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-800 mb-3">Lightning Fast</h3>
                    <p class="text-gray-600">Optimized performance with minimal CSS footprint and local resources.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- CTA Section -->
    <section class="bg-blue-600 py-20">
        <div class="container mx-auto px-6 text-center">
            <h2 class="text-3xl font-bold text-white mb-6">
                Ready to Get Started?
            </h2>
            <p class="text-blue-100 text-lg mb-8 max-w-xl mx-auto">
                Join thousands of developers who trust our secure, fast platform for their projects.
            </p>
            <button class="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition shadow-lg">
                Start Building Today
            </button>
        </div>
    </section>

    <!-- Footer -->
    <footer class="bg-gray-800 py-12">
        <div class="container mx-auto px-6">
            <div class="text-center">
                <div class="text-2xl font-bold text-white mb-4">YourBrand</div>
                <p class="text-gray-400 mb-6">Building the future, one secure website at a time.</p>
                <div class="flex justify-center space-x-6">
                    <a href="#" class="text-gray-400 hover:text-white transition">Privacy</a>
                    <a href="#" class="text-gray-400 hover:text-white transition">Terms</a>
                    <a href="#" class="text-gray-400 hover:text-white transition">Support</a>
                </div>
                <div class="mt-6 pt-6 border-t border-gray-700">
                    <p class="text-gray-400 text-sm">
                        © 2024 YourBrand. All rights reserved. Built with LumaUI-lite.
                    </p>
                </div>
            </div>
        </div>
    </footer>

    <script>
        // Add some interactive functionality
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🎉 Landing page loaded successfully!');
            console.log('✅ Tailwind CSS is working without COEP issues!');
            
            // Add click handlers for buttons
            const buttons = document.querySelectorAll('button');
            buttons.forEach(button => {
                button.addEventListener('click', function() {
                    console.log('Button clicked:', this.textContent);
                    // Add ripple effect or other interactions here
                });
            });
            
            // Simple scroll animation
            window.addEventListener('scroll', function() {
                const nav = document.querySelector('nav');
                if (window.scrollY > 50) {
                    nav.classList.add('shadow-lg');
                } else {
                    nav.classList.remove('shadow-lg');
                }
            });
        });
    </script>
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

    this.log(`\x1b[32m✅ Created beautiful landing page with secure Tailwind CSS!\x1b[0m\n`);
    this.log(`\x1b[36m🎨 Features included:\x1b[0m\n`);
    this.log(`\x1b[90m  • Responsive navigation\x1b[0m\n`);
    this.log(`\x1b[90m  • Hero section with call-to-action\x1b[0m\n`);
    this.log(`\x1b[90m  • Features grid layout\x1b[0m\n`);
    this.log(`\x1b[90m  • Footer with links\x1b[0m\n`);
    this.log(`\x1b[90m  • Interactive JavaScript\x1b[0m\n`);
    this.log(`\x1b[90m  • No external CDN dependencies\x1b[0m\n`);

    return {
      success: true,
      message: 'Landing page created successfully with secure Tailwind CSS implementation',
      data: { 
        fileName: landingPageFile.name, 
        path: landingPageFile.path,
        features: ['Responsive design', 'Secure Tailwind CSS', 'Interactive elements', 'Modern layout']
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