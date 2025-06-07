import React, { useState, useEffect } from 'react';
import { Plus, FolderOpen, Trash2, Edit, Eye, Play } from 'lucide-react';
import LumaUILiteProjectModal from './lumauilite_components/LumaUILiteProjectModal';
import LumaUILiteEditor from './lumauilite_components/LumaUILiteEditor';
import LumaUILiteAppPreview from './lumauilite_components/LumaUILiteAppPreview';

export interface LiteProjectFile {
  id: string;
  name: string;
  path: string;
  content: string;
  type: 'file' | 'directory';
  mimeType?: string;
  size?: number;
  isImage?: boolean;
  extension?: string;
  lastModified: Date;
}

export interface LiteProject {
  id: string;
  name: string;
  description: string;
  type: string;
  features: string[];
  files: {
    // Legacy support for existing projects
    html?: string;
    css?: string;
    js?: string;
  };
  // New file system
  projectFiles: LiteProjectFile[];
  createdAt: Date;
  lastModified: Date;
}

const LumaUILite: React.FC = () => {
  const [projects, setProjects] = useState<LiteProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<LiteProject | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isAppPreviewOpen, setIsAppPreviewOpen] = useState(false);

  // Load projects from localStorage with migration support
  useEffect(() => {
    const savedProjects = localStorage.getItem('lumaui-lite-projects');
    if (savedProjects) {
      try {
        const parsed = JSON.parse(savedProjects);
        setProjects(parsed.map((p: any) => ({
          ...p,
          createdAt: new Date(p.createdAt),
          lastModified: new Date(p.lastModified),
          // Migrate old projects to new format
          projectFiles: p.projectFiles || []
        })));
      } catch (error) {
        console.error('Error loading projects:', error);
      }
    }
  }, []);

  // Save projects to localStorage
  const saveProjects = (updatedProjects: LiteProject[]) => {
    localStorage.setItem('lumaui-lite-projects', JSON.stringify(updatedProjects));
    setProjects(updatedProjects);
  };

  const handleCreateProject = (projectData: Omit<LiteProject, 'id' | 'createdAt' | 'lastModified'>) => {
    const newProject: LiteProject = {
      ...projectData,
      id: `lite-project-${Date.now()}`,
      createdAt: new Date(),
      lastModified: new Date(),
      // Create default files if projectFiles is empty
      projectFiles: projectData.projectFiles.length > 0 ? projectData.projectFiles : [
        {
          id: `file-${Date.now()}-1`,
          name: 'index.html',
          path: 'index.html',
          content: projectData.files.html || '<!DOCTYPE html>\n<html>\n<head>\n  <title>My Project</title>\n  <link rel="stylesheet" href="styles.css">\n</head>\n<body>\n  <h1>Hello World!</h1>\n  <script src="script.js"></script>\n</body>\n</html>',
          type: 'file',
          mimeType: 'text/html',
          extension: 'html',
          lastModified: new Date()
        },
        {
          id: `file-${Date.now()}-2`,
          name: 'styles.css',
          path: 'styles.css',
          content: projectData.files.css || 'body {\n  font-family: Arial, sans-serif;\n  margin: 0;\n  padding: 20px;\n}\n\nh1 {\n  color: #333;\n}',
          type: 'file',
          mimeType: 'text/css',
          extension: 'css',
          lastModified: new Date()
        },
        {
          id: `file-${Date.now()}-3`,
          name: 'script.js',
          path: 'script.js',
          content: projectData.files.js || 'document.addEventListener("DOMContentLoaded", function() {\n  console.log("Page loaded successfully!");\n});',
          type: 'file',
          mimeType: 'application/javascript',
          extension: 'js',
          lastModified: new Date()
        }
      ]
    };
    
    const updatedProjects = [newProject, ...projects];
    saveProjects(updatedProjects);
    setIsCreateModalOpen(false);
    
    // Immediately open the editor for the new project
    setSelectedProject(newProject);
    setIsEditorOpen(true);
  };

  const handleDeleteProject = (projectId: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      const updatedProjects = projects.filter(p => p.id !== projectId);
      saveProjects(updatedProjects);
      
      // Close editor or app preview if deleted project was selected
      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
        setIsEditorOpen(false);
        setIsAppPreviewOpen(false);
      }
    }
  };

  const handleOpenProject = (project: LiteProject) => {
    setSelectedProject(project);
    setIsEditorOpen(true);
  };

  const handleOpenApp = (project: LiteProject) => {
    setSelectedProject(project);
    setIsAppPreviewOpen(true);
  };

  const handleUpdateProject = (updatedProject: LiteProject) => {
    const updatedProjects = projects.map(p => 
      p.id === updatedProject.id 
        ? { ...updatedProject, lastModified: new Date() }
        : p
    );
    saveProjects(updatedProjects);
    setSelectedProject(updatedProject);
  };

  const handleBackToProjects = () => {
    setIsEditorOpen(false);
    setSelectedProject(null);
  };

  const handleCloseAppPreview = () => {
    setIsAppPreviewOpen(false);
    setSelectedProject(null);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // If app preview is open, show the app preview
  if (isAppPreviewOpen && selectedProject) {
    return (
      <LumaUILiteAppPreview
        project={selectedProject}
        onClose={handleCloseAppPreview}
      />
    );
  }

  // If editor is open, show the editor
  if (isEditorOpen && selectedProject) {
    return (
      <LumaUILiteEditor
        project={selectedProject}
        onUpdateProject={handleUpdateProject}
        onBackToProjects={handleBackToProjects}
      />
    );
  }

  // Show projects listing page
  return (
    <div className="h-full bg-gradient-to-br from-white to-blue-50 dark:from-gray-900 dark:to-gray-800 overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="glassmorphic border-b border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                LumaUI-lite
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Build simple single-page applications with ease
              </p>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all shadow-lg"
            >
              <Plus className="w-4 h-4" />
              Create Project
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {projects.length === 0 ? (
            /* Empty State */
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center shadow-lg">
                  <FolderOpen className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-3">
                  No Projects Yet
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                  Get started by creating your first single-page application. It's quick and easy!
                </p>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all mx-auto text-sm font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <Plus className="w-4 h-4" />
                  Create Your First Project
                </button>
              </div>
            </div>
          ) : (
            /* Projects Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="glassmorphic p-6 rounded-xl border border-white/30 dark:border-gray-700/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                        {project.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                        {project.description}
                      </p>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-medium">
                          {project.type}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {project.features.length} features
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => handleOpenApp(project)}
                        className="p-2 text-gray-500 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                        title="Open app"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenProject(project)}
                        className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Edit project"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProject(project.id)}
                        className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Created: {formatDate(project.createdAt)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Modified: {formatDate(project.lastModified)}
                    </div>
                    
                    {project.features.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {project.features.slice(0, 3).map((feature, index) => (
                          <span
                            key={index}
                            className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full"
                          >
                            {feature}
                          </span>
                        ))}
                        {project.features.length > 3 && (
                          <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 rounded-full">
                            +{project.features.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleOpenApp(project)}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Open App
                    </button>
                    <button
                      onClick={() => handleOpenProject(project)}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Project Modal */}
      <LumaUILiteProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateProject={handleCreateProject}
      />
    </div>
  );
};

export default LumaUILite; 