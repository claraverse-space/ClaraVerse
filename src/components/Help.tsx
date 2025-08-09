import { useState, useEffect, useMemo } from 'react';
import { 
  Search,
  BookOpen,
  ChevronRight,
  ChevronDown,
  Home,
  RefreshCw,
  ExternalLink,
  Clock,
  User,
  Sun,
  Moon,
  FileText,
  Zap,
  Bot,
  HelpCircle,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Star,
  ArrowRight,
  Github,
  MessageSquare,
  Youtube,
  Heart
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Components } from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useTheme } from '../hooks/useTheme';

// Types
interface DocFile {
  id: string;
  title: string;
  description: string;
  category: string;
  order: number;
  filePath: string;
  lastUpdated?: string;
  contributors?: string[];
}

interface DocConfig {
  categories: string[];
  files: Record<string, DocFile>;
}

interface DocContent {
  metadata: {
    title: string;
    description: string;
    category: string;
    order: number;
    lastUpdated?: string;
    contributors?: string[];
  };
  content: string;
}

interface CachedDoc {
  content: DocContent;
  timestamp: number;
  etag?: string;
}

interface CacheData {
  config: DocConfig;
  docs: Record<string, CachedDoc>;
  lastFetch: number;
}

// Cache utilities
const CACHE_KEY = 'claraverse_docs_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/badboysm890/ClaraVerse/main/docs';

// GitHub API helpers
const fetchGitHubFile = async (path: string): Promise<string> => {
  const response = await fetch(`${GITHUB_RAW_BASE}/${path}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}: ${response.statusText}`);
  }
  return response.text();
};

const parseMarkdownWithFrontmatter = (content: string): DocContent => {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    return {
      metadata: {
        title: 'Untitled Document',
        description: '',
        category: 'general',
        order: 999
      },
      content: content
    };
  }

  const [, frontmatter, markdownContent] = match;
  const metadata: any = {};
  
  frontmatter.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length) {
      const value = valueParts.join(':').trim().replace(/^["']|["']$/g, '');
      if (key === 'contributors' && value.startsWith('[')) {
        metadata[key] = JSON.parse(value);
      } else if (key === 'order') {
        metadata[key] = parseInt(value) || 999;
      } else {
        metadata[key] = value;
      }
    }
  });

  return {
    metadata: {
      title: metadata.title || 'Untitled Document',
      description: metadata.description || '',
      category: metadata.category || 'general',
      order: metadata.order || 999,
      lastUpdated: metadata.lastUpdated,
      contributors: metadata.contributors || []
    },
    content: markdownContent
  };
};

// Category icons and colors
const getCategoryConfig = (category: string) => {
  switch (category) {
    case 'getting-started': 
      return { 
        icon: Home, 
        color: 'text-emerald-500', 
        bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
        label: 'Getting Started'
      };
    case 'features': 
      return { 
        icon: Zap, 
        color: 'text-amber-500', 
        bgColor: 'bg-amber-50 dark:bg-amber-500/10',
        label: 'Features'
      };
    case 'agents': 
      return { 
        icon: Bot, 
        color: 'text-purple-500', 
        bgColor: 'bg-purple-50 dark:bg-purple-500/10',
        label: 'Agents'
      };
    case 'ai-features': 
      return { 
        icon: Sparkles, 
        color: 'text-blue-500', 
        bgColor: 'bg-blue-50 dark:bg-blue-500/10',
        label: 'AI Features'
      };
    case 'troubleshooting': 
      return { 
        icon: HelpCircle, 
        color: 'text-red-500', 
        bgColor: 'bg-red-50 dark:bg-red-500/10',
        label: 'Troubleshooting'
      };
    default: 
      return { 
        icon: FileText, 
        color: 'text-gray-500', 
        bgColor: 'bg-gray-50 dark:bg-gray-500/10',
        label: 'Documentation'
      };
  }
};

