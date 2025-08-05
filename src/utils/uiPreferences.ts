import { PersonalInfo } from '../db';

// Default UI preferences
export const DEFAULT_UI_PREFERENCES = {
  font_scale: 1.0,
  accent_color: '#ec4899', // Default sakura-500
  font_family: 'system-ui', // Default system font
  font_weight: 'normal' as 'light' | 'normal' | 'medium' | 'semibold',
  line_height: 'normal' as 'tight' | 'normal' | 'relaxed' | 'loose',
  letter_spacing: 'normal' as 'tight' | 'normal' | 'wide',
  // Extended theming options
  background_style: 'default' as 'default' | 'warm' | 'cool' | 'minimal' | 'cozy',
  interface_density: 'normal' as 'compact' | 'normal' | 'comfortable',
  border_radius: 'normal' as 'sharp' | 'normal' | 'rounded' | 'soft',
  glassmorphism_strength: 'medium' as 'none' | 'subtle' | 'medium' | 'strong',
};

// Font scale options
export const FONT_SCALE_OPTIONS = [
  { value: 0.75, label: 'Small (75%)', description: 'Compact text for more content' },
  { value: 0.85, label: 'Small+ (85%)', description: 'Slightly smaller text' },
  { value: 1.0, label: 'Normal (100%)', description: 'Default font size' },
  { value: 1.15, label: 'Large (115%)', description: 'Slightly larger text' },
  { value: 1.3, label: 'Large+ (130%)', description: 'Larger text for better readability' },
  { value: 1.5, label: 'Extra Large (150%)', description: 'Maximum font size' },
];

// Font weight options
export const FONT_WEIGHT_OPTIONS = [
  { value: 'light', label: 'Light (300)', description: 'Thin, elegant text' },
  { value: 'normal', label: 'Normal (400)', description: 'Standard weight' },
  { value: 'medium', label: 'Medium (500)', description: 'Slightly bold' },
  { value: 'semibold', label: 'Semibold (600)', description: 'Bold and clear' },
];

// Line height options
export const LINE_HEIGHT_OPTIONS = [
  { value: 'tight', label: 'Tight (1.25)', description: 'Compact line spacing' },
  { value: 'normal', label: 'Normal (1.5)', description: 'Standard line spacing' },
  { value: 'relaxed', label: 'Relaxed (1.75)', description: 'Comfortable reading' },
  { value: 'loose', label: 'Loose (2.0)', description: 'Maximum readability' },
];

// Letter spacing options
export const LETTER_SPACING_OPTIONS = [
  { value: 'tight', label: 'Tight (-0.025em)', description: 'Condensed characters' },
  { value: 'normal', label: 'Normal (0)', description: 'Standard spacing' },
  { value: 'wide', label: 'Wide (0.025em)', description: 'Expanded characters' },
];

// Popular accent color options
export const ACCENT_COLOR_OPTIONS = [
  { value: '#ec4899', label: 'Sakura Pink', description: 'Classic Clara pink' },
  { value: '#3b82f6', label: 'Blue', description: 'Professional blue' },
  { value: '#8b5cf6', label: 'Purple', description: 'Royal purple' },
  { value: '#06b6d4', label: 'Cyan', description: 'Ocean cyan' },
  { value: '#10b981', label: 'Green', description: 'Nature green' },
  { value: '#f59e0b', label: 'Amber', description: 'Warm amber' },
  { value: '#ef4444', label: 'Red', description: 'Vibrant red' },
  { value: '#84cc16', label: 'Lime', description: 'Fresh lime' },
];

// Convert hex to RGB values for CSS custom properties
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// Generate color shades from base color
export function generateColorShades(hexColor: string) {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return null;

  const { r, g, b } = rgb;

  // Generate lighter and darker shades
  const shades = {
    50: lighten(r, g, b, 0.95),
    100: lighten(r, g, b, 0.85),
    200: lighten(r, g, b, 0.7),
    300: lighten(r, g, b, 0.5),
    400: lighten(r, g, b, 0.3),
    500: `${r} ${g} ${b}`, // Base color
    600: darken(r, g, b, 0.1),
    700: darken(r, g, b, 0.25),
    800: darken(r, g, b, 0.4),
    900: darken(r, g, b, 0.55),
  };

  return shades;
}

