import { ApplicationTemplate, TemplateFile } from '../index';

// Landing page template generators
const generateMarketingLandingPage = (frameworkId: string, projectName: string): TemplateFile[] => {
  const files: TemplateFile[] = [];

  if (frameworkId === 'react-vite-tailwind') {
    // React components for marketing landing page
    files.push({
      path: 'src/components/Hero.tsx',
      type: 'file',
      content: `import React from 'react';
import { ArrowRight, Play, Star } from 'lucide-react';

const Hero: React.FC = () => {
  return (
    <section className="relative bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 min-h-screen flex items-center">
      <div className="absolute inset-0 bg-black/20"></div>
      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center text-white">
          <div className="mb-6">
            <span className="inline-flex items-center px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium border border-white/20">
              🚀 New Product Launch
            </span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Transform Your
            <span className="bg-gradient-to-r from-blue-400 to-pink-400 bg-clip-text text-transparent"> Business </span>
            Today
          </h1>
          
          <p className="text-xl md:text-2xl mb-8 text-gray-200 leading-relaxed max-w-3xl mx-auto">
            Discover the ultimate solution that helps thousands of businesses streamline operations, 
            boost productivity, and achieve unprecedented growth.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <button className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg font-semibold text-lg transition-all duration-300 transform hover:scale-105 shadow-xl">
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </button>
            
            <button className="flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur-sm hover:bg-white/20 rounded-lg font-semibold text-lg transition-all duration-300 border border-white/20">
              <Play className="w-5 h-5" />
              Watch Demo
            </button>
          </div>
          
          <div className="flex items-center justify-center gap-8 text-sm">
            <div className="flex items-center gap-2">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <span>4.9/5 from 2,000+ reviews</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-white/30"></div>
            <span className="hidden sm:inline">Trusted by 50,000+ businesses</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;`
    });

    files.push({
      path: 'src/components/Features.tsx',
      type: 'file',
      content: `import React from 'react';
import { Zap, Shield, TrendingUp, Users, Globe, Clock } from 'lucide-react';

const Features: React.FC = () => {
  const features = [
    {
      icon: <Zap className="w-8 h-8" />,
      title: 'Lightning Fast',
      description: 'Built for speed with optimized performance that scales with your business growth.'
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: 'Enterprise Security',
      description: 'Bank-level security with end-to-end encryption and compliance certifications.'
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: 'Growth Analytics',
      description: 'Real-time insights and analytics to make data-driven decisions for your business.'
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: 'Team Collaboration',
      description: 'Seamless collaboration tools that keep your team aligned and productive.'
    },
    {
      icon: <Globe className="w-8 h-8" />,
      title: 'Global Reach',
      description: 'Multi-language support and global infrastructure for worldwide accessibility.'
    },
    {
      icon: <Clock className="w-8 h-8" />,
      title: '24/7 Support',
      description: 'Round-the-clock customer support with dedicated success managers.'
    }
  ];

  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
            Everything You Need to Succeed
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Powerful features designed to streamline your workflow and accelerate your business growth.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-8 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white mb-6">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-4">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;`
    });

    files.push({
      path: 'src/components/CTA.tsx',
      type: 'file',
      content: `import React from 'react';
import { ArrowRight, CheckCircle } from 'lucide-react';

const CTA: React.FC = () => {
  return (
    <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Transform Your Business?
          </h2>
          <p className="text-xl mb-8 text-blue-100">
            Join thousands of businesses that have already made the switch and seen incredible results.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-6 items-center justify-center mb-8">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span>14-day free trial</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span>Cancel anytime</span>
            </div>
          </div>
          
          <button className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 hover:bg-gray-100 rounded-lg font-semibold text-lg transition-all duration-300 transform hover:scale-105 shadow-xl">
            Start Your Free Trial
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default CTA;`
    });

    // Update App.tsx to use the new components
    files.push({
      path: 'src/App.tsx',
      type: 'file',
      overwrite: true,
      content: `import React from 'react';
import Hero from './components/Hero';
import Features from './components/Features';
import CTA from './components/CTA';
import './App.css';

function App() {
  return (
    <div className="min-h-screen">
      <Hero />
      <Features />
      <CTA />
    </div>
  );
}

export default App;`
    });

  } else if (frameworkId === 'vanilla-tailwind') {
    // Vanilla HTML version
    files.push({
      path: 'index.html',
      type: 'file',
      overwrite: true,
      content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${projectName} - Transform Your Business</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    animation: {
                        'fade-in': 'fadeIn 0.6s ease-in-out',
                        'slide-up': 'slideUp 0.8s ease-out'
                    }
                }
            }
        }
    </script>
    <style>
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body class="bg-gray-50">
    <!-- Hero Section -->
    <section class="relative bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 min-h-screen flex items-center">
        <div class="absolute inset-0 bg-black opacity-20"></div>
        <div class="container mx-auto px-4 relative z-10">
            <div class="max-w-4xl mx-auto text-center text-white animate-fade-in">
                <div class="mb-6">
                    <span class="inline-flex items-center px-4 py-2 bg-white bg-opacity-10 backdrop-blur-sm rounded-full text-sm font-medium border border-white border-opacity-20">
                        🚀 New Product Launch
                    </span>
                </div>
                
                <h1 class="text-5xl md:text-7xl font-bold mb-6 leading-tight">
                    Transform Your
                    <span class="bg-gradient-to-r from-blue-400 to-pink-400 bg-clip-text text-transparent"> Business </span>
                    Today
                </h1>
                
                <p class="text-xl md:text-2xl mb-8 text-gray-200 leading-relaxed max-w-3xl mx-auto">
                    Discover the ultimate solution that helps thousands of businesses streamline operations, 
                    boost productivity, and achieve unprecedented growth.
                </p>
                
                <div class="flex flex-col sm:flex-row gap-4 justify-center mb-12">
                    <button class="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-lg font-semibold text-lg transition-all duration-300 transform hover:scale-105 shadow-xl">
                        Get Started Free
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                        </svg>
                    </button>
                    
                    <button class="flex items-center justify-center gap-2 px-8 py-4 bg-white bg-opacity-10 backdrop-blur-sm hover:bg-opacity-20 rounded-lg font-semibold text-lg transition-all duration-300 border border-white border-opacity-20">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                        Watch Demo
                    </button>
                </div>
                
                <div class="flex items-center justify-center gap-8 text-sm">
                    <div class="flex items-center gap-2">
                        <div class="flex">
                            <span class="text-yellow-400">★★★★★</span>
                        </div>
                        <span>4.9/5 from 2,000+ reviews</span>
                    </div>
                    <div class="hidden sm:block w-px h-4 bg-white bg-opacity-30"></div>
                    <span class="hidden sm:inline">Trusted by 50,000+ businesses</span>
                </div>
            </div>
        </div>
    </section>

    <!-- Features Section -->
    <section class="py-20 bg-gray-50">
        <div class="container mx-auto px-4">
            <div class="text-center mb-16 animate-slide-up">
                <h2 class="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
                    Everything You Need to Succeed
                </h2>
                <p class="text-xl text-gray-600 max-w-3xl mx-auto">
                    Powerful features designed to streamline your workflow and accelerate your business growth.
                </p>
            </div>
            
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div class="p-8 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 animate-slide-up">
                    <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white mb-6">
                        ⚡
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Lightning Fast</h3>
                    <p class="text-gray-600 leading-relaxed">Built for speed with optimized performance that scales with your business growth.</p>
                </div>
                
                <div class="p-8 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 animate-slide-up">
                    <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white mb-6">
                        🛡️
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Enterprise Security</h3>
                    <p class="text-gray-600 leading-relaxed">Bank-level security with end-to-end encryption and compliance certifications.</p>
                </div>
                
                <div class="p-8 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 animate-slide-up">
                    <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white mb-6">
                        📈
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Growth Analytics</h3>
                    <p class="text-gray-600 leading-relaxed">Real-time insights and analytics to make data-driven decisions for your business.</p>
                </div>
                
                <div class="p-8 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 animate-slide-up">
                    <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white mb-6">
                        👥
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Team Collaboration</h3>
                    <p class="text-gray-600 leading-relaxed">Seamless collaboration tools that keep your team aligned and productive.</p>
                </div>
                
                <div class="p-8 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 animate-slide-up">
                    <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white mb-6">
                        🌍
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Global Reach</h3>
                    <p class="text-gray-600 leading-relaxed">Multi-language support and global infrastructure for worldwide accessibility.</p>
                </div>
                
                <div class="p-8 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 animate-slide-up">
                    <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white mb-6">
                        🕒
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 mb-4">24/7 Support</h3>
                    <p class="text-gray-600 leading-relaxed">Round-the-clock customer support with dedicated success managers.</p>
                </div>
            </div>
        </div>
    </section>

    <!-- CTA Section -->
    <section class="py-20 bg-gradient-to-r from-blue-600 to-purple-600">
        <div class="container mx-auto px-4">
            <div class="max-w-4xl mx-auto text-center text-white">
                <h2 class="text-4xl md:text-5xl font-bold mb-6">
                    Ready to Transform Your Business?
                </h2>
                <p class="text-xl mb-8 text-blue-100">
                    Join thousands of businesses that have already made the switch and seen incredible results.
                </p>
                
                <div class="flex flex-col sm:flex-row gap-6 items-center justify-center mb-8">
                    <div class="flex items-center gap-2">
                        <span class="text-green-400">✓</span>
                        <span>No credit card required</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-green-400">✓</span>
                        <span>14-day free trial</span>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-green-400">✓</span>
                        <span>Cancel anytime</span>
                    </div>
                </div>
                
                <button class="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 hover:bg-gray-100 rounded-lg font-semibold text-lg transition-all duration-300 transform hover:scale-105 shadow-xl">
                    Start Your Free Trial
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
                    </svg>
                </button>
            </div>
        </div>
    </section>

    <script>
        // Add smooth scrolling and interactions
        document.addEventListener('DOMContentLoaded', function() {
            // Animate elements on scroll
            const observerOptions = {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px'
            };
            
            const observer = new IntersectionObserver(function(entries) {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }
                });
            }, observerOptions);
            
            document.querySelectorAll('.animate-slide-up').forEach(el => {
                el.style.opacity = '0';
                el.style.transform = 'translateY(30px)';
                el.style.transition = 'opacity 0.8s ease-out, transform 0.8s ease-out';
                observer.observe(el);
            });
        });
    </script>
