import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './common/Tabs';
import { Code, Eye, MessageSquare, Send, Layout, Save, Play, RefreshCw, Wand2, ArrowRight, Check, Download, FolderPlus, Folder, ArrowLeft } from 'lucide-react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useTheme } from '../hooks/useTheme';
import Editor from '@monaco-editor/react';
import ChatPanel from './uibuilder_components/ChatPanel';
import { 
  OllamaModel, 
  OllamaService, 
  ollamaSettingsStore,
  OpenAIService,
  OpenAIModel,
  OpenAIModelSelector,
  ApiTypeSelector
} from './uibuilder_components/ui_builder_libraries';
import { db, Message } from '../db';
import { v4 as uuidv4 } from 'uuid';
import { UIBuilderDesign } from './uibuilder_components/ui_builder_libraries/ProjectTypes';
import PreviewPanel from './uibuilder_components/PreviewPanel';
import ExportProjectModal from './uibuilder_components/ExportProjectModal';
import ProjectManagerModal from './uibuilder_components/ProjectManagerModal';
import { uiBuilderService, UIBuilderProject } from '../services/UIBuilderService';

// Check if we're running in Electron
const isElectron = !!(window && window.process && window.process.type);

interface UIBuilderProps {
  onPageChange: (page: string) => void;
}

