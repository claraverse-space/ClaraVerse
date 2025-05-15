import React, { useState, useEffect } from 'react';
import { Download, Trash2, FileText, FolderOpen, X, ChevronRight, Files, Plus, ChevronDown, RefreshCw, Eye } from 'lucide-react';
import { useInterpreter } from '../../contexts/InterpreterContext';
import { FileInfo } from '../../utils/InterpreterClient';
import logo from '../../assets/logo.png';

interface InterpreterSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  newFiles?: FileInfo[];
  onFileSelect?: (file: FileInfo) => void;
}

// Add a type for folder state
interface FolderState {
  [folderId: string]: boolean; // true = expanded, false = collapsed
}

const InterpreterSidebar: React.FC<InterpreterSidebarProps> = ({ isOpen, onToggle, newFiles = [], onFileSelect }) => {
  const { interpreterClient } = useInterpreter();
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedFiles, setHighlightedFiles] = useState<Set<string>>(new Set());
  const [folderState, setFolderState] = useState<FolderState>({});
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [uploadTarget, setUploadTarget] = useState<string>("");
  const [previewFile, setPreviewFile] = useState<FileInfo | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Fetch files from the interpreter's workspace
  const fetchFiles = async () => {
    if (!isOpen) return;
    
    setIsLoading(true);
    try {
      const fileList = await interpreterClient.listFiles();
      // Deduplicate files based on ID
      const uniqueFiles = Array.from(
        new Map(fileList.map(file => [file.id, file])).values()
      );
      setFiles(uniqueFiles);
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles();
  }, [isOpen, interpreterClient]);

  // Handle new files highlighting
  useEffect(() => {
    if (newFiles.length > 0) {
      // Refresh the file list
      fetchFiles();
      
      // Update highlighted files
      const newHighlightedFiles = new Set(newFiles.map(file => file.id));
      setHighlightedFiles(newHighlightedFiles);
      
      // Clear highlights after 3 seconds
      const timer = setTimeout(() => {
        setHighlightedFiles(new Set());
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [newFiles]);

  const handleDownload = async (file: FileInfo) => {
    try {
      const blob = await interpreterClient.downloadFile(file.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const handleDelete = async (file: FileInfo) => {
    if (!confirm(`Are you sure you want to delete ${file.name}?`)) return;

    try {
      await interpreterClient.deleteFile(file.id);
      setFiles(files.filter(f => f.id !== file.id));
      if (selectedFile === file.id) {
        setSelectedFile(null);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  };

  // Upload handler
  const handleUpload = async (targetDir: string) => {
    setUploadTarget(targetDir);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  // On file input change, upload selected files
  const onFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const filesToUpload = e.target.files;
    if (!filesToUpload) return;
    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      try {
        await interpreterClient.uploadFile(file, uploadTarget);
      } catch (err) {
        console.error('Upload failed:', err);
      }
    }
    fetchFiles();
  };

  // Helper to build a tree from flat file list
  function buildFileTree(files: FileInfo[]) {
    const tree: any = {};
    files.forEach(file => {
      const parts = file.id.split(/[\\/]/g);
      let current = tree;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        // Defensive: ensure current is always an object
        if (!current) current = {};
        if (i === parts.length - 1) {
          current[part] = { ...file };
        } else {
          if (!current[part] || typeof current[part] !== 'object' || !current[part].children) {
            current[part] = { __folder: true, children: {} };
          }
          current = current[part].children;
        }
      }
    });
    return tree;
  }

  // Helper to determine preview type
  function getPreviewType(file: FileInfo) {
    const ext = file.type.toLowerCase();
    if (["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg"].includes(ext)) return "image";
    if (["pdf"].includes(ext)) return "pdf";
    if (["html", "htm"].includes(ext)) return "html";
    if (["txt", "md", "json", "js", "ts", "py", "csv", "log", "css", "xml", "yml", "yaml"].includes(ext)) return "text";
    return null;
  }

  // Fetch preview content
  const openPreview = async (file: FileInfo) => {
    setPreviewFile(file);
    setPreviewContent(null);
    setPreviewUrl(null);
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const type = getPreviewType(file);
      const blob = await interpreterClient.downloadFile(file.id);
      if (type === "image" || type === "pdf" || type === "html") {
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
      } else if (type === "text") {
        const text = await blob.text();
        setPreviewContent(text);
      } else {
        setPreviewError("Preview not supported for this file type.");
      }
    } catch (e) {
      setPreviewError("Failed to load preview.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setPreviewFile(null);
    setPreviewContent(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewError(null);
    setPreviewLoading(false);
  };

  // Recursive render for file/folder tree
  function renderTree(node: any, parentPath = "") {
    return Object.entries(node).map(([key, value]: any) => {
      if (value.__folder) {
        const folderId = parentPath ? `${parentPath}/${key}` : key;
        const expanded = folderState[folderId] || false;
        return (
          <div key={folderId} className="ml-2">
            <div
              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-sakura-50 dark:hover:bg-sakura-100/5 ${expanded ? 'font-semibold' : ''}`}
              onClick={() => setFolderState(s => ({ ...s, [folderId]: !expanded }))}
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span className={`font-medium text-sm truncate ${expanded ? 'text-sakura-500' : 'text-gray-800 dark:text-gray-100'}`}>{key}</span>
              <button
                className="ml-auto p-1 hover:bg-sakura-100 dark:hover:bg-sakura-100/10 rounded-full"
                title="Upload to this folder"
                onClick={e => { e.stopPropagation(); handleUpload(folderId); }}
              >
                <Plus className="w-4 h-4 text-sakura-500" />
              </button>
            </div>
            {expanded && (
              <div className="ml-4 border-l border-gray-200 dark:border-gray-700 pl-2">
                {renderTree(value.children, folderId)}
              </div>
            )}
          </div>
        );
      } else if (value.type === "folder") {
        // Defensive: treat as folder
        const folderId = value.id;
        const expanded = folderState[folderId] || false;
        return (
          <div key={folderId} className="ml-2">
            <div
              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-sakura-50 dark:hover:bg-sakura-100/5 ${expanded ? 'font-semibold' : ''}`}
              onClick={() => setFolderState(s => ({ ...s, [folderId]: !expanded }))}
            >
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              <span className={`font-medium text-sm truncate ${expanded ? 'text-sakura-500' : 'text-gray-800 dark:text-gray-100'}`}>{value.name}</span>
              <button
                className="ml-auto p-1 hover:bg-sakura-100 dark:hover:bg-sakura-100/10 rounded-full"
                title="Upload to this folder"
                onClick={e => { e.stopPropagation(); handleUpload(folderId); }}
              >
                <Plus className="w-4 h-4 text-sakura-500" />
              </button>
            </div>
            {/* Folders from API do not have children, but tree builder will nest files under folders */}
          </div>
        );
      } else {
        // File
        const file = value as FileInfo;
        const previewSupported = !!getPreviewType(file);
        return (
          <div
            key={file.id}
            className={`w-full flex items-center gap-2 p-3 rounded-lg transition-colors group relative cursor-pointer ${
              selectedFile === file.id
                ? 'bg-sakura-100 text-sakura-500 dark:bg-sakura-100/10'
                : highlightedFiles.has(file.id)
                ? 'bg-green-50 text-green-600 dark:bg-green-100/10 dark:text-green-400'
                : 'text-gray-700 dark:text-gray-300 hover:bg-sakura-50 dark:hover:bg-sakura-100/5'
            }`}
            onClick={() => previewSupported && openPreview(file)}
          >
            <FileText className="w-5 h-5 flex-shrink-0" />
            <div className="flex-1 text-left overflow-hidden min-w-0">
              <div className="flex items-center gap-1">
                <span className={`font-medium text-sm truncate ${
                  selectedFile === file.id ? 'text-sakura-500' :
                  highlightedFiles.has(file.id) ? 'text-green-600 dark:text-green-400' :
                  'text-gray-800 dark:text-gray-100'
                }`}>
                  {file.name}
                </span>
                {highlightedFiles.has(file.id) && (
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                    New
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  {new Date(file.created || Date.now()).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {previewSupported && (
                    <button
                      onClick={e => { e.stopPropagation(); openPreview(file); }}
                      className="p-1 hover:bg-sakura-100 dark:hover:bg-sakura-100/10 rounded-full"
                      title="Preview"
                    >
                      <Eye className="w-3 h-3 text-sakura-500" />
                    </button>
                  )}
                  {onFileSelect && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onFileSelect(file);
                      }}
                      className="p-1 hover:bg-sakura-100 dark:hover:bg-sakura-100/10 rounded-full"
                      title="Select File"
                    >
                      <Plus className="w-3 h-3 text-sakura-500" />
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(file);
                    }}
                    className="p-1 hover:bg-sakura-100 dark:hover:bg-sakura-100/10 rounded-full"
                    title="Download"
                  >
                    <Download className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(file);
                    }}
                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-full"
                    title="Delete"
                  >
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      }
    });
  }

  // Root upload button
  const RootUploadButton = (
    <button
      className="ml-2 mb-2 p-2 rounded-lg bg-sakura-50 dark:bg-sakura-100/5 text-sakura-500 hover:bg-sakura-100 dark:hover:bg-sakura-100/10 flex items-center gap-2"
      title="Upload to root folder"
      onClick={() => handleUpload("")}
    >
      <Plus className="w-4 h-4" /> Upload to Root
    </button>
  );

  // Preview Modal
  const PreviewModal = previewFile && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="backdrop-blur-xl bg-white/70 dark:bg-white/10 shadow-2xl max-w-3xl w-[700px] max-h-[80vh] flex flex-col relative rounded-2xl glassmorphic-modal" style={{border: 'none'}}>
        <button
          className="absolute top-2 right-2 p-2 rounded-full bg-gray-100/70 dark:bg-gray-800/40 hover:bg-gray-200/80 dark:hover:bg-gray-700/60"
          onClick={closePreview}
          title="Close Preview"
        >
          <X className="w-5 h-5 text-gray-500 dark:text-gray-200" />
        </button>
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <div className="font-semibold text-lg text-gray-800 dark:text-gray-100 truncate">{previewFile?.name}</div>
          <div className="flex gap-2">
            <button
              onClick={() => handleDownload(previewFile)}
              className="p-1.5 rounded-lg hover:bg-sakura-100 dark:hover:bg-sakura-100/10"
              title="Download"
            >
              <Download className="w-5 h-5 text-gray-500 dark:text-gray-200" />
            </button>
            <button
              onClick={async () => { await handleDelete(previewFile); closePreview(); }}
              className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20"
              title="Delete"
            >
              <Trash2 className="w-5 h-5 text-red-500" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6 flex flex-col items-center justify-center">
          {previewLoading ? (
            <div className="flex items-center justify-center h-40 text-gray-500 dark:text-gray-300">Loading preview...</div>
          ) : previewError ? (
            <div className="text-red-500 text-center">{previewError}</div>
          ) : previewFile && getPreviewType(previewFile) === "image" && previewUrl ? (
            <img src={previewUrl} alt={previewFile.name} className="max-w-full max-h-[55vh] mx-auto rounded shadow" />
          ) : previewFile && getPreviewType(previewFile) === "pdf" && previewUrl ? (
            <iframe src={previewUrl} title="PDF Preview" className="w-full h-[55vh] rounded shadow bg-white/80 dark:bg-black/40" />
          ) : previewFile && getPreviewType(previewFile) === "html" && previewUrl ? (
            <iframe src={previewUrl} title="HTML Preview" className="w-full h-[55vh] rounded shadow bg-white/80 dark:bg-black/40" />
          ) : previewFile && getPreviewType(previewFile) === "text" && previewContent ? (
            <pre className="bg-gray-100/70 dark:bg-gray-900/60 rounded-xl p-6 text-sm overflow-x-auto max-h-[55vh] text-gray-800 dark:text-gray-100 shadow-inner" style={{border: 'none'}}>{previewContent}</pre>
          ) : (
            <div className="text-gray-500 text-center">No preview available.</div>
          )}
        </div>
      </div>
    </div>
  );

  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed top-20 left-4 p-2 rounded-lg bg-white dark:bg-black hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors z-20"
        title="Open File Manager"
      >
        <Files className="w-5 h-5 text-gray-700 dark:text-gray-300" />
      </button>
    );
  }

  return (
    <div className="fixed top-16 left-0 h-[calc(100vh-64px)] flex z-20">
      <div className="h-full w-64 flex flex-col bg-white dark:bg-black">
        {/* Header */}
        <div className="flex items-center justify-between py-4 px-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Clara Logo" className="w-8 h-8 flex-shrink-0" />
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">
              Files
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchFiles}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Refresh File List"
            >
              <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : 'text-gray-500 dark:text-gray-400'}`} />
            </button>
            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Close File Manager"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>
        {/* Root upload button */}
        {RootUploadButton}
        {/* Hidden file input for uploads */}
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={onFileInputChange}
          multiple
        />
        {/* File List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-500"></div>
              <p className="mt-2">Loading files...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <FolderOpen className="w-12 h-12 mb-2" />
              <p>No files yet</p>
            </div>
          ) : (
            <div className="px-2 space-y-0.5 py-2">
              {renderTree(buildFileTree(files))}
            </div>
          )}
        </div>
        {PreviewModal}
      </div>
    </div>
  );
};

export default InterpreterSidebar; 