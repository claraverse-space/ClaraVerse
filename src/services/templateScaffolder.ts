import { WebContainer } from '@webcontainer/api';
import { ApplicationTemplate, TemplateFile } from '../components/templates';

export class TemplateScaffolder {
  private webContainer: WebContainer;
  private writeToTerminal: (data: string) => void;

  constructor(webContainer: WebContainer, writeToTerminal: (data: string) => void) {
    this.webContainer = webContainer;
    this.writeToTerminal = writeToTerminal;
  }

  async applyTemplate(
    template: ApplicationTemplate,
    frameworkId: string,
    projectName: string,
    onProgress?: (step: string, progress: number) => void
  ): Promise<boolean> {
    try {
      this.writeToTerminal(`\x1b[36m🎨 Applying template: ${template.name}\x1b[0m\n`);
      this.writeToTerminal(`\x1b[33m📋 Template: ${template.description}\x1b[0m\n`);
      
      // Check if template supports the framework
      if (!template.frameworks.includes(frameworkId)) {
        this.writeToTerminal(`\x1b[31m❌ Template "${template.name}" does not support framework "${frameworkId}"\x1b[0m\n`);
        this.writeToTerminal(`\x1b[33m💡 Supported frameworks: ${template.frameworks.join(', ')}\x1b[0m\n`);
        return false;
      }

      // Generate template files
      this.writeToTerminal(`\x1b[33m📁 Generating template files...\x1b[0m\n`);
      const templateFiles = template.generateFiles(frameworkId, projectName);
      
      if (templateFiles.length === 0) {
        this.writeToTerminal(`\x1b[33m⚠️ No files generated for this template\x1b[0m\n`);
        return true;
      }

      this.writeToTerminal(`\x1b[32m✅ Generated ${templateFiles.length} template files\x1b[0m\n`);

      // Apply each file
      let processedFiles = 0;
      for (const file of templateFiles) {
        try {
          if (onProgress) {
            onProgress(`Creating ${file.path}`, (processedFiles / templateFiles.length) * 100);
          }

          if (file.type === 'directory') {
            await this.webContainer.fs.mkdir(file.path, { recursive: true });
            this.writeToTerminal(`\x1b[90m📁 Created directory: ${file.path}\x1b[0m\n`);
          } else {
            // Check if file exists and should not be overwritten
            const fileExists = await this.fileExists(file.path);
            if (fileExists && !file.overwrite) {
              this.writeToTerminal(`\x1b[33m⚠️ Skipping existing file: ${file.path} (use overwrite: true to replace)\x1b[0m\n`);
              processedFiles++;
              continue;
            }

            // Ensure directory exists
            const dirPath = file.path.split('/').slice(0, -1).join('/');
            if (dirPath) {
              await this.webContainer.fs.mkdir(dirPath, { recursive: true });
            }

            // Write the file
            await this.webContainer.fs.writeFile(file.path, file.content);
            
            const action = fileExists ? 'Updated' : 'Created';
            this.writeToTerminal(`\x1b[90m📄 ${action} file: ${file.path} (${file.content.length} bytes)\x1b[0m\n`);
          }

          processedFiles++;
        } catch (error) {
          this.writeToTerminal(`\x1b[31m❌ Failed to create ${file.path}: ${error}\x1b[0m\n`);
          return false;
        }
      }

      if (onProgress) {
        onProgress('Template applied successfully', 100);
      }

      this.writeToTerminal(`\x1b[32m🎉 Template "${template.name}" applied successfully!\x1b[0m\n`);
      this.writeToTerminal(`\x1b[36m💡 Template features:\x1b[0m\n`);
      template.features.forEach(feature => {
        this.writeToTerminal(`\x1b[90m   • ${feature}\x1b[0m\n`);
      });
      this.writeToTerminal('\n');

      return true;

    } catch (error) {
      const errorDetails = error instanceof Error ? error.message : String(error);
      this.writeToTerminal(`\x1b[31m❌ Template application failed: ${errorDetails}\x1b[0m\n`);
      return false;
    }
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await this.webContainer.fs.readFile(path, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  async listCompatibleTemplates(frameworkId: string): Promise<ApplicationTemplate[]> {
    // This would be imported from the templates index
    const { ALL_TEMPLATES } = await import('../components/templates');
    return ALL_TEMPLATES.filter(template => template.frameworks.includes(frameworkId));
  }
} 