import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Loader2, RefreshCw } from 'lucide-react';
import { LiteProject } from '../LumaUILite';
import { AITemplateGenerator, AIGenerationRequest } from './services/AITemplateGenerator';
import { useProviders } from '../../contexts/ProvidersContext';
import { db } from '../../db';
import { ModelFetcher, ModelInfo } from './services/ModelFetcher';
import { getTemplate } from './templates/ProjectTemplates';

interface LumaUILiteProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (project: Omit<LiteProject, 'id' | 'createdAt' | 'lastModified'>) => void;
}

// Predefined project types for quick selection
const PROJECT_TYPES = [
  {
    id: 'landing-page',
    name: 'Landing Page',
    description: 'Marketing landing page with hero section and call-to-action',
    defaultFeatures: ['Hero section', 'Contact form', 'Responsive design', 'Call-to-action buttons'],
    icon: 'fas fa-rocket',
    color: 'from-blue-500 to-purple-600',
    hasTemplate: true
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    description: 'Personal portfolio to showcase your work and skills',
    defaultFeatures: ['Project gallery', 'About section', 'Contact form', 'Skills showcase'],
    icon: 'fas fa-user-tie',
    color: 'from-purple-500 to-pink-600',
    hasTemplate: true
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    description: 'Simple data dashboard with charts and metrics',
    defaultFeatures: ['Data visualization', 'Metrics cards', 'Interactive charts', 'Real-time updates'],
    icon: 'fas fa-chart-line',
    color: 'from-green-500 to-teal-600',
    hasTemplate: true
  },
  {
    id: 'blog',
    name: 'Blog/Article',
    description: 'Blog or article page with content sections',
    defaultFeatures: ['Article layout', 'Reading time', 'Social sharing', 'Comments section'],
    icon: 'fas fa-blog',
    color: 'from-orange-500 to-red-600',
    hasTemplate: true
  },
  {
    id: 'todo-app',
    name: 'Todo App',
    description: 'Task management application with CRUD operations',
    defaultFeatures: ['Add/remove tasks', 'Mark complete', 'Local storage', 'Filter tasks'],
    icon: 'fas fa-tasks',
    color: 'from-indigo-500 to-blue-600',
    hasTemplate: true
  },
  {
    id: 'calculator',
    name: 'Calculator',
    description: 'Basic calculator with mathematical operations',
    defaultFeatures: ['Basic math operations', 'Memory functions', 'Keyboard support', 'Scientific mode'],
    icon: 'fas fa-calculator',
    color: 'from-gray-500 to-gray-700',
    hasTemplate: true
  },
  {
    id: 'game',
    name: 'Simple Game',
    description: 'Browser-based game (like tic-tac-toe, memory game)',
    defaultFeatures: ['Game logic', 'Score tracking', 'Reset functionality', 'Animations'],
    icon: 'fas fa-gamepad',
    color: 'from-pink-500 to-rose-600',
    hasTemplate: true
  },
  {
    id: 'ecommerce',
    name: 'E-commerce',
    description: 'Product showcase and shopping interface',
    defaultFeatures: ['Product grid', 'Shopping cart', 'Product details', 'Checkout form'],
    icon: 'fas fa-shopping-cart',
    color: 'from-emerald-500 to-green-600',
    hasTemplate: true
  },
  {
    id: 'restaurant',
    name: 'Restaurant',
    description: 'Restaurant website with menu and reservations',
    defaultFeatures: ['Menu display', 'Reservation form', 'Gallery', 'Contact info'],
    icon: 'fas fa-utensils',
    color: 'from-amber-500 to-orange-600',
    hasTemplate: true
  },
  {
    id: 'custom',
    name: 'Custom Application',
    description: 'AI-powered custom application based on your description',
    defaultFeatures: [],
    icon: 'fas fa-magic',
    color: 'from-violet-500 to-purple-600',
    hasTemplate: false
  }
];



