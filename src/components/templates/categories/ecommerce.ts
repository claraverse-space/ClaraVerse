import { ApplicationTemplate } from '../index';

export const ecommerceTemplates: ApplicationTemplate[] = [
  {
    id: 'online-store',
    name: 'Online Store',
    description: 'Complete e-commerce store with product catalog and shopping cart',
    icon: '🛒',
    category: 'ecommerce',
    tags: ['store', 'shopping', 'products', 'cart'],
    difficulty: 'advanced',
    estimatedTime: '15 minutes',
    features: [
      'Product catalog',
      'Shopping cart',
      'Product filters',
      'Responsive design',
      'Payment integration ready'
    ],
    frameworks: ['react-vite-tailwind'],
    generateFiles: () => []
  }
]; 