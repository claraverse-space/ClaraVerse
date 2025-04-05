import React from 'react';
import { X, Wrench, Database, Wand2, Code, Search, FileText, Zap, BookOpen, MessageSquare, Brain, Star, Lightbulb, ArrowRight } from 'lucide-react';

interface Feature {
  id: string;
  title: string;
  description: string;
  date: string;
  category: 'Tools' | 'Knowledge Base' | 'Chat' | 'Other';
  details: string;
  useCases: string[];
  quickStart: string[];
  benefits: string[];
  codeExample?: string;
}

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FEATURES: Feature[] = [
  {
    id: '1',
    title: 'Smart Tool Assistant',
    description: 'Your AI helper can now use custom tools to help you get things done',
    date: '2025-04-05',
    category: 'Tools',
    details: `Let me explain how Clara's tools work in simple terms:

🔧 **What are Tools?**
Think of tools as special abilities that Clara can use to help you. Just like you might use a calculator for math or a weather app to check the forecast, Clara can use tools to do specific tasks for you.

🎯 **How Do They Help?**
- Instead of just chatting, Clara can now take action
- She can fetch real data, make calculations, or process information
- Everything happens right in your chat conversation
- Tools can be customized for your specific needs

🌟 **Key Features:**
1. **Smart Tool Detection**: Clara automatically knows when to use tools
2. **Real-Time Results**: Get instant answers and data
3. **Custom Tool Creation**: Create your own tools for specific tasks
4. **Safe & Reliable**: All tools are tested and secure
5. **Natural Language**: Just ask normally, no special commands needed

💡 **Tool Types Available:**
- Weather Information Tools
- Calculation Tools
- File Processing Tools
- API Integration Tools
- Custom Function Tools`,
    useCases: [
      "Get weather updates: \"What's the weather like in New York?\"",
      "Financial calculations: \"Calculate loan payments for $300,000\"",
      "Document analysis: \"Summarize this PDF for me\"",
      "Data processing: \"Convert this CSV to JSON\"",
      "API interactions: \"Get the latest stock price for AAPL\"",
      "Custom workflows: \"Update my project status in Jira\""
    ],
    quickStart: [
      'Start a chat with Clara and mention your task',
      'Clara will automatically detect when to use tools',
      'Get real-time results right in the chat',
      'Create custom tools for your specific needs',
      'Combine multiple tools for complex tasks'
    ],
    benefits: [
      'Save time with automated task execution',
      'Get accurate, real-time data from reliable sources',
      'Perform complex tasks with simple requests',
      'Customize tools for your specific workflows',
      'Seamless integration with your existing processes'
    ]
  },
  {
    id: '2',
    title: 'Smart Document Helper',
    description: 'Clara can now understand and use information from your documents',
    date: '2025-04-05',
    category: 'Knowledge Base',
    details: `Let me explain how Clara's document understanding works:

📚 **What is the Knowledge Base?**
Think of it as Clara's library. When you share documents with Clara, she reads and remembers them, so she can help you find information and answer questions about your documents.

🎯 **Core Features:**
- Document Understanding: Clara reads and comprehends your documents
- Smart Search: Find information across multiple documents
- Context Awareness: Get relevant information based on your conversation
- Source Citations: Know exactly where information comes from
- Temporary & Permanent Storage: Choose how long to keep documents

💡 **How It Works:**
1. **Upload Documents**: Share files by dragging and dropping
2. **Ask Questions**: Use natural language to inquire about content
3. **Get Smart Answers**: Receive responses with context and citations
4. **Follow Up**: Ask detailed questions about specific points
5. **Manage Documents**: Choose temporary or permanent storage

🔍 **Search Capabilities:**
- Semantic Search: Find information by meaning, not just keywords
- Multi-Document Search: Search across all your documents at once
- Context-Aware: Results based on your current conversation
- Real-Time Updates: Add or remove documents as needed`,
    useCases: [
      "Company policies: \"What's our work from home policy?\"",
      "Technical documentation: \"How do I deploy to production?\"",
      "Project management: \"What are our Q2 objectives?\"",
      "Research: \"Summarize the findings from these papers\"",
      "Legal documents: \"What are the key terms in this contract?\"",
      "Meeting notes: \"What action items were assigned last week?\""
    ],
    quickStart: [
      'Upload your documents through drag-and-drop',
      'Ask questions in natural language',
      'Review answers with source citations',
      'Follow up with more specific questions',
      'Manage your document storage preferences'
    ],
    benefits: [
      'Find information instantly without reading entire documents',
      'Get accurate answers with source references',
      'Save time searching through multiple documents',
      'Understand complex documents more easily',
      'Keep sensitive information temporary or permanent'
    ]
  },
  {
    id: '3',
    title: 'Enhanced Chat Experience',
    description: 'A smarter, more helpful chat interface with advanced features',
    date: '2025-04-05',
    category: 'Chat',
    details: `Let me show you what's new in Clara's chat interface:

💬 **Major Improvements:**
- Smarter Context Understanding
- Better Memory Management
- Enhanced Formatting Options
- Real-Time Response Streaming
- Multi-Modal Support (Text & Images)

🎯 **New Features:**
1. **Smart Memory**: Clara remembers important details from your conversation
2. **Better Understanding**: More accurate responses to your needs
3. **Rich Formatting**: Support for code, lists, tables, and more
4. **Real-Time Responses**: See answers as they're being written
5. **Image Support**: Share and discuss images naturally

💡 **Interface Improvements:**
- Cleaner Message Layout
- Better Code Formatting
- Image Preview Support
- Progress Indicators
- Easy File Sharing

🌟 **Advanced Features:**
- Message Editing
- Conversation History
- Tool Integration
- Knowledge Base Access
- Custom Styling Options`,
    useCases: [
      "Technical discussions with formatted code examples",
      "Image analysis and detailed visual feedback",
      "Multi-step problem solving with clear explanations",
      "Document creation and editing assistance",
      "Complex data visualization discussions",
      "Interactive learning sessions with real-time feedback"
    ],
    quickStart: [
      'Start a new chat or continue an existing one',
      'Try formatting with markdown (bold, italic, code)',
      'Share images for visual discussions',
      'Use tools and knowledge base together',
      'Edit messages to refine your questions'
    ],
    benefits: [
      'More natural and engaging conversations',
      'Better organization of complex information',
      'Seamless integration of multiple features',
      'Enhanced visual communication',
      'Improved context awareness and memory'
    ]
  }
];