const LumaUILiteProjectModal: React.FC<LumaUILiteProjectModalProps> = ({
  isOpen,
  onClose,
  onCreateProject
}) => {
  const { providers } = useProviders();
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: '',
    customDescription: '',
    features: [] as string[]
  });
  const [newFeature, setNewFeature] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [useAI, setUseAI] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [aiInstructions, setAiInstructions] = useState('');
  const [apiConfig, setApiConfig] = useState<any>(null);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string>('');

  // Load API configuration and set default provider/model
  useEffect(() => {
    const loadConfig = async () => {
      const config = await db.getAPIConfig();
      setApiConfig(config);
      
      // Set default provider from available providers
      if (providers.length > 0) {
        const primaryProvider = providers.find(p => p.isPrimary) || providers[0];
        setSelectedProvider(primaryProvider.id);
        // Load common models for the provider type
        const commonModels = ModelFetcher.getCommonModels(primaryProvider.type);
        setAvailableModels(commonModels);
        if (commonModels.length > 0) {
          setSelectedModel(commonModels[0].id);
        }
      }
    };
    
    if (isOpen) {
      loadConfig();
    }
  }, [isOpen, providers]);

  // Fetch models when provider changes
  const fetchModelsForProvider = async (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    if (!provider) return;

    setLoadingModels(true);
    setModelError('');
    
    try {
      // First show common models immediately
      const commonModels = ModelFetcher.getCommonModels(provider.type);
      setAvailableModels(commonModels);
      if (commonModels.length > 0) {
        setSelectedModel(commonModels[0].id);
      }

      // Then try to fetch actual models from API
      const fetchedModels = await ModelFetcher.fetchModels(provider);
      if (fetchedModels.length > 0) {
        setAvailableModels(fetchedModels);
        setSelectedModel(fetchedModels[0].id);
      }
    } catch (error) {
      console.error('Error fetching models:', error);
      setModelError(`Failed to fetch models: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Keep common models as fallback
    } finally {
      setLoadingModels(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setFormData({
      name: '',
      description: '',
      type: '',
      customDescription: '',
      features: []
    });
    setNewFeature('');
    setIsGenerating(false);
    setUseAI(false);
    setSelectedProvider('');
    setSelectedModel('');
    setAiInstructions('');
    setAvailableModels([]);
    setLoadingModels(false);
    setModelError('');
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleTypeSelect = (typeId: string) => {
    const selectedType = PROJECT_TYPES.find(t => t.id === typeId);
    if (selectedType) {
      setFormData(prev => ({
        ...prev,
        type: selectedType.name,
        description: selectedType.description,
        features: [...selectedType.defaultFeatures]
      }));
    }
  };

  const handleAddFeature = () => {
    if (newFeature.trim() && !formData.features.includes(newFeature.trim())) {
      setFormData(prev => ({
        ...prev,
        features: [...prev.features, newFeature.trim()]
      }));
      setNewFeature('');
    }
  };

  const handleRemoveFeature = (index: number) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index)
    }));
  };

  const generateInitialCode = async (projectData: typeof formData): Promise<{ html: string; css: string; js: string; aiTemplate?: any }> => {
    const isCustom = formData.type === 'Custom Application';
    const appDescription = isCustom ? formData.customDescription : formData.description;
    
    // Use predefined templates for known types
    const selectedType = PROJECT_TYPES.find(t => t.name === formData.type);
    if (selectedType && selectedType.hasTemplate) {
      return getTemplate(selectedType.id, projectData.name, appDescription);
    }

    // For custom applications, use AI generation if enabled
    if (isCustom && useAI) {
      const selectedProviderData = providers.find(p => p.id === selectedProvider);
      if (!selectedProviderData || !apiConfig) {
        throw new Error('AI provider not configured. Please set up your AI credentials in Settings.');
      }

      const aiGenerator = new AITemplateGenerator();
      
      // Set API configuration based on selected provider
      const apiKey = selectedProviderData.apiKey || '';
      
      if (!apiKey) {
        throw new Error(`API key not configured for ${selectedProviderData.name}. Please set it up in Settings.`);
      }

      aiGenerator.setApiConfiguration(selectedProviderData.type, apiKey, selectedProviderData.baseUrl);

      const request: AIGenerationRequest = {
        projectName: projectData.name,
        description: appDescription,
        features: projectData.features,
        provider: selectedProviderData.type,
        model: selectedModel,
        instructions: aiInstructions
      };

      const aiTemplate = await aiGenerator.generateTemplate(request);
      
      // For multi-page AI templates, return the main page (index.html) as the primary content
      // Additional pages will be handled separately in the project creation
      const mainPage = aiTemplate.pages.find(p => p.filename === 'index.html') || aiTemplate.pages[0];
      
      return {
        html: mainPage.content,
        css: '', // CSS is now inline in the HTML
        js: '',  // JavaScript is now inline in the HTML
        aiTemplate: aiTemplate // Pass the full template for multi-page handling
      };
    }
    
    // Generate basic HTML structure
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectData.name}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="styles.css">
</head>
<body class="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-800">
    <!-- Navigation -->
    <nav class="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
                <div class="flex items-center">
                    <i class="fas fa-rocket text-white text-2xl mr-3"></i>
                    <span class="text-white font-bold text-xl">${projectData.name}</span>
                </div>
                <div class="hidden md:block">
                    <div class="ml-10 flex items-baseline space-x-4">
                        <a href="#home" class="text-white hover:text-blue-200 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                            <i class="fas fa-home mr-1"></i> Home
                        </a>
                        <a href="#features" class="text-white hover:text-blue-200 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                            <i class="fas fa-star mr-1"></i> Features
                        </a>
                        <a href="#about" class="text-white hover:text-blue-200 px-3 py-2 rounded-md text-sm font-medium transition-colors">
                            <i class="fas fa-info-circle mr-1"></i> About
                        </a>
                    </div>
                </div>
                <div class="md:hidden">
                    <button id="mobile-menu-button" class="text-white hover:text-blue-200">
                        <i class="fas fa-bars text-xl"></i>
                    </button>
                </div>
            </div>
        </div>
        <!-- Mobile menu -->
        <div id="mobile-menu" class="md:hidden hidden bg-white/10 backdrop-blur-md">
            <div class="px-2 pt-2 pb-3 space-y-1">
                <a href="#home" class="text-white block px-3 py-2 rounded-md text-base font-medium">
                    <i class="fas fa-home mr-2"></i> Home
                </a>
                <a href="#features" class="text-white block px-3 py-2 rounded-md text-base font-medium">
                    <i class="fas fa-star mr-2"></i> Features
                </a>
                <a href="#about" class="text-white block px-3 py-2 rounded-md text-base font-medium">
                    <i class="fas fa-info-circle mr-2"></i> About
                </a>
            </div>
        </div>
    </nav>

    <!-- Hero Section -->
    <section id="home" class="relative min-h-screen flex items-center justify-center px-4">
        <div class="absolute inset-0 bg-black/20"></div>
        <div class="relative z-10 text-center text-white max-w-4xl mx-auto">
            <div class="mb-8">
                <i class="fas fa-code text-6xl mb-6 text-blue-300"></i>
            </div>
            <h1 class="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent">
                ${projectData.name}
            </h1>
            <p class="text-xl md:text-2xl mb-8 text-blue-100 leading-relaxed">
                ${appDescription}
            </p>
            <div class="flex flex-col sm:flex-row gap-4 justify-center">
                <button class="bg-white text-blue-600 px-8 py-4 rounded-full font-semibold text-lg hover:bg-blue-50 transition-all transform hover:scale-105 shadow-lg">
                    <i class="fas fa-play mr-2"></i> Get Started
                </button>
                <button class="border-2 border-white text-white px-8 py-4 rounded-full font-semibold text-lg hover:bg-white hover:text-blue-600 transition-all transform hover:scale-105">
                    <i class="fas fa-info-circle mr-2"></i> Learn More
                </button>
            </div>
        </div>
        
        <!-- Scroll indicator -->
        <div class="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white animate-bounce">
            <i class="fas fa-chevron-down text-2xl"></i>
        </div>
    </section>

    ${projectData.features.length > 0 ? `
    <!-- Features Section -->
    <section id="features" class="py-20 bg-white/10 backdrop-blur-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center mb-16">
                <h2 class="text-4xl md:text-5xl font-bold text-white mb-4">
                    <i class="fas fa-star text-yellow-300 mr-3"></i>
                    Planned Features
                </h2>
                <p class="text-xl text-blue-100 max-w-2xl mx-auto">
                    Discover what makes this ${projectData.type} special
                </p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                ${projectData.features.map((feature, index) => {
                    const icons = ['fas fa-bolt', 'fas fa-shield-alt', 'fas fa-mobile-alt', 'fas fa-chart-line', 'fas fa-users', 'fas fa-cog'];
                    const colors = ['text-yellow-300', 'text-green-300', 'text-blue-300', 'text-purple-300', 'text-pink-300', 'text-indigo-300'];
                    return `
                <div class="bg-white/10 backdrop-blur-md rounded-xl p-6 border border-white/20 hover:bg-white/20 transition-all transform hover:scale-105">
                    <div class="text-center">
                        <i class="${icons[index % icons.length]} text-4xl ${colors[index % colors.length]} mb-4"></i>
                        <h3 class="text-xl font-semibold text-white mb-3">${feature}</h3>
                        <p class="text-blue-100">Coming soon to enhance your experience</p>
                    </div>
                </div>`;
                }).join('\n                ')}
            </div>
        </div>
    </section>
    ` : ''}

    <!-- About Section -->
    <section id="about" class="py-20">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center">
                <h2 class="text-4xl md:text-5xl font-bold text-white mb-8">
                    <i class="fas fa-info-circle text-blue-300 mr-3"></i>
                    About This Project
                </h2>
                <div class="max-w-3xl mx-auto">
                    <p class="text-xl text-blue-100 mb-8 leading-relaxed">
                        Welcome to your ${projectData.type}! This project was created with LumaUI-lite, 
                        giving you a solid foundation to build upon. Start customizing by editing the 
                        HTML, CSS, and JavaScript files.
                    </p>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
                        <div class="text-center">
                            <i class="fas fa-code text-4xl text-green-300 mb-4"></i>
                            <h3 class="text-xl font-semibold text-white mb-2">Modern Code</h3>
                            <p class="text-blue-100">Built with latest web technologies</p>
                        </div>
                        <div class="text-center">
                            <i class="fas fa-mobile-alt text-4xl text-purple-300 mb-4"></i>
                            <h3 class="text-xl font-semibold text-white mb-2">Responsive</h3>
                            <p class="text-blue-100">Works perfectly on all devices</p>
                        </div>
                        <div class="text-center">
                            <i class="fas fa-rocket text-4xl text-pink-300 mb-4"></i>
                            <h3 class="text-xl font-semibold text-white mb-2">Fast & Light</h3>
                            <p class="text-blue-100">Optimized for performance</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer class="bg-black/30 backdrop-blur-md border-t border-white/20 py-12">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center">
                <div class="flex justify-center items-center mb-4">
                    <i class="fas fa-heart text-red-400 mx-2"></i>
                    <span class="text-white">Built with LumaUI-lite</span>
                    <i class="fas fa-heart text-red-400 mx-2"></i>
                </div>
                <p class="text-blue-200 text-sm">
                    © ${new Date().getFullYear()} ${projectData.name}. Ready to be customized by you!
                </p>
                <div class="flex justify-center space-x-6 mt-6">
                    <a href="#" class="text-blue-200 hover:text-white transition-colors">
                        <i class="fab fa-github text-2xl"></i>
                    </a>
                    <a href="#" class="text-blue-200 hover:text-white transition-colors">
                        <i class="fab fa-twitter text-2xl"></i>
                    </a>
                    <a href="#" class="text-blue-200 hover:text-white transition-colors">
                        <i class="fab fa-linkedin text-2xl"></i>
                    </a>
                </div>
            </div>
        </div>
    </footer>
    
    <script src="script.js"></script>
</body>
</html>`;

    // Generate minimal CSS (Tailwind handles most styling)
    const css = `/* ${projectData.name} Custom Styles */
/* Add any custom styles here that aren't covered by Tailwind */

/* Smooth scrolling for anchor links */
html {
    scroll-behavior: smooth;
}

/* Custom animations */
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(30px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

.fade-in-up {
    animation: fadeInUp 0.6s ease-out;
}

/* Custom gradient text */
.gradient-text {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

/* Glassmorphism effect enhancement */
.glass-effect {
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
}

/* Custom hover effects */
.hover-lift {
    transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.hover-lift:hover {
    transform: translateY(-5px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
}`;

    // Generate enhanced JavaScript with modern functionality
    const js = `// ${projectData.name} JavaScript
console.log('${projectData.name} loaded successfully!');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    initializeApp();
});

function initializeApp() {
    console.log('Initializing ${projectData.name}...');
    
    // Initialize mobile menu
    initializeMobileMenu();
    
    // Initialize smooth scrolling for navigation links
    initializeSmoothScrolling();
    
    // Initialize interactive buttons
    initializeButtons();
    
    // Initialize animations
    initializeAnimations();
    
    // Add your features implementation here:
    ${projectData.features.map(feature => `// TODO: Implement ${feature}`).join('\n    ')}
    
    console.log('${projectData.name} initialized successfully!');
}

// Mobile menu functionality
function initializeMobileMenu() {
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', function() {
            mobileMenu.classList.toggle('hidden');
            
            // Toggle hamburger icon
            const icon = mobileMenuButton.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-bars');
                icon.classList.toggle('fa-times');
            }
        });
        
        // Close mobile menu when clicking on a link
        const mobileLinks = mobileMenu.querySelectorAll('a');
        mobileLinks.forEach(link => {
            link.addEventListener('click', function() {
                mobileMenu.classList.add('hidden');
                const icon = mobileMenuButton.querySelector('i');
                if (icon) {
                    icon.classList.add('fa-bars');
                    icon.classList.remove('fa-times');
                }
            });
        });
    }
}

