import { ApplicationTemplate } from '../index';

export const dashboardTemplates: ApplicationTemplate[] = [
  {
    id: 'analytics-dashboard',
    name: 'Analytics Dashboard',
    description: 'Beautiful analytics dashboard with charts and metrics',
    icon: '📊',
    category: 'dashboard',
    tags: ['analytics', 'charts', 'metrics', 'admin'],
    difficulty: 'intermediate',
    estimatedTime: '12 minutes',
    features: [
      'Chart components',
      'Metric cards',
      'Data tables',
      'Responsive layout',
      'Dark mode support'
    ],
    frameworks: ['react-vite-tailwind'],
    generateFiles: () => []
  }
]; 