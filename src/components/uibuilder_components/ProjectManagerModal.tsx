import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Edit, FolderOpen, Clock, Search, AlertCircle, Check } from 'lucide-react';
import { uiBuilderService, UIBuilderProject } from '../../services/UIBuilderService';

interface ProjectManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProject: (project: UIBuilderProject) => void;
  onCreateNew: () => void;
  currentProjectId?: string;
}

const ProjectManagerModal: React.FC<ProjectManagerModalProps> = ({
  isOpen,
  onClose,
  onSelectProject,
  onCreateNew,
  currentProjectId
}) => {
  const [projects, setProjects] = useState<UIBuilderProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const allProjects = await uiBuilderService.getAllProjects();
      setProjects(allProjects.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ));
    } catch (err) {
      console.error('Failed to load projects:', err);
      setError('Failed to load projects. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await uiBuilderService.deleteProject(projectId);
      setConfirmDelete(null);
      setProjects(projects.filter(p => p.id !== projectId));
    } catch (err) {
      console.error('Failed to delete project:', err);
      setError('Failed to delete project. Please try again.');
    }
  };

  const filteredProjects = searchTerm
    ? projects.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()))
      )
    : projects;

  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div 
        className="glassmorphic bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-3xl h-[80vh] p-6 relative flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-sakura-500" />
            Project Manager
          </h2>
          <button 
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}
        
        <div className="flex items-center justify-between mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-sakura-300 dark:focus:ring-sakura-600"
              placeholder="Search projects..."
            />
          </div>
          
          <button
            onClick={onCreateNew}
            className="px-4 py-2 rounded-lg bg-sakura-500 hover:bg-sakura-600 text-white flex items-center gap-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sakura-500"></div>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              {searchTerm ? (
                <>
                  <Search className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-center">No projects found matching "{searchTerm}"</p>
                </>
              ) : (
                <>
                  <FolderOpen className="w-12 h-12 mb-4 opacity-50" />
                  <p className="text-center">No projects found. Create your first project!</p>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredProjects.map((project) => (
                <div 
                  key={project.id}
                  className={`p-4 rounded-lg border hover:shadow-md transition-all ${
                    project.id === currentProjectId 
                      ? 'border-sakura-500 bg-sakura-50 dark:bg-sakura-900/20' 
                      : 'border-gray-200 dark:border-gray-700 hover:border-sakura-300 dark:hover:border-sakura-700'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                        {project.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {project.description || 'No description provided'}
                      </p>
                      <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <Clock className="w-3.5 h-3.5 mr-1" />
                        <span>Updated {formatDate(project.updatedAt)}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => onSelectProject(project)}
                        className="p-2 rounded-lg hover:bg-sakura-100 dark:hover:bg-gray-800 text-sakura-500 transition-colors"
                        title="Open project"
                      >
                        <FolderOpen className="w-5 h-5" />
                      </button>
                      
                      {confirmDelete === project.id ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDeleteProject(project.id)}
                            className="p-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                            title="Confirm delete"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="p-1.5 rounded-lg bg-gray-500 text-white hover:bg-gray-600 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(project.id)}
                          className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                          title="Delete project"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectManagerModal; 