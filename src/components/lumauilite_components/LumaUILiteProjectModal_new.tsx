import React, { useState } from 'react';
import { X } from 'lucide-react';
import { LiteProject } from '../LumaUILite';

interface LumaUILiteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (project: Omit<LiteProject, 'id' | 'createdAt' | 'lastModified'>) => void;
}

const LumaUILiteProjectModal: React.FC<LumaUILiteProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });

  const [isCreating, setIsCreating] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Please enter a project name');
      return;
    }

    setIsCreating(true);

    try {
      // Create a simple project with empty files
      const newProject = {
        name: formData.name.trim(),
        description: formData.description.trim() || 'A simple web project',
        type: 'Web Project',
        features: ['HTML', 'CSS', 'JavaScript'],
        files: {
          html: '',
          css: '',
          js: ''
        },
        projectFiles: [
          {
            id: `file-${Date.now()}-1`,
            name: 'index.html',
            path: 'index.html',
            content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${formData.name}</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <h1>Welcome to ${formData.name}</h1>
    <p>${formData.description || 'Start building your project here!'}</p>
    
    <script src="script.js"></script>
</body>
</html>`,
            type: 'file' as const,
            mimeType: 'text/html',
            extension: 'html',
            lastModified: new Date()
          },
          {
            id: `file-${Date.now()}-2`,
            name: 'styles.css',
            path: 'styles.css',
            content: `/* ${formData.name} Styles */

body {
    font-family: Arial, sans-serif;
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    line-height: 1.6;
}

h1 {
    color: #333;
}`,
            type: 'file' as const,
            mimeType: 'text/css',
            extension: 'css',
            lastModified: new Date()
          },
          {
            id: `file-${Date.now()}-3`,
            name: 'script.js',
            path: 'script.js',
            content: `// ${formData.name} JavaScript

console.log('${formData.name} loaded!');

// Add your JavaScript code here`,
            type: 'file' as const,
            mimeType: 'application/javascript',
            extension: 'js',
            lastModified: new Date()
          }
        ]
      };

      onCreateProject(newProject);
      
      // Reset form
      setFormData({
        name: '',
        description: ''
      });
      
    } catch (error) {
      console.error('Error creating project:', error);
      alert('Failed to create project. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: ''
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Create New Project
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            {/* Project Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Project Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="My Awesome Project"
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                required
                disabled={isCreating}
              />
            </div>

            {/* Project Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Brief description of your project..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                disabled={isCreating}
              />
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5">
                  ℹ️
                </div>
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <p className="font-medium mb-1">Starting Simple</p>
                  <p>Your project will start with basic HTML, CSS, and JavaScript files. You can build and customize from there using the editor.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 mt-8">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2.5 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl transition-colors font-medium"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || !formData.name.trim()}
              className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:from-gray-400 disabled:to-gray-400 text-white rounded-xl transition-all font-medium disabled:cursor-not-allowed"
            >
              {isCreating ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LumaUILiteProjectModal;