const FeatureCard: React.FC<{ feature: Feature }> = ({ feature }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3">
        {feature.category === 'Tools' && <Wrench className="w-5 h-5 text-blue-500" />}
        {feature.category === 'Knowledge Base' && <Database className="w-5 h-5 text-green-500" />}
        {feature.category === 'Chat' && <MessageSquare className="w-5 h-5 text-purple-500" />}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{feature.title}</h3>
      </div>
      <span className="text-xs text-gray-500">{new Date(feature.date).toLocaleDateString()}</span>
    </div>
    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{feature.description}</p>
  </div>
);

const UseCaseCard: React.FC<{ useCase: string }> = ({ useCase }) => (
  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 flex items-start gap-3">
    <Lightbulb className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
    <p className="text-sm text-gray-700 dark:text-gray-300">{useCase}</p>
  </div>
);

interface QuickStartCardProps {
  step: string;
  index: number;
}

const QuickStartCard: React.FC<QuickStartCardProps> = ({ step, index }) => (
  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 flex items-start gap-3 shadow-sm">
    <div className="flex-shrink-0 w-8 h-8 bg-sakura-100 dark:bg-sakura-900/30 rounded-full flex items-center justify-center text-sakura-500">
      {index + 1}
    </div>
    <p className="text-sm text-gray-700 dark:text-gray-300">{step}</p>
  </div>
);

const BenefitCard: React.FC<{ benefit: string }> = ({ benefit }) => (
  <div className="bg-sakura-50 dark:bg-sakura-900/20 rounded-lg p-4 flex items-start gap-3">
    <Star className="w-5 h-5 text-sakura-500 flex-shrink-0 mt-0.5" />
    <p className="text-sm text-gray-700 dark:text-gray-300">{benefit}</p>
  </div>
);