// Search highlighting
const HighlightedText = ({ text, searchQuery }: { text: string; searchQuery: string }) => {
  if (!searchQuery.trim()) return <>{text}</>;
  
  const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === searchQuery.toLowerCase() ? (
          <span key={i} className="bg-sakura-200 dark:bg-sakura-600/50 px-1 rounded text-sakura-800 dark:text-sakura-200 font-medium">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};

const Help = () => {
  const { theme, setTheme } = useTheme();
  
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['getting-started']));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data
  const [config, setConfig] = useState<DocConfig | null>(null);
  const [docs, setDocs] = useState<Record<string, DocContent>>({});
  const [lastFetch, setLastFetch] = useState<number>(0);

  // Load cache from localStorage
  const loadCache = (): CacheData | null => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };

  // Save cache to localStorage
  const saveCache = (data: CacheData) => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save docs cache:', error);
    }
  };

  // Check if cache is valid
  const isCacheValid = (timestamp: number): boolean => {
    return Date.now() - timestamp < CACHE_DURATION;
  };

  // Fetch documentation from GitHub
  const fetchDocs = async (forceRefresh = false) => {
    setError(null);
    setRefreshing(forceRefresh);
    
    try {
      // Check cache first
      const cached = loadCache();
      if (!forceRefresh && cached && isCacheValid(cached.lastFetch)) {
        setConfig(cached.config);
        const docsMap: Record<string, DocContent> = {};
        Object.entries(cached.docs).forEach(([key, cachedDoc]) => {
          docsMap[key] = cachedDoc.content;
        });
        setDocs(docsMap);
        setLastFetch(cached.lastFetch);
        setLoading(false);
        return;
      }

      // Fetch config.json
      const configContent = await fetchGitHubFile('config.json');
      const docConfig: DocConfig = JSON.parse(configContent);
      setConfig(docConfig);

      // Fetch all documents
      const docsMap: Record<string, DocContent> = {};
      const cacheDocsMap: Record<string, CachedDoc> = {};
      
      await Promise.all(
        Object.entries(docConfig.files).map(async ([key, file]) => {
          try {
            const content = await fetchGitHubFile(file.filePath);
            const parsedDoc = parseMarkdownWithFrontmatter(content);
            docsMap[key] = parsedDoc;
            cacheDocsMap[key] = {
              content: parsedDoc,
              timestamp: Date.now()
            };
          } catch (error) {
            console.warn(`Failed to fetch ${file.filePath}:`, error);
          }
        })
      );

      setDocs(docsMap);
      const fetchTime = Date.now();
      setLastFetch(fetchTime);

      // Save to cache
      saveCache({
        config: docConfig,
        docs: cacheDocsMap,
        lastFetch: fetchTime
      });

      // Auto-select first document
      if (!selectedDoc && Object.keys(docsMap).length > 0) {
        const firstDoc = Object.entries(docConfig.files)
          .sort(([, a], [, b]) => a.order - b.order)[0];
        if (firstDoc) {
          setSelectedDoc(firstDoc[0]);
        }
      }

    } catch (error) {
      console.error('Failed to fetch documentation:', error);
      setError('Failed to load documentation. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initialize
  useEffect(() => {
    fetchDocs();
  }, []);

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) {
      newExpanded.delete(category);
    } else {
      newExpanded.add(category);
    }
    setExpandedCategories(newExpanded);
  };

  // Group documents by category
  const groupedDocs = useMemo(() => {
    if (!config) return {};
    
    const groups: Record<string, DocFile[]> = {};
    
    Object.entries(config.files).forEach(([key, file]) => {
      if (!groups[file.category]) {
        groups[file.category] = [];
      }
      groups[file.category].push({ ...file, id: key });
    });

    // Sort within each category
    Object.keys(groups).forEach(category => {
      groups[category].sort((a, b) => a.order - b.order);
    });

    return groups;
  }, [config]);

  // Search functionality
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !config) return null;

    const results: Array<{ file: DocFile & { id: string }; snippet: string }> = [];
    const query = searchQuery.toLowerCase();

    Object.entries(config.files).forEach(([key, file]) => {
      const doc = docs[key];
      if (!doc) return;

      const titleMatch = file.title.toLowerCase().includes(query);
      const descMatch = file.description.toLowerCase().includes(query);
      const contentMatch = doc.content.toLowerCase().includes(query);

      if (titleMatch || descMatch || contentMatch) {
        let snippet = '';
        if (contentMatch) {
          const contentLower = doc.content.toLowerCase();
          const matchIndex = contentLower.indexOf(query);
          const start = Math.max(0, matchIndex - 60);
          const end = Math.min(doc.content.length, matchIndex + 120);
          snippet = doc.content.slice(start, end);
          if (start > 0) snippet = '...' + snippet;
          if (end < doc.content.length) snippet += '...';
        } else {
          snippet = file.description;
        }

        results.push({
          file: { ...file, id: key },
          snippet
        });
      }
    });

    return results.sort((a, b) => a.file.order - b.file.order);
  }, [searchQuery, config, docs]);

  // Custom markdown components
  const MarkdownComponents: Partial<Components> = {
    h1: ({ children }) => (
      <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6 border-b border-gray-200 dark:border-gray-700 pb-4">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-3xl font-semibold text-gray-900 dark:text-white mb-4 mt-8">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
        {typeof children === 'string' ? (
          <HighlightedText text={children} searchQuery={searchQuery} />
        ) : (
          children
        )}
      </p>
    ),
    code: ({ inline, className, children, ...props }: any) => {
      const match = /language-(\w+)/.exec(className || '');
      return !inline && match ? (
        <SyntaxHighlighter
          style={theme === 'dark' ? oneDark : oneLight}
          language={match[1]}
          PreTag="div"
          className="rounded-lg my-4"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono text-sakura-600 dark:text-sakura-400" {...props}>
          {children}
        </code>
      );
    },
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-sakura-400 bg-sakura-50 dark:bg-sakura-900/20 pl-4 py-2 my-4 italic rounded-r-lg">
        {children}
      </blockquote>
    ),
    ul: ({ children }) => (
      <ul className="list-disc list-inside mb-4 space-y-1 text-gray-700 dark:text-gray-300">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside mb-4 space-y-1 text-gray-700 dark:text-gray-300">
        {children}
      </ol>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sakura-600 dark:text-sakura-400 hover:text-sakura-700 dark:hover:text-sakura-300 underline inline-flex items-center gap-1 transition-colors"
      >
        {children}
        <ExternalLink size={14} />
      </a>
    )
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-theme(spacing.18)-theme(spacing.12))] bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="glassmorphic p-8 rounded-2xl">
            <Loader2 className="h-8 w-8 animate-spin text-sakura-500 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 font-medium">Loading documentation...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-theme(spacing.18)-theme(spacing.12))] bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="glassmorphic p-8 rounded-2xl">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Failed to Load Documentation
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
            <button
              onClick={() => fetchDocs(true)}
              className="bg-sakura-500 hover:bg-sakura-600 text-white px-6 py-3 rounded-lg transition-colors font-medium flex items-center gap-2 mx-auto"
            >
              <RefreshCw size={16} />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-theme(spacing.16)-theme(spacing.1))] bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          {/* Header */}
          <div className="flex-shrink-0 p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-sakura-50 to-pink-50 dark:from-gray-800 dark:to-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-sakura-100 dark:bg-sakura-500/20 rounded-xl">
                  <BookOpen className="h-6 w-6 text-sakura-600 dark:text-sakura-400" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    Documentation
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">ClaraVerse Guide</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  className="p-2 rounded-lg glassmorphic hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Toggle theme"
                >
                  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                </button>
                <button
                  onClick={() => fetchDocs(true)}
                  disabled={refreshing}
                  className="p-2 rounded-lg glassmorphic hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  title="Refresh documentation"
                >
                  <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>
            
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" size={18} />
              <input
                type="text"
                placeholder="Search documentation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400
                  focus:border-sakura-500 focus:ring-2 focus:ring-sakura-500/20 outline-none transition-all"
              />
            </div>

            {lastFetch > 0 && (
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <CheckCircle2 size={12} className="text-emerald-500" />
                <span>Last updated: {new Date(lastFetch).toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            {searchResults ? (
              /* Search Results */
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Search size={16} className="text-gray-400" />
                  <h3 className="font-semibold text-gray-700 dark:text-gray-300">
                    Search Results ({searchResults.length})
                  </h3>
                </div>
                {searchResults.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">No results found</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {searchResults.map(({ file, snippet }) => {
                      const categoryConfig = getCategoryConfig(file.category);
                      return (
                        <button
                          key={file.id}
                          onClick={() => setSelectedDoc(file.id)}
                          className={`w-full text-left p-4 rounded-xl transition-all duration-200 group ${
                            selectedDoc === file.id
                              ? 'bg-sakura-100 dark:bg-sakura-500/20 shadow-md'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700 glassmorphic'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${categoryConfig.bgColor} flex-shrink-0 group-hover:scale-110 transition-transform`}>
                              <categoryConfig.icon size={16} className={categoryConfig.color} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-gray-900 dark:text-white mb-1 truncate">
                                <HighlightedText text={file.title} searchQuery={searchQuery} />
                              </div>
                              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                                <HighlightedText text={snippet} searchQuery={searchQuery} />
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Category Navigation */
              <div className="space-y-4">
                {config?.categories.map(category => {
                  const files = groupedDocs[category] || [];
                  const categoryConfig = getCategoryConfig(category);
                  const isExpanded = expandedCategories.has(category);

                  return (
                    <div key={category}>
                      <button
                        onClick={() => toggleCategory(category)}
                        className="w-full flex items-center justify-between p-3 rounded-xl glassmorphic hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${categoryConfig.bgColor} group-hover:scale-110 transition-transform`}>
                            <categoryConfig.icon size={18} className={categoryConfig.color} />
                          </div>
                          <div className="text-left">
                            <div className="font-semibold text-gray-900 dark:text-white">
                              {categoryConfig.label}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {files.length} document{files.length !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronDown size={16} className="text-gray-400 group-hover:text-sakura-500 transition-colors" />
                        ) : (
                          <ChevronRight size={16} className="text-gray-400 group-hover:text-sakura-500 transition-colors" />
                        )}
                      </button>
                      
                      {isExpanded && (
                        <div className="ml-4 mt-2 space-y-1">
                          {files.map(file => (
                            <button
                              key={file.id}
                              onClick={() => setSelectedDoc(file.id)}
                              className={`w-full text-left p-3 rounded-lg transition-all duration-200 group ${
                                selectedDoc === file.id
                                  ? 'bg-sakura-100 dark:bg-sakura-500/20 shadow-md'
                                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600 group-hover:bg-sakura-400 transition-colors"></div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 dark:text-white truncate">
                                    {file.title}
                                  </div>
                                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
                                    {file.description}
                                  </p>
                                </div>
                                <ArrowRight size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {selectedDoc && docs[selectedDoc] ? (
            <div className="h-full overflow-y-auto">
              <div className="max-w-4xl mx-auto p-8">
                {/* Document Header */}
                <div className="mb-8">
                  <div className="glassmorphic p-6 rounded-2xl">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
                          {docs[selectedDoc].metadata.title}
                        </h1>
                        {docs[selectedDoc].metadata.description && (
                          <p className="text-xl text-gray-600 dark:text-gray-400 leading-relaxed">
                            {docs[selectedDoc].metadata.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-6">
                        {config?.files[selectedDoc] && (
                          <div className={`p-3 rounded-xl ${getCategoryConfig(config.files[selectedDoc].category).bgColor}`}>
                            {(() => {
                              const CategoryIcon = getCategoryConfig(config.files[selectedDoc].category).icon;
                              return <CategoryIcon size={24} className={getCategoryConfig(config.files[selectedDoc].category).color} />;
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Metadata */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      {docs[selectedDoc].metadata.lastUpdated && (
                        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                          <Clock size={14} />
                          <span>Updated {docs[selectedDoc].metadata.lastUpdated}</span>
                        </div>
                      )}
                      {docs[selectedDoc].metadata.contributors && docs[selectedDoc].metadata.contributors.length > 0 && (
                        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                          <User size={14} />
                          <span>By {docs[selectedDoc].metadata.contributors.join(', ')}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 bg-sakura-100 dark:bg-sakura-500/20 text-sakura-600 dark:text-sakura-400 px-3 py-1 rounded-full">
                        <Star size={14} />
                        <span>Live from GitHub</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Document Content */}
                <div className="glassmorphic p-8 rounded-2xl">
                  <div className="prose dark:prose-invert prose-lg max-w-none prose-sakura">
                    <ReactMarkdown components={MarkdownComponents}>
                      {docs[selectedDoc].content}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full p-8">
              <div className="text-center max-w-md">
                <div className="glassmorphic p-8 rounded-2xl">
                  <div className="p-4 bg-sakura-100 dark:bg-sakura-500/20 rounded-2xl inline-block mb-6">
                    <BookOpen className="h-16 w-16 text-sakura-600 dark:text-sakura-400" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                    Welcome to ClaraVerse Documentation
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                    Select a topic from the sidebar to get started, or use the search to find specific information about ClaraVerse features and capabilities.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-900 dark:bg-gray-950 border-gray-800 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-8 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-sakura-500/20 rounded-xl">
                  <BookOpen className="h-6 w-6 text-sakura-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">ClaraVerse Documentation</h3>
                  <p className="text-sm text-gray-400">Join our community</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <a
                href="https://discord.gg/j633fsrAne"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors group"
              >
                <MessageSquare size={16} className="text-white" />
                <span className="text-white font-medium">Discord</span>
              </a>

              <a
                href="https://github.com/badboysm890/ClaraVerse"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors group"
              >
                <Github size={16} className="text-white" />
                <span className="text-white font-medium">GitHub</span>
              </a>

              <a
                href="https://reddit.com/r/claraverse"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 transition-colors group"
              >
                <MessageSquare size={16} className="text-white" />
                <span className="text-white font-medium">Reddit</span>
              </a>

              <a
                href="https://youtube.com/@claraverseai"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 transition-colors group"
              >
                <Youtube size={16} className="text-white" />
                <span className="text-white font-medium">YouTube</span>
              </a>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-400">
              <span>Made with</span>
              <Heart size={14} className="text-sakura-400 fill-current" />
              <span>by ClaraVerse Team</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Help;