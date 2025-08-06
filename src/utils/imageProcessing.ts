/**
 * Image Processing Utilities for Wallpaper Effects
 * This module handles real-time image manipulation for wallpaper customization
 */

export interface ImageEffects {
  opacity?: number;          // 0.0 - 1.0
  blur?: number;            // 0 - 10px
  brightness?: number;      // 0.0 - 2.0 (1.0 = normal)
  contrast?: number;        // 0.0 - 2.0 (1.0 = normal) 
  saturate?: number;        // 0.0 - 2.0 (1.0 = normal)
}

export interface WallpaperConfig {
  imageUrl: string;
  effects: ImageEffects;
  position?: string;
  size?: string;
}

/**
 * Creates a canvas element for image processing
 */
function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

/**
 * Loads an image from URL or data URI
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Enable CORS for external images
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Applies visual effects to an image using canvas filters
 */
export async function applyImageEffects(
  imageUrl: string, 
  effects: ImageEffects
): Promise<string> {
  try {
    const img = await loadImage(imageUrl);
    
    // Create canvas with the original image dimensions
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Build CSS filter string from effects
    const filters: string[] = [];
    
    if (effects.blur !== undefined && effects.blur > 0) {
      filters.push(`blur(${effects.blur}px)`);
    }
    
    if (effects.brightness !== undefined && effects.brightness !== 1) {
      filters.push(`brightness(${effects.brightness})`);
    }
    
    if (effects.contrast !== undefined && effects.contrast !== 1) {
      filters.push(`contrast(${effects.contrast})`);
    }
    
    if (effects.saturate !== undefined && effects.saturate !== 1) {
      filters.push(`saturate(${effects.saturate})`);
    }

    // Apply filters to canvas context
    ctx.filter = filters.length > 0 ? filters.join(' ') : 'none';
    
    // Handle opacity by setting global alpha
    if (effects.opacity !== undefined) {
      ctx.globalAlpha = effects.opacity;
    }
    
    // Draw the image with applied filters
    ctx.drawImage(img, 0, 0);
    
    // Convert canvas to data URL
    return canvas.toDataURL('image/png', 0.9);
    
  } catch (error) {
    console.error('Error applying image effects:', error);
    // Return original image URL if processing fails
    return imageUrl;
  }
}

/**
 * Creates a gradient wallpaper as data URL
 */
export function createGradientWallpaper(
  gradientCSS: string, 
  width: number = 1920, 
  height: number = 1080
): string {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not get canvas context for gradient');
  }

  // Parse gradient CSS and create canvas gradient
  // For now, we'll create a simple linear gradient
  // This can be enhanced to parse complex CSS gradients
  
  if (gradientCSS.includes('linear-gradient')) {
    // Extract colors from gradient CSS (simplified parsing)
    const colorMatches = gradientCSS.match(/#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}|rgb\([^)]+\)|rgba\([^)]+\)/g);
    
    if (colorMatches && colorMatches.length >= 2) {
      // Create linear gradient
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      
      // Add color stops
      colorMatches.forEach((color, index) => {
        const stop = index / (colorMatches.length - 1);
        gradient.addColorStop(stop, color);
      });
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    // Fallback to solid color
    ctx.fillStyle = gradientCSS;
    ctx.fillRect(0, 0, width, height);
  }
  
  return canvas.toDataURL('image/png', 0.9);
}

/**
 * Fetches a high-quality wallpaper image from multiple sources with fallbacks
 */
export async function fetchWallpaperImage(
  query: string = 'abstract',
  width: number = 1920,
  height: number = 1080
): Promise<string> {
  
  // Multiple image sources with fallbacks
  const imageSources = [
    // Unsplash Source API (original)
    `https://source.unsplash.com/${width}x${height}/?${encodeURIComponent(query)}`,
    
    // Pexels API - High quality stock photos with search
    () => fetchFromPexelsAPI(query, width, height),
    
    // Unsplash with different format
    `https://images.unsplash.com/photo-1501594907352-04cda38ebc29?ixlib=rb-4.0.3&auto=format&fit=crop&w=${width}&h=${height}&q=80`,
    
    // Alternative Unsplash endpoint
    `https://source.unsplash.com/featured/${width}x${height}/?${encodeURIComponent(query)}`,
    
    // Gradient fallback (generated locally)
    'gradient-fallback'
  ];

  for (let i = 0; i < imageSources.length; i++) {
    const source = imageSources[i];
    
    try {
      console.log(`Attempting to fetch from source ${i + 1}:`, typeof source === 'function' ? 'Pexels API' : source);
      
      // Special handling for gradient fallback
      if (source === 'gradient-fallback') {
        console.log('Using gradient fallback');
        return createGradientWallpaper(
          `linear-gradient(135deg, ${getRandomColor()}, ${getRandomColor()})`,
          width,
          height
        );
      }
      
      // Handle Pexels API function
      if (typeof source === 'function') {
        const imageUrl = await source();
        if (imageUrl) {
          console.log(`Successfully loaded from Pexels API`);
          return imageUrl;
        }
        throw new Error('Pexels API returned no image');
      }
      
      // Try to fetch the image from URL
      const imageUrl = await fetchImageFromUrl(source, width, height);
      console.log(`Successfully loaded from source ${i + 1}`);
      return imageUrl;
      
    } catch (error) {
      console.warn(`Source ${i + 1} failed:`, error);
      
      // If this is the last source, throw the error
      if (i === imageSources.length - 1) {
        throw new Error('All image sources failed');
      }
      
      // Continue to next source
      continue;
    }
  }
  
  // This should never be reached due to gradient fallback
  throw new Error('All image sources failed including fallback');
}

/**
 * Helper function to fetch image from a URL
 */
async function fetchImageFromUrl(
  url: string, 
  width: number, 
  height: number,
  timeout: number = 10000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    // Set timeout
    const timeoutId = setTimeout(() => {
      reject(new Error(`Image loading timeout after ${timeout}ms`));
    }, timeout);
    
    img.onload = () => {
      clearTimeout(timeoutId);
      
      try {
        // Convert to data URL to avoid CORS issues
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          // Draw image to fit canvas dimensions
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        } else {
          reject(new Error('Canvas context error'));
        }
      } catch (canvasError) {
        reject(new Error(`Canvas processing error: ${canvasError}`));
      }
    };
    
    img.onerror = () => {
      clearTimeout(timeoutId);
      reject(new Error(`Failed to load image from: ${url}`));
    };
    
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}

