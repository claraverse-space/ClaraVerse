import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  BookOpen, 
  Network, 
  Sidebar, 
  ArrowLeft,
  Settings,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  FileText,
  Clock,
  Users
} from 'lucide-react';
import NotebookChat from './NotebookChat';
import NotebookCanvas from './NotebookCanvas';
import GraphViewer from './GraphViewer';
import { NotebookResponse, NotebookDocumentResponse, claraNotebookService } from '../../services/claraNotebookService';

interface NotebookWorkspaceProps {
  notebook: NotebookResponse;
  documents: NotebookDocumentResponse[];
  onClose: () => void;
  onNotebookUpdated: (notebook: NotebookResponse) => void;
  onDocumentsUpdated?: (documents: NotebookDocumentResponse[]) => void;
}

const NotebookWorkspace: React.FC<NotebookWorkspaceProps> = ({
  notebook,
  documents,
  onClose,
  onNotebookUpdated,
  onDocumentsUpdated
}) => {
  // Panel visibility states
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  const [rightSidebarContent, setRightSidebarContent] = useState<'chat' | 'outline' | 'graph'>('chat');
  
  // Layout states
  const [rightSidebarWidth, setRightSidebarWidth] = useState(400);
  
  // Note-related states
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);


  // Calculate completed document count
  const completedDocumentCount = documents.filter(doc => doc.status === 'completed').length;

  // Handle document upload
  const handleDocumentUpload = async (files: File[]) => {
    if (!claraNotebookService.isBackendHealthy()) {
      throw new Error('Notebook backend is not available');
    }

    try {
      const uploadedDocs = await claraNotebookService.uploadDocuments(notebook.id, files);
      
      // Update notebook document count
      const updatedNotebook = {
        ...notebook,
        document_count: notebook.document_count + uploadedDocs.length
      };
      onNotebookUpdated(updatedNotebook);
      
      // Notify parent component of document updates
      if (onDocumentsUpdated) {
        onDocumentsUpdated([...uploadedDocs, ...documents]);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  };

  // Get panel widths
  const getRightPanelWidth = () => showRightSidebar ? rightSidebarWidth : 0;
  const getCenterPanelWidth = () => `calc(100% - ${getRightPanelWidth()}px)`;

  // Handle note events
  const handleNoteCreated = (note: any) => {
    // Note created handler
  };

  const handleNoteUpdated = (note: any) => {
    // Note updated handler
  };

  const handleNoteDeleted = (noteId: string) => {
    // Remove from selected notes
    setSelectedNotes(prev => prev.filter(id => id !== noteId));
  };

  // Resize handler for right sidebar
  const handleRightResize = (e: React.MouseEvent) => {
    const startX = e.clientX;
    const startWidth = rightSidebarWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(300, Math.min(600, startWidth - (e.clientX - startX)));
      setRightSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

      return (
    <div className="h-[95vh] flex bg-white dark:bg-black overflow-hidden">
      {/* Center Panel - Notes Canvas */}
      <div 
        className="flex-1 bg-white dark:bg-black flex flex-col h-full min-w-0"
        style={{ width: getCenterPanelWidth() }}
      >
        {/* Center Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-black flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Back to Notebooks"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-500" />
              <span className="font-medium text-gray-900 dark:text-white">{notebook.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Right Panel Toggle */}
            <button
              onClick={() => setShowRightSidebar(!showRightSidebar)}
              className={`p-2 rounded-lg transition-colors ${
                showRightSidebar
                  ? 'bg-blue-500 text-white'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700'
              }`}
              title={showRightSidebar ? "Hide Right Panel" : "Show Right Panel"}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notes Canvas */}
        <div className="flex-1 overflow-hidden min-h-0">
          <NotebookCanvas
            notebookId={notebook.id}
            onNoteCreated={handleNoteCreated}
            onNoteUpdated={handleNoteUpdated}
            onNoteDeleted={handleNoteDeleted}
          />
        </div>
      </div>

      {/* Right Sidebar */}
      {showRightSidebar && (
        <>
          {/* Right Resize Handle */}
          <div
            className="w-1 bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 cursor-col-resize transition-colors h-full"
            onMouseDown={handleRightResize}
          />

          <div 
            className="bg-white dark:bg-black border-l border-gray-200 dark:border-gray-700 flex flex-col h-full"
            style={{ width: rightSidebarWidth }}
          >
            {/* Right Sidebar Header with Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <div className="flex items-center justify-between p-3">
                <h3 className="font-medium text-gray-900 dark:text-white">Tools & Chat</h3>
                <button
                  onClick={() => setShowRightSidebar(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  title="Hide Right Panel"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              
              {/* Tab Navigation */}
              <div className="flex border-b border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setRightSidebarContent('chat')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                    rightSidebarContent === 'chat'
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Chat
                </button>
                <button
                  onClick={() => setRightSidebarContent('outline')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                    rightSidebarContent === 'outline'
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Outline
                </button>

                <button
                  onClick={() => setRightSidebarContent('graph')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm transition-colors ${
                    rightSidebarContent === 'graph'
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-500'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <Network className="w-4 h-4" />
                  Graph
                </button>
              </div>
            </div>

            {/* Right Sidebar Content */}
            <div className="flex-1 overflow-hidden min-h-0">
              {rightSidebarContent === 'chat' && (
                <NotebookChat
                  notebookId={notebook.id}
                  documentCount={documents.length}
                  completedDocumentCount={completedDocumentCount}
                  onDocumentUpload={handleDocumentUpload}
                />
              )}
              {rightSidebarContent === 'outline' && (
                <div className="p-4 h-full overflow-y-auto">
                  <NotebookOutline notebookId={notebook.id} selectedNotes={selectedNotes} />
                </div>
              )}

              {rightSidebarContent === 'graph' && (
                <div className="h-full">
                  <GraphViewer notebookId={notebook.id} onClose={() => setShowRightSidebar(false)} />
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Outline Component
const NotebookOutline: React.FC<{ notebookId: string; selectedNotes: string[] }> = ({ notebookId, selectedNotes }) => {
  const [notes, setNotes] = useState<any[]>([]);

  useEffect(() => {
    const savedNotes = localStorage.getItem(`notebook-notes-${notebookId}`);
    if (savedNotes) {
      setNotes(JSON.parse(savedNotes));
    }
  }, [notebookId]);

  const groupedNotes = notes.reduce((acc, note) => {
    if (!acc[note.type]) {
      acc[note.type] = [];
    }
    acc[note.type].push(note);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {notes.length} notes total
      </div>
      
      {Object.entries(groupedNotes).map(([type, typeNotes]) => (
        <div key={type} className="space-y-2">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 capitalize flex items-center gap-2">
            {type === 'text' && <FileText className="w-4 h-4" />}
            {type === 'code' && <FileText className="w-4 h-4" />}
            {type === 'todo' && <FileText className="w-4 h-4" />}
            {type === 'idea' && <FileText className="w-4 h-4" />}
            {type === 'query' && <FileText className="w-4 h-4" />}
            {type} ({typeNotes.length})
          </h3>
          <div className="space-y-1">
            {typeNotes.map(note => (
              <div
                key={note.id}
                className={`p-2 rounded-lg text-sm cursor-pointer transition-colors ${
                  selectedNotes.includes(note.id)
                    ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-900 dark:text-blue-100'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="font-medium truncate">{note.title}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {note.content.substring(0, 50)}...
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {new Date(note.updatedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      
      {notes.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No notes yet</p>
          <p className="text-xs">Create your first note to see the outline</p>
        </div>
      )}
    </div>
  );
};



export default NotebookWorkspace; 