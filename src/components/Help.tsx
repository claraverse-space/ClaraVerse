import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search,
  Plus,
  SlidersHorizontal,
  Grid,
  Layers,
  Code,
  FileText,
  Database,
  BarChart,
  ImageIcon,
  MessagesSquare,
  Bot,
  MoreVertical,
  ExternalLink,
  Moon,
  Sun
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Components } from 'react-markdown';
import helpContent from '../data/help-content.json';
import { db } from '../db';
import { useTheme } from '../hooks/useTheme';
import ReactPlayer from 'react-player/youtube';

interface HelpSection {
  id: string;
  title: string;
  content: string;
  contextSnippet?: string;
}

const HighlightedText = ({ text, searchQuery }: { text: string; searchQuery: string }) => {
  if (!searchQuery.trim()) return <>{text}</>;
  
  const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'));
  return (
    <>
      {parts.map((part, i) => 
        part.toLowerCase() === searchQuery.toLowerCase() ? (
          <span key={i} className="bg-yellow-200 dark:bg-yellow-900/50">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
};

const Help = () => {
  const { theme, setTheme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [sections, setSections] = useState<HelpSection[]>([]);
  const [filteredSections, setFilteredSections] = useState<HelpSection[]>([]);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [wallpaperUrl, setWallpaperUrl] = useState<string | null>(null);

  // Mock data for apps - in a real application, this would come from a database
  const mockApps = [
    { 
      id: 1, 
      name: 'Code Assistant', 
      description: 'AI-powered coding helper for developers',
      icon: Code,
      color: 'from-blue-400 to-indigo-600',
      created: '2023-06-10',
    },
    { 
      id: 2, 
      name: 'Document Analyzer', 
      description: 'Extract insights from documents and PDFs',
      icon: FileText,
      color: 'from-amber-400 to-orange-600',
      created: '2023-07-22',
    },
    { 
      id: 3, 
      name: 'SQL Generator', 
      description: 'Generate SQL queries using natural language',
      icon: Database,
      color: 'from-emerald-400 to-teal-600',
      created: '2023-08-05',
    },
    { 
      id: 4, 
      name: 'Chart Maker', 
      description: 'Create data visualizations from datasets',
      icon: BarChart,
      color: 'from-rose-400 to-pink-600',
      created: '2023-09-18',
    },
    { 
      id: 5, 
      name: 'Image Describer', 
      description: 'Generate detailed descriptions from images',
      icon: ImageIcon,
      color: 'from-purple-400 to-violet-600',
      created: '2023-10-01',
    },
    { 
      id: 6, 
      name: 'Chatbot Builder', 
      description: 'Create custom chatbots for your website',
      icon: MessagesSquare,
      color: 'from-green-400 to-emerald-600',
      created: '2023-11-15',
    },
  ];

  useEffect(() => {
    let updatedSections = helpContent.sections;
    if (!helpContent.sections.some((s: any) => s.id === 'dashboard-features')) {
      updatedSections = [
        {
          id: 'dashboard-features',
          title: 'Dashboard - Tour',
          content: '',
        },
        ...helpContent.sections
      ];
    }
    setSections(updatedSections);
    setSelectedSection(updatedSections[0].id);
    
    // Load wallpaper from IndexedDB
    const loadWallpaper = async () => {
      try {
        const wallpaper = await db.getWallpaper();
        if (wallpaper) {
          setWallpaperUrl(wallpaper);
        }
      } catch (error) {
        console.error('Error loading wallpaper:', error);
      }
    };
    loadWallpaper();
  }, []);

  useEffect(() => {
    const filtered = sections.filter(
      section =>
        section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        section.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredSections(filtered);
  }, [searchQuery, sections]);

  // Filter apps based on search query
  const filteredApps = mockApps.filter(app => 
    app.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    app.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort apps based on selected sort option
  const sortedApps = [...filteredApps].sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.created).getTime() - new Date(a.created).getTime();
    } else if (sortBy === 'oldest') {
      return new Date(a.created).getTime() - new Date(b.created).getTime();
    } else {
      return a.name.localeCompare(b.name);
    }
  });

  const searchResults = useMemo(() => {
    if (!searchQuery) return sections;

    const query = searchQuery.toLowerCase();
    return sections.filter(section => {
      const contentMatches = section.content.toLowerCase().includes(query);
      const titleMatches = section.title.toLowerCase().includes(query);
      return contentMatches || titleMatches;
    }).map(section => {
      // Find the first match context in content
      const contentLower = section.content.toLowerCase();
      const matchIndex = contentLower.indexOf(query);
      let contextSnippet = '';

      if (matchIndex !== -1) {
        const start = Math.max(0, matchIndex - 50);
        const end = Math.min(section.content.length, matchIndex + 100);
        contextSnippet = section.content.slice(start, end);
        if (start > 0) contextSnippet = '...' + contextSnippet;
        if (end < section.content.length) contextSnippet += '...';
      }

      return {
        ...section,
        contextSnippet
      };
    });
  }, [searchQuery, sections]);

  // Custom markdown components for highlighting
  const MarkdownComponents: Partial<Components> = {
    p: ({ children, ...props }) => (
      <p className="mb-4 text-gray-700 dark:text-gray-300" {...props}>
        {typeof children === 'string' ? (
          <HighlightedText text={children} searchQuery={searchQuery} />
        ) : (
          children
        )}
      </p>
    )
    // Add more components as needed for other markdown elements
  };

  // Toggle theme function
  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <>
      {/* Wallpaper */}
      {wallpaperUrl && (
        <div 
          className="fixed top-0 left-0 right-0 bottom-0 z-0"
          style={{
            backgroundImage: `url(${wallpaperUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.1,
            filter: 'blur(1px)',
            pointerEvents: 'none'
          }}
        />
      )}
      <div className="h-[calc(100vh-theme(spacing.16)-theme(spacing.12))] overflow-hidden flex relative z-10">
        {/* Sidebar */}
        <div className="w-64 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          <div className="p-4">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search help..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 
                  bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            
            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center w-full py-2 px-4 mb-2 rounded-lg border border-gray-200 dark:border-gray-700 
                bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              {theme === 'dark' ? (
                <div className="flex items-center">
                  <Sun size={16} className="mr-2" />
                  <span>Light Mode</span>
                </div>
              ) : (
                <div className="flex items-center">
                  <Moon size={16} className="mr-2" />
                  <span>Dark Mode</span>
                </div>
              )}
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto p-4">
            {searchResults.map((section) => (
              <button
                key={section.id}
                onClick={() => setSelectedSection(section.id)}
                className={`w-full text-left px-4 py-2 rounded-lg mb-2 transition-colors ${
                  selectedSection === section.id
                    ? 'bg-sakura-100 text-sakura-900 dark:bg-sakura-500 dark:text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <div>
                  <HighlightedText text={section.title} searchQuery={searchQuery} />
                  {section.contextSnippet && searchQuery && (
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                      <HighlightedText text={section.contextSnippet} searchQuery={searchQuery} />
                    </p>
                  )}
                </div>
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {selectedSection === 'dashboard-features' ? (
            <div className="flex-1 flex flex-col items-center justify-center h-full w-full">
              <div className="w-full max-w-3xl mx-auto flex flex-col items-center mb-6 px-2 md:px-0">
                <h1 className="text-3xl md:text-4xl font-extrabold text-sakura-700 dark:text-sakura-300 mb-2 font-sans text-center drop-shadow-sm">Clara Dashboard Tour</h1>
                <p className="text-lg md:text-xl text-gray-700 dark:text-gray-200 mb-4 font-sans text-center max-w-2xl">Discover all the features and possibilities of your Clara dashboard. Watch this quick tour to learn how to get the most out of your workspace, customize your experience, and unlock powerful tools for productivity and creativity.</p>
              </div>
              <div className="relative flex flex-col items-center justify-center w-full h-full rounded-2xl shadow-lg overflow-hidden bg-white/80 dark:bg-gray-900/80" style={{ aspectRatio: '16/9', minHeight: 320, maxHeight: '70vh' }}>
                {/* Soft blur/glow overlay for video edges */}
                <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl" style={{
                  boxShadow: '0 0 60px 20px rgba(236,72,153,0.10), 0 0 120px 40px rgba(236,72,153,0.08)',
                  backdropFilter: 'blur(2px)',
                  WebkitBackdropFilter: 'blur(2px)'
                }} />
                <ReactPlayer
                  url="https://youtu.be/8G6Ckl6uIQ0"
                  width="100%"
                  height="100%"
                  controls
                  light="https://img.youtube.com/vi/8G6Ckl6uIQ0/maxresdefault.jpg"
                  playIcon={<button className="bg-sakura-500 text-white px-6 py-3 rounded-full text-lg font-semibold shadow-lg hover:bg-sakura-600 transition">▶ Play Dashboard Demo</button>}
                  className="react-player rounded-2xl"
                  style={{ background: 'rgba(0,0,0,0.1)', zIndex: 20 }}
                />
                <div className="absolute bottom-4 left-0 right-0 flex justify-center z-30">
                  <span className="bg-sakura-100 dark:bg-sakura-700/80 text-sakura-900 dark:text-white px-4 py-2 rounded-full text-sm font-medium shadow">Clara's Dashboard Demo</span>
                </div>
              </div>
            </div>
          ) : selectedSection && (
            <div className="max-w-4xl mx-auto">
              <div className="prose dark:prose-invert prose-sakura max-w-none">
                <ReactMarkdown components={MarkdownComponents}>
                  {sections.find((section) => section.id === selectedSection)?.content || ''}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Help;