/**
 * Generate random hex colors for gradient fallbacks
 */
function getRandomColor(): string {
  const colors = [
    '#667eea', '#764ba2', '#f093fb', '#f5576c',
    '#4facfe', '#00f2fe', '#43e97b', '#38f9d7',
    '#ffecd2', '#fcb69f', '#a8edea', '#fed6e3',
    '#ff9a9e', '#fecfef', '#ffeac5', '#d299c2'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Resizes an image to fit specified dimensions while maintaining aspect ratio
 */
export async function resizeImage(
  imageUrl: string,
  maxWidth: number,
  maxHeight: number,
  mode: 'cover' | 'contain' | 'stretch' = 'cover'
): Promise<string> {
  try {
    const img = await loadImage(imageUrl);
    
    let { width, height } = img;
    let destWidth = maxWidth;
    let destHeight = maxHeight;
    
    if (mode === 'contain') {
      // Scale to fit within bounds, maintaining aspect ratio
      const scale = Math.min(maxWidth / width, maxHeight / height);
      destWidth = width * scale;
      destHeight = height * scale;
    } else if (mode === 'cover') {
      // Scale to fill bounds, maintaining aspect ratio, cropping if necessary
      const scale = Math.max(maxWidth / width, maxHeight / height);
      destWidth = width * scale;
      destHeight = height * scale;
    }
    // 'stretch' mode uses maxWidth and maxHeight directly
    
    const canvas = createCanvas(destWidth, destHeight);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get canvas context for resize');
    }
    
    // Draw resized image
    ctx.drawImage(img, 0, 0, destWidth, destHeight);
    
    return canvas.toDataURL('image/png', 0.9);
    
  } catch (error) {
    console.error('Error resizing image:', error);
    return imageUrl; // Return original on error
  }
}

/**
 * Creates a pattern-based wallpaper from SVG data
 */
export function createPatternWallpaper(
  svgDataUrl: string,
  width: number = 1920,
  height: number = 1080,
  scale: number = 1
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    
    img.onload = () => {
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      // Create pattern
      const pattern = ctx.createPattern(img, 'repeat');
      
      if (pattern) {
        // Scale the pattern if needed
        if (scale !== 1) {
          ctx.scale(scale, scale);
        }
        
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, width / scale, height / scale);
        
        resolve(canvas.toDataURL('image/png', 0.9));
      } else {
        reject(new Error('Could not create pattern'));
      }
    };
    
    img.onerror = () => reject(new Error('Failed to load pattern image'));
    img.src = svgDataUrl;
  });
}

/**
 * Combines multiple processing steps into a single function
 */