function lighten(r: number, g: number, b: number, factor: number): string {
  const newR = Math.round(r + (255 - r) * factor);
  const newG = Math.round(g + (255 - g) * factor);
  const newB = Math.round(b + (255 - b) * factor);
  return `${newR} ${newG} ${newB}`;
}

function darken(r: number, g: number, b: number, factor: number): string {
  const newR = Math.round(r * (1 - factor));
  const newG = Math.round(g * (1 - factor));
  const newB = Math.round(b * (1 - factor));
  return `${newR} ${newG} ${newB}`;
}

// AI-Inspired fonts commonly used by popular AI interfaces
export const SYSTEM_FONTS = [
  // Popular AI Interface Fonts
  { value: 'system-ui', label: 'System Default', description: 'Your system\'s default font', category: 'System' },
  { value: '"Söhne", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif', label: 'Söhne', description: 'ChatGPT\'s signature font family', category: 'AI Interface' },
  { value: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', label: 'Inter', description: 'Modern, clean interface font', category: 'AI Interface' },
  { value: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif', label: 'SF Pro Display', description: 'Apple\'s premium display font', category: 'AI Interface' },
  { value: '"Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif', label: 'Segoe UI', description: 'Microsoft\'s modern system font', category: 'AI Interface' },
  { value: '"Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', label: 'Roboto', description: 'Google\'s Material Design font', category: 'AI Interface' },
  
  // Professional & Modern Fonts
  { value: '"Helvetica Neue", Helvetica, Arial, sans-serif', label: 'Helvetica Neue', description: 'Classic modern sans-serif', category: 'Professional' },
  { value: '"Open Sans", -apple-system, BlinkMacSystemFont, sans-serif', label: 'Open Sans', description: 'Friendly and open character', category: 'Professional' },
  { value: '"Lato", -apple-system, BlinkMacSystemFont, sans-serif', label: 'Lato', description: 'Humanist sans-serif', category: 'Professional' },
  { value: '"Source Sans Pro", -apple-system, BlinkMacSystemFont, sans-serif', label: 'Source Sans Pro', description: 'Adobe\'s clean sans-serif', category: 'Professional' },
  { value: '"Nunito", -apple-system, BlinkMacSystemFont, sans-serif', label: 'Nunito', description: 'Rounded, friendly appearance', category: 'Professional' },
  
  // Reading & Content Fonts
  { value: '"Charter", "Bitstream Charter", "Sitka Text", Cambria, serif', label: 'Charter', description: 'Optimized for reading', category: 'Reading' },
  { value: '"Georgia", "Times New Roman", Times, serif', label: 'Georgia', description: 'Screen-optimized serif', category: 'Reading' },
  { value: '"Crimson Text", Georgia, serif', label: 'Crimson Text', description: 'Book-style serif font', category: 'Reading' },
  { value: '"Merriweather", Georgia, serif', label: 'Merriweather', description: 'Designed for readability', category: 'Reading' },
  
  // Monospace & Code Fonts
  { value: '"SF Mono", Monaco, Inconsolata, "Roboto Mono", monospace', label: 'SF Mono', description: 'Apple\'s monospace font', category: 'Code' },
  { value: '"Fira Code", "SF Mono", Monaco, Consolas, monospace', label: 'Fira Code', description: 'Programming font with ligatures', category: 'Code' },
  { value: '"JetBrains Mono", "SF Mono", Monaco, Consolas, monospace', label: 'JetBrains Mono', description: 'Developer-focused monospace', category: 'Code' },
  { value: '"Source Code Pro", Monaco, Consolas, monospace', label: 'Source Code Pro', description: 'Adobe\'s monospace font', category: 'Code' },
  { value: '"Consolas", "SF Mono", Monaco, monospace', label: 'Consolas', description: 'Microsoft\'s ClearType font', category: 'Code' },
  
  // Classic & Fallback Fonts
  { value: 'Arial, sans-serif', label: 'Arial', description: 'Universal sans-serif', category: 'Classic' },
  { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica', description: 'Timeless Swiss design', category: 'Classic' },
  { value: '"Times New Roman", Times, serif', label: 'Times New Roman', description: 'Traditional serif', category: 'Classic' },
  { value: 'Courier, "Courier New", monospace', label: 'Courier', description: 'Typewriter-style font', category: 'Classic' },
];

// Comprehensive visual presets inspired by popular AI interfaces
export const FONT_PRESETS = [
  {
    id: 'chatgpt',
    name: 'ChatGPT Style',
    description: 'Clean and modern like OpenAI\'s ChatGPT',
    icon: '🤖',
    settings: {
      font_family: '"Söhne", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, sans-serif',
      font_scale: 1.0,
      line_height: 'relaxed' as const,
      letter_spacing: 'normal' as const,
      font_weight: 'normal' as const,
      accent_color: '#10a37f', // ChatGPT's signature green
      background_style: 'default' as const,
      interface_density: 'normal' as const,
      border_radius: 'normal' as const,
      glassmorphism_strength: 'subtle' as const
    }
  },
  {
    id: 'claude',
    name: 'Claude Style', 
    description: 'Elegant and readable like Anthropic\'s Claude',
    icon: '🎭',
    settings: {
      font_family: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      font_scale: 1.0,
      line_height: 'relaxed' as const,
      letter_spacing: 'normal' as const,
      font_weight: 'normal' as const,
      accent_color: '#cc785c', // Claude's warm orange-brown
      background_style: 'warm' as const,
      interface_density: 'comfortable' as const,
      border_radius: 'rounded' as const,
      glassmorphism_strength: 'medium' as const
    }
  },
  {
    id: 'gemini',
    name: 'Gemini Style',
    description: 'Google\'s clean and professional look',
    icon: '💎',
    settings: {
      font_family: '"Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      font_scale: 1.0,
      line_height: 'normal' as const,
      letter_spacing: 'normal' as const,
      font_weight: 'normal' as const,
      accent_color: '#4285f4', // Google Blue
      background_style: 'cool' as const,
      interface_density: 'normal' as const,
      border_radius: 'normal' as const,
      glassmorphism_strength: 'subtle' as const
    }
  },
  {
    id: 'copilot',
    name: 'GitHub Copilot Style',
    description: 'Developer-friendly interface',
    icon: '🧑‍💻',
    settings: {
      font_family: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
      font_scale: 0.95,
      line_height: 'normal' as const,
      letter_spacing: 'normal' as const,
      font_weight: 'medium' as const,
      accent_color: '#7c3aed', // GitHub Copilot Purple
      background_style: 'minimal' as const,
      interface_density: 'compact' as const,
      border_radius: 'sharp' as const,
      glassmorphism_strength: 'none' as const
    }
  },
  {
    id: 'notion',
    name: 'Notion Style',
    description: 'Clean workspace aesthetic',
    icon: '📝',
    settings: {
      font_family: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      font_scale: 1.0,
      line_height: 'relaxed' as const,
      letter_spacing: 'normal' as const,
      font_weight: 'normal' as const,
      accent_color: '#2f1b69', // Notion's dark purple
      background_style: 'minimal' as const,
      interface_density: 'comfortable' as const,
      border_radius: 'normal' as const,
      glassmorphism_strength: 'subtle' as const
    }
  },
  {
    id: 'perplexity',
    name: 'Perplexity Style',
    description: 'Search-focused AI interface',
    icon: '🔍',
    settings: {
      font_family: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      font_scale: 0.95,
      line_height: 'normal' as const,
      letter_spacing: 'normal' as const,
      font_weight: 'medium' as const,
      accent_color: '#0ea5e9', // Perplexity's sky blue
      background_style: 'cool' as const,
      interface_density: 'compact' as const,
      border_radius: 'rounded' as const,
      glassmorphism_strength: 'medium' as const
    }
  },
  {
    id: 'readwise',
    name: 'Reading Optimized',
    description: 'Perfect for long conversations',
    icon: '📚',
    settings: {
      font_family: '"Charter", "Bitstream Charter", "Sitka Text", Cambria, serif',
      font_scale: 1.1,
      line_height: 'loose' as const,
      letter_spacing: 'normal' as const,
      font_weight: 'normal' as const,
      accent_color: '#f59e0b', // Warm amber for reading comfort
      background_style: 'cozy' as const,
      interface_density: 'comfortable' as const,
      border_radius: 'soft' as const,
      glassmorphism_strength: 'strong' as const
    }
  },
  {
    id: 'minimal',
    name: 'Minimal Clean',
    description: 'Ultra-clean minimalist style',
    icon: '⚪',
    settings: {
      font_family: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      font_scale: 0.95,
      line_height: 'tight' as const,
      letter_spacing: 'tight' as const,
      font_weight: 'light' as const,
      accent_color: '#6b7280', // Minimal gray
      background_style: 'minimal' as const,
      interface_density: 'compact' as const,
      border_radius: 'sharp' as const,
      glassmorphism_strength: 'none' as const
    }
  },
  {
    id: 'accessibility',
    name: 'High Readability',
    description: 'Optimized for accessibility',
    icon: '♿',
    settings: {
      font_family: '"Open Sans", -apple-system, BlinkMacSystemFont, sans-serif',
      font_scale: 1.2,
      line_height: 'loose' as const,
      letter_spacing: 'wide' as const,
      font_weight: 'medium' as const,
      accent_color: '#059669', // High contrast green
      background_style: 'default' as const,
      interface_density: 'comfortable' as const,
      border_radius: 'rounded' as const,
      glassmorphism_strength: 'subtle' as const
    }
  },
  {
    id: 'discord',
    name: 'Discord Style',
    description: 'Gaming and community focused',
    icon: '🎮',
    settings: {
      font_family: '"Whitney", "Helvetica Neue", Helvetica, Arial, sans-serif',
      font_scale: 1.0,
      line_height: 'normal' as const,
      letter_spacing: 'normal' as const,
      font_weight: 'medium' as const,
      accent_color: '#5865f2', // Discord Blurple
      background_style: 'cool' as const,
      interface_density: 'normal' as const,
      border_radius: 'rounded' as const,
      glassmorphism_strength: 'medium' as const
    }
  },
  {
    id: 'linear',
    name: 'Linear Style',
    description: 'Clean and efficient design',
    icon: '📐',
    settings: {
      font_family: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
      font_scale: 0.95,
      line_height: 'tight' as const,
      letter_spacing: 'tight' as const,
      font_weight: 'medium' as const,
      accent_color: '#6366f1', // Linear's indigo
      background_style: 'minimal' as const,
      interface_density: 'compact' as const,
      border_radius: 'normal' as const,
      glassmorphism_strength: 'subtle' as const
    }
  },
  {
    id: 'apple',
    name: 'Apple Style',
    description: 'Premium and polished interface',
    icon: '🍎',
    settings: {
      font_family: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
      font_scale: 1.0,
      line_height: 'normal' as const,
      letter_spacing: 'normal' as const,
      font_weight: 'normal' as const,
      accent_color: '#007aff', // Apple Blue
      background_style: 'default' as const,
      interface_density: 'normal' as const,
      border_radius: 'soft' as const,
      glassmorphism_strength: 'strong' as const
    }
  }
];

// Detect available system fonts
export async function detectSystemFonts(): Promise<{ value: string; label: string; description: string; category: string }[]> {
  const fonts = [...SYSTEM_FONTS];
  
  // Test for additional popular fonts
  const testFonts = [
    { family: 'Open Sans', description: 'Popular web font' },
    { family: 'Lato', description: 'Humanist sans-serif' },
    { family: 'Montserrat', description: 'Geometric sans-serif' },
    { family: 'Source Sans Pro', description: 'Adobe\'s sans-serif' },
    { family: 'Poppins', description: 'Modern geometric font' },
    { family: 'Nunito', description: 'Rounded sans-serif' },
    { family: 'Raleway', description: 'Elegant display font' },
  ];

  // Check font availability using font loading API
  if ('fonts' in document) {
    for (const testFont of testFonts) {
      try {
        const available = await document.fonts.check(`12px "${testFont.family}"`);
        if (available) {
          fonts.push({
            value: `${testFont.family}, system-ui, sans-serif`,
            label: testFont.family,
            description: testFont.description,
            category: 'Web Fonts'
          });
        }
      } catch (error) {
        // Font check failed, skip this font
        console.debug(`Font check failed for ${testFont.family}:`, error);
      }
    }
  }

  return fonts;
}

// Apply UI preferences to the document
export function applyUIPreferences(personalInfo: PersonalInfo | null) {
  const uiPrefs = personalInfo?.ui_preferences || DEFAULT_UI_PREFERENCES;
  const root = document.documentElement;

  // Apply font scaling
  root.style.setProperty('--font-scale', uiPrefs.font_scale.toString());

  // Apply font family
  root.style.setProperty('--font-family', uiPrefs.font_family || DEFAULT_UI_PREFERENCES.font_family);

  // Apply accent color
  const colorShades = generateColorShades(uiPrefs.accent_color);
  if (colorShades) {
    // Set sakura color variables to the chosen accent color
    Object.entries(colorShades).forEach(([shade, rgb]) => {
      root.style.setProperty(`--sakura-${shade}`, rgb);
    });
  }
}

// Initialize UI preferences on app start
export function initializeUIPreferences() {
  // Set up CSS custom properties for font scaling
  const style = document.createElement('style');
  style.textContent = `
    :root {
      --font-scale: 1;
      --base-font-size: 1rem;
      --scaled-font-size: calc(var(--base-font-size) * var(--font-scale));
    }
    
    /* Apply font scaling to all text elements */
    body {
      font-size: var(--scaled-font-size);
    }
    
    /* Scale specific text sizes proportionally */
    .text-xs { font-size: calc(0.75rem * var(--font-scale)); }
    .text-sm { font-size: calc(0.875rem * var(--font-scale)); }
    .text-base { font-size: calc(1rem * var(--font-scale)); }
    .text-lg { font-size: calc(1.125rem * var(--font-scale)); }
    .text-xl { font-size: calc(1.25rem * var(--font-scale)); }
    .text-2xl { font-size: calc(1.5rem * var(--font-scale)); }
    .text-3xl { font-size: calc(1.875rem * var(--font-scale)); }
    .text-4xl { font-size: calc(2.25rem * var(--font-scale)); }
    .text-5xl { font-size: calc(3rem * var(--font-scale)); }
    
    /* Update Tailwind color classes to use custom properties */
    .text-sakura-500 { color: rgb(var(--sakura-500) / var(--tw-text-opacity, 1)); }
    .bg-sakura-500 { background-color: rgb(var(--sakura-500) / var(--tw-bg-opacity, 1)); }
    .border-sakura-500 { border-color: rgb(var(--sakura-500) / var(--tw-border-opacity, 1)); }
    .text-sakura-400 { color: rgb(var(--sakura-400) / var(--tw-text-opacity, 1)); }
    .bg-sakura-400 { background-color: rgb(var(--sakura-400) / var(--tw-bg-opacity, 1)); }
    .border-sakura-400 { border-color: rgb(var(--sakura-400) / var(--tw-border-opacity, 1)); }
    .text-sakura-600 { color: rgb(var(--sakura-600) / var(--tw-text-opacity, 1)); }
    .bg-sakura-600 { background-color: rgb(var(--sakura-600) / var(--tw-bg-opacity, 1)); }
    .border-sakura-600 { border-color: rgb(var(--sakura-600) / var(--tw-border-opacity, 1)); }
    .text-sakura-300 { color: rgb(var(--sakura-300) / var(--tw-text-opacity, 1)); }
    .bg-sakura-300 { background-color: rgb(var(--sakura-300) / var(--tw-bg-opacity, 1)); }
    .border-sakura-300 { border-color: rgb(var(--sakura-300) / var(--tw-border-opacity, 1)); }
    .text-sakura-700 { color: rgb(var(--sakura-700) / var(--tw-text-opacity, 1)); }
    .bg-sakura-700 { background-color: rgb(var(--sakura-700) / var(--tw-bg-opacity, 1)); }
    .border-sakura-700 { border-color: rgb(var(--sakura-700) / var(--tw-border-opacity, 1)); }
    .text-sakura-100 { color: rgb(var(--sakura-100) / var(--tw-text-opacity, 1)); }
    .bg-sakura-100 { background-color: rgb(var(--sakura-100) / var(--tw-bg-opacity, 1)); }
    .border-sakura-100 { border-color: rgb(var(--sakura-100) / var(--tw-border-opacity, 1)); }
    .text-sakura-50 { color: rgb(var(--sakura-50) / var(--tw-text-opacity, 1)); }
    .bg-sakura-50 { background-color: rgb(var(--sakura-50) / var(--tw-bg-opacity, 1)); }
    .border-sakura-50 { border-color: rgb(var(--sakura-50) / var(--tw-border-opacity, 1)); }
    .text-sakura-800 { color: rgb(var(--sakura-800) / var(--tw-text-opacity, 1)); }
    .bg-sakura-800 { background-color: rgb(var(--sakura-800) / var(--tw-bg-opacity, 1)); }
    .border-sakura-800 { border-color: rgb(var(--sakura-800) / var(--tw-border-opacity, 1)); }
    .text-sakura-900 { color: rgb(var(--sakura-900) / var(--tw-text-opacity, 1)); }
    .bg-sakura-900 { background-color: rgb(var(--sakura-900) / var(--tw-bg-opacity, 1)); }
    .border-sakura-900 { border-color: rgb(var(--sakura-900) / var(--tw-border-opacity, 1)); }
    .text-sakura-200 { color: rgb(var(--sakura-200) / var(--tw-text-opacity, 1)); }
    .bg-sakura-200 { background-color: rgb(var(--sakura-200) / var(--tw-bg-opacity, 1)); }
    .border-sakura-200 { border-color: rgb(var(--sakura-200) / var(--tw-border-opacity, 1)); }
    
    /* Hover and focus states */
    .hover\\:bg-sakura-600:hover { background-color: rgb(var(--sakura-600) / var(--tw-bg-opacity, 1)); }
    .hover\\:bg-sakura-100:hover { background-color: rgb(var(--sakura-100) / var(--tw-bg-opacity, 1)); }
    .hover\\:border-sakura-300:hover { border-color: rgb(var(--sakura-300) / var(--tw-border-opacity, 1)); }
    .focus\\:border-sakura-300:focus { border-color: rgb(var(--sakura-300) / var(--tw-border-opacity, 1)); }
    .focus\\:ring-sakura-300:focus { --tw-ring-color: rgb(var(--sakura-300) / var(--tw-ring-opacity, 1)); }
    .focus\\:ring-sakura-500:focus { --tw-ring-color: rgb(var(--sakura-500) / var(--tw-ring-opacity, 1)); }
    
    /* Dark mode variants */
    .dark .dark\\:bg-sakura-900\\/20 { background-color: rgb(var(--sakura-900) / 0.2); }
    .dark .dark\\:text-sakura-400 { color: rgb(var(--sakura-400) / var(--tw-text-opacity, 1)); }
    .dark .dark\\:text-sakura-300 { color: rgb(var(--sakura-300) / var(--tw-text-opacity, 1)); }
    
    /* Peer states */
    .peer-checked\\:bg-sakura-500 { background-color: rgb(var(--sakura-500) / var(--tw-bg-opacity, 1)); }
    .peer-checked\\:bg-sakura-600 { background-color: rgb(var(--sakura-600) / var(--tw-bg-opacity, 1)); }
  `;
  
  document.head.appendChild(style);
}
