/**
 * Centralized configuration for thinking tags
 * This allows easy addition of new thinking tag types without modifying multiple files
 */

export interface ThinkingTagConfig {
  name: string;
  openTag: string;
  closeTag: string;
  description?: string;
}

/**
 * Configuration for all supported thinking tags
 * Add new thinking tag types here and they'll automatically work across the entire system
 */
export const THINKING_TAGS: ThinkingTagConfig[] = [
  {
    name: 'think',
    openTag: '<think>',
    closeTag: '</think>',
    description: 'Standard thinking tag'
  },
  {
    name: 'seed:think',
    openTag: '<seed:think>',
    closeTag: '</seed:think>',
    description: 'Seed-namespaced thinking tag'
  }
  // Add more thinking tag types here as needed:
  // {
  //   name: 'plan',
  //   openTag: '<plan>',
  //   closeTag: '</plan>',
  //   description: 'Planning thoughts'
  // },
  // {
  //   name: 'analyze',
  //   openTag: '<analyze>',
  //   closeTag: '</analyze>',
  //   description: 'Analysis thoughts'
  // }
];

/**
 * Generate regex pattern that matches any configured thinking tag
 * @param global - Whether to use global flag (for replace operations)
 * @param caseInsensitive - Whether to use case insensitive flag
 * @returns RegExp that matches any thinking tag content
 */
export const createThinkingRegex = (global: boolean = false, caseInsensitive: boolean = true): RegExp => {
  // Escape special regex characters in tag names
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Create alternation pattern for all open/close tag pairs
  const patterns = THINKING_TAGS.map(tag => {
    const openTag = escapeRegex(tag.openTag);
    const closeTag = escapeRegex(tag.closeTag);
    return `${openTag}([\\s\\S]*?)${closeTag}`;
  });
  
  const pattern = `(${patterns.join('|')})`;
  
  let flags = '';
  if (global) flags += 'g';
  if (caseInsensitive) flags += 'i';
  
  return new RegExp(pattern, flags);
};

/**
 * Generate regex pattern for partial/streaming thinking content (no closing tag yet)
 * @param caseInsensitive - Whether to use case insensitive flag
 * @returns RegExp that matches partial thinking content
 */
export const createPartialThinkingRegex = (caseInsensitive: boolean = true): RegExp => {
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Create alternation pattern for all open tags (without closing)
  const patterns = THINKING_TAGS.map(tag => {
    const openTag = escapeRegex(tag.openTag);
    return `${openTag}([\\s\\S]*?)$`;
  });
  
  const pattern = `(${patterns.join('|')})`;
  const flags = caseInsensitive ? 'i' : '';
  
  return new RegExp(pattern, flags);
};

/**
 * Extract thinking content from text using any configured thinking tag
 * @param content - The text content to parse
 * @returns Object with thinking content, response content, and metadata
 */
export interface ParsedThinkingContent {
  thinking: string;
  response: string;
  thinkingTimeSeconds?: number;
  tagType?: string; // Which tag type was detected
  isPartial?: boolean; // Whether this is partial/streaming content
}

export const parseThinkingContent = (content: string): ParsedThinkingContent => {
  // First try to match complete thinking blocks
  const completeRegex = createThinkingRegex(false, true);
  const completeMatch = content.match(completeRegex);
  
  if (completeMatch) {
    // Find which tag type was matched
    let matchedTag: ThinkingTagConfig | undefined;
    let thinkingContent = '';
    
    for (const tag of THINKING_TAGS) {
      const tagRegex = new RegExp(`${tag.openTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s\\S]*?)${tag.closeTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
      const tagMatch = content.match(tagRegex);
      if (tagMatch) {
        matchedTag = tag;
        thinkingContent = tagMatch[1].trim();
        break;
      }
    }
    
    if (matchedTag) {
      const response = content.replace(completeRegex, '').trim();
      
      // Estimate thinking time based on content length
      const wordsInThinking = thinkingContent.split(/\s+/).filter(word => word.length > 0).length;
      const estimatedSeconds = Math.max(1, Math.floor(wordsInThinking / 50));
      
      return {
        thinking: thinkingContent,
        response,
        thinkingTimeSeconds: estimatedSeconds,
        tagType: matchedTag.name,
        isPartial: false
      };
    }
  }
  
  // Try to match partial thinking blocks (streaming scenario)
  const partialRegex = createPartialThinkingRegex(true);
  const partialMatch = content.match(partialRegex);
  
  if (partialMatch) {
    // Find which tag type was matched
    let matchedTag: ThinkingTagConfig | undefined;
    let thinkingContent = '';
    
    for (const tag of THINKING_TAGS) {
      const tagRegex = new RegExp(`${tag.openTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s\\S]*?)$`, 'i');
      const tagMatch = content.match(tagRegex);
      if (tagMatch) {
        matchedTag = tag;
        thinkingContent = tagMatch[1].trim();
        break;
      }
    }
    
    if (matchedTag) {
      // Estimate thinking time
      const wordsInThinking = thinkingContent.split(/\s+/).filter(word => word.length > 0).length;
      const estimatedSeconds = Math.max(1, Math.floor(wordsInThinking / 50));
      
      // Get any content before the thinking tag
      const beforeThinkIndex = content.indexOf(matchedTag.openTag);
      const beforeThink = beforeThinkIndex > 0 ? content.substring(0, beforeThinkIndex).trim() : '';
      
      return {
        thinking: thinkingContent,
        response: beforeThink,
        thinkingTimeSeconds: estimatedSeconds,
        tagType: matchedTag.name,
        isPartial: true
      };
    }
  }
  
  // No thinking content found
  return {
    thinking: '',
    response: content,
    thinkingTimeSeconds: 0,
    isPartial: false
  };
};

/**
 * Clean content by removing all thinking tags (useful for TTS, summaries, etc.)
 * @param content - Content to clean
 * @param replacement - What to replace thinking blocks with (default: empty string)
 * @returns Cleaned content
 */
export const cleanThinkingTags = (content: string, replacement: string = ''): string => {
  const regex = createThinkingRegex(true, true);
  return content.replace(regex, replacement);
};

/**
 * Wrap content in a specific thinking tag
 * @param content - Content to wrap
 * @param tagName - Name of the tag to use (must exist in THINKING_TAGS)
 * @returns Wrapped content or original content if tag not found
 */
export const wrapInThinkingTag = (content: string, tagName: string): string => {
  const tag = THINKING_TAGS.find(t => t.name === tagName);
  if (!tag) {
    console.warn(`Thinking tag "${tagName}" not found in configuration`);
    return content;
  }
  return `${tag.openTag}${content}${tag.closeTag}`;
};

/**
 * Get all configured thinking tag names
 * @returns Array of tag names
 */
export const getThinkingTagNames = (): string[] => {
  return THINKING_TAGS.map(tag => tag.name);
};

/**
 * Check if content contains any thinking tags
 * @param content - Content to check
 * @returns Boolean indicating if thinking content is present
 */
export const hasThinkingContent = (content: string): boolean => {
  const regex = createThinkingRegex(false, true);
  return regex.test(content);
};