export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ isOpen, onClose }) => {
  const [selectedFeature, setSelectedFeature] = React.useState<Feature | null>(FEATURES[0]);
  const [activeTab, setActiveTab] = React.useState<'overview' | 'quickStart' | 'useCases' | 'benefits'>('overview');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-6xl h-[85vh] bg-white dark:bg-gray-800 rounded-xl shadow-xl flex overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-72 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 p-4">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-sakura-500" />
              What's New
            </h3>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="space-y-3">
            {FEATURES.map(feature => (
              <button
                key={feature.id}
                onClick={() => setSelectedFeature(feature)}
                className={`w-full p-4 rounded-xl text-left transition-all ${
                  selectedFeature?.id === feature.id
                    ? 'bg-white dark:bg-gray-800 shadow-lg scale-[1.02]'
                    : 'hover:bg-white/50 dark:hover:bg-gray-800/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  {feature.category === 'Tools' && <Wrench className="w-4 h-4 text-blue-500" />}
                  {feature.category === 'Knowledge Base' && <Database className="w-4 h-4 text-green-500" />}
                  {feature.category === 'Chat' && <MessageSquare className="w-4 h-4 text-purple-500" />}
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{feature.title}</span>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{feature.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Feature Header */}
          <div className="border-b border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <span className={`px-2 py-1 rounded-full ${
                selectedFeature?.category === 'Tools' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' :
                selectedFeature?.category === 'Knowledge Base' ? 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' :
                'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
              }`}>
                {selectedFeature?.category}
              </span>
              <span className="text-gray-500">·</span>
              <span className="text-gray-500 dark:text-gray-400">
                Released {selectedFeature && new Date(selectedFeature.date).toLocaleDateString()}
              </span>
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              {selectedFeature?.title}
            </h2>
            
            {/* Tabs */}
            <div className="flex gap-4 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActiveTab('overview')}
                className={`pb-2 text-sm font-medium transition-colors relative ${
                  activeTab === 'overview'
                    ? 'text-sakura-500 border-b-2 border-sakura-500 -mb-[1px]'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('quickStart')}
                className={`pb-2 text-sm font-medium transition-colors relative ${
                  activeTab === 'quickStart'
                    ? 'text-sakura-500 border-b-2 border-sakura-500 -mb-[1px]'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Quick Start
              </button>
              <button
                onClick={() => setActiveTab('useCases')}
                className={`pb-2 text-sm font-medium transition-colors relative ${
                  activeTab === 'useCases'
                    ? 'text-sakura-500 border-b-2 border-sakura-500 -mb-[1px]'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Use Cases
              </button>
              <button
                onClick={() => setActiveTab('benefits')}
                className={`pb-2 text-sm font-medium transition-colors relative ${
                  activeTab === 'benefits'
                    ? 'text-sakura-500 border-b-2 border-sakura-500 -mb-[1px]'
                    : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Benefits
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'overview' && selectedFeature && (
              <div className="prose dark:prose-invert max-w-none">
                <div className="bg-gray-50 dark:bg-gray-900/50 rounded-xl p-6 mb-6">
                  <p className="text-lg text-gray-700 dark:text-gray-300">
                    {selectedFeature.description}
                  </p>
                </div>
                {selectedFeature.details.split('\n\n').map((paragraph, index) => (
                  <div key={index} className="mb-6">
                    {paragraph.includes('**') ? (
                      <div className="markdown-content" dangerouslySetInnerHTML={{ 
                        __html: paragraph
                          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                          .replace(/\n/g, '<br />') 
                      }} />
                    ) : (
                      <p className="mb-4">{paragraph}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'quickStart' && selectedFeature?.quickStart && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-500" />
                  Getting Started
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {selectedFeature.quickStart.map((step, index) => (
                    <QuickStartCard key={index} step={step} index={index} />
                  ))}
                </div>
                {selectedFeature.codeExample && (
                  <div className="mt-8">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Try these examples:</h4>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                      <code>{selectedFeature.codeExample}</code>
                    </pre>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'useCases' && selectedFeature?.useCases && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-purple-500" />
                  Popular Use Cases
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {selectedFeature.useCases.map((useCase, index) => (
                    <UseCaseCard key={index} useCase={useCase} />
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'benefits' && selectedFeature?.benefits && (
              <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  <Star className="w-5 h-5 text-sakura-500" />
                  Key Benefits
                </h3>
                <div className="grid grid-cols-1 gap-4">
                  {selectedFeature.benefits.map((benefit, index) => (
                    <BenefitCard key={index} benefit={benefit} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsNewModal; 