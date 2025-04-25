import React, { useState, useEffect } from 'react';
import { X, Download, Box, FileJson, FileText, ChevronLeft, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface WorkflowModalProps {
  workflow: {
    category: string;
    name: string;
    description: string;
    nodeCount: number;
    tags: string[];
    nodeNames: string[];
    readmeLink: string;
    jsonLink: string;
  };
  onClose: () => void;
}

type ViewMode = 'details' | 'json' | 'docs';

const toRawGitHubUrl = (url: string): string =>
  url
    .replace('https://github.com/', 'https://raw.githubusercontent.com/')
    .replace('/blob/', '/');

const WorkflowModal: React.FC<WorkflowModalProps> = ({ workflow, onClose }) => {
  const [jsonContent, setJsonContent] = useState<string>('');
  const [docsContent, setDocsContent] = useState<string>('');
  const [loading, setLoading] = useState({ json: true, docs: true });
  const [showDocs, setShowDocs] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchContent = async () => {
    try {
      const [jsonResponse, docsResponse] = await Promise.all([
        fetch(toRawGitHubUrl(workflow.jsonLink)),
        fetch(toRawGitHubUrl(workflow.readmeLink))
      ]);

      if (!jsonResponse.ok) throw new Error(`JSON HTTP ${jsonResponse.status}`);
      if (!docsResponse.ok) throw new Error(`Docs HTTP ${docsResponse.status}`);

      const [jsonText, docsText] = await Promise.all([
        jsonResponse.text(),
        docsResponse.text()
      ]);

      setJsonContent(jsonText);
      setDocsContent(docsText);
    } catch (err) {
      console.error('Failed to fetch content:', err);
    } finally {
      setLoading({ json: false, docs: false });
    }
  };

  useEffect(() => {
    fetchContent();
  }, [workflow.jsonLink, workflow.readmeLink]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="relative w-[95vw] h-[90vh] bg-white dark:bg-black rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 flex items-start justify-between p-6 bg-white dark:bg-black border-b border-gray-100/10 dark:border-gray-800/50 z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-500/10 dark:bg-pink-500/20 rounded-lg">
              <Box className="w-6 h-6 text-pink-500 dark:text-pink-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {workflow.name}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-1 bg-pink-500 dark:bg-black border border-transparent dark:border-pink-500/50 text-white text-xs rounded-full font-medium">
                  {workflow.category}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {workflow.nodeCount} Nodes
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDocs(!showDocs)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-transparent dark:bg-transparent text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800"
            >
              <FileText className="w-4 h-4" />
              
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="h-full pt-28 pb-20 overflow-y-auto">
          <div className="px-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: Details */}
            <div className="space-y-8">
              {/* Description */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Description
                </h3>
                <p className="text-gray-600 dark:text-gray-300">
                  {workflow.description}
                </p>
              </div>

              {/* Nodes */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Nodes Used
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {workflow.nodeNames.map((node) => (
                    <div
                      key={node}
                      className="px-3 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-100/10 dark:border-gray-800/50 rounded-lg text-sm text-gray-600 dark:text-gray-300"
                    >
                      {node}
                    </div>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                  Tags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {workflow.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-gray-50 dark:bg-gray-900 border border-gray-100/10 dark:border-gray-800/50 text-gray-600 dark:text-gray-300 text-sm rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Documentation (Hidden by default) */}
              {showDocs && (
                <div>
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Documentation
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-900 border border-gray-100/10 dark:border-gray-800/50 rounded-lg p-4">
                    {loading.docs ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 dark:border-pink-400"></div>
                      </div>
                    ) : (
                      <div className="prose dark:prose-invert max-w-none prose-sm">
                        <ReactMarkdown>{docsContent}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: JSON Preview */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <FileJson className="w-4 h-4" />
                Workflow JSON
              </h3>
              <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200/50 dark:border-gray-800/50 rounded-lg p-4 h-[calc(100%-2rem)]">
                {loading.json ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 dark:border-pink-400"></div>
                  </div>
                ) : (
                  <SyntaxHighlighter
                    language="json"
                    style={vscDarkPlus}
                    customStyle={{
                      background: 'transparent',
                      margin: 0,
                      padding: 0,
                      height: '100%',
                      maxHeight: '100%',
                    }}
                  >
                    {jsonContent}
                  </SyntaxHighlighter>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-6 bg-white dark:bg-black border-t border-gray-100/10 dark:border-gray-800/50">
          <button
            onClick={async () => {
              const rawUrl = toRawGitHubUrl(workflow.jsonLink);
              try {
                const response = await fetch(rawUrl);
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${workflow.name.toLowerCase().replace(/\s+/g, '_')}.json`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
              } catch (error) {
                console.error('Failed to download workflow:', error);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-800"
          >
            <Download className="w-4 h-4" />
            Download JSON
          </button>
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={async () => {
                const rawUrl = toRawGitHubUrl(workflow.jsonLink);
                try {
                  window.electron.clipboard.writeText(rawUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000); // Reset after 2 seconds
                } catch (error) {
                  console.error('Failed to copy URL:', error);
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                copied 
                  ? 'bg-green-500 dark:bg-green-600 text-white' 
                  : 'bg-pink-500 dark:bg-black border border-transparent dark:border-pink-500/50 text-white hover:bg-pink-600 dark:hover:bg-gray-900'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Copy Import URL
                </>
              )}
            </button>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              💡 Quick Tip: Use "Import from URL" in Clara's n8n after copying the link
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowModal; 