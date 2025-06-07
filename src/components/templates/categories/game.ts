import { ApplicationTemplate } from '../index';

export const gameTemplates: ApplicationTemplate[] = [
  {
    id: 'puzzle-game',
    name: 'Puzzle Game',
    description: 'Interactive puzzle game with scoring and levels',
    icon: '🧩',
    category: 'game',
    tags: ['game', 'puzzle', 'interactive', 'entertainment'],
    difficulty: 'advanced',
    estimatedTime: '20 minutes',
    features: [
      'Game logic',
      'Score tracking',
      'Level progression',
      'Animations',
      'Sound effects ready'
    ],
    frameworks: ['react-vite-tailwind', 'vanilla-tailwind'],
    generateFiles: () => []
  },
  {
    id: 'memory-game',
    name: 'Memory Card Game',
    description: 'Classic memory matching game with multiple difficulty levels',
    icon: '🎮',
    category: 'game',
    tags: ['memory', 'cards', 'matching', 'brain-training'],
    difficulty: 'intermediate',
    estimatedTime: '15 minutes',
    features: [
      'Card matching logic',
      'Timer functionality',
      'Difficulty levels',
      'High scores',
      'Responsive design'
    ],
    frameworks: ['react-vite-tailwind', 'vanilla-tailwind'],
    generateFiles: () => []
  }
]; 