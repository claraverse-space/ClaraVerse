import React, { useState, useEffect } from 'react';
import { Plus, FolderOpen, Trash2, Edit, Eye, Play } from 'lucide-react';
import LumaUILiteProjectModal from './lumauilite_components/LumaUILiteProjectModal';
import LumaUILiteEditor from './lumauilite_components/LumaUILiteEditor';
import LumaUILiteAppPreview from './lumauilite_components/LumaUILiteAppPreview';

export interface LiteProjectFile {
  id: string;
  name: string;
  path: string;
  content: string;
  type: 'file' | 'directory';
  mimeType?: string;
  size?: number;
  isImage?: boolean;
  extension?: string;
  lastModified: Date;
}

export interface LiteProject {
  id: string;
  name: string;
  description: string;
  type: string;
  features: string[];
  files: {
    // Legacy support for existing projects
    html?: string;
    css?: string;
    js?: string;
  };
  // New file system
  projectFiles: LiteProjectFile[];
  createdAt: Date;
  lastModified: Date;
}

const LumaUILite: React.FC = () => {
  const [projects, setProjects] = useState<LiteProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<LiteProject | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isAppPreviewOpen, setIsAppPreviewOpen] = useState(false);

  // Load projects from localStorage with migration support
  useEffect(() => {
    const savedProjects = localStorage.getItem('lumaui-lite-projects');
    if (savedProjects) {
      try {
        const parsed = JSON.parse(savedProjects);
        setProjects(parsed.map((p: any) => ({
          ...p,
          createdAt: new Date(p.createdAt),
          lastModified: new Date(p.lastModified),
          // Migrate old projects to new format
          projectFiles: p.projectFiles || []
        })));
      } catch (error) {
        console.error('Error loading projects:', error);
      }
    }
  }, []);

  // Save projects to localStorage
  const saveProjects = (updatedProjects: LiteProject[]) => {
    localStorage.setItem('lumaui-lite-projects', JSON.stringify(updatedProjects));
    setProjects(updatedProjects);
  };

  const handleCreateProject = (projectData: Omit<LiteProject, 'id' | 'createdAt' | 'lastModified'>) => {
    const newProject: LiteProject = {
      ...projectData,
      id: `lite-project-${Date.now()}`,
      createdAt: new Date(),
      lastModified: new Date(),
      // Create default files if projectFiles is empty
      projectFiles: projectData.projectFiles.length > 0 ? projectData.projectFiles : [
        {
          id: `file-${Date.now()}-1`,
          name: 'index.html',
          path: 'index.html',
          content: projectData.files.html || `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectData.name}</title>
    
    <!-- Essential CSS Libraries -->
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://unpkg.com/aos@2.3.1/dist/aos.css" rel="stylesheet">
    
    <!-- Custom Styles -->
    <link rel="stylesheet" href="styles.css">
    
    <!-- Tailwind Config -->
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        'inter': ['Inter', 'sans-serif'],
                        'poppins': ['Poppins', 'sans-serif'],
                    },
                    colors: {
                        'sakura': {
                            50: '#fef7f7',
                            100: '#fdeaea',
                            200: '#fbd5d5',
                            300: '#f7b2b2',
                            400: '#f18a8a',
                            500: '#e85d5d',
                            600: '#d63939',
                            700: '#b42a2a',
                            800: '#952626',
                            900: '#7c2525',
                        }
                    }
                }
            }
        }
    </script>
</head>
<body class="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 font-inter">
    <!-- Navigation -->
    <nav class="fixed top-0 w-full z-50 bg-white/10 backdrop-blur-md border-b border-white/20" data-aos="fade-down">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between items-center h-16">
                <div class="flex items-center">
                    <i class="fas fa-rocket text-white text-2xl mr-3 animate__animated animate__pulse animate__infinite"></i>
                    <span class="text-white font-bold text-xl font-poppins">${projectData.name}</span>
                </div>
                <div class="hidden md:block">
                    <div class="ml-10 flex items-baseline space-x-4">
                        <a href="#home" class="text-white hover:text-sakura-300 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 hover:bg-white/10">
                            <i class="fas fa-home mr-1"></i> Home
                        </a>
                        <a href="#about" class="text-white hover:text-sakura-300 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 hover:bg-white/10">
                            <i class="fas fa-info-circle mr-1"></i> About
                        </a>
                        <a href="#features" class="text-white hover:text-sakura-300 px-3 py-2 rounded-md text-sm font-medium transition-all duration-300 hover:bg-white/10">
                            <i class="fas fa-star mr-1"></i> Features
                        </a>
                    </div>
                </div>
                <div class="md:hidden">
                    <button id="mobile-menu-button" class="text-white hover:text-sakura-300 transition-all duration-300">
                        <i class="fas fa-bars text-xl"></i>
                    </button>
                </div>
            </div>
        </div>
        <!-- Mobile menu -->
        <div id="mobile-menu" class="md:hidden hidden bg-white/10 backdrop-blur-md">
            <div class="px-2 pt-2 pb-3 space-y-1">
                <a href="#home" class="text-white block px-3 py-2 rounded-md text-base font-medium hover:bg-white/10 transition-all">
                    <i class="fas fa-home mr-2"></i> Home
                </a>
                <a href="#about" class="text-white block px-3 py-2 rounded-md text-base font-medium hover:bg-white/10 transition-all">
                    <i class="fas fa-info-circle mr-2"></i> About
                </a>
                <a href="#features" class="text-white block px-3 py-2 rounded-md text-base font-medium hover:bg-white/10 transition-all">
                    <i class="fas fa-star mr-2"></i> Features
                </a>
            </div>
        </div>
    </nav>

    <!-- Hero Section -->
    <section id="home" class="relative min-h-screen flex items-center justify-center px-4 pt-16">
        <div class="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-blue-900/20 to-pink-900/20"></div>
        <div class="absolute inset-0 bg-black/30"></div>
        
        <!-- Animated background particles -->
        <div class="absolute inset-0 overflow-hidden">
            <div class="absolute top-1/4 left-1/4 w-2 h-2 bg-sakura-400 rounded-full animate-pulse"></div>
            <div class="absolute top-3/4 right-1/4 w-1 h-1 bg-blue-400 rounded-full animate-ping"></div>
            <div class="absolute top-1/2 left-3/4 w-3 h-3 bg-purple-400 rounded-full animate-bounce"></div>
        </div>
        
        <div class="relative z-10 text-center text-white max-w-4xl mx-auto">
            <div class="mb-8" data-aos="zoom-in" data-aos-delay="200">
                <i class="fas fa-code text-6xl mb-6 text-sakura-400 animate__animated animate__fadeInUp"></i>
            </div>
            <h1 class="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-sakura-200 to-sakura-300 bg-clip-text text-transparent font-poppins" data-aos="fade-up" data-aos-delay="400">
                ${projectData.name}
            </h1>
            <p class="text-xl md:text-2xl mb-8 text-gray-200 leading-relaxed" data-aos="fade-up" data-aos-delay="600">
                ${projectData.description || 'Welcome to your stunning new application built with modern design'}
            </p>
            <div class="flex flex-col sm:flex-row gap-4 justify-center" data-aos="fade-up" data-aos-delay="800">
                <button class="group bg-gradient-to-r from-sakura-500 to-sakura-600 text-white px-8 py-4 rounded-full font-semibold text-lg hover:from-sakura-600 hover:to-sakura-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl">
                    <i class="fas fa-play mr-2 group-hover:animate-pulse"></i> Get Started
                </button>
                <button class="group border-2 border-sakura-400 text-sakura-400 px-8 py-4 rounded-full font-semibold text-lg hover:bg-sakura-400 hover:text-white transition-all duration-300 transform hover:scale-105 backdrop-blur-sm">
                    <i class="fas fa-info-circle mr-2 group-hover:rotate-12 transition-transform"></i> Learn More
                </button>
            </div>
        </div>
        
        <!-- Scroll indicator -->
        <div class="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-white animate-bounce" data-aos="fade-up" data-aos-delay="1000">
            <i class="fas fa-chevron-down text-2xl"></i>
        </div>
    </section>

    <!-- About Section -->
    <section id="about" class="py-20">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center">
                <h2 class="text-4xl md:text-5xl font-bold text-white mb-8">
                    <i class="fas fa-info-circle text-sakura-400 mr-3"></i>
                    About This Project
                </h2>
                <div class="max-w-3xl mx-auto">
                    <p class="text-xl text-gray-200 mb-8 leading-relaxed">
                        Welcome to your ${projectData.type || 'application'}! This project was created with LumaUI-lite, 
                        giving you a solid foundation to build upon. Start customizing by editing the 
                        HTML, CSS, and JavaScript files.
                    </p>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-8 mt-12">
                        <div class="text-center">
                            <i class="fas fa-code text-4xl text-sakura-400 mb-4"></i>
                            <h3 class="text-xl font-semibold text-white mb-2">Modern Code</h3>
                            <p class="text-gray-200">Built with latest web technologies</p>
                        </div>
                        <div class="text-center">
                            <i class="fas fa-mobile-alt text-4xl text-sakura-400 mb-4"></i>
                            <h3 class="text-xl font-semibold text-white mb-2">Responsive</h3>
                            <p class="text-gray-200">Works perfectly on all devices</p>
                        </div>
                        <div class="text-center">
                            <i class="fas fa-rocket text-4xl text-sakura-400 mb-4"></i>
                            <h3 class="text-xl font-semibold text-white mb-2">Fast & Light</h3>
                            <p class="text-gray-200">Optimized for performance</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer class="bg-gray-900/50 backdrop-blur-md border-t border-gray-700/50 py-12">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center">
                <div class="flex justify-center items-center mb-4">
                    <i class="fas fa-heart text-sakura-400 mx-2"></i>
                    <span class="text-white">Built with LumaUI-lite</span>
                    <i class="fas fa-heart text-sakura-400 mx-2"></i>
                </div>
                <p class="text-gray-300 text-sm">
                    © ${new Date().getFullYear()} ${projectData.name}. Ready to be customized by you!
                </p>
                <div class="flex justify-center space-x-6 mt-6">
                    <a href="#" class="text-gray-400 hover:text-sakura-400 transition-colors">
                        <i class="fab fa-github text-2xl"></i>
                    </a>
                    <a href="#" class="text-gray-400 hover:text-sakura-400 transition-colors">
                        <i class="fab fa-twitter text-2xl"></i>
                    </a>
                    <a href="#" class="text-gray-400 hover:text-sakura-400 transition-colors">
                        <i class="fab fa-linkedin text-2xl"></i>
                    </a>
                </div>
            </div>
        </div>
    </footer>
    
    <!-- Essential JavaScript Libraries -->
    <script src="https://unpkg.com/aos@2.3.1/dist/aos.js"></script>
    <script defer src="https://unpkg.com/alpinejs@3.x.x/dist/cdn.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/typed.js@2.0.12"></script>
    
    <!-- Custom JavaScript -->
    <script src="script.js"></script>
</body>
</html>`,
          type: 'file',
          mimeType: 'text/html',
          extension: 'html',
          lastModified: new Date()
        },
        {
          id: `file-${Date.now()}-2`,
          name: 'styles.css',
          path: 'styles.css',
          content: projectData.files.css || `/* ${projectData.name} - Modern UI Styles */
/* Enhanced styles with popular design patterns */

/* CSS Variables for consistent theming */
:root {
    --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --sakura-gradient: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    --glass-bg: rgba(255, 255, 255, 0.1);
    --glass-border: rgba(255, 255, 255, 0.2);
    --shadow-soft: 0 8px 32px rgba(0, 0, 0, 0.1);
    --shadow-glow: 0 0 20px rgba(244, 114, 182, 0.3);
}

/* Smooth scrolling and base styles */
html {
    scroll-behavior: smooth;
    scroll-padding-top: 80px;
}

body {
    overflow-x: hidden;
}

/* Enhanced Glassmorphism */
.glass-card {
    background: var(--glass-bg);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border: 1px solid var(--glass-border);
    box-shadow: var(--shadow-soft);
}

/* Neumorphism Cards */
.neuro-card {
    background: linear-gradient(145deg, #2a2a2a, #1a1a1a);
    box-shadow: 
        20px 20px 60px #0d0d0d,
        -20px -20px 60px #3d3d3d;
    border-radius: 20px;
}

/* Custom Animations */
@keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-20px); }
}

@keyframes glow {
    0%, 100% { box-shadow: 0 0 20px rgba(244, 114, 182, 0.3); }
    50% { box-shadow: 0 0 40px rgba(244, 114, 182, 0.6); }
}

@keyframes slideInLeft {
    from {
        opacity: 0;
        transform: translateX(-50px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

@keyframes slideInRight {
    from {
        opacity: 0;
        transform: translateX(50px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

/* Utility Classes */
.float-animation {
    animation: float 6s ease-in-out infinite;
}

.glow-effect {
    animation: glow 2s ease-in-out infinite alternate;
}

.slide-in-left {
    animation: slideInLeft 0.8s ease-out;
}

.slide-in-right {
    animation: slideInRight 0.8s ease-out;
}

/* Enhanced Button Styles */
.btn-primary {
    background: var(--sakura-gradient);
    border: none;
    border-radius: 50px;
    padding: 12px 30px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1px;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
}

.btn-primary::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
    transition: left 0.5s;
}

.btn-primary:hover::before {
    left: 100%;
}

.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 25px rgba(244, 114, 182, 0.4);
}

/* Card Hover Effects */
.card-hover {
    transition: all 0.3s ease;
    cursor: pointer;
}

.card-hover:hover {
    transform: translateY(-10px) scale(1.02);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

/* Text Effects */
.text-gradient {
    background: var(--sakura-gradient);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.text-glow {
    text-shadow: 0 0 20px rgba(244, 114, 182, 0.5);
}

/* Loading Animations */
.loading-dots {
    display: inline-block;
}

.loading-dots::after {
    content: '';
    animation: dots 1.5s steps(5, end) infinite;
}

@keyframes dots {
    0%, 20% { content: ''; }
    40% { content: '.'; }
    60% { content: '..'; }
    80%, 100% { content: '...'; }
}

/* Responsive Typography */
.responsive-text {
    font-size: clamp(1rem, 4vw, 2rem);
    line-height: 1.4;
}

/* Custom Scrollbar */
::-webkit-scrollbar {
    width: 8px;
}

::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
}

::-webkit-scrollbar-thumb {
    background: var(--sakura-gradient);
    border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%);
}

/* Mobile Optimizations */
@media (max-width: 768px) {
    .glass-card {
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
    }
    
    .card-hover:hover {
        transform: translateY(-5px) scale(1.01);
    }
}

/* Dark Mode Enhancements */
@media (prefers-color-scheme: dark) {
    :root {
        --glass-bg: rgba(0, 0, 0, 0.2);
        --glass-border: rgba(255, 255, 255, 0.1);
    }
}`,
          type: 'file',
          mimeType: 'text/css',
          extension: 'css',
          lastModified: new Date()
        },
        {
          id: `file-${Date.now()}-3`,
          name: 'script.js',
          path: 'script.js',
          content: projectData.files.js || `// ${projectData.name} - Modern Interactive JavaScript
// Enhanced with popular libraries and modern UI patterns

console.log('🚀 ${projectData.name} loading with modern libraries...');

// Application state
const AppState = {
    isLoaded: false,
    animations: {
        aos: null,
        gsap: null,
        typed: null
    },
    theme: 'dark',
    mobile: {
        menuOpen: false
    }
};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('📱 DOM Content Loaded - Initializing modern app...');
    initializeApp();
});

async function initializeApp() {
    console.log('⚡ Initializing ${projectData.name} with modern features...');
    
    try {
        // Initialize libraries in order
        await initializeLibraries();
        
        // Initialize core functionality
        initializeMobileMenu();
        initializeSmoothScrolling();
        initializeButtons();
        initializeScrollEffects();
        initializeTypingAnimation();
        initializeGSAPAnimations();
        initializeThemeToggle();
        initializeParallaxEffects();
        
        AppState.isLoaded = true;
        console.log('✅ ${projectData.name} initialized successfully with all modern features!');
        
        // Show welcome notification
        showNotification('🎉 Welcome to ${projectData.name}! All modern features loaded.', 'success');
        
    } catch (error) {
        console.error('❌ Error initializing app:', error);
        showNotification('⚠️ Some features may not work properly', 'warning');
    }
}

// Initialize modern libraries
async function initializeLibraries() {
    // Initialize AOS (Animate On Scroll)
    if (typeof AOS !== 'undefined') {
        AOS.init({
            duration: 1000,
            easing: 'ease-in-out-cubic',
            once: true,
            offset: 100,
            delay: 100
        });
        AppState.animations.aos = AOS;
        console.log('📜 AOS (Animate On Scroll) initialized');
    }
    
    // Initialize GSAP if available
    if (typeof gsap !== 'undefined') {
        AppState.animations.gsap = gsap;
        console.log('🎬 GSAP animation library loaded');
    }
    
    // Initialize Typed.js if available
    if (typeof Typed !== 'undefined') {
        console.log('⌨️ Typed.js library loaded');
    }
}

// Enhanced mobile menu with animations
function initializeMobileMenu() {
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    
    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', function() {
            AppState.mobile.menuOpen = !AppState.mobile.menuOpen;
            
            if (AppState.mobile.menuOpen) {
                mobileMenu.classList.remove('hidden');
                // Animate menu items
                const menuItems = mobileMenu.querySelectorAll('a');
                menuItems.forEach((item, index) => {
                    item.style.opacity = '0';
                    item.style.transform = 'translateX(-20px)';
                    setTimeout(() => {
                        item.style.transition = 'all 0.3s ease';
                        item.style.opacity = '1';
                        item.style.transform = 'translateX(0)';
                    }, index * 100);
                });
            } else {
                mobileMenu.classList.add('hidden');
            }
            
            // Animate hamburger icon
            const icon = mobileMenuButton.querySelector('i');
            if (icon) {
                icon.style.transform = AppState.mobile.menuOpen ? 'rotate(90deg)' : 'rotate(0deg)';
                icon.classList.toggle('fa-bars');
                icon.classList.toggle('fa-times');
            }
        });
        
        // Close mobile menu when clicking on a link
        const mobileLinks = mobileMenu.querySelectorAll('a');
        mobileLinks.forEach(link => {
            link.addEventListener('click', function() {
                mobileMenu.classList.add('hidden');
                AppState.mobile.menuOpen = false;
                const icon = mobileMenuButton.querySelector('i');
                if (icon) {
                    icon.style.transform = 'rotate(0deg)';
                    icon.classList.add('fa-bars');
                    icon.classList.remove('fa-times');
                }
            });
        });
    }
}

// Enhanced smooth scrolling with easing
function initializeSmoothScrolling() {
    const navLinks = document.querySelectorAll('a[href^="#"]');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                // Use GSAP for smooth scrolling if available
                if (AppState.animations.gsap) {
                    AppState.animations.gsap.to(window, {
                        duration: 1.5,
                        scrollTo: { y: targetElement, offsetY: 80 },
                        ease: "power2.inOut"
                    });
                } else {
                    targetElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });
}

// Enhanced interactive buttons with modern effects
function initializeButtons() {
    // Get Started button with ripple effect
    const getStartedBtn = document.querySelector('button:has(i.fa-play)');
    if (getStartedBtn) {
        addRippleEffect(getStartedBtn);
        getStartedBtn.addEventListener('click', function() {
            showNotification('🚀 Welcome to ${projectData.name}! Let\\'s build something amazing!', 'success');
            
            // Animate scroll to features section
            const featuresSection = document.getElementById('features') || document.getElementById('about');
            if (featuresSection) {
                if (AppState.animations.gsap) {
                    AppState.animations.gsap.to(window, {
                        duration: 2,
                        scrollTo: { y: featuresSection, offsetY: 80 },
                        ease: "power3.inOut"
                    });
                } else {
                    featuresSection.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    }
    
    // Learn More button
    const learnMoreBtn = document.querySelector('button:has(i.fa-info-circle)');
    if (learnMoreBtn) {
        addRippleEffect(learnMoreBtn);
        learnMoreBtn.addEventListener('click', function() {
            const aboutSection = document.getElementById('about');
            if (aboutSection) {
                if (AppState.animations.gsap) {
                    AppState.animations.gsap.to(window, {
                        duration: 1.5,
                        scrollTo: { y: aboutSection, offsetY: 80 },
                        ease: "power2.inOut"
                    });
                } else {
                    aboutSection.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    }
}

// Add ripple effect to buttons
function addRippleEffect(button) {
    button.addEventListener('click', function(e) {
        const ripple = document.createElement('span');
        const rect = button.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top - size / 2;
        
        ripple.style.cssText = \`
            position: absolute;
            width: \${size}px;
            height: \${size}px;
            left: \${x}px;
            top: \${y}px;
            background: rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            transform: scale(0);
            animation: ripple 0.6s linear;
            pointer-events: none;
        \`;
        
        button.style.position = 'relative';
        button.style.overflow = 'hidden';
        button.appendChild(ripple);
        
        setTimeout(() => {
            ripple.remove();
        }, 600);
    });
    
    // Add ripple animation CSS
    if (!document.querySelector('#ripple-styles')) {
        const style = document.createElement('style');
        style.id = 'ripple-styles';
        style.textContent = \`
            @keyframes ripple {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
        \`;
        document.head.appendChild(style);
    }
}

// Initialize scroll-triggered effects
function initializeScrollEffects() {
    // Parallax effect for hero section
    window.addEventListener('scroll', throttle(() => {
        const scrolled = window.pageYOffset;
        const heroSection = document.getElementById('home');
        
        if (heroSection) {
            const speed = scrolled * 0.5;
            heroSection.style.transform = \`translateY(\${speed}px)\`;
        }
        
        // Update navigation background opacity
        const nav = document.querySelector('nav');
        if (nav) {
            const opacity = Math.min(scrolled / 100, 1);
            nav.style.backgroundColor = \`rgba(255, 255, 255, \${opacity * 0.1})\`;
        }
    }, 16));
}

// Initialize typing animation for hero text
function initializeTypingAnimation() {
    if (typeof Typed !== 'undefined') {
        const heroTitle = document.querySelector('h1');
        if (heroTitle) {
            // Create a span for the typing effect
            const typingSpan = document.createElement('span');
            typingSpan.id = 'typed-text';
            heroTitle.appendChild(typingSpan);
            
            new Typed('#typed-text', {
                strings: [
                    '${projectData.name}',
                    'Modern Design',
                    'Beautiful UI',
                    'Amazing UX'
                ],
                typeSpeed: 100,
                backSpeed: 50,
                backDelay: 2000,
                loop: true,
                showCursor: true,
                cursorChar: '|'
            });
        }
    }
}

// Initialize GSAP animations
function initializeGSAPAnimations() {
    if (AppState.animations.gsap) {
        const gsap = AppState.animations.gsap;
        
        // Animate hero elements
        gsap.timeline()
            .from('.hero-icon', { duration: 1, scale: 0, ease: "back.out(1.7)" })
            .from('.hero-title', { duration: 1, y: 50, opacity: 0, ease: "power2.out" }, "-=0.5")
            .from('.hero-description', { duration: 1, y: 30, opacity: 0, ease: "power2.out" }, "-=0.7")
            .from('.hero-buttons', { duration: 1, y: 20, opacity: 0, ease: "power2.out" }, "-=0.5");
        
        // Animate cards on scroll
        gsap.utils.toArray('.card-hover').forEach(card => {
            gsap.fromTo(card, 
                { y: 50, opacity: 0 },
                {
                    y: 0,
                    opacity: 1,
                    duration: 1,
                    ease: "power2.out",
                    scrollTrigger: {
                        trigger: card,
                        start: "top 80%",
                        end: "bottom 20%",
                        toggleActions: "play none none reverse"
                    }
                }
            );
        });
    }
}

// Initialize theme toggle functionality
function initializeThemeToggle() {
    // Create theme toggle button if it doesn't exist
    let themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) {
        themeToggle = document.createElement('button');
        themeToggle.id = 'theme-toggle';
        themeToggle.className = 'fixed top-20 right-4 z-50 p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all duration-300';
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        document.body.appendChild(themeToggle);
    }
    
    themeToggle.addEventListener('click', function() {
        AppState.theme = AppState.theme === 'dark' ? 'light' : 'dark';
        document.body.classList.toggle('light-theme');
        
        const icon = themeToggle.querySelector('i');
        icon.classList.toggle('fa-moon');
        icon.classList.toggle('fa-sun');
        
        showNotification(\`🎨 Switched to \${AppState.theme} theme\`, 'info');
    });
}

// Initialize parallax effects
function initializeParallaxEffects() {
    const parallaxElements = document.querySelectorAll('[data-parallax]');
    
    if (parallaxElements.length > 0) {
        window.addEventListener('scroll', throttle(() => {
            const scrolled = window.pageYOffset;
            
            parallaxElements.forEach(element => {
                const speed = element.dataset.parallax || 0.5;
                const yPos = -(scrolled * speed);
                element.style.transform = \`translateY(\${yPos}px)\`;
            });
        }, 16));
    }
}

// Enhanced notification system
function showNotification(message, type = 'info') {
    console.log(\`[\${type.toUpperCase()}] \${message}\`);
    
    const notification = document.createElement('div');
    notification.className = \`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl text-white font-medium transform transition-all duration-500 translate-x-full shadow-lg backdrop-blur-md\`;
    
    // Enhanced styling based on type
    const styles = {
        success: 'bg-gradient-to-r from-green-500 to-emerald-500',
        error: 'bg-gradient-to-r from-red-500 to-pink-500',
        warning: 'bg-gradient-to-r from-yellow-500 to-orange-500',
        info: 'bg-gradient-to-r from-blue-500 to-purple-500'
    };
    
    notification.classList.add(styles[type] || styles.info);
    notification.innerHTML = \`
        <div class="flex items-center gap-3">
            <i class="fas fa-\${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>\${message}</span>
        </div>
    \`;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.classList.remove('translate-x-full');
    }, 100);
    
    // Auto remove
    setTimeout(() => {
        notification.classList.add('translate-x-full');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 500);
    }, 4000);
}

// Utility functions
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

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
}

// Performance monitoring
function logPerformance() {
    if (performance.timing) {
        const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        console.log(\`⚡ Page loaded in \${loadTime}ms\`);
    }
}

// Initialize performance monitoring
window.addEventListener('load', logPerformance);

// Export for global access
window.AppState = AppState;
window.showNotification = showNotification;

console.log('🎉 ${projectData.name} JavaScript fully loaded with modern features!');`,
          type: 'file',
          mimeType: 'application/javascript',
          extension: 'js',
          lastModified: new Date()
        }
      ]
    };
    
    const updatedProjects = [newProject, ...projects];
    saveProjects(updatedProjects);
    setIsCreateModalOpen(false);
    
    // Immediately open the editor for the new project
    setSelectedProject(newProject);
    setIsEditorOpen(true);
  };

  const handleDeleteProject = (projectId: string) => {
    if (confirm('Are you sure you want to delete this project?')) {
      const updatedProjects = projects.filter(p => p.id !== projectId);
      saveProjects(updatedProjects);
      
      // Close editor or app preview if deleted project was selected
      if (selectedProject?.id === projectId) {
        setSelectedProject(null);
        setIsEditorOpen(false);
        setIsAppPreviewOpen(false);
      }
    }
  };

  const handleOpenProject = (project: LiteProject) => {
    setSelectedProject(project);
    setIsEditorOpen(true);
  };

  const handleOpenApp = (project: LiteProject) => {
    setSelectedProject(project);
    setIsAppPreviewOpen(true);
  };

  const handleUpdateProject = (updatedProject: LiteProject) => {
    const updatedProjects = projects.map(p => 
      p.id === updatedProject.id 
        ? { ...updatedProject, lastModified: new Date() }
        : p
    );
    saveProjects(updatedProjects);
    setSelectedProject(updatedProject);
  };

  const handleBackToProjects = () => {
    setIsEditorOpen(false);
    setSelectedProject(null);
  };

  const handleCloseAppPreview = () => {
    setIsAppPreviewOpen(false);
    setSelectedProject(null);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // If app preview is open, show the app preview
  if (isAppPreviewOpen && selectedProject) {
    return (
      <LumaUILiteAppPreview
        project={selectedProject}
        onClose={handleCloseAppPreview}
      />
    );
  }

  // If editor is open, show the editor
  if (isEditorOpen && selectedProject) {
    return (
      <LumaUILiteEditor
        project={selectedProject}
        onUpdateProject={handleUpdateProject}
        onBackToProjects={handleBackToProjects}
      />
    );
  }

  // Show projects listing page
  return (
    <div className="h-full bg-gradient-to-br from-white to-blue-50 dark:from-gray-900 dark:to-gray-800 overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="glassmorphic border-b border-white/20 dark:border-gray-700/50 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                LumaUI-lite
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Build simple single-page applications with ease
              </p>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all shadow-lg"
            >
              <Plus className="w-4 h-4" />
              Create Project
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {projects.length === 0 ? (
            /* Empty State */
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 rounded-full flex items-center justify-center shadow-lg">
                  <FolderOpen className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-3">
                  No Projects Yet
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                  Get started by creating your first single-page application. It's quick and easy!
                </p>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all mx-auto text-sm font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <Plus className="w-4 h-4" />
                  Create Your First Project
                </button>
              </div>
            </div>
          ) : (
            /* Projects Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="glassmorphic p-6 rounded-xl border border-white/30 dark:border-gray-700/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
                        {project.name}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                        {project.description}
                      </p>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full font-medium">
                          {project.type}
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {project.features.length} features
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => handleOpenApp(project)}
                        className="p-2 text-gray-500 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                        title="Open app"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenProject(project)}
                        className="p-2 text-gray-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        title="Edit project"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProject(project.id)}
                        className="p-2 text-gray-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Created: {formatDate(project.createdAt)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Modified: {formatDate(project.lastModified)}
                    </div>
                    
                    {project.features.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3">
                        {project.features.slice(0, 3).map((feature, index) => (
                          <span
                            key={index}
                            className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full"
                          >
                            {feature}
                          </span>
                        ))}
                        {project.features.length > 3 && (
                          <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 rounded-full">
                            +{project.features.length - 3} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => handleOpenApp(project)}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Open App
                    </button>
                    <button
                      onClick={() => handleOpenProject(project)}
                      className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create Project Modal */}
      <LumaUILiteProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreateProject={handleCreateProject}
      />
    </div>
  );
};

export default LumaUILite; 