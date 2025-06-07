import { ApplicationTemplate } from '../index';

export const blogTemplates: ApplicationTemplate[] = [
  {
    id: 'personal-blog',
    name: 'Personal Blog',
    description: 'Clean and modern blog design for personal content',
    icon: '📝',
    category: 'blog',
    tags: ['blog', 'content', 'writing', 'personal'],
    difficulty: 'beginner',
    estimatedTime: '8 minutes',
    features: [
      'Article layouts',
      'Tag system',
      'Search functionality',
      'Comments section',
      'Social sharing'
    ],
    frameworks: ['react-vite-tailwind', 'vanilla-tailwind'],
    generateFiles: () => []
  }
]; 