// Smooth scrolling for navigation links
function initializeSmoothScrolling() {
    const navLinks = document.querySelectorAll('a[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Initialize interactive buttons
function initializeButtons() {
    // Get Started button
    const getStartedBtn = document.querySelector('button:has(i.fa-play)');
    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', function() {
            showNotification('Welcome to ${projectData.name}! Ready to get started?', 'success');
            // Scroll to features or about section
            const featuresSection = document.getElementById('features') || document.getElementById('about');
            if (featuresSection) {
                featuresSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
    
    // Learn More button
    const learnMoreBtn = document.querySelector('button:has(i.fa-info-circle)');
    if (learnMoreBtn) {
        learnMoreBtn.addEventListener('click', function() {
            const aboutSection = document.getElementById('about');
            if (aboutSection) {
                aboutSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    }
}

// Initialize scroll animations
function initializeAnimations() {
    // Add fade-in animation to elements when they come into view
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in-up');
            }
        });
    }, observerOptions);
    
    // Observe feature cards and other elements
    const elementsToAnimate = document.querySelectorAll('.bg-white\\/10, .text-center > div');
    elementsToAnimate.forEach(el => observer.observe(el));
}

// Utility functions
function showNotification(message, type = 'info') {
    console.log(\`[\${type.toUpperCase()}] \${message}\`);
    
    // Create a simple notification
    const notification = document.createElement('div');
    notification.className = \`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg text-white font-medium transform transition-all duration-300 translate-x-full\`;
    
    // Set color based on type
    switch(type) {
        case 'success':
            notification.classList.add('bg-green-500');
            break;
        case 'error':
            notification.classList.add('bg-red-500');
            break;
        case 'warning':
            notification.classList.add('bg-yellow-500');
            break;
        default:
            notification.classList.add('bg-blue-500');
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// Parallax effect for hero section (optional)
function initializeParallax() {
    window.addEventListener('scroll', function() {
        const scrolled = window.pageYOffset;
        const heroSection = document.getElementById('home');
        
        if (heroSection) {
            const rate = scrolled * -0.5;
            heroSection.style.transform = \`translateY(\${rate}px)\`;
        }
    });
}

// Initialize parallax if desired
// initializeParallax();

// Add more utility functions as needed
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}`;

    return { html, css, js };
  };

  const handleCreateProject = async () => {
    if (!formData.name.trim()) {
      alert('Please enter a project name');
      return;
    }

    if (!formData.type) {
      alert('Please select a project type');
      return;
    }

    if (formData.type === 'Custom Application' && !formData.customDescription.trim()) {
      alert('Please describe your custom application');
      return;
    }

    setIsGenerating(true);

    try {
      // Simulate generation delay for better UX
      await new Promise(resolve => setTimeout(resolve, 1500));

      const files = await generateInitialCode(formData);

      // Create project files array - handle both single page and multi-page templates
      let projectFiles: any[] = [];
      
      if (files.aiTemplate && files.aiTemplate.pages) {
        // Multi-page AI template - create a file for each page
        projectFiles = files.aiTemplate.pages.map((page: any, index: number) => ({
          id: `file-${Date.now()}-${index + 1}`,
          name: page.filename,
          path: page.filename,
          content: page.content,
          type: 'file' as const,
          mimeType: 'text/html',
          extension: 'html',
          lastModified: new Date()
        }));
      } else {
        // Single page template - create default files
        projectFiles = [
          {
            id: `file-${Date.now()}-1`,
            name: 'index.html',
            path: 'index.html',
            content: files.html,
            type: 'file' as const,
            mimeType: 'text/html',
            extension: 'html',
            lastModified: new Date()
          },
          {
            id: `file-${Date.now()}-2`,
            name: 'styles.css',
            path: 'styles.css',
            content: files.css,
            type: 'file' as const,
            mimeType: 'text/css',
            extension: 'css',
            lastModified: new Date()
          },
          {
            id: `file-${Date.now()}-3`,
            name: 'script.js',
            path: 'script.js',
            content: files.js,
            type: 'file' as const,
            mimeType: 'application/javascript',
            extension: 'js',
            lastModified: new Date()
          }
        ];
      }

      const projectData = {
        name: formData.name.trim(),
        description: formData.type === 'Custom Application' ? formData.customDescription : formData.description,
        type: formData.type,
        features: formData.features,
        files: {
          html: files.html,
          css: files.css,
          js: files.js
        },
        projectFiles: projectFiles
      };

      onCreateProject(projectData);
      handleReset();
    } catch (error) {
      console.error('Error generating project:', error);
      alert(`Error generating project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glassmorphic max-w-4xl w-full max-h-[90vh] overflow-auto rounded-2xl border border-white/30 dark:border-gray-700/50">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/20 dark:border-gray-700/50">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              {step === 1 ? 'Create New Project' : 'Customize Your Project'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {step === 1 ? 'Choose what kind of application you want to build' : 'Add features and customize your project'}
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 ? (
            /* Step 1: Project Type Selection */
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="My Awesome App"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                  Choose Application Type *
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {PROJECT_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => handleTypeSelect(type.id)}
                      className={`group text-left p-6 rounded-xl border-2 transition-all duration-300 transform hover:scale-105 hover:shadow-xl relative overflow-hidden ${
                        formData.type === type.name
                          ? `border-transparent bg-gradient-to-br ${type.color} text-white shadow-lg ring-4 ring-blue-200 dark:ring-blue-800`
                          : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 hover:shadow-lg bg-white dark:bg-gray-800'
                      }`}
                    >
                      {/* Background pattern for unselected cards */}
                      {formData.type !== type.name && (
                        <div className="absolute inset-0 opacity-5">
                          <div className={`w-full h-full bg-gradient-to-br ${type.color}`}></div>
                        </div>
                      )}
                      
                      <div className="flex items-center mb-3 relative z-10">
                        <div className={`w-16 h-16 rounded-xl flex items-center justify-center mr-4 shadow-lg transition-all duration-300 group-hover:scale-110 ${
                          formData.type === type.name 
                            ? 'bg-white/20 backdrop-blur-sm' 
                            : `bg-gradient-to-br ${type.color} group-hover:shadow-xl`
                        }`}>
                          <i className={`${type.icon} text-2xl ${
                            formData.type === type.name ? 'text-white' : 'text-white'
                          } drop-shadow-sm transition-transform duration-300 group-hover:scale-110`}></i>
                        </div>
                        <div className="flex-1">
                          <h3 className={`font-bold text-lg mb-1 ${
                            formData.type === type.name 
                              ? 'text-white' 
                              : 'text-gray-800 dark:text-gray-100'
                          }`}>
                            {type.name}
                          </h3>
                          {type.hasTemplate && (
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              formData.type === type.name
                                ? 'bg-white/20 text-white'
                                : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                            }`}>
                              <i className="fas fa-magic mr-1"></i>
                              Template Ready
                            </span>
                          )}
                        </div>
                      </div>
                      <p className={`text-sm leading-relaxed relative z-10 ${
                        formData.type === type.name 
                          ? 'text-white/90' 
                          : 'text-gray-600 dark:text-gray-400'
                      }`}>
                        {type.description}
                      </p>
                      {formData.type === type.name && (
                        <div className="mt-4 flex items-center text-white/80 relative z-10">
                          <i className="fas fa-check-circle mr-2"></i>
                          <span className="text-sm font-medium">Selected</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {formData.type === 'Custom Application' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Describe Your Application *
                    </label>
                    <textarea
                      value={formData.customDescription}
                      onChange={(e) => setFormData(prev => ({ ...prev, customDescription: e.target.value }))}
                      placeholder="Describe what your application will do, its main features, and any specific requirements..."
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                  </div>

                  {/* AI Generation Toggle */}
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 p-6 rounded-xl border border-purple-200 dark:border-purple-700/50">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center mr-3">
                          <i className="fas fa-magic text-white"></i>
                        </div>
                        <div>
                          <h3 className="font-bold text-gray-800 dark:text-gray-100">AI-Powered Generation</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">Let AI create a custom template for you</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={useAI}
                          onChange={(e) => setUseAI(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-gradient-to-r peer-checked:from-purple-500 peer-checked:to-blue-500"></div>
                      </label>
                    </div>

                    {useAI && (
                      <div className="space-y-4 mt-4 pt-4 border-t border-purple-200 dark:border-purple-700/50">
                        {/* AI Provider Selection */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            AI Provider
                          </label>
                          <select
                            value={selectedProvider}
                            onChange={(e) => {
                              setSelectedProvider(e.target.value);
                              if (e.target.value) {
                                fetchModelsForProvider(e.target.value);
                              } else {
                                setAvailableModels([]);
                                setSelectedModel('');
                              }
                            }}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          >
                            <option value="">Select a provider...</option>
                            {providers.filter(p => p.type === 'openai' || p.type === 'openrouter' || p.type === 'ollama').map(provider => (
                              <option key={provider.id} value={provider.id}>
                                {provider.name} ({provider.type})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* AI Model Selection */}
                        {selectedProvider && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                AI Model
                              </label>
                              <button
                                onClick={() => fetchModelsForProvider(selectedProvider)}
                                disabled={loadingModels}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors disabled:opacity-50"
                              >
                                <RefreshCw className={`w-3 h-3 ${loadingModels ? 'animate-spin' : ''}`} />
                                Refresh
                              </button>
                            </div>
                            
                            {loadingModels ? (
                              <div className="flex items-center justify-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                <Loader2 className="w-5 h-5 animate-spin text-purple-500 mr-2" />
                                <span className="text-sm text-gray-600 dark:text-gray-400">Loading models...</span>
                              </div>
                            ) : modelError ? (
                              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg">
                                <p className="text-sm text-red-600 dark:text-red-400">{modelError}</p>
                                <p className="text-xs text-red-500 dark:text-red-400 mt-1">Using fallback models</p>
                              </div>
                            ) : null}
                            
                            <select
                              value={selectedModel}
                              onChange={(e) => setSelectedModel(e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                              disabled={loadingModels}
                            >
                              <option value="">Select a model...</option>
                              {availableModels.map(model => (
                                <option key={model.id} value={model.id}>
                                  {model.name}
                                  {model.context_length && ` (${model.context_length.toLocaleString()} tokens)`}
                                </option>
                              ))}
                            </select>
                            
                            {selectedModel && availableModels.length > 0 && (
                              <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-600 dark:text-blue-400">
                                {availableModels.find(m => m.id === selectedModel)?.description}
                              </div>
                            )}
                          </div>
                        )}

                        {/* AI Instructions */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Additional Instructions (Optional)
                          </label>
                          <textarea
                            value={aiInstructions}
                            onChange={(e) => setAiInstructions(e.target.value)}
                            placeholder="Any specific styling, functionality, or design preferences..."
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          />
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                          <div className="flex items-start">
                            <i className="fas fa-info-circle text-blue-500 mt-1 mr-3"></i>
                            <div className="text-sm text-blue-700 dark:text-blue-300">
                              <p className="font-medium mb-1">AI Generation will:</p>
                              <ul className="list-disc list-inside space-y-1 text-xs">
                                <li>Create a custom HTML template based on your description</li>
                                <li>Generate beautiful CSS with Clara's design system</li>
                                <li>Add interactive JavaScript functionality</li>
                                <li>Use Tailwind CSS and Font Awesome icons</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Step 2: Features Customization */
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                  {formData.name} - {formData.type}
                </h3>
                <p className="text-sm text-blue-600 dark:text-blue-300">
                  {formData.type === 'Custom Application' ? formData.customDescription : formData.description}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                  Features & Requirements
                </label>
                
                {/* Add Feature Input */}
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    placeholder="Add a feature or requirement..."
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    onKeyPress={(e) => e.key === 'Enter' && handleAddFeature()}
                  />
                  <button
                    onClick={handleAddFeature}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                {/* Features List */}
                {formData.features.length > 0 && (
                  <div className="space-y-2">
                    {formData.features.map((feature, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600"
                      >
                        <span className="text-gray-800 dark:text-gray-200">{feature}</span>
                        <button
                          onClick={() => handleRemoveFeature(index)}
                          className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {formData.features.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    No features added yet. Add some features to help guide the code generation.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-white/20 dark:border-gray-700/50">
          <div className="flex items-center gap-2">
            {step === 2 && (
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Back
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            
            {step === 1 ? (
              <button
                onClick={() => setStep(2)}
                disabled={!formData.name.trim() || !formData.type || (formData.type === 'Custom Application' && !formData.customDescription.trim())}
                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next: Customize
              </button>
            ) : (
              <button
                onClick={handleCreateProject}
                disabled={isGenerating}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Create Project'
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LumaUILiteProjectModal; 