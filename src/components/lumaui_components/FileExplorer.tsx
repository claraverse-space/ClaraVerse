import React from 'react';
import { FolderOpen, Folder, FileText, Code, Image, Settings, Database } from 'lucide-react';
import { FileNode } from '../../types';

interface FileExplorerProps {
  files: FileNode[];
  selectedFile: string | null;
  onFileSelect: (path: string, content: string) => void;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ 
  files, 
  selectedFile, 
  onFileSelect, 
  expandedFolders, 
  onToggleFolder 
}) => {
  
  // Get appropriate icon for file type with enhanced styling
  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
      case 'vue':
      case 'svelte':
        return <Code className="w-4 h-4 text-emerald-500" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
      case 'webp':
        return <Image className="w-4 h-4 text-sakura-500" />;
      case 'json':
      case 'yaml':
      case 'yml':
        return <Database className="w-4 h-4 text-blue-500" />;
      case 'css':
      case 'scss':
      case 'sass':
      case 'less':
        return <Settings className="w-4 h-4 text-purple-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };
  
  const renderNode = (node: FileNode, level: number = 0) => {
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = selectedFile === node.path;
    
    return (
      <div key={node.path}>
        <div
          className={`group flex items-center gap-2 px-3 py-2 cursor-pointer transition-all duration-200 hover:bg-gradient-to-r hover:from-sakura-50/60 hover:to-pink-50/60 dark:hover:from-sakura-900/30 dark:hover:to-pink-900/30 hover:border-l-2 hover:border-sakura-400 hover:shadow-sm hover:backdrop-blur-sm ${
            isSelected 
              ? 'bg-gradient-to-r from-sakura-100 to-pink-100 dark:from-sakura-900/50 dark:to-pink-900/50 border-l-3 border-sakura-500 shadow-md backdrop-blur-sm' 
              : ''
          }`}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={() => {
            if (node.type === 'directory') {
              onToggleFolder(node.path);
            } else if (node.content !== undefined) {
              onFileSelect(node.path, node.content);
            }
          }}
        >
          {node.type === 'directory' ? (
            <>
              {isExpanded ? (
                <FolderOpen className="w-4 h-4 text-sakura-500 transition-colors" />
              ) : (
                <Folder className="w-4 h-4 text-sakura-400 group-hover:text-sakura-500 transition-colors" />
              )}
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-sakura-700 dark:group-hover:text-sakura-300 transition-colors">
                {node.name}
              </span>
            </>
          ) : (
            <>
              {getFileIcon(node.name)}
              <span className="text-sm text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                {node.name}
              </span>
              {isSelected && (
                <div className="ml-auto w-2 h-2 bg-gradient-to-br from-sakura-500 to-pink-500 rounded-full animate-pulse shadow-lg" />
              )}
            </>
          )}
        </div>
        
        {node.type === 'directory' && isExpanded && node.children && (
          <div className="border-l border-sakura-200/50 dark:border-sakura-700/50 ml-6">
            {node.children.map(child => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="h-full glassmorphic">
      <div className="p-4 border-b border-white/20 dark:border-gray-700/50 glassmorphic-card">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-sakura-100 to-pink-100 dark:from-sakura-900/40 dark:to-pink-900/40 rounded-xl flex items-center justify-center shadow-sm backdrop-blur-sm border border-white/30 dark:border-gray-700/50">
            <FolderOpen className="w-5 h-5 text-sakura-600 dark:text-sakura-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Explorer</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400">Project files</p>
          </div>
        </div>
      </div>
      
      <div className="overflow-auto scrollbar-none p-2">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="w-20 h-20 bg-gradient-to-br from-sakura-100 to-pink-100 dark:from-sakura-900/30 dark:to-pink-900/30 rounded-2xl flex items-center justify-center mb-6 shadow-lg backdrop-blur-sm border border-white/30 dark:border-gray-700/50">
              <FolderOpen className="w-10 h-10 text-sakura-600 dark:text-sakura-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-2">
              No Files Yet
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center leading-relaxed">
              Start your project to explore files and directories
            </p>
          </div>
        ) : (
          files.map(node => renderNode(node))
        )}
      </div>
    </div>
  );
};

export default FileExplorer; 