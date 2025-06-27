import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import mermaid from 'mermaid';
import MonacoEditor from './MilkdownEditor';
import SimpleMonacoTest from './SimpleMonacoTest';
import { 
  Plus, 
  Search, 
  Filter, 
  Grid, 
  List, 
  FileText, 
  Folder,
  FolderOpen,
  Edit3,
  Trash2,
  Save,
  Eye,
  Bold,
  Italic,
  Underline,
  Link,
  Hash,
  Quote,
  Code,
  Image,
  Table,
  MoreHorizontal,
  Calendar,
  Clock,
  Star,
  Archive,
  X,
  ChevronRight,
  ChevronDown,
  File,
  FolderPlus,
  Edit,
  Check,
  Copy,
  CheckCircle,
  Circle,
  ExternalLink,
  Play,
  SplitSquareHorizontal,
  Monitor
} from 'lucide-react';

// Import CSS for math rendering and markdown constraints
import 'katex/dist/katex.min.css';
import './markdown-styles.css';

// Separate Mermaid component to handle useEffect properly
const MermaidDiagram: React.FC<{ code: string; id: string }> = ({ code, id }) => {
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const renderDiagram = async () => {
      try {
        const { svg: renderedSvg } = await mermaid.render(id, code);
        setSvg(renderedSvg);
        setError('');
      } catch (err) {
        console.error('Mermaid rendering error:', err);
        setError('Failed to render diagram');
      }
    };

    renderDiagram();
  }, [code, id]);

  if (error) {
    return (
      <div className="my-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="text-red-600 dark:text-red-400 text-sm font-medium mb-2">Mermaid Error</div>
        <pre className="text-xs text-red-500 dark:text-red-400 whitespace-pre-wrap">{error}</pre>
      </div>
    );
  }

  return (
    <div className="my-4 w-full overflow-hidden">
      <div className="flex items-center justify-between bg-gray-800 px-4 py-2 text-sm text-gray-300">
        <span>Mermaid Diagram</span>
        <button
          onClick={() => navigator.clipboard.writeText(code)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-700 rounded"
          title="Copy diagram code"
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>
      <div 
        className="flex justify-center items-center p-4 bg-white dark:bg-gray-900 rounded-b-lg border overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
};

interface Note {
  id: string;
  title: string;
  content: string;
  folder?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  linkedNotes: string[]; // IDs of notes this note links to
  backlinks: string[]; // IDs of notes that link to this note
}

interface Folder {
  id: string;
  name: string;
  parentId?: string;
  isExpanded: boolean;
}

interface NotebookCanvasProps {
  notebookId: string;
  onNoteCreated?: (note: Note) => void;
  onNoteUpdated?: (note: Note) => void;
  onNoteDeleted?: (noteId: string) => void;
}

const NotebookCanvas: React.FC<NotebookCanvasProps> = ({ 
  notebookId, 
  onNoteCreated, 
  onNoteUpdated, 
  onNoteDeleted 
}) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('split'); // New view mode state - default to split for Notion-like experience
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const splitPreviewRef = useRef<HTMLDivElement>(null);

  // Load notes and folders from localStorage
  useEffect(() => {
    const savedNotes = localStorage.getItem(`notebook-notes-${notebookId}`);
    const savedFolders = localStorage.getItem(`notebook-folders-${notebookId}`);
    
    if (savedNotes) {
      const parsedNotes = JSON.parse(savedNotes);
      setNotes(parsedNotes);
      // Auto-select first note if none selected
      if (parsedNotes.length > 0 && !selectedNoteId) {
        setSelectedNoteId(parsedNotes[0].id);
      }
    }
    if (savedFolders) {
      setFolders(JSON.parse(savedFolders));
    }
  }, [notebookId]);

  // Save notes to localStorage
  const saveNotes = useCallback((newNotes: Note[]) => {
    localStorage.setItem(`notebook-notes-${notebookId}`, JSON.stringify(newNotes));
    setNotes(newNotes);
  }, [notebookId]);

  // Save folders to localStorage
  const saveFolders = useCallback((newFolders: Folder[]) => {
    localStorage.setItem(`notebook-folders-${notebookId}`, JSON.stringify(newFolders));
    setFolders(newFolders);
  }, [notebookId]);

  // Debounced auto-save for backlinks processing
  const debouncedSave = useCallback((noteId: string, content: string) => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(() => {
      // Get fresh notes from localStorage to ensure we have the latest data
      const savedNotes = localStorage.getItem(`notebook-notes-${notebookId}`);
      const currentNotes = savedNotes ? JSON.parse(savedNotes) : [];
      
      const linkedNotes = extractLinkedNotes(content);
      
      // Update the note with linked notes
      const updatedNotes = currentNotes.map((note: Note) => 
        note.id === noteId 
          ? { ...note, linkedNotes }
          : note
      );
      
      // Update backlinks for all notes
      const notesWithBacklinks = updatedNotes.map((note: Note) => {
        // Remove this note from all backlinks first
        const cleanedBacklinks = (note.backlinks || []).filter(id => id !== noteId);
        
        // Add backlink if this note is linked
        if (linkedNotes.includes(note.id)) {
          return { ...note, backlinks: [...cleanedBacklinks, noteId] };
        }
        
        return { ...note, backlinks: cleanedBacklinks };
      });
      
      // Save final state with backlinks
      localStorage.setItem(`notebook-notes-${notebookId}`, JSON.stringify(notesWithBacklinks));
      
      if (onNoteUpdated) {
        const updatedNote = notesWithBacklinks.find((n: Note) => n.id === noteId);
        if (updatedNote) onNoteUpdated(updatedNote);
      }
    }, 500); // 500ms debounce
  }, [notebookId, onNoteUpdated]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Create a new folder
  const createFolder = () => {
    if (!newFolderName.trim()) return;
    
    const newFolder: Folder = {
      id: `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: newFolderName.trim(),
      isExpanded: true
    };

    const updatedFolders = [...(folders || []), newFolder];
    saveFolders(updatedFolders);
    setNewFolderName('');
    setIsCreatingFolder(false);
  };

  // Edit folder name
  const editFolder = (folderId: string, newName: string) => {
    if (!newName.trim()) return;
    
    const updatedFolders = (folders || []).map(folder => 
      folder.id === folderId ? { ...folder, name: newName.trim() } : folder
    );
    saveFolders(updatedFolders);
    setEditingFolderId(null);
    setEditingFolderName('');
  };

  // Delete folder and move notes to no folder
  const deleteFolder = (folderId: string) => {
    // Move all notes from this folder to no folder
    const updatedNotes = (notes || []).map(note => 
      note.folder === folderId ? { ...note, folder: undefined } : note
    );
    saveNotes(updatedNotes);
    
    // Remove the folder
    const updatedFolders = (folders || []).filter(folder => folder.id !== folderId);
    saveFolders(updatedFolders);
    
    // Clear selected folder if it was deleted
    if (selectedFolder === folderId) {
      setSelectedFolder(null);
    }
  };

  // Create a new note
  const createNote = (folder?: string) => {
    const newNote: Note = {
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: 'Untitled Note',
      content: '',
      folder: folder || selectedFolder || undefined,
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      linkedNotes: [],
      backlinks: []
    };

    const updatedNotes = [...notes, newNote];
    saveNotes(updatedNotes);
    setSelectedNoteId(newNote.id);
    setIsEditing(true);
    setEditTitle(newNote.title);
    setEditContent(newNote.content);
    onNoteCreated?.(newNote);
  };

  // Update note
  const updateNote = (noteId: string, updates: Partial<Note>) => {
    const updatedNotes = (notes || []).map(note => 
      note.id === noteId 
        ? { ...note, ...updates, updatedAt: new Date().toISOString() }
        : note
    );
    saveNotes(updatedNotes);
    
    const updatedNote = updatedNotes.find(n => n.id === noteId);
    if (updatedNote) {
      onNoteUpdated?.(updatedNote);
    }
  };

  // Delete note
  const deleteNote = (noteId: string) => {
    const updatedNotes = (notes || []).filter(note => note.id !== noteId);
    saveNotes(updatedNotes);
    
    if (selectedNoteId === noteId) {
      setSelectedNoteId(updatedNotes.length > 0 ? updatedNotes[0].id : null);
    }
    
    onNoteDeleted?.(noteId);
  };

  // Save current edit
  const saveEdit = () => {
    if (selectedNoteId) {
      // Process content for wiki-links [[Note Title]]
      const linkedNotes = extractLinkedNotes(editContent);
      
      // Update the note with new content
      const updatedNotes = (notes || []).map(note => 
        note.id === selectedNoteId 
          ? { ...note, title: editTitle, content: editContent, linkedNotes, updatedAt: new Date().toISOString() }
          : note
      );
      
      // Update backlinks for linked notes using the updated notes array
      const notesWithBacklinks = updatedNotes.map(note => {
        // Remove this note from all backlinks first
        const cleanedBacklinks = (note.backlinks || []).filter(id => id !== selectedNoteId);
        
        // Add backlink if this note is linked
        if (linkedNotes.includes(note.id)) {
          return { ...note, backlinks: [...cleanedBacklinks, selectedNoteId] };
        }
        
        return { ...note, backlinks: cleanedBacklinks };
      });
      
      // Save everything at once
      saveNotes(notesWithBacklinks);
      
      const updatedNote = notesWithBacklinks.find(n => n.id === selectedNoteId);
      if (updatedNote) {
        onNoteUpdated?.(updatedNote);
      }
    }
    setIsEditing(false);
  };

  // Filter notes based on search and folder
  const filteredNotes = (notes || []).filter(note => {
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (note.tags || []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesFolder = !selectedFolder || note.folder === selectedFolder;
    
    return matchesSearch && matchesFolder;
  });

  // Get current note
  const currentNote = (notes || []).find(n => n.id === selectedNoteId);

  // Extract [[Note Title]] links from content
  const extractLinkedNotes = (content: string): string[] => {
    const linkRegex = /\[\[([^\]]+)\]\]/g;
    const links: string[] = [];
    let match;
    
    while ((match = linkRegex.exec(content)) !== null) {
      const linkedTitle = match[1];
      const linkedNote = (notes || []).find(note => note.title === linkedTitle);
      if (linkedNote) {
        links.push(linkedNote.id);
      }
    }
    
    return links;
  };

  // Update backlinks for linked notes
  const updateBacklinks = (sourceNoteId: string, linkedNoteIds: string[]) => {
    const updatedNotes = (notes || []).map(note => {
      // Remove this note from all backlinks first
      const cleanedBacklinks = (note.backlinks || []).filter(id => id !== sourceNoteId);
      
      // Add backlink if this note is linked
      if (linkedNoteIds.includes(note.id)) {
        return { ...note, backlinks: [...cleanedBacklinks, sourceNoteId] };
      }
      
      return { ...note, backlinks: cleanedBacklinks };
    });
    
    saveNotes(updatedNotes);
  };

  // Cancel edit
  const cancelEdit = () => {
    const currentNote = (notes || []).find(n => n.id === selectedNoteId);
    if (currentNote) {
      setEditTitle(currentNote.title);
      setEditContent(currentNote.content);
    }
    setIsEditing(false);
  };

  // Start editing
  const startEdit = () => {
    const currentNote = (notes || []).find(n => n.id === selectedNoteId);
    if (currentNote) {
      setEditTitle(currentNote.title);
      setEditContent(currentNote.content);
      setIsEditing(true);
    }
  };

  // Initialize Mermaid
  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: 'dark',
      securityLevel: 'loose',
    });
  }, []);

  // Enhanced markdown renderer with custom components
  const renderMarkdown = (content: string) => {
    // Process wiki links and special embeds before markdown rendering
    let processedContent = content.replace(/\[\[([^\]]+)\]\]/g, (match, title) => {
      const linkedNote = (notes || []).find(note => note.title === title);
      if (linkedNote) {
        return `<span class="wiki-link" data-note-id="${linkedNote.id}">${title}</span>`;
      }
      return `<span class="wiki-link-missing">${title}</span>`;
    });

    // Process YouTube embeds
    processedContent = processedContent.replace(
      /https:\/\/(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/g,
      '<div class="youtube-embed" data-video-id="$1"></div>'
    );

    // Process callouts
    processedContent = processedContent.replace(
      /> \[!(info|warning|error|success|note)\]\s*(.+?)$/gm,
      '<div class="callout callout-$1">$2</div>'
    );

    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        className="w-full"
        components={{
          // Custom code block renderer
          code({ node, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const isInline = !className;
            
            if (!isInline && language) {
              // Handle Mermaid diagrams
              if (language === 'mermaid') {
                const chartId = `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                const chartCode = String(children);
                
                return <MermaidDiagram code={chartCode} id={chartId} />;
              }

              return (
                <div 
                  className="relative group my-4 overflow-hidden rounded-lg"
                  style={{ 
                    maxWidth: '100%', 
                    width: '100%',
                    minWidth: 0 
                  }}
                >
                  <div className="flex items-center justify-between bg-gray-800 px-4 py-2 text-sm text-gray-300">
                    <span className="truncate">{language}</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(String(children))}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-700 rounded flex-shrink-0"
                      title="Copy code"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <div 
                    className="overflow-x-auto"
                    style={{ maxWidth: '100%' }}
                  >
                    <SyntaxHighlighter
                      style={oneDark as any}
                      language={language}
                      PreTag="div"
                      customStyle={{
                        margin: 0,
                        borderTopLeftRadius: 0,
                        borderTopRightRadius: 0,
                        maxWidth: '100%',
                        fontSize: '14px',
                        lineHeight: '1.4',
                      } as any}
                      wrapLines={true}
                      wrapLongLines={true}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  </div>
                </div>
              );
            }
            
            return (
              <code 
                className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono break-all"
                style={{ 
                  wordBreak: 'break-all',
                  overflowWrap: 'anywhere',
                  maxWidth: '100%',
                  display: 'inline-block'
                }}
                {...props}
              >
                {children}
              </code>
            );
          },
          
          // Enhanced image renderer with zoom and captions
          img({ src, alt, title, ...props }) {
            return (
              <div className="my-4">
                <img
                  src={src}
                  alt={alt}
                  title={title}
                  className="max-w-full h-auto rounded-lg shadow-lg cursor-zoom-in hover:shadow-xl transition-shadow"
                  onClick={() => {
                    // Open image in modal/lightbox
                    window.open(src, '_blank');
                  }}
                  {...props}
                />
                {alt && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 text-center mt-2 italic">
                    {alt}
                  </p>
                )}
              </div>
            );
          },
          
          // Enhanced table renderer
          table({ children, ...props }) {
            return (
              <div 
                className="overflow-x-auto my-4 rounded-lg border border-gray-200 dark:border-gray-700"
                style={{ 
                  maxWidth: '100%',
                  width: '100%',
                  minWidth: 0
                }}
              >
                <table className="w-full table-auto" style={{ minWidth: '400px' }} {...props}>
                  {children}
                </table>
              </div>
            );
          },
          
          th({ children, ...props }) {
            return (
              <th className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-left font-semibold" {...props}>
                {children}
              </th>
            );
          },
          
          td({ children, ...props }) {
            return (
              <td className="px-4 py-2 border-b border-gray-200 dark:border-gray-700" {...props}>
                {children}
              </td>
            );
          },
          
          // Enhanced blockquote
          blockquote({ children, ...props }) {
            return (
              <blockquote className="border-l-4 border-blue-500 pl-4 py-2 my-4 bg-blue-50 dark:bg-blue-900/20 italic" {...props}>
                {children}
              </blockquote>
            );
          },
          
          // Task list items
          li({ children, ...props }) {
            const childrenStr = String(children);
            
            // Check if it's a task list item
            if (childrenStr.includes('[ ]') || childrenStr.includes('[x]')) {
              const isChecked = childrenStr.includes('[x]');
              const text = childrenStr.replace(/\[([ x])\]\s*/, '');
              
              return (
                <li className="flex items-center gap-2 my-1" {...props}>
                  {isChecked ? (
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}
                  <span className={isChecked ? 'line-through text-gray-500' : ''}>{text}</span>
                </li>
              );
            }
            
            return <li {...props}>{children}</li>;
          },
          
          // Enhanced links
          a({ href, children, ...props }) {
            const isExternal = href?.startsWith('http');
            
            return (
              <a
                href={href}
                className="text-blue-500 hover:text-blue-700 underline break-all"
                style={{
                  wordBreak: 'break-all',
                  overflowWrap: 'anywhere',
                  maxWidth: '100%',
                  display: 'inline-block'
                }}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                {...props}
              >
                <span className="inline-flex items-center gap-1 break-all">
                  <span className="break-all">{children}</span>
                  {isExternal && <ExternalLink className="w-3 h-3 flex-shrink-0" />}
                </span>
              </a>
            );
          },
          
          // Headers with anchors
          h1({ children, ...props }) {
            return <h1 className="text-3xl font-bold mt-6 mb-4 pb-2 border-b border-gray-200 dark:border-gray-700" {...props}>{children}</h1>;
          },
          h2({ children, ...props }) {
            return <h2 className="text-2xl font-semibold mt-5 mb-3" {...props}>{children}</h2>;
          },
          h3({ children, ...props }) {
            return <h3 className="text-xl font-semibold mt-4 mb-2" {...props}>{children}</h3>;
          },
          h4({ children, ...props }) {
            return <h4 className="text-lg font-semibold mt-3 mb-2" {...props}>{children}</h4>;
          },
          
          // Paragraphs
          p({ children, ...props }) {
            return <p className="mb-3 leading-relaxed break-words overflow-wrap-anywhere" {...props}>{children}</p>;
          },
          
          // Horizontal rule
          hr({ ...props }) {
            return <hr className="my-6 border-gray-300 dark:border-gray-600" {...props} />;
          },
          
          // Custom span handler for wiki links
          span({ className, children, ...props }: any) {
            if (className === 'wiki-link') {
              const noteId = props['data-note-id'];
              return (
                <button
                  onClick={() => {
                    setSelectedNoteId(noteId);
                    setIsEditing(false);
                  }}
                  className="text-blue-500 hover:text-blue-700 underline bg-blue-50 dark:bg-blue-900/20 px-1 py-0.5 rounded"
                >
                  [[{children}]]
                </button>
              );
            }
            
            if (className === 'wiki-link-missing') {
              return (
                <span className="text-red-500 bg-red-50 dark:bg-red-900/20 px-1 py-0.5 rounded">
                  [[{children}]]
                </span>
              );
            }
            
            return <span className={className} {...props}>{children}</span>;
          },

          // Custom div handler for embeds and callouts
          div({ className, children, ...props }: any) {
            // YouTube embed
            if (className === 'youtube-embed') {
              const videoId = props['data-video-id'];
              return (
                <div className="my-4 w-full">
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden shadow-lg max-w-full">
                    <iframe
                      src={`https://www.youtube.com/embed/${videoId}`}
                      title="YouTube video"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="w-full h-full"
                    />
                  </div>
                </div>
              );
            }

            // Callouts
            if (className?.startsWith('callout')) {
              const type = className.split('-')[1];
              const styles = {
                info: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200',
                warning: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200',
                error: 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200',
                success: 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200',
                note: 'border-gray-500 bg-gray-50 dark:bg-gray-900/20 text-gray-800 dark:text-gray-200',
              };

              const icons = {
                info: '💡',
                warning: '⚠️',
                error: '❌',
                success: '✅',
                note: '📝',
              };

              return (
                <div className={`border-l-4 p-4 my-4 rounded-r-lg ${styles[type as keyof typeof styles] || styles.note}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{icons[type as keyof typeof icons] || icons.note}</span>
                    <div className="flex-1">{children}</div>
                  </div>
                </div>
              );
            }

            return <div className={className} {...props}>{children}</div>;
          },
        }}
              >
          {processedContent}
        </ReactMarkdown>
    );
  };

  // Get notes without folder
  const notesWithoutFolder = (filteredNotes || []).filter(note => !note.folder);

  // Check if we have any content at all
  const hasAnyContent = (notes || []).length > 0 || (folders || []).length > 0;

  return (
    <div className="h-full flex bg-white dark:bg-black overflow-hidden">
      {/* Left Sidebar - File Tree */}
      <div className="w-80 flex flex-col bg-white dark:bg-black border-r border-gray-100 dark:border-gray-800">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">Notes</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCreatingFolder(true)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                title="New Folder"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
              <button
                onClick={() => createNote()}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                title="New Note"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
            />
          </div>

          {/* Create Folder Input */}
          {isCreatingFolder && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                placeholder="Folder name..."
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') createFolder();
                  if (e.key === 'Escape') {
                    setIsCreatingFolder(false);
                    setNewFolderName('');
                  }
                }}
                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-white"
                autoFocus
              />
              <button
                onClick={createFolder}
                className="p-2 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                title="Create"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setIsCreatingFolder(false);
                  setNewFolderName('');
                }}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Folder Tree */}
        <div className="flex-1 overflow-y-auto p-2">
          {!hasAnyContent ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <div className="bg-gray-50 dark:bg-gray-900 rounded-full p-6 mb-4">
                <FileText className="w-12 h-12 text-gray-400 dark:text-gray-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No notes yet
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
                Create your first note or folder to get started
              </p>
              <div className="flex flex-col gap-2 w-full">
                <button
                  onClick={() => createNote()}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Note
                </button>
                <button
                  onClick={() => setIsCreatingFolder(true)}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-500 dark:bg-gray-600 text-white rounded-lg hover:bg-gray-600 dark:hover:bg-gray-700 transition-colors"
                >
                  <FolderPlus className="w-4 h-4" />
                  Create Folder
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Notes without folder */}
              {notesWithoutFolder.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 p-2 text-gray-600 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 mb-2">
                    <FileText className="w-4 h-4" />
                    <span className="text-sm font-medium">Unsorted Notes</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                      {notesWithoutFolder.length}
                    </span>
                  </div>
                  <div className="ml-6 space-y-1">
                    {notesWithoutFolder.map(note => (
                      <button
                        key={note.id}
                        onClick={() => {
                          setSelectedNoteId(note.id);
                          setIsEditing(false);
                        }}
                        className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors border ${
                          selectedNoteId === note.id 
                            ? 'bg-blue-500 text-white border-blue-600' 
                            : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <FileText className="w-4 h-4 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{note.title}</div>
                          <div className="text-xs opacity-75 truncate">{(note.content || '').substring(0, 50)}...</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Folders */}
              {(folders || []).map(folder => (
                <div key={folder.id} className="mb-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setSelectedFolder(selectedFolder === folder.id ? null : folder.id);
                        // Toggle folder expansion
                        const updatedFolders = (folders || []).map(f => 
                          f.id === folder.id ? { ...f, isExpanded: !f.isExpanded } : f
                        );
                        saveFolders(updatedFolders);
                      }}
                      className={`flex-1 flex items-center gap-2 p-2 rounded-lg text-left transition-colors border ${
                        selectedFolder === folder.id 
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 border-blue-300 dark:border-blue-700' 
                          : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <ChevronRight className={`w-4 h-4 transition-transform ${folder.isExpanded ? 'rotate-90' : ''}`} />
                      {folder.isExpanded ? <FolderOpen className="w-4 h-4 text-blue-500 dark:text-blue-400" /> : <Folder className="w-4 h-4 text-gray-500 dark:text-gray-400" />}
                      
                      {editingFolderId === folder.id ? (
                        <input
                          type="text"
                          value={editingFolderName}
                          onChange={(e) => setEditingFolderName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') editFolder(folder.id, editingFolderName);
                            if (e.key === 'Escape') {
                              setEditingFolderId(null);
                              setEditingFolderName('');
                            }
                          }}
                          onBlur={() => editFolder(folder.id, editingFolderName)}
                          className="flex-1 text-sm font-medium bg-transparent focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm font-medium">{folder.name}</span>
                      )}
                      
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                        {(notes || []).filter(note => note.folder === folder.id).length}
                      </span>
                    </button>
                    
                    {/* Folder Actions */}
                    <button
                      onClick={() => {
                        setEditingFolderId(folder.id);
                        setEditingFolderName(folder.name);
                      }}
                      className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                      title="Edit Folder"
                    >
                      <Edit className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => deleteFolder(folder.id)}
                      className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                      title="Delete Folder"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  
                  {/* Notes in folder */}
                  {folder.isExpanded && (
                    <div className="ml-6 mt-1 space-y-1">
                      {(filteredNotes || [])
                        .filter(note => note.folder === folder.id)
                        .map(note => (
                          <button
                            key={note.id}
                            onClick={() => {
                              setSelectedNoteId(note.id);
                              setIsEditing(false);
                            }}
                            className={`w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors border ${
                              selectedNoteId === note.id 
                                ? 'bg-blue-500 text-white border-blue-600' 
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-900 dark:text-white border-gray-200 dark:border-gray-700'
                            }`}
                          >
                            <FileText className="w-4 h-4 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{note.title}</div>
                              <div className="text-xs opacity-75 truncate">{(note.content || '').substring(0, 50)}...</div>
                            </div>
                          </button>
                        ))}
                      
                      {/* Create note in folder */}
                      <button
                        onClick={() => createNote(folder.id)}
                        className="w-full flex items-center gap-2 p-2 rounded-lg text-left transition-colors border border-dashed border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="text-sm">New note in {folder.name}</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {currentNote ? (
          <>
            {/* Editor Header */}
            <div className="flex items-center justify-between p-4 bg-white dark:bg-black border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {isEditing ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="text-xl font-semibold bg-transparent outline-none text-gray-900 dark:text-white flex-1"
                    placeholder="Note title..."
                  />
                ) : (
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-white truncate">
                    {currentNote.title}
                  </h1>
                )}
                
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Clock className="w-4 h-4" />
                  <span>{new Date(currentNote.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={saveEdit}
                      className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                    >
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    {/* View Mode Controls */}
                    <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                      <button
                        onClick={() => setViewMode('edit')}
                        className={`p-2 rounded-md transition-colors ${
                          viewMode === 'edit' 
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                        title="Edit Mode"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('split')}
                        className={`p-2 rounded-md transition-colors ${
                          viewMode === 'split' 
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                        title="Split View"
                      >
                        <SplitSquareHorizontal className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('preview')}
                        className={`p-2 rounded-md transition-colors ${
                          viewMode === 'preview' 
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' 
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                        title="Preview Mode"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <button
                      onClick={startEdit}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-700 dark:text-gray-300"
                      title="Edit Note"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteNote(currentNote.id)}
                      className="p-2 hover:bg-red-100 dark:hover:bg-red-900 text-red-500 dark:text-red-400 rounded-lg transition-colors"
                      title="Delete Note"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>

                        {/* Editor Content */}
            <div className="flex-1 min-w-0 overflow-hidden">
              {isEditing ? (
                <SimpleMonacoTest
                  content={editContent}
                  onChange={setEditContent}
                />
              ) : viewMode === 'edit' ? (
                <SimpleMonacoTest
                  content={currentNote.content}
                  onChange={(newContent) => {
                    // Update the current note content immediately for responsive UI
                    const updatedNotes = (notes || []).map(note => 
                      note.id === currentNote.id 
                        ? { ...note, content: newContent, updatedAt: new Date().toISOString() }
                        : note
                    );
                    saveNotes(updatedNotes);
                    // Debounced save for backlinks and final persistence
                    debouncedSave(currentNote.id, newContent);
                  }}
                />
              ) : viewMode === 'split' ? (
                <div className="flex h-full">
                  {/* Editor Side */}
                  <div className="flex-1 border-r border-gray-200 dark:border-gray-700">
                    <SimpleMonacoTest
                      content={currentNote.content}
                      onChange={(newContent) => {
                        // Update the current note content immediately for responsive UI
                        const updatedNotes = (notes || []).map(note => 
                          note.id === currentNote.id 
                            ? { ...note, content: newContent, updatedAt: new Date().toISOString() }
                            : note
                        );
                        saveNotes(updatedNotes);
                        // Debounced save for backlinks and final persistence
                        debouncedSave(currentNote.id, newContent);
                      }}
                    />
                  </div>
                  
                  {/* Preview Side */}
                  <div 
                    ref={splitPreviewRef}
                    className="flex-1 h-full overflow-y-auto overflow-x-hidden p-6 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white markdown-content-container"
                  >
                    <div className="prose prose-gray dark:prose-invert max-w-none markdown-content">
                      {renderMarkdown(currentNote.content)}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full overflow-y-auto overflow-x-hidden p-6 bg-white dark:bg-black text-gray-900 dark:text-white markdown-content-container">
                  <div className="prose prose-gray dark:prose-invert max-w-none markdown-content">
                    {renderMarkdown(currentNote.content)}
                  </div>
                </div>
              )}
            </div>


          </>
        ) : (
          /* No Note Selected */
          <div className="flex-1 flex items-center justify-center bg-white dark:bg-black">
            <div className="text-center">
              <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No note selected
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Select a note from the sidebar or create a new one
              </p>
              <button
                onClick={() => createNote()}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                Create your first note
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotebookCanvas; 