export async function processWallpaper(config: WallpaperConfig): Promise<string> {
  try {
    let processedImageUrl = config.imageUrl;
    
    // Apply visual effects if any are specified
    const hasEffects = Object.values(config.effects).some(value => 
      value !== undefined && value !== 1 && value !== 0
    );
    
    if (hasEffects) {
      processedImageUrl = await applyImageEffects(config.imageUrl, config.effects);
    }
    
    return processedImageUrl;
    
  } catch (error) {
    console.error('Error processing wallpaper:', error);
    return config.imageUrl; // Return original on error
  }
}

/**
 * Validates if a string is a valid image data URL
 */
export function isValidImageDataUrl(url: string): boolean {
  return url.startsWith('data:image/') && url.includes('base64');
}

/**
 * Converts blob to data URL
 */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to data URL'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Fetches an image from Pexels API
 * Note: For production use, you should get a free API key from https://www.pexels.com/api/
 * This function uses a demo approach without API key for basic functionality
 */
async function fetchFromPexelsAPI(
  query: string,
  width: number = 1920,
  height: number = 1080
): Promise<string> {
  try {
    // For demo purposes, we'll use Pexels' curated photos endpoint
    // In production, you should use their search API with an API key
    
    // Pexels provides some publicly accessible images
    // We'll create a list of high-quality Pexels image URLs based on common search terms
    const pexelsImages: { [key: string]: string[] } = {
      'abstract': [
        'https://images.pexels.com/photos/1054222/pexels-photo-1054222.jpeg',
        'https://images.pexels.com/photos/1292115/pexels-photo-1292115.jpeg',
        'https://images.pexels.com/photos/1629236/pexels-photo-1629236.jpeg'
      ],
      'nature': [
        'https://images.pexels.com/photos/414612/pexels-photo-414612.jpeg',
        'https://images.pexels.com/photos/326055/pexels-photo-326055.jpeg',
        'https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg'
      ],
      'city': [
        'https://images.pexels.com/photos/374870/pexels-photo-374870.jpeg',
        'https://images.pexels.com/photos/1486222/pexels-photo-1486222.jpeg',
        'https://images.pexels.com/photos/1519088/pexels-photo-1519088.jpeg'
      ],
      'ocean': [
        'https://images.pexels.com/photos/1032650/pexels-photo-1032650.jpeg',
        'https://images.pexels.com/photos/1212487/pexels-photo-1212487.jpeg',
        'https://images.pexels.com/photos/1366919/pexels-photo-1366919.jpeg'
      ],
      'mountains': [
        'https://images.pexels.com/photos/417074/pexels-photo-417074.jpeg',
        'https://images.pexels.com/photos/1624438/pexels-photo-1624438.jpeg',
        'https://images.pexels.com/photos/1323550/pexels-photo-1323550.jpeg'
      ],
      'sky': [
        'https://images.pexels.com/photos/531880/pexels-photo-531880.jpeg',
        'https://images.pexels.com/photos/1421903/pexels-photo-1421903.jpeg',
        'https://images.pexels.com/photos/1199957/pexels-photo-1199957.jpeg'
      ]
    };

    // Find matching images for the query
    const queryLower = query.toLowerCase();
    let selectedImages: string[] = [];
    
    // Direct match
    if (pexelsImages[queryLower]) {
      selectedImages = pexelsImages[queryLower];
    } else {
      // Search for partial matches
      for (const [key, images] of Object.entries(pexelsImages)) {
        if (queryLower.includes(key) || key.includes(queryLower)) {
          selectedImages = images;
          break;
        }
      }
    }
    
    // If no match found, use abstract images as default
    if (selectedImages.length === 0) {
      selectedImages = pexelsImages['abstract'];
    }
    
    // Select a random image from the matching set
    const randomImage = selectedImages[Math.floor(Math.random() * selectedImages.length)];
    
    // Add query parameters for sizing (Pexels supports dynamic resizing)
    const imageUrl = `${randomImage}?auto=compress&cs=tinysrgb&w=${width}&h=${height}&fit=crop`;
    
    console.log(`🎨 Using Pexels image: ${imageUrl}`);
    
    // Fetch and convert the image to data URL
    return await fetchImageFromUrl(imageUrl, width, height, 15000);
    
  } catch (error) {
    console.error('Error fetching from Pexels:', error);
    throw error;
  }
}

// Backward compatibility alias
export const fetchUnsplashImage = fetchWallpaperImage;

/**
 * Downloads processed image as file
 */
export function downloadProcessedImage(dataUrl: string, filename: string = 'wallpaper.png'): void {
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
