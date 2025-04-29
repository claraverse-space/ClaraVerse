import React, { useState } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { Message } from '../../db';
import { uiBuilderService } from '../../services/UIBuilderService';

interface ExportProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (projectId: string) => void;
  currentHtml: string;
  currentCss: string;
  currentJs: string;
  messages: Message[];
  currentName?: string;
  currentDescription?: string;
}

const ExportProjectModal: React.FC<ExportProjectModalProps> = ({
  isOpen,
  onClose,
  onExport,
  currentHtml,
  currentCss,
  currentJs,
  messages,
  currentName = '',
  currentDescription = ''
}) => {
  const [name, setName] = useState(currentName || 'My UI Project');
  const [description, setDescription] = useState(currentDescription || 'A custom UI project built with ClaraVerse UI Builder');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleExport = async () => {
    if (!name.trim()) {
      setError('Please enter a project name');
      return;
    }

    try {
      setIsExporting(true);
      setError(null);
      
      // Create a new project using the UIBuilderService
      const newProject = await uiBuilderService.createProject({
        name: name.trim(),
        description: description.trim(),
        htmlCode: currentHtml,
        cssCode: currentCss,
        jsCode: currentJs,
        messages: messages
      });
      
      // Call the onExport callback with the new project ID
      onExport(newProject.id);
      
      // Close the modal
      onClose();
    } catch (err) {
      console.error('Failed to export project:', err);
      setError('Failed to export project. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div 
        className="glassmorphic bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Save Project</h2>
          <button 
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm">
            {error}
          </div>
        )}
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Project Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-sakura-300 dark:focus:ring-sakura-600"
              placeholder="Enter project name"
              disabled={isExporting}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 rounded-lg bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-sakura-300 dark:focus:ring-sakura-600 resize-none"
              placeholder="Enter project description"
              disabled={isExporting}
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300 transition-colors"
            disabled={isExporting}
          >
            Cancel
          </button>
          
          <button
            onClick={handleExport}
            disabled={isExporting || !name.trim()}
            className={`px-4 py-2 rounded-lg bg-sakura-500 hover:bg-sakura-600 text-white flex items-center gap-2 transition-colors ${
              isExporting || !name.trim() ? 'opacity-70 cursor-not-allowed' : ''
            }`}
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Project
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExportProjectModal; 