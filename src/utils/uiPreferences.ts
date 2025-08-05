import { PersonalInfo } from '../db';

// Default UI preferences
export const DEFAULT_UI_PREFERENCES = {
  font_scale: 1.0,
  accent_color: '#ec4899', // Default sakura-500
  font_family: 'system-ui', // Default system font
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

// Common system fonts that are widely available
export const SYSTEM_FONTS = [
  { value: 'system-ui', label: 'System Default', description: 'Your system\'s default font' },
  { value: 'Inter, system-ui, sans-serif', label: 'Inter', description: 'Modern sans-serif' },
  { value: 'Roboto, system-ui, sans-serif', label: 'Roboto', description: 'Google\'s Roboto font' },
  { value: 'Segoe UI, system-ui, sans-serif', label: 'Segoe UI', description: 'Windows system font' },
  { value: 'San Francisco, system-ui, sans-serif', label: 'San Francisco', description: 'Apple system font' },
  { value: 'Arial, sans-serif', label: 'Arial', description: 'Classic sans-serif' },
  { value: 'Helvetica, Arial, sans-serif', label: 'Helvetica', description: 'Clean sans-serif' },
  { value: 'Georgia, serif', label: 'Georgia', description: 'Readable serif font' },
  { value: 'Times New Roman, serif', label: 'Times New Roman', description: 'Traditional serif' },
  { value: 'Courier New, monospace', label: 'Courier New', description: 'Monospace font' },
  { value: 'Monaco, Consolas, monospace', label: 'Monaco', description: 'Code editor font' },
];

// Detect available system fonts
export async function detectSystemFonts(): Promise<{ value: string; label: string; description: string }[]> {
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