</body>
</html>`
    });
  }

  return files;
};

const generateSaasLandingPage = (frameworkId: string, projectName: string): TemplateFile[] => {
  const files: TemplateFile[] = [];

  if (frameworkId === 'react-vite-tailwind') {
    files.push({
      path: 'src/components/SaasHero.tsx',
      type: 'file',
      content: `import React from 'react';
import { ArrowRight, Play, CheckCircle } from 'lucide-react';

const SaasHero: React.FC = () => {
  return (
    <section className="relative bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="relative z-10 pb-8 bg-white sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
          <svg
            className="hidden lg:block absolute right-0 inset-y-0 h-full w-48 text-white transform translate-x-1/2"
            fill="currentColor"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <polygon points="50,0 100,0 50,100 0,100" />
          </svg>

          <div className="relative pt-6 px-4 sm:px-6 lg:px-8">
            <nav className="relative flex items-center justify-between sm:h-10 lg:justify-start" aria-label="Global">
              <div className="flex items-center flex-grow flex-shrink-0 lg:flex-grow-0">
                <div className="flex items-center justify-between w-full md:w-auto">
                  <div className="text-2xl font-bold text-gray-900">{projectName}</div>
                </div>
              </div>
              <div className="hidden md:block md:ml-10 md:pr-4 md:space-x-8">
                <a href="#features" className="font-medium text-gray-500 hover:text-gray-900">Features</a>
                <a href="#pricing" className="font-medium text-gray-500 hover:text-gray-900">Pricing</a>
                <a href="#" className="font-medium text-indigo-600 hover:text-indigo-500">Log in</a>
              </div>
            </nav>
          </div>

          <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
            <div className="sm:text-center lg:text-left">
              <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
                <span className="block xl:inline">Scale your business with</span>{' '}
                <span className="block text-indigo-600 xl:inline">smart automation</span>
              </h1>
              <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                Streamline operations, boost productivity, and grow revenue with our powerful SaaS platform. 
                Join thousands of businesses that trust us to scale their operations.
              </p>
              <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
                <div className="rounded-md shadow">
                  <button className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 md:py-4 md:text-lg md:px-10">
                    Start free trial
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </button>
                </div>
                <div className="mt-3 sm:mt-0 sm:ml-3">
                  <button className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 md:py-4 md:text-lg md:px-10">
                    <Play className="mr-2 w-5 h-5" />
                    Watch demo
                  </button>
                </div>
              </div>
              <div className="mt-6 flex items-center text-sm text-gray-500">
                <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                <span>14-day free trial</span>
                <CheckCircle className="w-4 h-4 text-green-500 ml-4 mr-2" />
                <span>No credit card required</span>
              </div>
            </div>
          </main>
        </div>
      </div>
      <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
        <div className="h-56 w-full bg-gradient-to-br from-indigo-500 to-purple-600 sm:h-72 md:h-96 lg:w-full lg:h-full flex items-center justify-center">
          <div className="text-white text-center">
            <div className="text-6xl mb-4">📊</div>
            <p className="text-xl">Beautiful Dashboard Preview</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SaasHero;`
    });

    // Update App.tsx for SaaS template
    files.push({
      path: 'src/App.tsx',
      type: 'file',
      overwrite: true,
      content: `import React from 'react';
import SaasHero from './components/SaasHero';
import './App.css';

function App() {
  return (
    <div className="min-h-screen">
      <SaasHero />
    </div>
  );
}

export default App;`
    });
  }

  return files;
};

export const landingPageTemplates: ApplicationTemplate[] = [
  {
    id: 'marketing-landing',
    name: 'Marketing Landing Page',
    description: 'High-converting marketing landing page with hero, features, and CTA sections',
    icon: '🎯',
    category: 'landing',
    tags: ['marketing', 'conversion', 'business', 'cta'],
    difficulty: 'beginner',
    estimatedTime: '5 minutes',
    features: [
      'Hero section with compelling headline',
      'Feature showcase grid',
      'Call-to-action sections',
      'Responsive design',
      'Modern gradients and animations'
    ],
    frameworks: ['react-vite-tailwind', 'vanilla-tailwind'],
    generateFiles: generateMarketingLandingPage
  },
  {
    id: 'saas-landing',
    name: 'SaaS Product Landing',
    description: 'Professional SaaS landing page with navigation, hero, and product showcase',
    icon: '🚀',
    category: 'landing',
    tags: ['saas', 'product', 'business', 'professional'],
    difficulty: 'beginner',
    estimatedTime: '7 minutes',
    features: [
      'Professional navigation',
      'Product-focused hero section',
      'Feature highlights',
      'Pricing integration ready',
      'Clean, modern design'
    ],
    frameworks: ['react-vite-tailwind'],
    generateFiles: generateSaasLandingPage
  }
]; 