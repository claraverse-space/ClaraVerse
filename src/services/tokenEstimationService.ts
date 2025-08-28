/**
 * Token Estimation Service
 * Provides multiple methods for estimating token counts when provider reports are unreliable
 */

export interface TokenEstimate {
  tokens: number;
  method: 'word-count' | 'character-count' | 'hybrid';
  confidence: 'high' | 'medium' | 'low';
}

export interface TokenValidationResult {
  finalTokens: number;
  isEstimated: boolean;
  confidence: 'high' | 'medium' | 'low';
  method: string;
  reportedTokens?: number;
  estimatedTokens?: number;
}

/**
 * Estimate tokens based on word count
 * Formula: words × 1.3 (accounts for punctuation, spaces, and tokenization)
 */
export const estimateTokensFromWords = (text: string): TokenEstimate => {
  // Clean the text and count words
  const words = text
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .split(' ')
    .filter(word => word.length > 0).length;
  
  // Base multiplier of 1.3 for English text
  let multiplier = 1.3;
  
  // Adjust multiplier based on content characteristics
  const codeBlockCount = (text.match(/```/g) || []).length / 2;
  const hasCode = codeBlockCount > 0 || text.includes('function') || text.includes('const ') || text.includes('import ');
  const hasMarkdown = text.includes('##') || text.includes('**') || text.includes('[](');
  const hasSpecialChars = /[{}[\]().,;:!?'"]/g.test(text);
  
  // Code and markdown tend to have higher token-to-word ratios
  if (hasCode) multiplier += 0.2;
  if (hasMarkdown) multiplier += 0.1;
  if (hasSpecialChars) multiplier += 0.1;
  
  const tokens = Math.round(words * multiplier);
  
  // Confidence based on text characteristics
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (words > 50 && !hasCode) confidence = 'high';
  if (words < 20 || hasCode) confidence = 'low';
  
  return {
    tokens,
    method: 'word-count',
    confidence
  };
};

/**
 * Estimate tokens based on character count
 * Formula: characters ÷ 4 (rough approximation for English)
 */
export const estimateTokensFromCharacters = (text: string): TokenEstimate => {
  const chars = text.length;
  
  // Base divisor of 4 for English text
  let divisor = 4;
  
  // Adjust divisor based on content characteristics
  const hasWhitespace = /\s/.test(text);
  const hasCode = text.includes('function') || text.includes('const ') || text.includes('{') || text.includes('}');
  const hasLongWords = text.split(' ').some(word => word.length > 8);
  
  // Whitespace-heavy content has fewer tokens per character
  if (hasWhitespace) divisor += 0.5;
  // Code tends to have more tokens per character
  if (hasCode) divisor -= 0.5;
  // Long words tend to be split into multiple tokens
  if (hasLongWords) divisor -= 0.3;
  
  const tokens = Math.round(chars / divisor);
  
  // Confidence based on text length and characteristics
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (chars > 200 && chars < 2000 && !hasCode) confidence = 'high';
  if (chars < 50 || hasCode) confidence = 'low';
  
  return {
    tokens,
    method: 'character-count',
    confidence
  };
};

/**
 * Get the best token estimate using multiple methods
 */
export const getBestTokenEstimate = (text: string): TokenEstimate => {
  const wordEstimate = estimateTokensFromWords(text);
  const charEstimate = estimateTokensFromCharacters(text);
  
  // Use the estimate with higher confidence, or average if equal
  if (wordEstimate.confidence === 'high' && charEstimate.confidence !== 'high') {
    return wordEstimate;
  }
  
  if (charEstimate.confidence === 'high' && wordEstimate.confidence !== 'high') {
    return charEstimate;
  }
  
  // If both have same confidence, use hybrid approach
  const hybridTokens = Math.round((wordEstimate.tokens + charEstimate.tokens) / 2);
  const hybridConfidence = wordEstimate.confidence === 'high' && charEstimate.confidence === 'high' 
    ? 'high' 
    : wordEstimate.confidence === 'low' || charEstimate.confidence === 'low' 
    ? 'low' 
    : 'medium';
  
  return {
    tokens: hybridTokens,
    method: 'hybrid',
    confidence: hybridConfidence
  };
};

/**
 * Validate reported tokens against estimation
 * Returns corrected token count with confidence information
 */
export const validateTokenCount = (
  reportedTokens: number | undefined,
  text: string,
  providerType?: string
): TokenValidationResult => {
  const estimate = getBestTokenEstimate(text);
  
  // If no reported tokens, use estimation
  if (!reportedTokens || reportedTokens <= 0) {
    return {
      finalTokens: estimate.tokens,
      isEstimated: true,
      confidence: estimate.confidence,
      method: `estimated (${estimate.method})`,
      estimatedTokens: estimate.tokens
    };
  }
  
  // Calculate the ratio between reported and estimated
  const ratio = reportedTokens / estimate.tokens;
  
  // Define thresholds for validation
  const LOWER_THRESHOLD = 0.5; // If reported is less than 50% of estimate, it's likely wrong
  const UPPER_THRESHOLD = 3.0;  // If reported is more than 300% of estimate, it might be wrong
  
  // Provider-specific trust levels
  const getProviderTrust = (provider?: string): number => {
    switch (provider?.toLowerCase()) {
      case 'openai': return 0.9; // High trust
      case 'anthropic': return 0.9; // High trust
      case 'ollama': return 0.6; // Medium trust
      case 'claras-pocket': return 0.5; // Lower trust
      default: return 0.7; // Default trust
    }
  };
  
  const providerTrust = getProviderTrust(providerType);
  
  // Decision logic
  if (ratio >= LOWER_THRESHOLD && ratio <= UPPER_THRESHOLD) {
    // Reported tokens seem reasonable
    return {
      finalTokens: reportedTokens,
      isEstimated: false,
      confidence: providerTrust > 0.8 ? 'high' : 'medium',
      method: 'provider-reported',
      reportedTokens,
      estimatedTokens: estimate.tokens
    };
  } else if (ratio < LOWER_THRESHOLD) {
    // Reported tokens seem too low, use estimation if confidence is reasonable
    if (estimate.confidence === 'high' || providerTrust < 0.7) {
      return {
        finalTokens: estimate.tokens,
        isEstimated: true,
        confidence: 'medium',
        method: `estimated (reported too low: ${reportedTokens})`,
        reportedTokens,
        estimatedTokens: estimate.tokens
      };
    } else {
      // Keep reported but flag as potentially inaccurate
      return {
        finalTokens: reportedTokens,
        isEstimated: false,
        confidence: 'low',
        method: 'provider-reported (possibly incomplete)',
        reportedTokens,
        estimatedTokens: estimate.tokens
      };
    }
  } else {
    // Reported tokens seem too high, use reported but flag
    return {
      finalTokens: reportedTokens,
      isEstimated: false,
      confidence: 'low',
      method: 'provider-reported (possibly inflated)',
      reportedTokens,
      estimatedTokens: estimate.tokens
    };
  }
};

/**
 * Accumulate tokens from streaming chunks
 */
export class StreamingTokenAccumulator {
  private chunkTokens: number[] = [];
  private totalTokens: number = 0;
  
  addChunk(tokens: number | undefined): void {
    if (tokens && tokens > 0) {
      this.chunkTokens.push(tokens);
      this.totalTokens += tokens;
    }
  }
  
  getCurrentTotal(): number {
    return this.totalTokens;
  }
  
  getChunkCount(): number {
    return this.chunkTokens.length;
  }
  
  getAverageChunkSize(): number {
    return this.chunkTokens.length > 0 ? this.totalTokens / this.chunkTokens.length : 0;
  }
  
  reset(): void {
    this.chunkTokens = [];
    this.totalTokens = 0;
  }
  
  /**
   * Get debug information about the accumulation
   */
  getDebugInfo(): {
    chunkCount: number;
    totalTokens: number;
    averageChunkSize: number;
    chunkSizes: number[];
  } {
    return {
      chunkCount: this.chunkTokens.length,
      totalTokens: this.totalTokens,
      averageChunkSize: this.getAverageChunkSize(),
      chunkSizes: [...this.chunkTokens]
    };
  }
}

/**
 * Post-process token count after streaming completes
 */
export const postProcessTokenCount = (
  streamingTotal: number,
  reportedTotal: number | undefined,
  finalText: string,
  providerType?: string
): TokenValidationResult => {
  // First, validate the reported total against estimation
  const reportedValidation = validateTokenCount(reportedTotal, finalText, providerType);
  
  // If we have streaming data, compare it with reported
  if (streamingTotal > 0) {
    const streamingValidation = validateTokenCount(streamingTotal, finalText, providerType);
    
    // Choose the more reliable source
    if (reportedValidation.confidence === 'high' && streamingValidation.confidence !== 'high') {
      return {
        ...reportedValidation,
        method: `${reportedValidation.method} (preferred over streaming: ${streamingTotal})`
      };
    } else if (streamingValidation.confidence === 'high' && reportedValidation.confidence !== 'high') {
      return {
        ...streamingValidation,
        method: `streaming-accumulated (preferred over reported: ${reportedTotal})`
      };
    } else {
      // Both have similar confidence, use the higher value if reasonable
      const ratio = Math.abs(streamingTotal - (reportedTotal || 0)) / Math.max(streamingTotal, reportedTotal || 1);
      if (ratio < 0.2) { // Less than 20% difference
        const avgTokens = Math.round((streamingTotal + (reportedTotal || 0)) / 2);
        return {
          finalTokens: avgTokens,
          isEstimated: false,
          confidence: 'medium',
          method: `averaged (streaming: ${streamingTotal}, reported: ${reportedTotal})`,
          reportedTokens: reportedTotal,
          estimatedTokens: streamingValidation.estimatedTokens
        };
      } else {
        // Significant difference, use streaming as it's usually more complete
        return {
          ...streamingValidation,
          method: `streaming-accumulated (differs from reported: ${reportedTotal})`
        };
      }
    }
  }
  
  // No streaming data, just use reported validation
  return reportedValidation;
};
