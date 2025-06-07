export interface ApplicationTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: string;
  preview?: string;
  features: string[];
  frameworks: string[]; // Which frameworks this template supports
  generateFiles: (frameworkId: string, projectName: string) => TemplateFile[];
}

export interface TemplateFile {
  path: string;
  content: string;
  type: 'file' | 'directory';
  overwrite?: boolean; // Whether to overwrite existing files
}

export interface TemplateCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  templates: ApplicationTemplate[];
}

// Import all template categories
import { landingPageTemplates } from './categories/landingPage';
import { productTemplates } from './categories/product';
import { gameTemplates } from './categories/game';
import { dashboardTemplates } from './categories/dashboard';
import { ecommerceTemplates } from './categories/ecommerce';
import { blogTemplates } from './categories/blog';

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  {
    id: 'landing',
    name: 'Landing Pages',
    description: 'Beautiful landing pages for marketing and conversion',
    icon: '🎯',
    templates: landingPageTemplates
  },
  {
    id: 'product',
    name: 'Product Apps',
    description: 'SaaS products and web applications',
    icon: '💼',
    templates: productTemplates
  },
  {
    id: 'dashboard',
    name: 'Dashboards',
    description: 'Admin panels and data visualization',
    icon: '📊',
    templates: dashboardTemplates
  },
  {
    id: 'ecommerce',
    name: 'E-commerce',
    description: 'Online stores and marketplace apps',
    icon: '🛒',
    templates: ecommerceTemplates
  },
  {
    id: 'blog',
    name: 'Content Sites',
    description: 'Blogs, portfolios, and content-driven sites',
    icon: '📝',
    templates: blogTemplates
  },
  {
    id: 'game',
    name: 'Games',
    description: 'Interactive games and entertainment',
    icon: '🎮',
    templates: gameTemplates
  }
];

// Flatten all templates for easy access
export const ALL_TEMPLATES: ApplicationTemplate[] = TEMPLATE_CATEGORIES.flatMap(
  category => category.templates
);

// Helper function to get template by ID
export const getTemplateById = (id: string): ApplicationTemplate | undefined => {
  return ALL_TEMPLATES.find(template => template.id === id);
};

// Helper function to get templates by category
export const getTemplatesByCategory = (categoryId: string): ApplicationTemplate[] => {
  const category = TEMPLATE_CATEGORIES.find(cat => cat.id === categoryId);
  return category ? category.templates : [];
};

// Helper function to get templates by framework support
export const getTemplatesByFramework = (frameworkId: string): ApplicationTemplate[] => {
  return ALL_TEMPLATES.filter(template => template.frameworks.includes(frameworkId));
}; 