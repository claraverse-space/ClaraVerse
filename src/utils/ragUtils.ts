interface SearchResult {
  content: string;
  metadata: {
    source_file?: string;
    page?: number;
    source?: string;
    [key: string]: any;
  };
  score?: number | null;
}

export const generateSystemPromptWithContext = (
  basePrompt: string,
  searchResults: SearchResult[],
  isTemporary: boolean = false
): string => {
  // Format context from search results
  const context = searchResults.map(result => {
    const source = result.metadata.source_file 
      ? `\nSource: ${result.metadata.source_file}` 
      : '';
    const page = result.metadata.page 
      ? ` (Page ${result.metadata.page})` 
      : '';
    
    return `Content${source}${page}:\n${result.content}\n`;
  }).join('\n---\n');

  // Different prompt for temporary vs permanent documents
  const contextPrompt = isTemporary 
    ? `The user has provided the following additional context for this specific query. Consider this information but do not mention it explicitly in your response unless asked:

${context}

Process the user's query in light of this context, but respond naturally without referring to the provided information directly.`
    : `You have access to the following relevant context from the knowledge base. Use this information when it's relevant to the user's questions or the conversation:

${context}

Note: Only use this context when relevant to the user's query. If the context doesn't contain information pertinent to the question, rely on your general knowledge instead.`;

  return `${basePrompt}\n\n${contextPrompt}`;
};