const UIBuilder: React.FC<UIBuilderProps> = ({ onPageChange }) => {
  const { isDark } = useTheme();
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatMode, setChatMode] = useState<'chat' | 'design'>('design');
  const [selectedOllamaModel, setSelectedOllamaModel] = useState<OllamaModel | null>(null);
  const [selectedOpenAIModel, setSelectedOpenAIModel] = useState<OpenAIModel | null>(null);
  const [apiType, setApiType] = useState<'ollama' | 'openai'>('ollama');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [apiConfig, setApiConfig] = useState({
    ollama_base_url: '',
    openai_api_key: '',
    openai_base_url: 'https://api.openai.com/v1',
  });
  
  // Initialize services
  const ollamaService = new OllamaService(ollamaSettingsStore.getConnection());
  const openAIService = new OpenAIService(
    apiConfig.openai_base_url,
    apiConfig.openai_api_key
  );
  
  // Code editors content
  const [htmlCode, setHtmlCode] = useState(`<!DOCTYPE html>
<html lang="en">
<head>
  <title>My Custom UI</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <div class="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-8 flex items-center justify-center">
    <div class="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 relative overflow-hidden">
      <div class="absolute -top-10 -right-10 w-40 h-40 bg-pink-500/10 rounded-full"></div>
      <div class="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-500/10 rounded-full"></div>
      
      <div class="relative">
        <i class="fas fa-heart text-5xl text-pink-500 mb-6 block animate-bounce"></i>
        <h1 class="text-3xl font-bold text-gray-800 mb-4">Welcome!</h1>
        <p class="text-gray-600 mb-8">
          Start building your beautiful UI here. This example shows how to use Tailwind CSS and Font Awesome icons.
        </p>
        <button class="group bg-gradient-to-r from-pink-500 to-purple-500 text-white px-6 py-3 rounded-xl font-medium inline-flex items-center gap-2 hover:shadow-lg transition duration-300 hover:-translate-y-0.5">
          <span>Get Started</span>
          <i class="fas fa-arrow-right transition-transform group-hover:translate-x-1"></i>
        </button>
      </div>
    </div>
  </div>
</body>
</html>`);

  const [cssCode, setCssCode] = useState(`/* Additional custom styles */
@keyframes float {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
}

.fas.fa-heart {
  animation: float 3s ease-in-out infinite;
}

/* Any custom styles can be added here */`);

  const [jsCode, setJsCode] = useState(`document.addEventListener('DOMContentLoaded', function() {
  const button = document.querySelector('button');
  
  button.addEventListener('click', function() {
    // Add a ripple effect
    const ripple = document.createElement('div');
    ripple.className = 'absolute inset-0 bg-white/20 rounded-xl';
    this.appendChild(ripple);
    
    // Remove ripple after animation
    setTimeout(() => {
      ripple.remove();
    }, 1000);
  });
});`);

  const [activeTab, setActiveTab] = useState<'html' | 'css' | 'js' | 'preview'>('html');
  const [previewError, setPreviewError] = useState<{message: string; line: number; column: number} | null>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);

  // Resizing state
  const [leftPanelWidth, setLeftPanelWidth] = useState(33); // 33% initially
  const [isResizingHorizontal, setIsResizingHorizontal] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [chatInput]);

  // Load API config and models when component mounts
  useEffect(() => {
    const loadApiConfig = async () => {
      const config = await db.getAPIConfig();
      if (config) {
        setApiConfig({
          ollama_base_url: config.ollama_base_url || '',
          openai_api_key: config.openai_api_key || '',
          openai_base_url: config.openai_base_url || 'https://api.openai.com/v1',
        });
        
        // Set the default API type based on stored config
        if (config.api_type === 'openai' || config.api_type === 'ollama') {
          setApiType(config.api_type);
        }
        
        // Update OpenAI service with the loaded config
        openAIService.setBaseUrl(config.openai_base_url || 'https://api.openai.com/v1');
        openAIService.setApiKey(config.openai_api_key || '');
        
        // Update Ollama settings store with the loaded config
        if (config.ollama_base_url) {
          try {
            // Just use the full URL as-is
            ollamaSettingsStore.updateConnection({
              host: config.ollama_base_url,
              port: 11434, // This will be ignored if host is a full URL
              secure: config.ollama_base_url.startsWith('https://')
            });
            
            console.log(`Updated Ollama connection to URL: ${config.ollama_base_url}`);
          } catch (err) {
            console.error('Failed to update Ollama connection:', err);
          }
        }
      }
    };

    loadApiConfig();
  }, []);

  // Load previously selected models from localStorage
  useEffect(() => {
    // Load Ollama model
    const savedOllamaModel = localStorage.getItem('ollama_ui_builder_selected_model');
    if (savedOllamaModel) {
      try {
        setSelectedOllamaModel(JSON.parse(savedOllamaModel));
      } catch (e) {
        console.warn('Failed to parse saved Ollama model', e);
      }
    }
    
    // Load OpenAI model
    const savedOpenAIModel = localStorage.getItem('openai_ui_builder_selected_model');
    if (savedOpenAIModel) {
      try {
        setSelectedOpenAIModel(JSON.parse(savedOpenAIModel));
      } catch (e) {
        console.warn('Failed to parse saved OpenAI model', e);
      }
    } else {
      // Set a default OpenAI model if none was previously selected
      const defaultModel: OpenAIModel = {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        maxTokens: 16000,
        category: 'gpt',
        contextWindow: 16000
      };
      setSelectedOpenAIModel(defaultModel);
      localStorage.setItem('openai_ui_builder_selected_model', JSON.stringify(defaultModel));
    }
  }, []);

  // Add new state for current design
  const [currentDesign, setCurrentDesign] = useState<UIBuilderDesign | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showProjectManager, setShowProjectManager] = useState(false);

  // Load last active design on mount
  useEffect(() => {
    const loadLastDesign = async () => {
      try {
        // First check if we have a specific project ID in localStorage (set from the Apps page)
        const savedProjectId = localStorage.getItem('current_ui_project');
        
        if (savedProjectId) {
          // Load the specific project
          const project = await uiBuilderService.getProjectById(savedProjectId);
          
          if (project) {
            // Convert UIBuilderProject to UIBuilderDesign
            const designFromProject: UIBuilderDesign = {
              id: project.id,
              name: project.name,
              description: project.description,
              htmlCode: project.htmlCode,
              cssCode: project.cssCode,
              jsCode: project.jsCode,
              messages: project.messages,
              createdAt: project.createdAt,
              updatedAt: project.updatedAt,
              version: project.version
            };
            
            setCurrentDesign(designFromProject);
            setHtmlCode(project.htmlCode);
            setCssCode(project.cssCode);
            setJsCode(project.jsCode);
            setMessages(project.messages);
            
            // Clear the localStorage item if we're in "create new" mode
            if (localStorage.getItem('create_new_ui_project') === 'true') {
              localStorage.removeItem('create_new_ui_project');
              handleNewProject();
            }
            
            return;
          }
        }
        
        // Fallback: load most recent project from the database
        const designs = await db.getAllDesigns();
        if (designs && designs.length > 0) {
          // Get the most recently updated design
          const lastDesign = designs.sort((a: UIBuilderDesign, b: UIBuilderDesign) => 
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )[0];
          
          setCurrentDesign(lastDesign);
          setHtmlCode(lastDesign.htmlCode);
          setCssCode(lastDesign.cssCode);
          setJsCode(lastDesign.jsCode);
          setMessages(lastDesign.messages);
        }
      } catch (error) {
        console.error('Failed to load design:', error);
      }
    };

    loadLastDesign();
    
    // Clean up function to clear localStorage when component unmounts
    return () => {
      localStorage.removeItem('current_ui_project');
    };
  }, []);

  // Auto-save functionality
  useEffect(() => {
    if (!currentDesign) return;

    // Clear any existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout for auto-save
    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        const updatedDesign: UIBuilderDesign = {
          ...currentDesign,
          htmlCode,
          cssCode,
          jsCode,
          messages,
          updatedAt: new Date().toISOString(),
          version: currentDesign.version + 1
        };

        await db.updateDesign(updatedDesign);
        setCurrentDesign(updatedDesign);
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error) {
        console.error('Auto-save failed:', error);
        setSaveStatus('error');
      }
    }, 3000); // Auto-save after 3 seconds of no changes

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [htmlCode, cssCode, jsCode, messages, currentDesign]);

  // Save current design
  const saveDesign = async () => {
    setIsSaving(true);
    setSaveStatus('idle');

    try {
      let designToSave: UIBuilderDesign;
      
      // Check for project ID from localStorage
      const currentProjectId = localStorage.getItem('current_ui_project');
      
      if (currentDesign) {
        // Update existing design
        designToSave = {
          ...currentDesign,
          htmlCode,
          cssCode,
          jsCode,
          messages,
          updatedAt: new Date().toISOString(),
          version: currentDesign.version + 1
        };
      } else if (currentProjectId) {
        // If we have a current project ID but no design loaded, try to load it first
        try {
          const project = await uiBuilderService.getProjectById(currentProjectId);
          if (project) {
            designToSave = {
              id: project.id,
              name: project.name,
              description: project.description || '',
              htmlCode,
              cssCode,
              jsCode,
              messages,
              createdAt: project.createdAt,
              updatedAt: new Date().toISOString(),
              version: project.version + 1
            };
          } else {
            // Project not found, create new
            designToSave = {
              id: uuidv4(),
              name: 'Untitled Design',
              htmlCode,
              cssCode,
              jsCode,
              messages,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              version: 1
            };
          }
        } catch (err) {
          console.error('Failed to load existing project:', err);
          // Create new if loading fails
          designToSave = {
            id: uuidv4(),
            name: 'Untitled Design',
            htmlCode,
            cssCode,
            jsCode,
            messages,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            version: 1
          };
        }
      } else {
        // Create new design
        designToSave = {
          id: uuidv4(),
          name: 'Untitled Design',
          htmlCode,
          cssCode,
          jsCode,
          messages,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: 1
        };
      }

      // Update the local design state
      await db.updateDesign(designToSave);
      setCurrentDesign(designToSave);
      
      // Also update the UIBuilderProject in the service if this is a project
      if (currentProjectId || (currentDesign && currentDesign.id)) {
        const projectId = currentProjectId || (currentDesign?.id || '');
        if (projectId) {
          // Check if project exists
          const existingProject = await uiBuilderService.getProjectById(projectId);
          
          if (existingProject) {
            // Update existing project
            await uiBuilderService.updateProject({
              ...existingProject,
              htmlCode,
              cssCode,
              jsCode,
              messages,
              updatedAt: new Date().toISOString(),
              version: existingProject.version + 1
            });
          } else if (designToSave) {
            // Create new project from design - fix the createProject parameters
            await uiBuilderService.createProject({
              name: designToSave.name,
              description: designToSave.description || '',
              htmlCode: designToSave.htmlCode,
              cssCode: designToSave.cssCode,
              jsCode: designToSave.jsCode,
              messages: designToSave.messages,
              isArchived: false,
              isDeleted: false,
              tags: [],
              category: 'ui',
              isPublic: false
            });
            // Save project ID to localStorage
            localStorage.setItem('current_ui_project', designToSave.id);
          }
        }
      }
      
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Failed to save design:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  // Define updatePreview function
  const updatePreview = useCallback(() => {
    if (previewIframeRef.current && previewIframeRef.current.contentWindow) {
      previewIframeRef.current.contentWindow.postMessage({
        type: 'update-preview',
        html: htmlCode,
        css: cssCode,
        js: jsCode
      }, '*');
    }
  }, [htmlCode, cssCode, jsCode]);

  // Update preview when code changes
  useEffect(() => {
    // Listen for error messages from the preview
    const handlePreviewError = (event: MessageEvent) => {
      if (event.data.type === 'preview-error') {
        setPreviewError(event.data.error);
      }
    };

    window.addEventListener('message', handlePreviewError);
    
    // Update preview when switching to preview tab or when code changes
    if (activeTab === 'preview') {
      // Add a small delay to ensure iframe is ready
      const timeoutId = setTimeout(() => {
        updatePreview();
      }, 100);
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('message', handlePreviewError);
      };
    }

    return () => {
      window.removeEventListener('message', handlePreviewError);
    };
  }, [activeTab, updatePreview]);

  // Handle horizontal resize start
  const startHorizontalResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingHorizontal(true);
  };

  // Handle resize dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingHorizontal && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newLeftPanelWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
        
        // Constrain to reasonable limits (15% to 85%)
        if (newLeftPanelWidth >= 15 && newLeftPanelWidth <= 85) {
          setLeftPanelWidth(newLeftPanelWidth);
        }
      }
    };

    const handleMouseUp = () => {
      setIsResizingHorizontal(false);
    };

    if (isResizingHorizontal) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingHorizontal]);

  // Helper function to get system prompt based on mode and purpose
  const getSystemPrompt = (mode: 'chat' | 'design', purpose: 'generate' | 'enhance' = 'generate') => {
    if (purpose === 'enhance') {
      return `You are an expert UI/UX prompt engineer. Your task is to enhance and expand the user's input to create a more detailed and specific prompt that will lead to better UI generation results.

Key aspects to consider and include in the enhanced prompt:
1. Visual Design:
   - Layout structure and hierarchy
   - Color scheme and consistency
   - Typography choices and scale
   - Spacing and alignment
   - Visual elements (shadows, gradients, borders)

2. Functionality:
   - Interactive elements
   - Animations and transitions
   - User feedback mechanisms
   - Responsive behavior

3. User Experience:
   - Accessibility considerations
   - Mobile responsiveness
   - Loading states
   - Error handling
   - User feedback

4. Technical Specifications:
   - Specific Tailwind classes
   - Custom animations
   - JavaScript interactions
   - Performance optimizations

Format the enhanced prompt to be clear and structured, but maintain a natural language flow. Focus on the user's original intent while adding necessary technical and design details.

Original prompt: {input}

Respond with a single enhanced prompt that expands on the user's request while maintaining their core intention. Keep the tone friendly and conversational while being technically precise.`;
    }
    
    return mode === 'design' ? `You are a UI design assistant specializing in modern web development. You help create and modify HTML, CSS, and JavaScript code based on user requests.

Available Frameworks and Libraries:
1. CSS Frameworks:
   - Tailwind CSS (v3) - Primary framework, prefer using Tailwind utility classes
   - Font Awesome (v6) - For icons, use 'fas', 'far', 'fab' classes
   - Custom CSS - For animations and custom styles not possible with Tailwind

2. JavaScript Capabilities:
   - Vanilla JavaScript with modern ES6+ features
   - DOM manipulation and event handling
   - Animations and transitions
   - Async/await and Promises

Best Practices to Follow:
1. HTML Structure:
   - Use semantic HTML5 elements (nav, header, main, footer, etc.)
   - Maintain proper heading hierarchy (h1 -> h6)
   - Include proper meta tags and viewport settings
   - Use aria-labels and roles for accessibility

2. Tailwind CSS Usage:
   - Prefer Tailwind utility classes over custom CSS
   - Use @apply in custom CSS only when necessary
   - Follow mobile-first responsive design:
     * Default: Mobile (<640px)
     * sm: 640px and up
     * md: 768px and up
     * lg: 1024px and up
     * xl: 1280px and up
   - Use Tailwind's color palette (e.g., blue-500, gray-700)
   - Utilize Tailwind's built-in animations and transitions

3. JavaScript Guidelines:
   - Use 'DOMContentLoaded' event listener
   - Implement proper event delegation
   - Handle errors gracefully
   - Clean up event listeners and intervals
   - Use const/let appropriately
   - Implement smooth animations

4. Common Components to Consider:
   - Navigation bars
   - Hero sections
   - Cards and grids
   - Forms and inputs
   - Modals and dialogs
   - Buttons and CTAs
   - Lists and tables
   - Footers

5. Performance Considerations:
   - Minimize DOM manipulations
   - Use CSS transforms for animations
   - Debounce event handlers when needed
   - Optimize images and assets
   - Use proper loading strategies

Here is the current code:

HTML:
${htmlCode}

CSS:
${cssCode}

JavaScript:
${jsCode}

Respond with modified code based on the user's request. Keep all existing functionality and just modify what the user is asking for. Always respond with valid JSON in the following format:
{
  "html": "...",
  "css": "...",
  "js": "..."
}`
    : "You are Clara, a helpful and knowledgeable AI assistant. Provide clear, concise, and accurate responses to the user's questions.";
  };

  // Generate completion for chat or design mode
  const generateCompletion = async () => {
    const hasModel = apiType === 'ollama' ? selectedOllamaModel : selectedOpenAIModel;
    if (!hasModel || !chatInput.trim() || isGenerating) return;
    
    // Add user message to the chat
    setMessages(prev => [...prev, { content: chatInput, sender: 'user' }]);
    setIsGenerating(true);
    
    try {
      let systemPrompt = '';
      
      if (chatMode === 'design') {
        // Design mode - provide the current HTML, CSS, and JS as context
        systemPrompt = getSystemPrompt(chatMode);
      } else {
        // Normal chat mode
        systemPrompt = getSystemPrompt(chatMode);
      }
      
      let aiResponseContent = '';
      
      // Generate the response based on selected API type
      if (apiType === 'ollama' && selectedOllamaModel) {
        // Use Ollama service
        await ollamaService.generateCompletionStream(
          {
            model: selectedOllamaModel.name,
            prompt: chatInput,
            system: systemPrompt,
            options: {
              temperature: 0.7,
            },
            format: chatMode === 'design' ? 'json' : undefined,
          },
          (chunk) => {
            // Accumulate the response
            aiResponseContent += chunk.response;
            
            // Update message in UI
            updateAIMessage(aiResponseContent);
          },
          () => finalizeResponse(aiResponseContent),
          (error) => handleGenerationError(error)
        );
      } else if (apiType === 'openai' && selectedOpenAIModel) {
        // Use OpenAI service
        if (!apiConfig.openai_api_key) {
          setIsGenerating(false);
          setMessages(prev => [
            ...prev,
            { content: "Error: OpenAI API key is not configured. Please set it in Settings.", sender: 'ai' }
          ]);
          return;
        }
        
        // Configure OpenAI service with current settings
        openAIService.setApiKey(apiConfig.openai_api_key);
        openAIService.setBaseUrl(apiConfig.openai_base_url || 'https://api.openai.com/v1');
        
        // Prepare messages for OpenAI format
        const messages = [
          { role: 'system' as const, content: systemPrompt },
          { role: 'user' as const, content: chatInput }
        ];
        
        await openAIService.generateCompletionStream(
          {
            model: selectedOpenAIModel.id,
            messages: messages,
            temperature: 0.7,
            stream: true,
            response_format: chatMode === 'design' ? { type: 'json_object' } : undefined,
          },
          (chunk) => {
            // Accumulate the response
            aiResponseContent += chunk.response;
            
            // Update message in UI
            updateAIMessage(aiResponseContent);
          },
          () => finalizeResponse(aiResponseContent),
          (error) => handleGenerationError(error)
        );
      }
    } catch (error) {
      console.error('Failed to generate completion:', error);
      setIsGenerating(false);
      setMessages(prev => [
        ...prev, 
        { content: `Error: ${error instanceof Error ? error.message : 'An error occurred.'}`, sender: 'ai' }
      ]);
    }
    
    setChatInput('');
  };

  // Helper function to update AI message as streaming progresses
  const updateAIMessage = (content: string) => {
    setMessages(prev => {
      // Check if we already have an AI message that we need to update
      const lastMessage = prev[prev.length - 1];
      if (lastMessage && lastMessage.sender === 'ai') {
        // Update the last message
        const updatedMessages = [...prev];
        updatedMessages[updatedMessages.length - 1] = {
          ...lastMessage,
          content: content,
        };
        return updatedMessages;
      } else {
        // Add a new AI message
        return [...prev, { content: content, sender: 'ai' }];
      }
    });
  };

  // Helper function to finalize response handling
  const finalizeResponse = (content: string) => {
    setIsGenerating(false);
    
    // If in design mode, try to parse the JSON response and update the code
    if (chatMode === 'design') {
      try {
        const responseJson = JSON.parse(content);
        if (responseJson.html) setHtmlCode(responseJson.html);
        if (responseJson.css) setCssCode(responseJson.css);
        if (responseJson.js) setJsCode(responseJson.js);
        
        // Update the preview
        updatePreview();
      } catch (error) {
        console.error('Failed to parse JSON response:', error);
        // Append an error message
        setMessages(prev => [
          ...prev, 
          { content: "Sorry, I couldn't parse the response as valid JSON to update the code.", sender: 'ai' }
        ]);
      }
    }
  };

  // Helper function to handle generation errors
  const handleGenerationError = (error: Error) => {
    console.error('Generation error:', error);
    setIsGenerating(false);
    setMessages(prev => [
      ...prev, 
      { content: `Error: ${error.message || 'An error occurred while generating the response.'}`, sender: 'ai' }
    ]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      generateCompletion();
    }
  };

  const handleExportSuccess = (projectId: string) => {
    console.log('Project exported successfully with ID:', projectId);
    
    // Optionally, you could reset the form or show a success notification
    // For now, we'll just close the modal
    
    // You could also navigate to a project details page if you have one
    // onPageChange('project-details?id=' + projectId);
  };

  const handleSelectProject = async (project: UIBuilderProject) => {
    try {
      // First, save the current project if any
      if (currentDesign) {
        await saveDesign();
      }
      
      // Then load the selected project
      setHtmlCode(project.htmlCode);
      setCssCode(project.cssCode);
      setJsCode(project.jsCode);
      setMessages(project.messages);
      
      // Convert UIBuilderProject to UIBuilderDesign
      const designFromProject: UIBuilderDesign = {
        id: project.id,
        name: project.name,
        description: project.description || '',
        htmlCode: project.htmlCode,
        cssCode: project.cssCode,
        jsCode: project.jsCode,
        messages: project.messages,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        version: project.version
      };
      
      setCurrentDesign(designFromProject);
      
      // Save current project ID to localStorage
      localStorage.setItem('current_ui_project', project.id);
      
      setShowProjectManager(false);
      
      // Update the preview
      setActiveTab('preview');
      setTimeout(() => {
        updatePreview();
      }, 100);
    } catch (err) {
      console.error('Failed to load project:', err);
    }
  };

  const handleOllamaModelSelect = (model: OllamaModel) => {
    setSelectedOllamaModel(model);
    // Save to localStorage for persistence
    localStorage.setItem('ollama_ui_builder_selected_model', JSON.stringify(model));
  };

  const handleOpenAIModelSelect = (model: OpenAIModel) => {
    setSelectedOpenAIModel(model);
    // Save to localStorage for persistence
    localStorage.setItem('openai_ui_builder_selected_model', JSON.stringify(model));
  };

  const handleApiTypeChange = async (type: 'ollama' | 'openai') => {
    console.log('UIBuilder: Changing API type to:', type);
    setApiType(type);
    
    try {
      // Save the API type preference to the database
      const config = await db.getAPIConfig();
      console.log('UIBuilder: Current config:', config);
      if (config) {
        await db.updateAPIConfig({
          ...config,
          api_type: type
        });
        console.log('UIBuilder: Updated config with new API type');
        
        // Update the OpenAI and Ollama service instances with current config
        if (type === 'openai' && config.openai_base_url) {
          openAIService.setBaseUrl(config.openai_base_url);
          openAIService.setApiKey(config.openai_api_key || '');
          console.log('UIBuilder: Updated OpenAI service with URL:', config.openai_base_url);
        } else if (type === 'ollama' && config.ollama_base_url) {
          try {
            // Just use the full URL as-is
            ollamaSettingsStore.updateConnection({
              host: config.ollama_base_url,
              port: 11434, // This will be ignored if host is a full URL
              secure: config.ollama_base_url.startsWith('https://')
            });
            
            console.log(`UIBuilder: Updated Ollama connection to URL: ${config.ollama_base_url}`);
          } catch (err) {
            console.error('Failed to update Ollama connection:', err);
          }
        }
      }

      // Reset selected model when switching API types
      if (type === 'ollama') {
        // Load saved Ollama model or set to null
        const savedOllamaModel = localStorage.getItem('ollama_ui_builder_selected_model');
        console.log('UIBuilder: Loading saved Ollama model:', savedOllamaModel);
        if (savedOllamaModel) {
          try {
            setSelectedOllamaModel(JSON.parse(savedOllamaModel));
          } catch (e) {
            console.warn('Failed to parse saved Ollama model', e);
            setSelectedOllamaModel(null);
          }
        } else {
          setSelectedOllamaModel(null);
        }
        setSelectedOpenAIModel(null);
      } else {
        // Load saved OpenAI model or set default
        const savedOpenAIModel = localStorage.getItem('openai_ui_builder_selected_model');
        console.log('UIBuilder: Loading saved OpenAI model:', savedOpenAIModel);
        if (savedOpenAIModel) {
          try {
            setSelectedOpenAIModel(JSON.parse(savedOpenAIModel));
          } catch (e) {
            console.warn('Failed to parse saved OpenAI model', e);
            // Set default OpenAI model
            const defaultModel: OpenAIModel = {
              id: 'gpt-3.5-turbo',
              name: 'GPT-3.5 Turbo',
              maxTokens: 16000,
              category: 'gpt',
              contextWindow: 16000
            };
            setSelectedOpenAIModel(defaultModel);
            localStorage.setItem('openai_ui_builder_selected_model', JSON.stringify(defaultModel));
          }
        } else {
          // Set default OpenAI model
          const defaultModel: OpenAIModel = {
            id: 'gpt-3.5-turbo',
            name: 'GPT-3.5 Turbo',
            maxTokens: 16000,
            category: 'gpt',
            contextWindow: 16000
          };
          setSelectedOpenAIModel(defaultModel);
          localStorage.setItem('openai_ui_builder_selected_model', JSON.stringify(defaultModel));
        }
        setSelectedOllamaModel(null);
      }
    } catch (error) {
      console.error('Failed to update API type:', error);
    }
  };

  // Add enhance prompt function
  const enhancePrompt = async () => {
    if (!chatInput.trim() || isEnhancing || isGenerating) return;
    
    setIsEnhancing(true);
    try {
      const hasModel = apiType === 'ollama' ? selectedOllamaModel : selectedOpenAIModel;
      if (!hasModel) return;

      let enhancedPrompt = '';
      
      if (apiType === 'ollama' && selectedOllamaModel) {
        await ollamaService.generateCompletionStream(
          {
            model: selectedOllamaModel.name,
            prompt: chatInput,
            system: getSystemPrompt(chatMode, 'enhance'),
            options: {
              temperature: 0.7,
            }
          },
          (chunk) => {
            enhancedPrompt += chunk.response;
          },
          () => {}, // onComplete callback
          (error) => console.error('Error enhancing prompt:', error) // onError callback
        );
      } else if (apiType === 'openai' && selectedOpenAIModel) {
        if (!apiConfig.openai_api_key) {
          throw new Error("OpenAI API key is not configured");
        }
        
        const messages = [
          { role: 'system' as const, content: getSystemPrompt(chatMode, 'enhance') },
          { role: 'user' as const, content: chatInput }
        ];
        
        await openAIService.generateCompletionStream(
          {
            model: selectedOpenAIModel.id,
            messages: messages,
            temperature: 0.7,
            stream: true,
          },
          (chunk) => {
            enhancedPrompt += chunk.response;
          },
          () => {}, // onComplete callback
          (error) => console.error('Error enhancing prompt:', error) // onError callback
        );
      }

      setChatInput(enhancedPrompt.trim());
    } catch (error) {
      console.error('Failed to enhance prompt:', error);
    } finally {
      setIsEnhancing(false);
    }
  };

  // Function to reset the UI Builder to a new project
  const handleNewProject = () => {
    // Default HTML template
    const defaultHtmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>My Project</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body>
  <div class="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-8 flex items-center justify-center">
    <div class="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 relative overflow-hidden">
      <div class="absolute -top-10 -right-10 w-40 h-40 bg-pink-500/10 rounded-full"></div>
      <div class="absolute -bottom-10 -left-10 w-40 h-40 bg-purple-500/10 rounded-full"></div>
      
      <div class="relative">
        <i class="fas fa-rocket text-5xl text-purple-500 mb-6 block"></i>
        <h1 class="text-3xl font-bold text-gray-800 mb-4">New Project</h1>
        <p class="text-gray-600 mb-8">
          Start building your beautiful UI here. Use Tailwind CSS and Font Awesome icons.
        </p>
        <button class="group bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-xl font-medium inline-flex items-center gap-2 hover:shadow-lg transition duration-300 hover:-translate-y-0.5">
          <span>Get Started</span>
          <i class="fas fa-arrow-right transition-transform group-hover:translate-x-1"></i>
        </button>
      </div>
    </div>
  </div>
</body>
</html>`;

    // Default CSS template
    const defaultCssTemplate = `/* Custom animations */
@keyframes float {
  0% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
  100% { transform: translateY(0px); }
}

.fas.fa-rocket {
  animation: float 3s ease-in-out infinite;
}

/* Add your custom styles here */`;

    // Default JS template
    const defaultJsTemplate = `document.addEventListener('DOMContentLoaded', function() {
  const button = document.querySelector('button');
  
  button.addEventListener('click', function() {
    // Add a ripple effect
    const ripple = document.createElement('div');
    ripple.className = 'absolute inset-0 bg-white/20 rounded-xl';
    this.appendChild(ripple);
    
    // Remove ripple after animation
    setTimeout(() => {
      ripple.remove();
    }, 1000);
  });
});`;

    // Reset the state
    setHtmlCode(defaultHtmlTemplate);
    setCssCode(defaultCssTemplate);
    setJsCode(defaultJsTemplate);
    setMessages([]);
    setCurrentDesign(null);
    
    // Update the preview
    setActiveTab('preview');
    setTimeout(() => {
      updatePreview();
    }, 100);
  };

  // Add an auto-save effect
  useEffect(() => {
    const autoSaveChanges = () => {
      // Check if we have a current design or current project ID
      const shouldSave = currentDesign || localStorage.getItem('current_ui_project');
      if (shouldSave) {
        saveDesign();
      }
    };
    
    // Set up auto-save with debounce
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(() => {
      autoSaveChanges();
    }, 3000); // Auto-save after 3 seconds of inactivity
    
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [htmlCode, cssCode, jsCode]); // Add only code changes as dependencies

  return (
    <div className="flex h-screen bg-gradient-to-br from-white to-sakura-50 dark:from-gray-900 dark:to-gray-900">
      <Sidebar activePage="ui-builder" onPageChange={onPageChange} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar userName="User" onPageChange={onPageChange} />
        
        <div ref={containerRef} className="flex-1 flex relative overflow-hidden">
          {/* Left Panel - Clara's Designer Interface */}
          <div 
            style={{ width: `${leftPanelWidth}%` }} 
            className="h-full flex flex-col glassmorphic transition-all duration-100 overflow-hidden"
          >
            <div className="px-4 py-3 flex items-center justify-between flex-shrink-0 border-b border-gray-200 dark:border-gray-700/50">
              <div className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-sakura-500" />
                <h2 className="font-medium text-gray-900 dark:text-white text-sm">Clara's Designer</h2>
              </div>
              <ApiTypeSelector 
                onApiTypeChange={handleApiTypeChange}
                currentApiType={apiType}
                onPageChange={onPageChange}
              />
            </div>
            
            {/* Fixed height chat panel */}
            <div className="flex-1 overflow-hidden">
              <ChatPanel 
                messages={messages} 
                mode={chatMode} 
                onModeChange={setChatMode}
                selectedModel={apiType === 'ollama' ? selectedOllamaModel : selectedOpenAIModel as any}
                onModelSelect={apiType === 'ollama' ? handleOllamaModelSelect : handleOpenAIModelSelect as any}
                apiType={apiType}
              />
            </div>
            
            {/* Fixed input box */}
            <div className="p-4 bg-transparent backdrop-blur-sm border-t border-gray-200 dark:border-gray-700/50 flex-shrink-0">
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={chatMode === 'design' 
                    ? "Describe changes you want to make to the UI..." 
                    : "Type a message..."}
                  className="w-full p-3 pr-24 text-sm rounded-xl min-h-[44px] max-h-[180px] bg-transparent dark:text-white focus:outline-none resize-none overflow-hidden border border-gray-200 dark:border-gray-700/50"
                  style={{ height: 'auto' }}
                />
                <div className="absolute right-3 bottom-3 flex items-center gap-2">
                  <button
                    onClick={enhancePrompt}
                    disabled={!chatInput.trim() || isEnhancing || isGenerating}
                    className={`p-2 rounded-lg transition-colors ${
                      chatInput.trim() && !isEnhancing && !isGenerating
                        ? 'bg-purple-500/80 hover:bg-purple-600/90 text-white'
                        : 'bg-transparent text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    }`}
                    title="Enhance prompt"
                  >
                    {isEnhancing ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wand2 className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={generateCompletion}
                    disabled={
                      (apiType === 'ollama' && !selectedOllamaModel) || 
                      (apiType === 'openai' && (!selectedOpenAIModel || !apiConfig.openai_api_key)) || 
                      !chatInput.trim() || 
                      isGenerating ||
                      isEnhancing
                    }
                    className={`p-2 rounded-lg transition-colors ${
                      chatInput.trim() && ((apiType === 'ollama' && selectedOllamaModel) || (apiType === 'openai' && selectedOpenAIModel && apiConfig.openai_api_key)) && !isGenerating && !isEnhancing
                        ? 'bg-blue-500/80 hover:bg-blue-600/90 text-white'
                        : 'bg-transparent text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {isGenerating ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Horizontal Resize Handle */}
          <div 
            className="absolute top-0 bottom-0 w-1 cursor-col-resize z-10 hover:bg-sakura-400/30 active:bg-sakura-400/50 transition-colors"
            style={{ left: `${leftPanelWidth}%` }}
            onMouseDown={startHorizontalResize}
          />
          
          {/* Right Panel - Code Editors with Tabs */}
          <div 
            id="right-panel"
            style={{ width: `${100 - leftPanelWidth}%` }} 
            className="h-full flex flex-col transition-all duration-100 bg-transparent backdrop-blur-sm"
          >
            <div className="p-3 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 bg-white/30 dark:bg-gray-800/30 backdrop-blur-md flex-shrink-0">
              <Tabs defaultValue="html" className="w-auto">
                <TabsList className="flex bg-gray-100/80 dark:bg-gray-800/80 rounded-lg p-1 gap-1">
                  <TabsTrigger 
                    value="html" 
                    onClick={() => setActiveTab('html')}
                    className={`px-3 py-1.5 flex items-center rounded-md transition-all duration-200 ${
                      activeTab === 'html' 
                        ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm' 
                        : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className={`flex items-center justify-center w-5 h-5 rounded mr-2 ${activeTab === 'html' ? 'text-orange-500' : 'text-gray-500 dark:text-gray-400'}`}>
                      <Code className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-medium">HTML</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="css" 
                    onClick={() => setActiveTab('css')}
                    className={`px-3 py-1.5 flex items-center rounded-md transition-all duration-200 ${
                      activeTab === 'css' 
                        ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm' 
                        : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className={`flex items-center justify-center w-5 h-5 rounded mr-2 ${activeTab === 'css' ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`}>
                      <Code className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-medium">CSS</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="js" 
                    onClick={() => setActiveTab('js')}
                    className={`px-3 py-1.5 flex items-center rounded-md transition-all duration-200 ${
                      activeTab === 'js' 
                        ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm' 
                        : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className={`flex items-center justify-center w-5 h-5 rounded mr-2 ${activeTab === 'js' ? 'text-yellow-500' : 'text-gray-500 dark:text-gray-400'}`}>
                      <Code className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-medium">JavaScript</span>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="preview" 
                    onClick={() => {
                      setActiveTab('preview');
                    }}
                    className={`px-3 py-1.5 flex items-center rounded-md transition-all duration-200 ${
                      activeTab === 'preview' 
                        ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm' 
                        : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <div className={`flex items-center justify-center w-5 h-5 rounded mr-2 ${activeTab === 'preview' ? 'text-green-500' : 'text-gray-500 dark:text-gray-400'}`}>
                      <Eye className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-medium">Preview</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onPageChange('apps')}
                  className="flex items-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-md bg-gray-100/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-gray-700/80 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Apps</span>
                </button>
                
                <div className="px-3 py-1.5 bg-gray-100/80 dark:bg-gray-800/80 rounded-lg flex items-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400 mr-2">Project:</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {currentDesign?.name || "Untitled Project"}
                  </span>
                  <button
                    onClick={() => setShowProjectManager(true)}
                    className="ml-2 p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                    title="Open Project Manager"
                  >
                    <Folder className="w-3.5 h-3.5" />
                  </button>
                </div>
                
                <button 
                  className="flex items-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-md bg-gray-100/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-gray-700/80 transition-colors"
                  onClick={updatePreview}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Refresh</span>
                </button>
                <button 
                  onClick={handleNewProject}
                  className="flex items-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-md bg-gray-100/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-gray-700/80 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>New Project</span>
                </button>
                <button
                  className={`flex items-center justify-center p-2 rounded-md transition-colors ${
                    isSaving
                      ? 'bg-gray-400 cursor-not-allowed text-white'
                      : saveStatus === 'success'
                      ? 'bg-green-500 text-white'
                      : saveStatus === 'error'
                      ? 'bg-red-500 text-white'
                      : 'bg-blue-500/90 hover:bg-blue-600 text-white'
                  }`}
                  onClick={saveDesign}
                  disabled={isSaving}
                  title={isSaving ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : 'Save Project'}
                >
                  {isSaving ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : saveStatus === 'success' ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                </button>
                <button
                  className="flex items-center gap-1.5 py-1.5 px-3 text-xs font-medium rounded-md bg-sakura-500 hover:bg-sakura-600 text-white transition-colors"
                  onClick={() => setShowExportModal(true)}
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden">
              {/* Code Editors and Preview */}
              <div className="h-full shadow-inner">
                {activeTab === 'html' && (
                  <Editor
                    value={htmlCode}
                    onChange={(value) => setHtmlCode(value || '')}
                    language="html"
                    theme={isDark ? 'vs-dark' : 'vs-light'}
                    options={{
                      minimap: { enabled: true },
                      fontSize: 14,
                      wordWrap: 'on',
                      automaticLayout: true,
                      padding: { top: 16 },
                      scrollBeyondLastLine: false,
                      lineNumbers: 'on',
                      lineDecorationsWidth: 10,
                      lineNumbersMinChars: 3,
                      renderLineHighlight: 'all',
                      cursorBlinking: 'smooth',
                      cursorSmoothCaretAnimation: 'on',
                      bracketPairColorization: { enabled: true },
                      folding: true,
                      scrollbar: {
                        vertical: 'visible',
                        horizontal: 'visible',
                        verticalScrollbarSize: 12,
                        horizontalScrollbarSize: 12,
                      }
                    }}
                    className="h-full w-full"
                  />
                )}
                {activeTab === 'css' && (
                  <Editor
                    value={cssCode}
                    onChange={(value) => setCssCode(value || '')}
                    language="css"
                    theme={isDark ? 'vs-dark' : 'vs-light'}
                    options={{
                      minimap: { enabled: true },
                      fontSize: 14,
                      wordWrap: 'on',
                      automaticLayout: true,
                      padding: { top: 16 },
                      scrollBeyondLastLine: false,
                      lineNumbers: 'on',
                      lineDecorationsWidth: 10,
                      lineNumbersMinChars: 3,
                      renderLineHighlight: 'all',
                      cursorBlinking: 'smooth',
                      cursorSmoothCaretAnimation: 'on',
                      bracketPairColorization: { enabled: true },
                      folding: true,
                      scrollbar: {
                        vertical: 'visible',
                        horizontal: 'visible',
                        verticalScrollbarSize: 12,
                        horizontalScrollbarSize: 12,
                      }
                    }}
                    className="h-full w-full"
                  />
                )}
                {activeTab === 'js' && (
                  <Editor
                    value={jsCode}
                    onChange={(value) => setJsCode(value || '')}
                    language="javascript"
                    theme={isDark ? 'vs-dark' : 'vs-light'}
                    options={{
                      minimap: { enabled: true },
                      fontSize: 14,
                      wordWrap: 'on',
                      automaticLayout: true,
                      padding: { top: 16 },
                      scrollBeyondLastLine: false,
                      lineNumbers: 'on',
                      lineDecorationsWidth: 10,
                      lineNumbersMinChars: 3,
                      renderLineHighlight: 'all',
                      cursorBlinking: 'smooth',
                      cursorSmoothCaretAnimation: 'on',
                      bracketPairColorization: { enabled: true },
                      folding: true,
                      scrollbar: {
                        vertical: 'visible',
                        horizontal: 'visible',
                        verticalScrollbarSize: 12,
                        horizontalScrollbarSize: 12,
                      }
                    }}
                    className="h-full w-full"
                  />
                )}
                {activeTab === 'preview' && (
                  <div className="w-full h-full bg-[#e9e9e9] dark:bg-gray-800 relative overflow-hidden">
                    {previewError && (
                      <div className="absolute top-0 left-0 right-0 bg-red-500 text-white px-4 py-2 text-sm">
                        Error on line {previewError.line}: {previewError.message}
                      </div>
                    )}
                    <div className="w-full h-full flex items-stretch">
                      {isElectron ? (
                        // Use our enhanced PreviewPanel component for Electron
                        <PreviewPanel
                          elements={[{ id: '1', type: 'div', props: {}, children: [] }]}
                          htmlContent={htmlCode}
                          cssContent={cssCode}
                          jsContent={jsCode}
                        />
                      ) : (
                      <iframe
                        ref={previewIframeRef}
                        src="/preview.html"
                        className="w-full h-full border-none bg-white"
                        sandbox="allow-scripts allow-modals allow-forms allow-same-origin allow-popups"
                        title="Preview"
                      />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <ExportProjectModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onExport={handleExportSuccess}
        currentHtml={htmlCode}
        currentCss={cssCode}
        currentJs={jsCode}
        messages={messages}
        currentName={currentDesign?.name}
        currentDescription={currentDesign?.description}
      />
      <ProjectManagerModal
        isOpen={showProjectManager}
        onClose={() => setShowProjectManager(false)}
        onSelectProject={handleSelectProject}
        onCreateNew={handleNewProject}
        currentProjectId={currentDesign?.id}
      />
    </div>
  );
};

export default UIBuilder; 