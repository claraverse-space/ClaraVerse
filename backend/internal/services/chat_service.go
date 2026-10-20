package services

import (
	"bufio"
	"bytes"
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"claraverse/internal/database"
	"claraverse/internal/health"
	"claraverse/internal/models"
	"claraverse/internal/tools"

	"github.com/google/uuid"
	cache "github.com/patrickmn/go-cache"
	"go.mongodb.org/mongo-driver/bson/primitive"
)

// truncateToolCallID ensures tool call IDs are max 40 chars (OpenAI API constraint)
// OpenAI may send IDs > 40 chars, but rejects them when sent back
func truncateToolCallID(id string) string {
	if len(id) <= 40 {
		return id
	}
	// Keep prefix (like "call_") and truncate to 40 chars
	return id[:40]
}

// ChatService handles chat operations
type ChatService struct {
	db                      *database.DB
	providerService         *ProviderService
	conversationCache       *cache.Cache // TTL cache for conversation history (30 min)
	summaryCache            *cache.Cache // Cache for AI-generated context summaries
	toolRegistry            *tools.Registry
	toolService             *ToolService              // Tool service for credential-filtered tools
	mcpBridge               *MCPBridgeService         // MCP bridge for local client tools
	modelAliases            map[int]map[string]string // Provider ID -> (Frontend Model -> Actual Model) mapping
	streamBuffer            *StreamBufferService      // Buffer for resumable streaming
	usageLimiter            *UsageLimiterService      // Usage limiter for tier-based limits
	toolPredictorService    *ToolPredictorService     // Tool predictor for dynamic tool selection
	memoryExtractionService *MemoryExtractionService  // Memory extraction service for extracting memories from chats
	memorySelectionService  *MemorySelectionService   // Memory selection service for selecting relevant memories
	hindsightClient         *HindsightClient          // Optional: when set, replaces native extraction+selection for this turn (see hindsight_client.go)
	userService             *UserService              // User service for getting user preferences
	settingsService         *SettingsService          // Settings service for system-wide model assignments
	healthService           *health.Service           // Health service for provider health tracking
	skillService            *SkillService             // Skill service for auto-routing messages to skills
	// ragSearcher is the optional RAG wiring. When set, chat turns
	// that carry KnowledgeProjectIDs get a per-turn search_knowledge
	// tool bound to (userID, project_ids). When nil, the picker is
	// effectively a no-op and chat behaves as before.
	ragSearcher RAGSearcher
}

// ContextSummary stores AI-generated summary of older messages
type ContextSummary struct {
	Summary          string    // AI-generated summary text
	SummarizedCount  int       // Number of messages that were summarized
	LastMessageIndex int       // Index of the last message that was summarized
	CreatedAt        time.Time // When this summary was created
}

// harmonyStripper extracts <reasoning>...</reasoning> spans from a streaming
// content channel. gpt-oss (the OpenAI Harmony response format on Bedrock)
// emits its chain-of-thought inline inside the regular `content` delta wrapped
// in <reasoning>...</reasoning> tags rather than the o1/o3 reasoning_content
// channel — so without this, the tags leak verbatim to the chat UI.
//
// Each call returns (visible, reasoning): bytes to forward as normal content
// vs. bytes to route to a reasoning_chunk message. Trailing bytes that could
// be a partial tag are held back in `pending` for the next call.
type harmonyStripper struct {
	inReasoning bool
	pending     string
}

func (h *harmonyStripper) process(chunk string) (visible, reasoning string) {
	const openTag = "<reasoning>"
	const closeTag = "</reasoning>"

	buf := h.pending + chunk
	h.pending = ""

	var visOut, reasOut strings.Builder

	for {
		tag := openTag
		if h.inReasoning {
			tag = closeTag
		}
		idx := strings.Index(buf, tag)
		if idx >= 0 {
			if h.inReasoning {
				reasOut.WriteString(buf[:idx])
			} else {
				visOut.WriteString(buf[:idx])
			}
			buf = buf[idx+len(tag):]
			h.inReasoning = !h.inReasoning
			continue
		}
		// No full tag in buf. Hold back any trailing bytes that could be a
		// partial prefix of the tag we're hunting, so we don't emit a half-tag.
		hold := 0
		max := len(tag) - 1
		if max > len(buf) {
			max = len(buf)
		}
		for n := max; n > 0; n-- {
			if strings.HasSuffix(buf, tag[:n]) {
				hold = n
				break
			}
		}
		emit := buf[:len(buf)-hold]
		if h.inReasoning {
			reasOut.WriteString(emit)
		} else {
			visOut.WriteString(emit)
		}
		h.pending = buf[len(buf)-hold:]
		break
	}

	return visOut.String(), reasOut.String()
}

// ImageRegistryAdapter wraps ImageRegistryService to implement tools.ImageRegistryInterface
// This adapter is needed to avoid import cycles between services and tools packages
type ImageRegistryAdapter struct {
	registry *ImageRegistryService
}

// GetByHandle implements tools.ImageRegistryInterface
func (a *ImageRegistryAdapter) GetByHandle(conversationID, handle string) *tools.ImageRegistryEntry {
	entry := a.registry.GetByHandle(conversationID, handle)
	if entry == nil {
		return nil
	}
	return &tools.ImageRegistryEntry{
		Handle:   entry.Handle,
		FileID:   entry.FileID,
		Filename: entry.Filename,
		Source:   entry.Source,
	}
}

// ListHandles implements tools.ImageRegistryInterface
func (a *ImageRegistryAdapter) ListHandles(conversationID string) []string {
	return a.registry.ListHandles(conversationID)
}

// RegisterGeneratedImage implements tools.ImageRegistryInterface
func (a *ImageRegistryAdapter) RegisterGeneratedImage(conversationID, fileID, prompt string) string {
	return a.registry.RegisterGeneratedImage(conversationID, fileID, prompt)
}

// RegisterEditedImage implements tools.ImageRegistryInterface
func (a *ImageRegistryAdapter) RegisterEditedImage(conversationID, fileID, sourceHandle, prompt string) string {
	return a.registry.RegisterEditedImage(conversationID, fileID, sourceHandle, prompt)
}

// NewChatService creates a new chat service
func NewChatService(
	db *database.DB,
	providerService *ProviderService,
	mcpBridge *MCPBridgeService,
	toolService *ToolService,
) *ChatService {
	// Create conversation cache with eviction hook for file cleanup
	conversationCache := cache.New(30*time.Minute, 10*time.Minute)

	// Create summary cache with longer TTL (1 hour) - summaries are expensive to regenerate
	summaryCache := cache.New(1*time.Hour, 15*time.Minute)

	// Set up eviction handler to cleanup associated files
	conversationCache.OnEvicted(func(key string, value interface{}) {
		conversationID := key
		log.Printf("🗑️  [CACHE-EVICT] Conversation %s expired, cleaning up associated files...", conversationID)

		// Get file cache service
		fileCache := GetFileCacheService()

		// Delete all files for this conversation
		fileCache.DeleteConversationFiles(conversationID)

		// Also clean up the summary cache
		summaryCache.Delete(conversationID)

		log.Printf("✅ [CACHE-EVICT] Cleanup completed for conversation %s", conversationID)
	})

	return &ChatService{
		db:                db,
		providerService:   providerService,
		conversationCache: conversationCache,
		summaryCache:      summaryCache,
		toolRegistry:      tools.GetRegistry(),
		toolService:       toolService,
		mcpBridge:         mcpBridge,
		modelAliases:      make(map[int]map[string]string),
		streamBuffer:      NewStreamBufferService(),
	}
}

// SetToolService sets the tool service for credential-filtered tools
// This allows setting the tool service after initialization when there are circular dependencies
func (s *ChatService) SetToolService(toolService *ToolService) {
	s.toolService = toolService
	log.Println("✅ [CHAT-SERVICE] Tool service set for credential-filtered tools")
}

// SetUsageLimiter sets the usage limiter for tier-based usage limits
func (s *ChatService) SetUsageLimiter(usageLimiter *UsageLimiterService) {
	s.usageLimiter = usageLimiter
	log.Println("✅ [CHAT-SERVICE] Usage limiter set for tier-based limits")
}

// SetToolPredictorService sets the tool predictor service for dynamic tool selection
func (s *ChatService) SetToolPredictorService(predictor *ToolPredictorService) {
	s.toolPredictorService = predictor
	log.Println("✅ [CHAT-SERVICE] Tool predictor service set for smart tool routing")
}

// SetSkillService sets the skill service for auto-routing messages to skills
func (s *ChatService) SetSkillService(skillService *SkillService) {
	s.skillService = skillService
	log.Println("✅ [CHAT-SERVICE] Skill service set for auto-routing")
}

// SetMemoryExtractionService sets the memory extraction service for extracting memories from chats
func (s *ChatService) SetMemoryExtractionService(memoryExtraction *MemoryExtractionService) {
	s.memoryExtractionService = memoryExtraction
	log.Println("✅ [CHAT-SERVICE] Memory extraction service set for conversation memory extraction")
}

// SetMemorySelectionService sets the memory selection service for selecting relevant memories
func (s *ChatService) SetMemorySelectionService(memorySelection *MemorySelectionService) {
	s.memorySelectionService = memorySelection
	log.Println("✅ [CHAT-SERVICE] Memory selection service set for memory injection")
}

// SetHindsightClient wires an evaluated alternative to the native memory
// pipeline (see hindsight_client.go). When set, both extraction
// (checkAndTriggerMemoryExtraction) and selection (buildMemoryContext) use
// Hindsight exclusively instead of the native path for that turn — the two
// aren't run side by side, to avoid double LLM calls and duplicate memories.
func (s *ChatService) SetHindsightClient(client *HindsightClient) {
	s.hindsightClient = client
	log.Println("✅ [CHAT-SERVICE] Hindsight memory client set — replacing native extraction+selection")
}

// SetHealthService sets the health service for provider health tracking
func (s *ChatService) SetHealthService(healthService *health.Service) {
	s.healthService = healthService
	log.Println("[CHAT-SERVICE] Health service set for provider health tracking")
}

// SetUserService sets the user service for getting user preferences
func (s *ChatService) SetUserService(userService *UserService) {
	s.userService = userService
	log.Println("✅ [CHAT-SERVICE] User service set for preference checking")
}

// SetSettingsService sets the settings service for system-wide model assignments
// SetRAGSearcher wires the RAG layer so chat turns can attach
// project knowledge bases via the chat picker. Optional — when nil,
// the picker UI still works but the resulting knowledge_project_ids
// are ignored at the LLM call.
func (s *ChatService) SetRAGSearcher(r RAGSearcher) {
	s.ragSearcher = r
}

func (s *ChatService) SetSettingsService(settingsService *SettingsService) {
	s.settingsService = settingsService
	log.Println("✅ [CHAT-SERVICE] Settings service set for system model assignment")
}

// GetStreamBuffer returns the stream buffer service for resume handling
func (s *ChatService) GetStreamBuffer() *StreamBufferService {
	return s.streamBuffer
}

// SetModelAliases sets model aliases for a provider
func (s *ChatService) SetModelAliases(providerID int, aliases map[string]models.ModelAlias) {
	if aliases != nil && len(aliases) > 0 {
		// Convert ModelAlias to string map for internal storage
		stringAliases := make(map[string]string)
		for frontend, alias := range aliases {
			stringAliases[frontend] = alias.ActualModel
		}
		s.modelAliases[providerID] = stringAliases

		log.Printf("🔄 [MODEL-ALIAS] Loaded %d model aliases for provider %d", len(aliases), providerID)
		for frontend, alias := range aliases {
			if alias.Description != "" {
				log.Printf("   %s -> %s (%s)", frontend, alias.ActualModel, alias.Description)
			} else {
				log.Printf("   %s -> %s", frontend, alias.ActualModel)
			}
		}
	}
}

// normalizeAPIModelName converts a possibly-prefixed model identifier (e.g.
// "3:zai.glm-5", the canonical row id stored in model_aliases.model_id) into
// the bare API model name (e.g. "zai.glm-5") that providers like Bedrock
// expect. Returns the input unchanged if it doesn't look up to a row.
//
// Centralised here so every caller of the alias resolver (chat,
// classifier, tool predictor, memory pool, daemon runner, etc.) gets the
// correct upstream identifier without having to remember to fix it.
func (s *ChatService) normalizeAPIModelName(name string) string {
	if name == "" {
		return name
	}
	if _, apiName, err := s.providerService.GetByModelIDWithName(name); err == nil && apiName != "" {
		if apiName != name {
			log.Printf("🩹 [MODEL-ALIAS] Normalized row id '%s' -> api name '%s'", name, apiName)
		}
		return apiName
	}
	return name
}

// resolveModelName resolves a frontend model name to the actual model name using aliases
func (s *ChatService) resolveModelName(providerID int, modelName string) string {
	if aliases, exists := s.modelAliases[providerID]; exists {
		if actualModel, found := aliases[modelName]; found {
			normalized := s.normalizeAPIModelName(actualModel)
			log.Printf("🔄 [MODEL-ALIAS] Resolved '%s' -> '%s' for provider %d", modelName, normalized, providerID)
			return normalized
		}
	}
	// No alias found, return original model name (still normalize in case it's a row id)
	return s.normalizeAPIModelName(modelName)
}

// resolveModelAlias searches all providers for a model alias and returns the provider ID and actual model name
// Returns (providerID, actualModelName, found)
func (s *ChatService) resolveModelAlias(aliasName string) (int, string, bool) {
	for providerID, aliases := range s.modelAliases {
		if actualModel, found := aliases[aliasName]; found {
			normalized := s.normalizeAPIModelName(actualModel)
			log.Printf("🔄 [MODEL-ALIAS] Resolved alias '%s' -> provider=%d, model='%s'", aliasName, providerID, normalized)
			return providerID, normalized, true
		}
	}
	return 0, "", false
}

// ResolveModelAlias is the public version that returns provider and actual model name
// Returns (provider, actualModelName, found)
func (s *ChatService) ResolveModelAlias(aliasName string) (*models.Provider, string, bool) {
	providerID, actualModel, found := s.resolveModelAlias(aliasName)
	if !found {
		return nil, "", false
	}

	provider, err := s.providerService.GetByID(providerID)
	if err != nil {
		log.Printf("⚠️ [MODEL-ALIAS] Found alias but provider %d not found: %v", providerID, err)
		return nil, "", false
	}

	return provider, actualModel, true
}

// GetDefaultProvider returns the first available enabled provider (for fallback)
func (s *ChatService) GetDefaultProvider() (*models.Provider, error) {
	providers, err := s.providerService.GetAll()
	if err != nil {
		return nil, fmt.Errorf("failed to get providers: %w", err)
	}

	if len(providers) == 0 {
		return nil, fmt.Errorf("no providers configured")
	}

	// Return first enabled provider
	return &providers[0], nil
}

// GetDefaultProviderWithModel returns the first available provider and a default model from it
func (s *ChatService) GetDefaultProviderWithModel() (*models.Provider, string, error) {
	provider, err := s.GetDefaultProvider()
	if err != nil {
		return nil, "", err
	}

	// Query for the first visible model from this provider. Select the
	// `name` column (upstream API id like "zai.glm-5"), NOT `id` (the
	// row id like "3:zai.glm-5" — strict providers reject the prefix).
	var modelID string
	err = s.db.QueryRow(`
		SELECT name FROM models
		WHERE provider_id = ? AND is_visible = 1
		ORDER BY name
		LIMIT 1
	`, provider.ID).Scan(&modelID)

	if err != nil {
		// No models found, try without visibility filter
		err = s.db.QueryRow(`
			SELECT name FROM models
			WHERE provider_id = ?
			ORDER BY name
			LIMIT 1
		`, provider.ID).Scan(&modelID)

		if err != nil {
			return nil, "", fmt.Errorf("no models found for default provider %s: %w", provider.Name, err)
		}
	}

	log.Printf("🔧 [DEFAULT] Using provider '%s' with model '%s'", provider.Name, modelID)
	return provider, modelID, nil
}

// GetTextProviderWithModel returns a text-capable provider and model for internal use (metadata generation, etc.)
// It tries model aliases first, then falls back to finding any enabled text provider
// This filters out audio-only and image-only providers
func (s *ChatService) GetTextProviderWithModel() (*models.Provider, string, error) {
	// Strategy 1: Try to use model aliases from config (these are known good text models)
	configService := GetConfigService()
	allAliases := configService.GetAllModelAliases()

	// Get image-only provider names to filter them out
	imageProviderService := GetImageProviderService()
	imageProviders := imageProviderService.GetAllProviders()
	imageProviderNames := make(map[string]bool)
	for _, ip := range imageProviders {
		imageProviderNames[ip.Name] = true
	}

	// Try aliases in order of preference (smaller/faster models first for metadata generation)
	preferredAliases := []string{"haiku-4.5", "gpt-4o-mini", "sonnet-4.5", "gpt-4o"}

	for _, aliasName := range preferredAliases {
		for providerID, aliases := range allAliases {
			if aliasInfo, found := aliases[aliasName]; found {
				// Get the provider and verify it's enabled and not image-only
				provider, err := s.providerService.GetByID(providerID)
				if err != nil || !provider.Enabled || provider.AudioOnly {
					continue
				}
				// Check if it's an image-only provider by name
				if imageProviderNames[provider.Name] {
					continue
				}

				log.Printf("📋 [TEXT-PROVIDER] Found via alias: %s -> %s (provider: %s)",
					aliasName, aliasInfo.ActualModel, provider.Name)
				return provider, aliasInfo.ActualModel, nil
			}
		}
	}

	// Strategy 2: Try any available model alias
	for providerID, aliases := range allAliases {
		for aliasName, aliasInfo := range aliases {
			provider, err := s.providerService.GetByID(providerID)
			if err != nil || !provider.Enabled || provider.AudioOnly {
				continue
			}
			if imageProviderNames[provider.Name] {
				continue
			}

			log.Printf("📋 [TEXT-PROVIDER] Found via any alias: %s -> %s (provider: %s)",
				aliasName, aliasInfo.ActualModel, provider.Name)
			return provider, aliasInfo.ActualModel, nil
		}
	}

	// Strategy 3: Query database for any text-capable provider with models
	log.Printf("📋 [TEXT-PROVIDER] No aliases found, querying database for text provider...")

	var providerID int
	var providerName, baseURL, apiKey string
	var systemPrompt, favicon *string

	// Find first enabled text provider (not audio_only) that has models
	err := s.db.QueryRow(`
		SELECT p.id, p.name, p.base_url, p.api_key, p.system_prompt, p.favicon
		FROM providers p
		WHERE p.enabled = 1 AND (p.audio_only = 0 OR p.audio_only IS NULL)
		AND EXISTS (SELECT 1 FROM models m WHERE m.provider_id = p.id)
		ORDER BY p.id ASC
		LIMIT 1
	`).Scan(&providerID, &providerName, &baseURL, &apiKey, &systemPrompt, &favicon)

	if err != nil {
		return nil, "", fmt.Errorf("no text-capable provider found: %w", err)
	}

	// Check if this provider is an image-only provider
	if imageProviderNames[providerName] {
		// Try to find the next one that's not image-only
		rows, err := s.db.Query(`
			SELECT p.id, p.name, p.base_url, p.api_key, p.system_prompt, p.favicon
			FROM providers p
			WHERE p.enabled = 1 AND (p.audio_only = 0 OR p.audio_only IS NULL)
			AND EXISTS (SELECT 1 FROM models m WHERE m.provider_id = p.id)
			ORDER BY p.id ASC
		`)
		if err != nil {
			return nil, "", fmt.Errorf("failed to query providers: %w", err)
		}
		defer rows.Close()

		found := false
		for rows.Next() {
			if err := rows.Scan(&providerID, &providerName, &baseURL, &apiKey, &systemPrompt, &favicon); err != nil {
				continue
			}
			if !imageProviderNames[providerName] {
				found = true
				break
			}
		}

		if !found {
			return nil, "", fmt.Errorf("no text-capable provider found (all are image-only)")
		}
	}

	// Get first model from this provider. Select `name` (upstream API id),
	// NOT `id` — the row id form ("3:zai.glm-5") is rejected by strict
	// providers (Bedrock) as "invalid model identifier".
	var modelID string
	err = s.db.QueryRow(`
		SELECT name FROM models
		WHERE provider_id = ? AND is_visible = 1
		ORDER BY name
		LIMIT 1
	`, providerID).Scan(&modelID)

	if err != nil {
		// Try without visibility filter
		err = s.db.QueryRow(`
			SELECT name FROM models
			WHERE provider_id = ?
			ORDER BY name
			LIMIT 1
		`, providerID).Scan(&modelID)

		if err != nil {
			return nil, "", fmt.Errorf("no models found for provider %s: %w", providerName, err)
		}
	}

	provider := &models.Provider{
		ID:      providerID,
		Name:    providerName,
		BaseURL: baseURL,
		APIKey:  apiKey,
		Enabled: true,
	}
	if systemPrompt != nil {
		provider.SystemPrompt = *systemPrompt
	}
	if favicon != nil {
		provider.Favicon = *favicon
	}

	log.Printf("📋 [TEXT-PROVIDER] Found via database: provider=%s, model=%s", providerName, modelID)
	return provider, modelID, nil
}

// getConversationMessages retrieves messages from cache
func (s *ChatService) getConversationMessages(conversationID string) []map[string]interface{} {
	if cached, found := s.conversationCache.Get(conversationID); found {
		if messages, ok := cached.([]map[string]interface{}); ok {
			log.Printf("📖 [CACHE] Retrieved %d messages for conversation %s", len(messages), conversationID)
			return messages
		}
		log.Printf("⚠️  [CACHE] Invalid cache data type for conversation %s", conversationID)
	}
	log.Printf("📖 [CACHE] No cached messages for conversation %s (starting fresh)", conversationID)
	return []map[string]interface{}{}
}

// GetConversationMessages retrieves messages from cache (public)
func (s *ChatService) GetConversationMessages(conversationID string) []map[string]interface{} {
	return s.getConversationMessages(conversationID)
}

// setConversationMessages stores messages in cache with TTL
func (s *ChatService) setConversationMessages(conversationID string, messages []map[string]interface{}) {
	s.conversationCache.Set(conversationID, messages, cache.DefaultExpiration)
	log.Printf("💾 [CACHE] Stored %d messages for conversation %s", len(messages), conversationID)
}

// Context Window Management Constants
const (
	// Maximum tokens to send to the model (conservative limit for safety)
	// Most models support 128K+, but we use 80K to leave room for response
	MaxContextTokens = 80000

	// Threshold to trigger summarization (70% of max)
	SummarizationThreshold = 56000

	// Approximate tokens per character (conservative estimate)
	TokensPerChar = 0.25

	// Maximum characters for a single message before truncation
	MaxMessageChars = 50000

	// Minimum messages before summarization kicks in
	MinMessagesForSummary = 15
)

// estimateTokens provides a rough token count for a string
// Uses the conservative estimate of ~4 chars per token
func estimateTokens(s string) int {
	return int(float64(len(s)) * TokensPerChar)
}

// estimateMessagesTokens calculates approximate token count for messages
func estimateMessagesTokens(messages []map[string]interface{}) int {
	total := 0
	for _, msg := range messages {
		if content, ok := msg["content"].(string); ok {
			total += estimateTokens(content)
		}
		// Account for role and structure overhead
		total += 10
	}
	return total
}

// getContextSummary retrieves a cached context summary for a conversation
func (s *ChatService) getContextSummary(conversationID string) *ContextSummary {
	if cached, found := s.summaryCache.Get(conversationID); found {
		if summary, ok := cached.(*ContextSummary); ok {
			return summary
		}
	}
	return nil
}

// setContextSummary stores a context summary in cache
func (s *ChatService) setContextSummary(conversationID string, summary *ContextSummary) {
	s.summaryCache.Set(conversationID, summary, cache.DefaultExpiration)
	log.Printf("💾 [SUMMARY] Stored context summary for %s (%d messages summarized)", conversationID, summary.SummarizedCount)
}

// generateContextSummary uses AI to create a summary of messages
// If an existing summary exists, it incorporates that context into the new summary
func (s *ChatService) generateContextSummary(conversationID string, messages []map[string]interface{}, existingSummary *ContextSummary, config *models.Config) string {
	// Build the content to summarize
	var contentToSummarize strings.Builder

	// If we have an existing summary, include it first so new summary builds upon it
	if existingSummary != nil && existingSummary.Summary != "" {
		contentToSummarize.WriteString("=== PREVIOUS CONVERSATION SUMMARY ===\n")
		contentToSummarize.WriteString(existingSummary.Summary)
		contentToSummarize.WriteString("\n\n=== NEW MESSAGES SINCE LAST SUMMARY ===\n\n")
		log.Printf("📚 [SUMMARY] Including previous summary (%d chars) in new summarization", len(existingSummary.Summary))
	}

	for i, msg := range messages {
		role, _ := msg["role"].(string)
		content, _ := msg["content"].(string)
		if role == "system" {
			continue // Skip system messages
		}
		// Truncate very long messages for the summary (keep more context for technical conversations)
		if len(content) > 8000 {
			content = content[:4000] + "\n\n[... middle content truncated for summary ...]\n\n" + content[len(content)-2000:]
		}
		contentToSummarize.WriteString(fmt.Sprintf("[%s #%d]: %s\n\n", role, i+1, content))
	}

	// Create summarization prompt - optimized for technical conversations
	summaryPrompt := []map[string]interface{}{
		{
			"role": "system",
			"content": `You are a technical conversation summarizer. Your job is to create a detailed context summary that preserves ALL important information needed to continue the conversation seamlessly.

CRITICAL - You MUST preserve:
1. **FILE PATHS & CODE** - Every file path, function name, class name, variable name mentioned
2. **TECHNICAL DECISIONS** - Architecture choices, implementation approaches, why certain solutions were chosen/rejected
3. **BUGS & FIXES** - What was broken, what fixed it, error messages encountered
4. **CONFIGURATION** - Settings, thresholds, environment variables, API endpoints discussed
5. **CURRENT STATE** - What has been implemented, what's pending, what's blocked
6. **USER PREFERENCES** - Coding style, frameworks preferred, constraints mentioned
7. **SPECIFIC VALUES** - Numbers, dates, versions, exact strings that were important

FORMAT YOUR SUMMARY AS:
## Project Context
[What is being built/modified]

## Files Modified/Discussed
- path/to/file.ext - what was done
- path/to/another.ext - what was changed

## Key Technical Details
[Specific implementations, code patterns, configurations]

## Current Status
[What's done, what's in progress, what's next]

## Important Decisions Made
[Why certain approaches were chosen]

## Open Issues/Blockers
[Any unresolved problems]

IMPORTANT: If a "PREVIOUS CONVERSATION SUMMARY" is provided, merge that context with the new messages into ONE comprehensive summary. Do not lose any important details from the previous summary.

Be THOROUGH - it's better to include too much detail than to lose critical context. Max 2000 words.`,
		},
		{
			"role":    "user",
			"content": fmt.Sprintf("Create a detailed technical summary of this conversation that preserves all context needed to continue:\n\n%s", contentToSummarize.String()),
		},
	}

	// Make a non-streaming request for summary
	chatReq := models.ChatRequest{
		Model:       config.Model,
		Messages:    summaryPrompt,
		Stream:      false,
		Temperature: 0.3, // Low temperature for consistency
	}

	reqBody, err := json.Marshal(chatReq)
	if err != nil {
		log.Printf("❌ [SUMMARY] Failed to marshal request: %v", err)
		return ""
	}

	req, err := http.NewRequest("POST", config.BaseURL+"/chat/completions", bytes.NewBuffer(reqBody))
	if err != nil {
		log.Printf("❌ [SUMMARY] Failed to create request: %v", err)
		return ""
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+config.APIKey)

	client := &http.Client{Timeout: 600 * time.Second} // 10 min — local models may cold start
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ [SUMMARY] Request failed: %v", err)
		return ""
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("❌ [SUMMARY] API error (status %d): %s", resp.StatusCode, string(body))
		return ""
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Printf("❌ [SUMMARY] Failed to decode response: %v", err)
		return ""
	}

	if len(result.Choices) == 0 {
		log.Printf("⚠️  [SUMMARY] No choices in response")
		return ""
	}

	summary := strings.TrimSpace(result.Choices[0].Message.Content)
	log.Printf("✅ [SUMMARY] Generated summary for %s (%d chars)", conversationID, len(summary))
	return summary
}

// optimizeContextWindow manages context to prevent exceeding token limits
// Uses AI-powered summarization for older messages, preserving context
func (s *ChatService) optimizeContextWindow(messages []map[string]interface{}, conversationID string, config *models.Config, writeChan chan models.ServerMessage) []map[string]interface{} {
	totalTokens := estimateMessagesTokens(messages)

	// If within limits, return as-is
	if totalTokens <= SummarizationThreshold {
		return messages
	}

	log.Printf("📊 [CONTEXT] Context optimization needed: %d tokens exceeds %d threshold", totalTokens, SummarizationThreshold)

	// Notify client that context optimization is starting
	if writeChan != nil {
		select {
		case writeChan <- models.ServerMessage{
			Type:     "context_optimizing",
			Status:   "started",
			Progress: 0,
			Content:  "Compacting conversation to keep chatting...",
		}:
		default:
			log.Printf("⚠️ [CONTEXT] WriteChan unavailable for optimization status")
		}
	}

	// Strategy 1: Truncate very long individual messages
	for i := range messages {
		if content, ok := messages[i]["content"].(string); ok {
			if len(content) > MaxMessageChars {
				keepFirst := MaxMessageChars / 2
				keepLast := MaxMessageChars / 4
				truncated := content[:keepFirst] + "\n\n[... content truncated ...]\n\n" + content[len(content)-keepLast:]
				messages[i]["content"] = truncated
				log.Printf("✂️  [CONTEXT] Truncated message %d from %d to %d chars", i, len(content), len(truncated))
			}
		}
	}

	// Recalculate after truncation
	totalTokens = estimateMessagesTokens(messages)
	if totalTokens <= SummarizationThreshold {
		// Truncation was sufficient - notify completion before returning
		if writeChan != nil {
			select {
			case writeChan <- models.ServerMessage{
				Type:     "context_optimizing",
				Status:   "completed",
				Progress: 100,
				Content:  "Context optimized via truncation",
			}:
			default:
			}
		}
		return messages
	}

	// Strategy 2: Use AI summary for older messages
	// Separate system message from conversation
	var systemMsg map[string]interface{}
	nonSystemMessages := make([]map[string]interface{}, 0)

	for _, msg := range messages {
		if role, ok := msg["role"].(string); ok && role == "system" {
			systemMsg = msg
		} else {
			nonSystemMessages = append(nonSystemMessages, msg)
		}
	}

	// Need enough messages to summarize
	if len(nonSystemMessages) < MinMessagesForSummary {
		// Not enough messages for summarization - notify completion
		if writeChan != nil {
			select {
			case writeChan <- models.ServerMessage{
				Type:     "context_optimizing",
				Status:   "completed",
				Progress: 100,
				Content:  "Context optimization complete",
			}:
			default:
			}
		}
		return messages
	}

	// After summarization, we keep NO recent messages - only the summary
	// New messages will be added naturally as conversation continues
	allMessages := nonSystemMessages

	// Check if we have an existing cached summary to build upon
	existingSummary := s.getContextSummary(conversationID)
	var summaryText string

	// Always generate fresh summary when threshold exceeded (incorporating old summary if exists)
	log.Printf("🤖 [CONTEXT] Generating AI summary for %d messages in %s", len(allMessages), conversationID)

	if writeChan != nil {
		select {
		case writeChan <- models.ServerMessage{
			Type:     "context_optimizing",
			Status:   "summarizing",
			Progress: 30,
			Content:  "Summarizing conversation...",
		}:
		default:
		}
	}

	if config != nil {
		// Generate summary, incorporating existing summary if present
		summaryText = s.generateContextSummary(conversationID, allMessages, existingSummary, config)

		if summaryText != "" {
			// Cache the summary with count of ALL messages summarized
			s.setContextSummary(conversationID, &ContextSummary{
				Summary:          summaryText,
				SummarizedCount:  len(allMessages),
				LastMessageIndex: len(allMessages) - 1,
				CreatedAt:        time.Now(),
			})

			// Summary complete
			if writeChan != nil {
				select {
				case writeChan <- models.ServerMessage{
					Type:     "context_optimizing",
					Status:   "completed",
					Progress: 100,
					Content:  "Context optimized successfully",
				}:
				default:
				}
			}
		} else {
			// AI summary failed - still notify completion so modal closes
			if writeChan != nil {
				select {
				case writeChan <- models.ServerMessage{
					Type:     "context_optimizing",
					Status:   "completed",
					Progress: 100,
					Content:  "Context trimmed (summary unavailable)",
				}:
				default:
				}
			}
		}
	} else {
		// No cached summary and no config - just notify completion
		if writeChan != nil {
			select {
			case writeChan <- models.ServerMessage{
				Type:     "context_optimizing",
				Status:   "completed",
				Progress: 100,
				Content:  "Context trimmed",
			}:
			default:
			}
		}
	}

	// Build optimized context
	result := make([]map[string]interface{}, 0)

	// Add system message first
	if systemMsg != nil {
		result = append(result, systemMsg)
	}

	// Add summary as a system context message
	if summaryText != "" {
		summaryMsg := map[string]interface{}{
			"role": "system",
			"content": fmt.Sprintf(`[Conversation Context Summary - %d messages summarized]
%s

[End of summary - new messages will be added below]`, len(allMessages), summaryText),
		}
		result = append(result, summaryMsg)
	} else {
		// Fallback: just note that context was trimmed
		summaryMsg := map[string]interface{}{
			"role":    "system",
			"content": fmt.Sprintf("[Note: %d earlier messages were condensed due to context limits.]", len(allMessages)),
		}
		result = append(result, summaryMsg)
	}

	// NO recent messages kept - only the summary
	// New messages will be added naturally as conversation continues

	newTokens := estimateMessagesTokens(result)
	log.Printf("📉 [CONTEXT] Reduced from %d to %d tokens (summarized %d msgs, keeping only summary)", totalTokens, newTokens, len(allMessages))

	return result
}

// optimizeContextAfterStream runs context optimization AFTER streaming completes
// This is called asynchronously so it doesn't block the user experience
func (s *ChatService) optimizeContextAfterStream(userConn *models.UserConnection) {
	// Recover from panics (user may disconnect)
	defer func() {
		if r := recover(); r != nil {
			log.Printf("⚠️ [CONTEXT] Recovered from panic during post-stream optimization: %v", r)
		}
	}()

	// Get current messages from cache
	messages := s.getConversationMessages(userConn.ConversationID)
	totalTokens := estimateMessagesTokens(messages)

	// Check if optimization is needed
	if totalTokens <= SummarizationThreshold {
		log.Printf("📊 [CONTEXT] Post-stream check: %d tokens, no optimization needed (threshold: %d)",
			totalTokens, SummarizationThreshold)
		return
	}

	log.Printf("📊 [CONTEXT] Post-stream optimization starting: %d tokens exceeds %d threshold",
		totalTokens, SummarizationThreshold)

	// Get config for summarization API call
	config, err := s.GetEffectiveConfig(userConn, userConn.ModelID)
	if err != nil {
		log.Printf("❌ [CONTEXT] Failed to get config for optimization: %v", err)
		return
	}

	// Run the optimization (this will send UI notifications via WriteChan)
	optimizedMessages := s.optimizeContextWindow(messages, userConn.ConversationID, config, userConn.WriteChan)

	// Save optimized messages back to cache
	s.setConversationMessages(userConn.ConversationID, optimizedMessages)

	log.Printf("✅ [CONTEXT] Post-stream optimization complete for %s", userConn.ConversationID)
}

// checkAndTriggerMemoryExtraction checks if memory extraction threshold is reached
// This is called asynchronously after each assistant message
func (s *ChatService) checkAndTriggerMemoryExtraction(userConn *models.UserConnection) {
	// Recover from panics
	defer func() {
		if r := recover(); r != nil {
			log.Printf("⚠️ [MEMORY] Recovered from panic during memory extraction check: %v", r)
		}
	}()

	// Get user preferences to check if memory is enabled and get threshold
	ctx := context.Background()
	user, err := s.userService.GetUserBySupabaseID(ctx, userConn.UserID)
	if err != nil {
		log.Printf("⚠️ [MEMORY] Failed to get user preferences: %v", err)
		return
	}

	// Check if memory system is enabled for this user
	if !user.Preferences.MemoryEnabled {
		return // Memory system disabled, skip extraction
	}

	// Get user's configured threshold (default to 20 if not set)
	threshold := user.Preferences.MemoryExtractionThreshold
	if threshold <= 0 {
		threshold = 20 // Default to 20 messages (conservative)
	}

	// Get current messages from cache
	messages := s.getConversationMessages(userConn.ConversationID)
	messageCount := len(messages)

	// Check if threshold reached (message count is multiple of threshold)
	if messageCount > 0 && messageCount%threshold == 0 {
		log.Printf("🧠 [MEMORY] Threshold reached (%d messages), enqueuing extraction job for conversation %s",
			messageCount, userConn.ConversationID)

		// Get recent messages (last 'threshold' messages for extraction)
		startIndex := messageCount - threshold
		if startIndex < 0 {
			startIndex = 0
		}
		recentMessages := messages[startIndex:]

		if s.hindsightClient != nil {
			// Hindsight does its own fact/entity extraction server-side from
			// raw text — no local job queue or extractor-model pool needed.
			// Fire-and-forget: retain() took several seconds against a local
			// model in testing, same order of magnitude as the native
			// pipeline's background worker, so this must not block the turn.
			go func(userID string, msgs []map[string]interface{}) {
				defer func() {
					if r := recover(); r != nil {
						log.Printf("⚠️ [MEMORY-HINDSIGHT] Recovered from panic during retain: %v", r)
					}
				}()
				blob := buildQueryTextFromMessages(msgs)
				ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
				defer cancel()
				if err := s.hindsightClient.Retain(ctx, userID, blob, "chat"); err != nil {
					log.Printf("⚠️ [MEMORY-HINDSIGHT] Retain failed: %v", err)
				} else {
					log.Printf("✅ [MEMORY-HINDSIGHT] Retained %d messages for user %s", len(msgs), userID)
				}
			}(userConn.UserID, recentMessages)
			return
		}

		// Enqueue extraction job (non-blocking)
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		err := s.memoryExtractionService.EnqueueExtraction(
			ctx,
			userConn.UserID,
			userConn.ConversationID,
			recentMessages,
		)
		if err != nil {
			log.Printf("⚠️ [MEMORY] Failed to enqueue extraction job: %v", err)
		} else {
			log.Printf("✅ [MEMORY] Extraction job enqueued successfully")
		}
	}
}

// SetConversationMessages stores messages in cache with TTL (public)
func (s *ChatService) SetConversationMessages(conversationID string, messages []map[string]interface{}) {
	s.setConversationMessages(conversationID, messages)
}

// clearConversation removes all messages for a conversation (internal)
func (s *ChatService) clearConversation(conversationID string) {
	s.conversationCache.Delete(conversationID)
	log.Printf("🗑️  [CACHE] Cleared conversation %s", conversationID)
}

// ClearConversation removes all messages for a conversation (public)
func (s *ChatService) ClearConversation(conversationID string) {
	s.clearConversation(conversationID)
}

// CreateConversation creates a new conversation in the database with ownership tracking
func (s *ChatService) CreateConversation(conversationID, userID, title string) error {
	_, err := s.db.Exec(`
		INSERT INTO conversations (id, user_id, title, expires_at)
		VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))
		ON DUPLICATE KEY UPDATE
			last_activity_at = NOW(),
			expires_at = DATE_ADD(NOW(), INTERVAL 30 MINUTE)
	`, conversationID, userID, title)

	if err != nil {
		return fmt.Errorf("failed to create conversation: %w", err)
	}

	log.Printf("📝 [OWNERSHIP] Created conversation %s for user %s", conversationID, userID)
	return nil
}

// IsConversationOwner checks if a user owns a specific conversation
func (s *ChatService) IsConversationOwner(conversationID, userID string) bool {
	var ownerID string
	err := s.db.QueryRow("SELECT user_id FROM conversations WHERE id = ?", conversationID).Scan(&ownerID)

	if err != nil {
		// Conversation doesn't exist in database - allow access (for backward compatibility with cache-only conversations)
		log.Printf("⚠️  [OWNERSHIP] Conversation %s not in database, allowing access", conversationID)
		return true
	}

	isOwner := ownerID == userID
	if !isOwner {
		log.Printf("🚫 [OWNERSHIP] User %s denied access to conversation %s (owned by %s)", userID, conversationID, ownerID)
	}

	return isOwner
}

// UpdateConversationActivity updates the last activity timestamp and extends expiration
func (s *ChatService) UpdateConversationActivity(conversationID string) error {
	_, err := s.db.Exec(`
		UPDATE conversations
		SET last_activity_at = NOW(),
			expires_at = DATE_ADD(NOW(), INTERVAL 30 MINUTE),
			updated_at = NOW()
		WHERE id = ?
	`, conversationID)

	if err != nil {
		return fmt.Errorf("failed to update conversation activity: %w", err)
	}

	return nil
}

// DeleteAllConversationsByUser deletes all conversations for a specific user (for GDPR compliance)
func (s *ChatService) DeleteAllConversationsByUser(userID string) error {
	result, err := s.db.Exec("DELETE FROM conversations WHERE user_id = ?", userID)
	if err != nil {
		return fmt.Errorf("failed to delete user conversations: %w", err)
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("🗑️  [GDPR] Deleted %d conversations for user %s", rowsAffected, userID)

	return nil
}

// GetAllConversationsByUser retrieves all conversations for a user (for GDPR data export)
func (s *ChatService) GetAllConversationsByUser(userID string) ([]map[string]interface{}, error) {
	rows, err := s.db.Query(`
		SELECT id, title, created_at, updated_at, last_activity_at, expires_at
		FROM conversations
		WHERE user_id = ?
		ORDER BY created_at DESC
	`, userID)

	if err != nil {
		return nil, fmt.Errorf("failed to query conversations: %w", err)
	}
	defer rows.Close()

	conversations := make([]map[string]interface{}, 0)

	for rows.Next() {
		var id, title, createdAt, updatedAt, lastActivityAt, expiresAt string

		if err := rows.Scan(&id, &title, &createdAt, &updatedAt, &lastActivityAt, &expiresAt); err != nil {
			log.Printf("⚠️  Failed to scan conversation: %v", err)
			continue
		}

		// Get messages from cache if available
		messages := s.getConversationMessages(id)

		conversation := map[string]interface{}{
			"id":               id,
			"title":            title,
			"created_at":       createdAt,
			"updated_at":       updatedAt,
			"last_activity_at": lastActivityAt,
			"expires_at":       expiresAt,
			"message_count":    len(messages),
			"messages":         messages,
		}

		conversations = append(conversations, conversation)
	}

	return conversations, nil
}

// ConversationStatus holds status information about a conversation
type ConversationStatus struct {
	Exists    bool  `json:"exists"`
	HasFiles  bool  `json:"hasFiles"`
	ExpiresIn int64 `json:"expiresIn"` // seconds until expiration, -1 if expired
}

// GetConversationStatus checks if a conversation exists and when it expires
func (s *ChatService) GetConversationStatus(conversationID string) *ConversationStatus {
	status := &ConversationStatus{
		Exists:    false,
		HasFiles:  false,
		ExpiresIn: -1,
	}

	// Check if conversation exists in cache
	if _, expiration, found := s.conversationCache.GetWithExpiration(conversationID); found {
		status.Exists = true

		// Calculate time until expiration
		if !expiration.IsZero() {
			timeUntilExpiration := time.Until(expiration)
			status.ExpiresIn = int64(timeUntilExpiration.Seconds())
		}

		// Check if conversation has files
		fileCache := GetFileCacheService()
		fileIDs := fileCache.GetConversationFiles(conversationID)
		status.HasFiles = len(fileIDs) > 0

		log.Printf("📊 [STATUS] Conversation %s: exists=%v, hasFiles=%v, expiresIn=%ds",
			conversationID, status.Exists, status.HasFiles, status.ExpiresIn)
	} else {
		log.Printf("📊 [STATUS] Conversation %s: not found in cache", conversationID)
	}

	return status
}

// AddUserMessage adds a user message to the conversation cache
func (s *ChatService) AddUserMessage(conversationID string, content interface{}) {
	messages := s.getConversationMessages(conversationID)

	// 🔍 DIAGNOSTIC: Log messages retrieved before adding new one
	log.Printf("🔍 [ADD-USER] Retrieved %d messages from cache for conversation %s",
		len(messages), conversationID)

	messages = append(messages, map[string]interface{}{
		"role":    "user",
		"content": content,
	})

	// 🔍 DIAGNOSTIC: Log messages after adding new user message
	log.Printf("🔍 [ADD-USER] After append: %d messages (added 1 user message)", len(messages))

	s.setConversationMessages(conversationID, messages)
}

// hasImageAttachments checks if messages contain any image attachments
func (s *ChatService) hasImageAttachments(messages []map[string]interface{}) bool {
	for _, msg := range messages {
		content := msg["content"]
		if content == nil {
			continue
		}

		// Try []interface{} first (generic slice)
		if contentArr, ok := content.([]interface{}); ok {
			for _, part := range contentArr {
				if partMap, ok := part.(map[string]interface{}); ok {
					if partType, ok := partMap["type"].(string); ok && partType == "image_url" {
						log.Printf("🖼️ [VISION-CHECK] Found image_url in []interface{} content")
						return true
					}
				}
			}
		}

		// Try []map[string]interface{} (typed slice - this is what websocket handler creates)
		if contentArr, ok := content.([]map[string]interface{}); ok {
			for _, part := range contentArr {
				if partType, ok := part["type"].(string); ok && partType == "image_url" {
					log.Printf("🖼️ [VISION-CHECK] Found image_url in []map[string]interface{} content")
					return true
				}
			}
		}
	}
	return false
}

// modelSupportsVision checks if a model supports vision/image inputs
func (s *ChatService) modelSupportsVision(modelID string) bool {
	// First check if it's an alias and get the actual model info
	configService := GetConfigService()
	var actualModelName string

	for providerID, aliases := range s.modelAliases {
		for aliasKey, aliasValue := range aliases {
			if aliasKey == modelID {
				// Found as alias - check the alias config for vision support
				aliasInfo := configService.GetModelAlias(providerID, aliasKey)
				if aliasInfo != nil && aliasInfo.SupportsVision != nil {
					log.Printf("📊 [VISION CHECK] Alias '%s' has explicit vision support: %v", modelID, *aliasInfo.SupportsVision)
					return *aliasInfo.SupportsVision
				}
				// If not explicitly set in alias, use actual model name for DB lookup
				actualModelName = aliasValue
				log.Printf("📊 [VISION CHECK] Alias '%s' -> actual model '%s' (no explicit vision setting)", modelID, actualModelName)
				break
			}
		}
		if actualModelName != "" {
			break
		}
	}

	// Use actual model name if found via alias, otherwise use the provided modelID
	queryModelName := modelID
	if actualModelName != "" {
		queryModelName = actualModelName
	}

	// Check database for model's vision support
	var supportsVision int
	err := s.db.QueryRow("SELECT supports_vision FROM models WHERE id = ? OR name = ?", queryModelName, queryModelName).Scan(&supportsVision)
	if err != nil {
		// Model not found - assume it doesn't support vision (safer approach)
		log.Printf("📊 [VISION CHECK] Model '%s' not found in database - assuming no vision support", queryModelName)
		return false
	}

	result := supportsVision == 1
	log.Printf("📊 [VISION CHECK] Model '%s' supports_vision=%v", queryModelName, result)
	return result
}

// ModelSupportsVision is a public wrapper to check if a model supports vision
func (s *ChatService) ModelSupportsVision(modelID string) bool {
	return s.modelSupportsVision(modelID)
}

// FindVisionCapableModel is a public wrapper to find a vision-capable model
// Returns (providerID, modelName, found)
func (s *ChatService) FindVisionCapableModel() (int, string, bool) {
	return s.findVisionCapableModel()
}

// GetVisibleModels returns all visible models for display
func (s *ChatService) GetVisibleModels() ([]map[string]interface{}, error) {
	query := `
		SELECT m.id, m.name, m.display_name, m.supports_vision, m.supports_tools,
		       p.name as provider_name
		FROM models m
		JOIN providers p ON m.provider_id = p.id
		WHERE m.is_visible = 1 AND p.enabled = 1 AND (p.audio_only = 0 OR p.audio_only IS NULL)
		ORDER BY p.name, m.name
		LIMIT 20
	`
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query models: %w", err)
	}
	defer rows.Close()

	var modelList []map[string]interface{}
	for rows.Next() {
		var id, name, providerName string
		var displayName sql.NullString
		var supportsVision, supportsTools int

		if err := rows.Scan(&id, &name, &displayName, &supportsVision, &supportsTools, &providerName); err != nil {
			continue
		}

		display := name
		if displayName.Valid && displayName.String != "" {
			display = displayName.String
		}

		modelList = append(modelList, map[string]interface{}{
			"id":              id,
			"name":            name,
			"display_name":    display,
			"provider":        providerName,
			"supports_vision": supportsVision == 1,
			"supports_tools":  supportsTools == 1,
		})
	}

	return modelList, nil
}

// findVisionCapableModel finds a vision-capable model to use as fallback
// Returns (providerID, modelName, found)
func (s *ChatService) findVisionCapableModel() (int, string, bool) {
	// First, check aliases for vision-capable models (preferred)
	configService := GetConfigService()
	allAliases := configService.GetAllModelAliases()

	for providerID, aliases := range allAliases {
		for aliasKey, aliasInfo := range aliases {
			if aliasInfo.SupportsVision != nil && *aliasInfo.SupportsVision {
				log.Printf("🔍 [VISION FALLBACK] Found vision-capable alias: %s (provider %d)", aliasKey, providerID)
				return providerID, aliasKey, true
			}
		}
	}

	// Query database for any vision-capable model
	var providerID int
	var modelName string
	err := s.db.QueryRow(`
		SELECT m.provider_id, m.name
		FROM models m
		JOIN providers p ON m.provider_id = p.id
		WHERE m.supports_vision = 1 AND m.is_visible = 1 AND p.enabled = 1
		ORDER BY m.provider_id ASC
		LIMIT 1
	`).Scan(&providerID, &modelName)

	if err != nil {
		log.Printf("⚠️  [VISION FALLBACK] No vision-capable model found in database")
		return 0, "", false
	}

	log.Printf("🔍 [VISION FALLBACK] Found vision-capable model: %s (provider %d)", modelName, providerID)
	return providerID, modelName, true
}

// modelSupportsTools checks if a model supports tools (returns true if unknown - optimistic approach)
func (s *ChatService) modelSupportsTools(modelID string) bool {
	log.Printf("🔍 [REQUEST] Checking if model '%s' supports tools...", modelID)
	log.Printf("🔍 [DB CHECK] Querying database for model: '%s'", modelID)

	var supportsTools int
	err := s.db.QueryRow("SELECT supports_tools FROM model_capabilities WHERE model_id = ?", modelID).Scan(&supportsTools)

	if err != nil {
		// Model not in database or error, assume it supports tools (optimistic)
		log.Printf("📊 [DB CHECK] Model '%s' NOT FOUND in database - assuming tools supported (optimistic)", modelID)
		return true
	}

	result := supportsTools == 1
	log.Printf("📊 [DB CHECK] Model '%s' found in database: supports_tools=%d (returning %v)", modelID, supportsTools, result)
	return result
}

// markModelNoToolSupport marks a model as not supporting tools
func (s *ChatService) markModelNoToolSupport(modelID string) error {
	log.Printf("💾 [DB WRITE] Attempting to mark model '%s' as NOT supporting tools", modelID)

	result, err := s.db.Exec(
		"REPLACE INTO model_capabilities (model_id, supports_tools) VALUES (?, 0)",
		modelID,
	)

	if err != nil {
		log.Printf("❌ [DB WRITE] Failed to mark model as no tool support: %v", err)
		return fmt.Errorf("failed to mark model as no tool support: %v", err)
	}

	rowsAffected, _ := result.RowsAffected()
	log.Printf("✅ [DB WRITE] Successfully marked model '%s' as NOT supporting tools (rows affected: %d)", modelID, rowsAffected)
	return nil
}

// getFreeTierConfig returns the configuration for the free tier model
// This is used when anonymous users try to access restricted models
func (s *ChatService) getFreeTierConfig(connID string) (*models.Config, error) {
	// First try model_aliases table (aliased models with free_tier)
	var aliasModelID string
	var aliasProviderID int
	err := s.db.QueryRow(`
		SELECT model_id, provider_id
		FROM model_aliases
		WHERE free_tier = 1
		LIMIT 1
	`).Scan(&aliasModelID, &aliasProviderID)

	if err == nil {
		provider, provErr := s.providerService.GetByID(aliasProviderID)
		if provErr == nil && provider.Enabled {
			log.Printf("🔒 [AUTH] Restricting connection %s to free tier alias model: %s", connID, aliasModelID)
			return &models.Config{
				BaseURL:    provider.BaseURL,
				APIKey:     provider.APIKey,
				Model:      aliasModelID,
				ProviderID: provider.ID,
			}, nil
		}
	}

	// Fall back to models table (non-aliased models with free_tier)
	var freeTierModelName string
	var freeTierProviderID int
	err = s.db.QueryRow(`
		SELECT name, provider_id
		FROM models
		WHERE free_tier = 1 AND is_visible = 1
		LIMIT 1
	`).Scan(&freeTierModelName, &freeTierProviderID)

	if err != nil {
		log.Printf("❌ [AUTH] No free tier model configured! Anonymous users cannot use the system.")
		return nil, fmt.Errorf("no free tier model available for anonymous users")
	}

	provider, err := s.providerService.GetByID(freeTierProviderID)
	if err != nil || !provider.Enabled {
		log.Printf("❌ [AUTH] Free tier model provider is disabled or not found")
		return nil, fmt.Errorf("free tier provider unavailable")
	}

	log.Printf("🔒 [AUTH] Restricting connection %s to free tier model: %s", connID, freeTierModelName)
	return &models.Config{
		BaseURL:    provider.BaseURL,
		APIKey:     provider.APIKey,
		Model:      freeTierModelName,
		ProviderID: provider.ID,
	}, nil
}

// GetEffectiveConfig returns the appropriate configuration based on user's selection
func (s *ChatService) GetEffectiveConfig(userConn *models.UserConnection, modelID string) (*models.Config, error) {
	// Priority 1: User provided their own API key (BYOK - Bring Your Own Key)
	if userConn.CustomConfig != nil {
		if userConn.CustomConfig.BaseURL != "" &&
			userConn.CustomConfig.APIKey != "" &&
			userConn.CustomConfig.Model != "" {
			log.Printf("🔑 [CONFIG] Using BYOK for user %s: model=%s", userConn.ConnID, userConn.CustomConfig.Model)
			return &models.Config{
				BaseURL: userConn.CustomConfig.BaseURL,
				APIKey:  userConn.CustomConfig.APIKey,
				Model:   userConn.CustomConfig.Model,
			}, nil
		}

		// Partial custom config - fall through to use platform providers if incomplete
		log.Printf("⚠️  [CONFIG] Incomplete custom config for user %s, falling back to platform providers", userConn.ConnID)
	}

	// Priority 2: User selected a model from platform (uses platform API keys)
	if modelID != "" {
		var providerID int
		var modelName string
		var foundModel bool

		// First, check if modelID is a model alias (e.g., "haiku-4.5" -> "glm-4.5-air")
		if aliasProviderID, actualModel, found := s.resolveModelAlias(modelID); found {
			// It's an alias - get the provider directly
			provider, err := s.providerService.GetByID(aliasProviderID)
			if err == nil && provider.Enabled {
				// Check if anonymous user is trying to use non-free-tier model
				if userConn.UserID == "anonymous" {
					// Check if this alias is free tier (aliases store free_tier in model_aliases table)
					var isFreeTier int
					err := s.db.QueryRow(
						"SELECT COALESCE(free_tier, 0) FROM model_aliases WHERE alias_name = ?",
						modelID,
					).Scan(&isFreeTier)

					if err != nil || isFreeTier == 0 {
						// Not free tier - redirect to free tier model
						log.Printf("⚠️  [AUTH] Anonymous user %s attempted to use restricted model %s (alias: %s), forcing free tier",
							userConn.ConnID, actualModel, modelID)
						return s.getFreeTierConfig(userConn.ConnID)
					}
				}

				// Defensive: an alias may have been seeded with a row-id
				// (e.g. "3:zai.glm-5") instead of the bare API name. Strict
				// providers like Bedrock reject the prefixed form. If the
				// actualModel resolves to a row in the models table, swap to
				// that row's `name` column before sending to the provider.
				if _, apiName, lookupErr := s.providerService.GetByModelIDWithName(actualModel); lookupErr == nil && apiName != "" && apiName != actualModel {
					log.Printf("🩹 [CONFIG] Alias actualModel '%s' is a row id; using api name '%s'", actualModel, apiName)
					actualModel = apiName
				}

				log.Printf("🏢 [CONFIG] Using aliased model for user %s: alias=%s, actual_model=%s, provider=%s",
					userConn.ConnID, modelID, actualModel, provider.Name)

				return &models.Config{
					BaseURL:    provider.BaseURL,
					APIKey:     provider.APIKey,
					Model:      actualModel,
					ProviderID: provider.ID,
				}, nil
			}
		}

		// Not an alias, try to find in database by model ID
		err := s.db.QueryRow(
			"SELECT provider_id, name FROM models WHERE id = ? AND is_visible = 1",
			modelID,
		).Scan(&providerID, &modelName)

		if err == nil {
			foundModel = true
		}

		if foundModel {
			// Check if anonymous user is trying to use non-free-tier model
			if userConn.UserID == "anonymous" {
				var isFreeTier int
				err := s.db.QueryRow(
					"SELECT COALESCE(free_tier, 0) FROM models WHERE id = ? AND is_visible = 1",
					modelID,
				).Scan(&isFreeTier)

				if err != nil || isFreeTier == 0 {
					// Not free tier - redirect to free tier model
					log.Printf("⚠️  [AUTH] Anonymous user %s attempted to use restricted model %s, forcing free tier",
						userConn.ConnID, modelName)
					return s.getFreeTierConfig(userConn.ConnID)
				}
			}

			provider, err := s.providerService.GetByID(providerID)
			if err == nil && provider.Enabled {
				// Resolve model name using aliases (if configured)
				actualModelName := s.resolveModelName(providerID, modelName)

				if actualModelName != modelName {
					log.Printf("🏢 [CONFIG] Using platform model for user %s: frontend_model=%s, actual_model=%s, provider=%s",
						userConn.ConnID, modelName, actualModelName, provider.Name)
				} else {
					log.Printf("🏢 [CONFIG] Using platform model for user %s: model=%s, provider=%s",
						userConn.ConnID, modelName, provider.Name)
				}

				return &models.Config{
					BaseURL:    provider.BaseURL,
					APIKey:     provider.APIKey,
					Model:      actualModelName, // Use resolved model name
					ProviderID: provider.ID,
				}, nil
			}
		}
	}

	// Priority 3: Fallback to first enabled provider with visible models
	log.Printf("⚙️  [CONFIG] No model selected, using fallback for user %s", userConn.ConnID)

	// Get first enabled provider
	var providerID int
	var providerName, baseURL, apiKey string
	err := s.db.QueryRow(`
		SELECT id, name, base_url, api_key
		FROM providers
		WHERE enabled = 1
		ORDER BY id ASC
		LIMIT 1
	`).Scan(&providerID, &providerName, &baseURL, &apiKey)

	if err != nil {
		return nil, fmt.Errorf("no enabled providers found: %w", err)
	}

	// Get first visible model from this provider
	var modelName string
	err = s.db.QueryRow(`
		SELECT name
		FROM models
		WHERE provider_id = ? AND is_visible = 1
		ORDER BY id ASC
		LIMIT 1
	`, providerID).Scan(&modelName)

	if err != nil {
		return nil, fmt.Errorf("no visible models found for provider %s: %w", providerName, err)
	}

	log.Printf("🔄 [CONFIG] Fallback using provider=%s, model=%s for user %s", providerName, modelName, userConn.ConnID)

	return &models.Config{
		BaseURL:    baseURL,
		APIKey:     apiKey,
		Model:      modelName,
		ProviderID: providerID,
	}, nil
}

// StreamChatCompletion streams chat completion responses
func (s *ChatService) StreamChatCompletion(userConn *models.UserConnection) error {
	config, err := s.GetEffectiveConfig(userConn, userConn.ModelID)
	if err != nil {
		return fmt.Errorf("failed to get config: %w", err)
	}

	policy := s.turnPolicyFor(userConn.ModelID)
	if policy.ToolStrategy == ToolsEssentialsOnly {
		log.Printf("⚡ [LITE] Lite mode active for model %s — skipping memory, skill prompt and tool prediction", userConn.ModelID)
	}

	// Get messages from cache instead of userConn.Messages
	messages := s.getConversationMessages(userConn.ConversationID)

	// 🖼️ Auto-switch to vision model if images are present but current model doesn't support vision
	// TODO: the turn policy above is resolved from userConn.ModelID and is not
	// re-resolved after this switch, so a lite-flagged model that auto-switches
	// to a vision-capable model still runs under the lite policy.
	if s.hasImageAttachments(messages) && !s.modelSupportsVision(userConn.ModelID) {
		log.Printf("🖼️ [VISION] Images detected but model '%s' doesn't support vision - finding fallback", userConn.ModelID)

		if fallbackProviderID, fallbackModel, found := s.findVisionCapableModel(); found {
			// Get the provider config for the fallback model
			provider, err := s.providerService.GetByID(fallbackProviderID)
			if err == nil && provider.Enabled {
				// Check if fallback is an alias
				if aliasProviderID, actualModel, isAlias := s.resolveModelAlias(fallbackModel); isAlias {
					aliasProvider, err := s.providerService.GetByID(aliasProviderID)
					if err == nil && aliasProvider.Enabled {
						config = &models.Config{
							BaseURL: aliasProvider.BaseURL,
							APIKey:  aliasProvider.APIKey,
							Model:   actualModel,
						}
						log.Printf("🖼️ [VISION] Silently switched to vision model: %s (alias for %s)", fallbackModel, actualModel)
					}
				} else {
					config = &models.Config{
						BaseURL: provider.BaseURL,
						APIKey:  provider.APIKey,
						Model:   fallbackModel,
					}
					log.Printf("🖼️ [VISION] Silently switched to vision model: %s", fallbackModel)
				}
			}
		} else {
			log.Printf("⚠️  [VISION] No vision-capable model available - proceeding with current model (may fail)")
		}
	}

	// 🔍 DIAGNOSTIC: Log messages retrieved from cache for streaming
	log.Printf("🔍 [STREAM] Retrieved %d messages from cache for conversation %s",
		len(messages), userConn.ConversationID)
	if len(messages) > 0 {
		// Count message types
		systemCount, userCount, assistantCount := 0, 0, 0
		for _, msg := range messages {
			if role, ok := msg["role"].(string); ok {
				switch role {
				case "system":
					systemCount++
				case "user":
					userCount++
				case "assistant":
					assistantCount++
				}
			}
		}
		log.Printf("🔍 [STREAM] Message breakdown BEFORE system prompt: system=%d, user=%d, assistant=%d",
			systemCount, userCount, assistantCount)
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// SKILL ROUTING - Check if a skill matches the user message
	// ═══════════════════════════════════════════════════════════════════════════

	// Helper to send lightweight status updates to the frontend
	sendStatus := func(status string, details map[string]interface{}) {
		msg := models.ServerMessage{
			Type:   "status_update",
			Status: status,
		}
		if details != nil {
			msg.Arguments = details
		}
		select {
		case userConn.WriteChan <- msg:
		default:
		}
	}

	var activeSkill *models.Skill
	if s.skillService != nil && !userConn.DisableTools {
		sendStatus("routing_skill", nil)
		skillUserMsg := extractLastUserMessage(messages)
		if skillUserMsg != "" {
			routed, err := s.skillService.RouteMessage(context.Background(), userConn.UserID, skillUserMsg)
			if err == nil && routed != nil {
				activeSkill = routed
				log.Printf("🎯 [SKILL] Auto-routed to skill: %s (category: %s)", activeSkill.Name, activeSkill.Category)
				// Notify frontend of skill activation
				sendStatus("skill_matched", map[string]interface{}{
					"skill_name": activeSkill.Name,
					"skill_icon": activeSkill.Icon,
				})
			}
		}
	}

	// ═══════════════════════════════════════════════════════════════════════════
	// TOOL SELECTION - Must happen BEFORE system prompt to determine ask_user inclusion
	//
	// Priority order:
	//   1. Skills (highest) — if a skill matched, its RequiredTools drive tool selection
	//   2. Tool predictor   — AI-selected subset when no skill matched
	//   3. All tools         — fallback when no predictor is available
	//
	// The manual client tool selector is intentionally bypassed — the skill system
	// is the authoritative source for tool selection. Each skill packs the exact
	// tools needed for the job.
	// ═══════════════════════════════════════════════════════════════════════════
	var tools []map[string]interface{}
	if userConn.DisableTools {
		log.Printf("🔒 [REQUEST] TOOLS DISABLED by client (agent builder mode)")
	} else if s.modelSupportsTools(config.Model) {
		// Extract user message first to check if tools are needed
		userMessage := extractLastUserMessage(messages)

		// 🎯 OPTIMIZATION: Skip tools for simple greetings (saves ~15k-20k tokens)
		if isSimpleGreeting(userMessage) {
			log.Printf("👋 [TOOL-OPTIMIZATION] Simple greeting detected (\"%s\") - skipping all tools to save tokens", userMessage)
			tools = []map[string]interface{}{} // No tools needed for "hi", "hello", etc.
		} else {
			sendStatus("selecting_tools", nil)

			// Get credential-filtered tools for user (only tools they have credentials for)
			credentialFilteredTools := []map[string]interface{}{}
			if s.toolService != nil {
				credentialFilteredTools = s.toolService.GetAvailableTools(context.Background(), userConn.UserID)
			} else {
				// Fallback: Get ALL user tools (built-in + MCP tools) without filtering
				credentialFilteredTools = s.toolRegistry.GetUserTools(userConn.UserID)
			}

			log.Printf("📦 [REQUEST] Credential-filtered tools: %d", len(credentialFilteredTools))

			// 🎯 SKILL-FIRST TOOL SELECTION: If a skill was routed, its RequiredTools
			// drive tool selection. Only essential utility tools + skill's required tools pass through.
			if activeSkill != nil && len(activeSkill.RequiredTools) > 0 {
				// Build the skill's required tool set
				skillToolSet := make(map[string]bool, len(activeSkill.RequiredTools))
				for _, t := range activeSkill.RequiredTools {
					skillToolSet[t] = true
				}

				filtered := make([]map[string]interface{}, 0, len(activeSkill.RequiredTools)+len(essentialToolNames))
				for _, toolDef := range credentialFilteredTools {
					if fn, ok := toolDef["function"].(map[string]interface{}); ok {
						if name, ok := fn["name"].(string); ok {
							// Include only: essential tools OR skill's required tools
							if essentialToolNames[name] || skillToolSet[name] {
								filtered = append(filtered, toolDef)
							}
						}
					}
				}
				log.Printf("🎯 [SKILL] Skill-driven tool selection: %d/%d tools (skill=%s, required=%v, essential=%d)",
					len(filtered), len(credentialFilteredTools), activeSkill.Name, activeSkill.RequiredTools, len(essentialToolNames))
				tools = filtered
				sendStatus("tools_ready", map[string]interface{}{
					"count":  len(filtered),
					"method": "skill",
				})
			} else if activeSkill != nil {
				// Skill matched but has no RequiredTools — use all tools
				log.Printf("🎯 [SKILL] Skill %s matched (no specific tools required), using all %d tools",
					activeSkill.Name, len(credentialFilteredTools))
				tools = credentialFilteredTools
				sendStatus("tools_ready", map[string]interface{}{
					"count":  len(credentialFilteredTools),
					"method": "skill",
				})
			} else if s.toolPredictorService != nil && len(credentialFilteredTools) > 0 && policy.ToolStrategy != ToolsEssentialsOnly {
				// No skill matched — predict CAPABILITY GROUPS (Phase 2), not
				// individual tools. The predictor chooses among ~12 groups instead
				// of ~192 tools (a coarse choice a small model gets right), then we
				// expand the chosen groups to their member tools. Reuses the whole
				// PredictTools machinery by passing synthetic group definitions.
				sendStatus("predicting_tools", nil)
				groupDefs := availableGroupDefs(credentialFilteredTools)
				log.Printf("🤖 [TOOL-PREDICTOR] Predicting capability groups (%d groups available from %d tools, %d history msgs)...",
					len(groupDefs), len(credentialFilteredTools), len(messages))
				predictedGroupDefs, err := s.toolPredictorService.PredictTools(
					context.Background(),
					userConn.UserID,
					userConn.ConversationID,
					userMessage,
					groupDefs,
					messages,
				)

				if err != nil {
					log.Printf("⚠️ [TOOL-PREDICTOR] Group prediction failed: %v, falling back to all tools", err)
					tools = credentialFilteredTools
					sendStatus("tools_ready", map[string]interface{}{
						"count":  len(credentialFilteredTools),
						"method": "fallback",
					})
				} else {
					tools = expandGroupsToTools(predictedGroupDefs, credentialFilteredTools)
					groupNames := make([]string, 0, len(predictedGroupDefs))
					for _, g := range predictedGroupDefs {
						groupNames = append(groupNames, toolDefName(g))
					}
					log.Printf("✅ [TOOL-PREDICTOR] Selected groups %v → %d tools", groupNames, len(tools))
					sendStatus("tools_ready", map[string]interface{}{
						"count":  len(tools),
						"method": "predicted_groups",
					})
				}
			} else if policy.ToolStrategy == ToolsEssentialsOnly {
				filtered := make([]map[string]interface{}, 0, len(essentialToolNames))
				for _, toolDef := range credentialFilteredTools {
					if fn, ok := toolDef["function"].(map[string]interface{}); ok {
						if name, ok := fn["name"].(string); ok && essentialToolNames[name] {
							filtered = append(filtered, toolDef)
						}
					}
				}
				tools = filtered
				log.Printf("⚡ [LITE] Using %d essential tools (from %d available)", len(tools), len(credentialFilteredTools))
				sendStatus("tools_ready", map[string]interface{}{
					"count":  len(tools),
					"method": "lite",
				})
			} else {
				// No skill, no predictor — use all credential-filtered tools
				log.Printf("📦 [REQUEST] No skill matched, no predictor, using all %d filtered tools", len(credentialFilteredTools))
				tools = credentialFilteredTools
			}

			// Dependency-closure guarantee: when a data file is in play, ensure the
			// WHOLE data/analysis workflow is available (read -> compute -> output),
			// unioned ON TOP of whatever was selected — so the model never stalls
			// mid-task on a missing step (the predictor kept separating run_python
			// from the output tools). Then always-on core tools. Additive only.
			if messagesHaveDataFile(messages) {
				before := len(tools)
				tools = unionToolsByName(tools, credentialFilteredTools, dataAnalysisGroupTools)
				if len(tools) != before {
					log.Printf("📊 [TOOLS] Data file present → guaranteed data-analysis group (%d→%d tools)", before, len(tools))
				}
			}
			tools = unionToolsByName(tools, credentialFilteredTools, alwaysOnCoreTools)

			if policy.ToolStrategy == ToolsEssentialsOnly {
				log.Printf("⚡ [LITE] Final tool count for this turn: %d", len(tools))
			}
		}

		// ─── RAG: per-turn search_knowledge injection ─────────────
		// When the user has attached projects via the chat picker AND
		// at least one of those projects has indexed knowledge, append
		// search_knowledge as a turn-scoped tool. The dispatch path
		// below routes it via userConn.InjectedTools so it doesn't
		// have to be in the global registry.
		userConn.InjectedTools = nil // reset every turn
		if s.ragSearcher != nil && len(userConn.KnowledgeProjectIDs) > 0 {
			ctx := context.Background()
			hasAny := false
			for _, pidHex := range userConn.KnowledgeProjectIDs {
				pid, err := primitive.ObjectIDFromHex(pidHex)
				if err == nil && s.ragSearcher.HasKnowledge(ctx, userConn.UserID, pid) {
					hasAny = true
					break
				}
			}
			if hasAny {
				skTool := s.ragSearcher.BuildSearchTool(userConn.UserID, userConn.KnowledgeProjectIDs)
				if skTool != nil {
					tools = append(tools, map[string]interface{}{
						"type": "function",
						"function": map[string]interface{}{
							"name":        skTool.Name,
							"description": skTool.Description,
							"parameters":  skTool.Parameters,
						},
					})
					if userConn.InjectedTools == nil {
						userConn.InjectedTools = map[string]models.InjectedTool{}
					}
					userConn.InjectedTools[skTool.Name] = models.InjectedTool{Execute: skTool.Execute}
					log.Printf("📚 [RAG] Injected search_knowledge for user %s (%d project(s))",
						userConn.UserID, len(userConn.KnowledgeProjectIDs))
				}
			}
		}

		// Log MCP connection status
		if s.mcpBridge != nil && s.mcpBridge.IsUserConnected(userConn.UserID) {
			builtinCount := s.toolRegistry.Count()
			mcpCount := s.toolRegistry.CountUserTools(userConn.UserID) - builtinCount
			log.Printf("📦 [REQUEST] INCLUDING TOOLS for model: %s (built-in: %d, MCP: %d, selected: %d)",
				config.Model, builtinCount, mcpCount, len(tools))
		} else {
			log.Printf("📦 [REQUEST] INCLUDING TOOLS for model: %s (selected tools: %d)", config.Model, len(tools))
		}
	} else {
		log.Printf("🚫 [REQUEST] EXCLUDING TOOLS for model: %s (marked as incompatible)", config.Model)
	}

	// Get system prompt - include ask_user instructions only if ask_user is actually
	// in the selected tools list. This prevents the prompt from telling the model to
	// use ask_user when it's not available, which causes MALFORMED_FUNCTION_CALL errors
	// (especially with Gemini) and empty responses.
	includeAskUser := false
	for _, t := range tools {
		if fn, ok := t["function"].(map[string]interface{}); ok {
			if name, ok := fn["name"].(string); ok && name == "ask_user" {
				includeAskUser = true
				break
			}
		}
	}
	systemPrompt := s.GetSystemPrompt(userConn, includeAskUser)

	// SKILL PROMPT INJECTION — Prepend the skill's system prompt before the base system prompt
	if !policy.SkipSkillPrompt {
		if activeSkill != nil && activeSkill.SystemPrompt != "" {
			systemPrompt = activeSkill.SystemPrompt + "\n\n---\n\n" + systemPrompt
			log.Printf("🎯 [SKILL] Injected skill system prompt for: %s (%d chars)", activeSkill.Name, len(activeSkill.SystemPrompt))
		}
	}

	// Inject available images context if there are images in this conversation
	imageRegistry := GetImageRegistryService()
	if imageRegistry.HasImages(userConn.ConversationID) {
		imageContext := imageRegistry.BuildSystemContext(userConn.ConversationID)
		if imageContext != "" {
			systemPrompt = systemPrompt + "\n\n" + imageContext
			log.Printf("📸 [SYSTEM] Injected image context for conversation %s", userConn.ConversationID)
		}
	}

	messages = s.buildMessagesWithSystemPrompt(systemPrompt, messages)

	// Annotate the system block with cache_control for providers that honor
	// it (Bedrock OpenAI shim, Anthropic native). Silent no-op otherwise.
	if applyPromptCaching(messages, config.BaseURL) {
		log.Printf("💾 [CACHE] Applied prompt caching marker on system message (provider: %s)", config.BaseURL)
	}

	// Note: Context optimization now happens AFTER streaming ends (in processStream)
	// This prevents blocking the response while the user waits

	// Prepare chat request
	chatReq := models.ChatRequest{
		Model:       config.Model,
		Messages:    messages,
		Stream:      true,
		Temperature: 0.7,
	}

	// Only include tools if non-empty (some APIs reject empty tools array)
	if len(tools) > 0 {
		chatReq.Tools = tools
		// Opt in to parallel tool calls so the model can emit multiple
		// tool_calls per turn — the execution loop below fans them out
		// concurrently. Pointer + omitempty means providers that don't
		// recognize the field won't see it (we always set it explicitly
		// when tools are present).
		parallelOn := true
		chatReq.ParallelToolCalls = &parallelOn
	}

	// Forward the reasoning_effort hint to the provider. Only emit known
	// values to avoid validation errors on providers that strictly
	// enforce the enum (gpt-oss rejects "none" but accepts low/medium/high).
	switch strings.ToLower(userConn.ReasoningEffort) {
	case "low", "medium", "high":
		chatReq.ReasoningEffort = strings.ToLower(userConn.ReasoningEffort)
		log.Printf("🧠 [REASONING] effort=%s for user %s", chatReq.ReasoningEffort, userConn.ConnID)
	}

	reqBody, err := json.Marshal(chatReq)
	if err != nil {
		return fmt.Errorf("failed to marshal request: %w", err)
	}

	// 🔍 DIAGNOSTIC: Log exactly what's being sent to LLM
	log.Printf("🔍 [LLM-REQUEST] Sending to LLM - Model: %s, Messages: %d, Tools: %d",
		chatReq.Model, len(chatReq.Messages), len(chatReq.Tools))
	log.Printf("🔍 [LLM-REQUEST] Request body size: %d bytes", len(reqBody))

	// 📋 Print the FULL JSON payload being sent to LLM
	prettyJSON, _ := json.MarshalIndent(chatReq, "", "  ")
	log.Printf("📋 [LLM-REQUEST] FULL JSON PAYLOAD:\n%s", string(prettyJSON))

	// Log all messages with FULL content for the user message
	if len(chatReq.Messages) > 0 {
		log.Printf("🔍 [LLM-REQUEST] === ALL MESSAGES BEING SENT TO LLM ===")
		for i, msg := range chatReq.Messages {
			role, _ := msg["role"].(string)
			contentStr := ""

			// Handle different content types
			if content, ok := msg["content"].(string); ok {
				contentStr = content
			} else if contentArr, ok := msg["content"].([]interface{}); ok {
				// Multi-part content (vision models)
				for j, part := range contentArr {
					if partMap, ok := part.(map[string]interface{}); ok {
						partType, _ := partMap["type"].(string)
						if partType == "text" {
							if text, ok := partMap["text"].(string); ok {
								contentStr += fmt.Sprintf("[Part %d - text]: %s\n", j, text)
							}
						} else if partType == "image_url" {
							contentStr += fmt.Sprintf("[Part %d - image_url]: <image data>\n", j)
						}
					}
				}
			}

			toolCallID, _ := msg["tool_call_id"].(string)
			toolName, _ := msg["name"].(string)

			log.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
			if role == "tool" {
				log.Printf("📨 [MSG %d] role=%s, tool_call_id=%s, name=%s", i, role, toolCallID, toolName)
				// Truncate tool responses for readability
				if len(contentStr) > 500 {
					log.Printf("   content (truncated): %s...", contentStr[:500])
				} else {
					log.Printf("   content: %s", contentStr)
				}
			} else if role == "user" {
				// Show FULL user message content (includes injected CSV context)
				log.Printf("👤 [MSG %d] role=%s", i, role)
				log.Printf("   FULL CONTENT:\n%s", contentStr)
			} else if role == "system" {
				log.Printf("⚙️  [MSG %d] role=%s", i, role)
				if len(contentStr) > 200 {
					log.Printf("   content (truncated): %s...", contentStr[:200])
				} else {
					log.Printf("   content: %s", contentStr)
				}
			} else if role == "assistant" {
				log.Printf("🤖 [MSG %d] role=%s", i, role)
				if len(contentStr) > 300 {
					log.Printf("   content (truncated): %s...", contentStr[:300])
				} else {
					log.Printf("   content: %s", contentStr)
				}
				// Log tool calls if present
				if toolCalls, ok := msg["tool_calls"].([]interface{}); ok && len(toolCalls) > 0 {
					log.Printf("   tool_calls: %d calls", len(toolCalls))
					for _, tc := range toolCalls {
						if tcMap, ok := tc.(map[string]interface{}); ok {
							if fn, ok := tcMap["function"].(map[string]interface{}); ok {
								fnName, _ := fn["name"].(string)
								fnArgs, _ := fn["arguments"].(string)
								log.Printf("     - %s(%s)", fnName, fnArgs)
							}
						}
					}
				}
			} else {
				log.Printf("❓ [MSG %d] role=%s, content=%s", i, role, contentStr)
			}
		}
		log.Printf("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
		log.Printf("🔍 [LLM-REQUEST] === END OF MESSAGES ===")
	}

	// Notify frontend that we're now calling the LLM
	sendStatus("generating", nil)

	// Create HTTP request
	req, err := http.NewRequest("POST", config.BaseURL+"/chat/completions", bytes.NewBuffer(reqBody))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+config.APIKey)

	// Send request (10 min timeout — local models like Ollama need time to cold start + generate)
	client := &http.Client{Timeout: 600 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		errorMsg := string(body)

		log.Printf("⚠️  [API ERROR] API Error for %s: %s", userConn.ConnID, errorMsg)

		// Check if error is due to tool incompatibility
		if len(tools) > 0 && s.detectToolIncompatibility(errorMsg) {
			log.Printf("🔍 [ERROR DETECTION] Tool incompatibility detected for model: %s", config.Model)

			// Mark model as not supporting tools
			if err := s.markModelNoToolSupport(config.Model); err != nil {
				log.Printf("⚠️  [ERROR DETECTION] Failed to mark model: %v", err)
			}

			// Add assistant error message to maintain alternation
			messages := s.getConversationMessages(userConn.ConversationID)
			errorMsgText := "I encountered an error. This model doesn't support tool calling. Tools have been disabled for future requests."
			messages = append(messages, map[string]interface{}{
				"role":    "assistant",
				"content": errorMsgText,
			})
			s.setConversationMessages(userConn.ConversationID, messages)
			log.Printf("✅ [ERROR DETECTION] Added assistant error message to cache to maintain alternation")

			// Inform user about the error
			userConn.WriteChan <- models.ServerMessage{
				Type:         "error",
				ErrorCode:    "model_tool_incompatible",
				ErrorMessage: fmt.Sprintf("Model '%s' doesn't support tool calling. Tools will be automatically disabled for this model on the next message.", config.Model),
			}

			// Retry WITHOUT tools
			log.Printf("🔄 [ERROR DETECTION] Retrying request WITHOUT tools for model: %s", config.Model)
			return s.StreamChatCompletion(userConn)
		}

		// Context-length overflow: a long, tool-heavy chat grows past the model's
		// window. Bubbling the raw 400 leaves a blank bubble and the frontend
		// then auto-retries the same over-limit request. Drop the oldest turns
		// and retry so the user still gets an answer.
		if s.isContextLengthError(errorMsg) {
			if userConn.ContextTrimRetries < 3 && s.trimOldestTurnsForContext(userConn) {
				userConn.ContextTrimRetries++
				log.Printf("✂️  [CONTEXT] Context length exceeded — retrying after trim (attempt %d) for %s", userConn.ContextTrimRetries, userConn.ConversationID)
				return s.StreamChatCompletion(userConn)
			}
			return fmt.Errorf("This conversation is too long for the current model's context window. Please start a new chat, or switch to a model with a larger context window, to continue")
		}

		// Report health failure
		if s.healthService != nil && config.ProviderID > 0 {
			if health.IsQuotaError(resp.StatusCode, errorMsg) {
				cooldown := health.ParseCooldownDuration(resp.StatusCode, errorMsg)
				s.healthService.SetCooldown(health.CapabilityChat, config.ProviderID, config.Model, cooldown)
				log.Printf("[HEALTH] Chat provider %d/%s quota exceeded, cooldown %v", config.ProviderID, config.Model, cooldown)
			} else {
				s.healthService.MarkUnhealthy(health.CapabilityChat, config.ProviderID, config.Model, errorMsg, resp.StatusCode)
			}
		}

		return fmt.Errorf("API error (status %d): %s", resp.StatusCode, errorMsg)
	}

	// Report health success
	if s.healthService != nil && config.ProviderID > 0 {
		s.healthService.MarkHealthy(health.CapabilityChat, config.ProviderID, config.Model)
	}

	// Process SSE stream — forward the resolved model name so the cost
	// chip's pricing lookup can find the right entry.
	return s.processStream(resp.Body, userConn, config.Model)
}

// emitAssistantFallback surfaces a visible assistant message and terminates the
// stream cleanly, so a turn that would otherwise end with a blank bubble (a
// post-tool continuation error, invalid tool calls, or empty model output)
// gets a real message instead. Sending content rather than only an error event
// also avoids the frontend re-running the whole turn (and its tool side effects).
func (s *ChatService) emitAssistantFallback(userConn *models.UserConnection, text string) {
	msgs := s.getConversationMessages(userConn.ConversationID)
	msgs = append(msgs, map[string]interface{}{"role": "assistant", "content": text})
	s.setConversationMessages(userConn.ConversationID, msgs)
	userConn.WriteChan <- models.ServerMessage{Type: "stream_chunk", Content: text, ConversationID: userConn.ConversationID}
	s.streamBuffer.MarkComplete(userConn.ConversationID, text)
	userConn.WriteChan <- models.ServerMessage{Type: "stream_end", ConversationID: userConn.ConversationID}
}

// isContextLengthError detects a provider "context window exceeded" error so the
// chat service can trim old turns and retry instead of leaving a blank bubble.
func (s *ChatService) isContextLengthError(errorMsg string) bool {
	m := strings.ToLower(errorMsg)
	return strings.Contains(m, "maximum context length") ||
		strings.Contains(m, "context length exceeded") ||
		strings.Contains(m, "context_length_exceeded") ||
		strings.Contains(m, "reduce the length") ||
		strings.Contains(m, "too many tokens") ||
		strings.Contains(m, "string too long") ||
		(strings.Contains(m, "context") && strings.Contains(m, "token") && strings.Contains(m, "exceed"))
}

// trimOldestTurnsForContext drops the oldest ~half of the conversation's turns
// from the in-memory cache so an over-long history fits the model's window. It
// only ever cuts on a USER-message boundary, so assistant/tool-call/tool-result
// sequences stay intact and API alternation rules aren't broken. Returns false
// when there is nothing older than the current turn to drop.
func (s *ChatService) trimOldestTurnsForContext(userConn *models.UserConnection) bool {
	msgs := s.getConversationMessages(userConn.ConversationID)
	userIdx := make([]int, 0, len(msgs))
	for i, m := range msgs {
		if r, _ := m["role"].(string); r == "user" {
			userIdx = append(userIdx, i)
		}
	}
	if len(userIdx) < 2 {
		return false
	}
	cutTurn := len(userIdx) / 2
	if cutTurn > len(userIdx)-2 {
		cutTurn = len(userIdx) - 2
	}
	if cutTurn < 1 {
		cutTurn = 1
	}
	trimmed := msgs[userIdx[cutTurn]:]
	s.setConversationMessages(userConn.ConversationID, trimmed)
	log.Printf("✂️  [CONTEXT] Trimmed conversation %s: %d → %d messages (dropped %d oldest turn(s))",
		userConn.ConversationID, len(msgs), len(trimmed), cutTurn)
	return true
}

// detectToolIncompatibility checks if an error message indicates tool incompatibility
func (s *ChatService) detectToolIncompatibility(errorMsg string) bool {
	errorLower := strings.ToLower(errorMsg)

	// Common error patterns for tool incompatibility
	patterns := []string{
		"roles must alternate",
		"tool",
		"not supported",
		"function calling",
		"unsupported",
	}

	// Check if error contains patterns related to tools
	hasToolKeyword := false
	hasErrorKeyword := false

	for _, pattern := range patterns {
		if strings.Contains(errorLower, pattern) {
			if pattern == "tool" || pattern == "function calling" {
				hasToolKeyword = true
			} else {
				hasErrorKeyword = true
			}
		}
	}

	// Must have both a tool-related keyword AND an error keyword
	result := hasToolKeyword && hasErrorKeyword

	if result {
		log.Printf("🔍 [ERROR DETECTION] Tool incompatibility pattern detected in error: %s", errorMsg)
	}

	return result || strings.Contains(errorLower, "roles must alternate")
}

// ToolCallAccumulator accumulates streaming tool call data
type ToolCallAccumulator struct {
	ID           string
	Type         string
	Name         string
	Arguments    strings.Builder
	ExtraContent map[string]interface{} // Gemini thought_signature support
}

// sanitizeConcatenatedJSON fixes Gemini's malformed tool call arguments.
// Gemini's OpenAI-compatible endpoint sometimes concatenates what should be separate
// tool calls into a single arguments string: {"url":"x"}{"query":"y"}
// This function merges all objects into one so no parameters are lost,
// and returns valid JSON that won't cause INVALID_ARGUMENT when echoed back to Gemini.
func sanitizeConcatenatedJSON(argsStr string) (string, bool) {
	if !strings.Contains(argsStr, "}{") {
		return argsStr, false
	}

	// Split on }{ boundary and reconstruct individual JSON objects
	parts := strings.Split(argsStr, "}{")
	if len(parts) < 2 {
		return argsStr, false
	}

	// Merge all key-value pairs from all objects into one
	merged := make(map[string]interface{})
	for i, part := range parts {
		// Reconstruct valid JSON for each part
		if i > 0 {
			part = "{" + part
		}
		if i < len(parts)-1 {
			part = part + "}"
		}

		var obj map[string]interface{}
		if err := json.Unmarshal([]byte(part), &obj); err != nil {
			// If any part fails to parse, fall back to first object only
			firstObjEnd := strings.Index(argsStr, "}{") + 1
			candidate := argsStr[:firstObjEnd]
			if json.Valid([]byte(candidate)) {
				return candidate, true
			}
			return argsStr, false
		}
		for k, v := range obj {
			merged[k] = v
		}
	}

	// Marshal the merged object back to JSON
	result, err := json.Marshal(merged)
	if err != nil {
		return argsStr, false
	}

	log.Printf("🔧 [FIX] Merged %d concatenated JSON objects into one: %s", len(parts), string(result))
	return string(result), true
}

// safeSendChunk sends a chunk to the client with graceful error handling
// This prevents panics if the channel is closed (client disconnected)
func (s *ChatService) safeSendChunk(userConn *models.UserConnection, content string) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("⚠️ [STREAM] Recovered from WriteChan panic for %s: %v (chunk buffered)", userConn.ConnID, r)
			// Chunk is already buffered in streamBuffer, so no data loss
		}
	}()

	select {
	case userConn.WriteChan <- models.ServerMessage{
		Type:    "stream_chunk",
		Content: content,
	}:
		// Successfully sent
	case <-time.After(100 * time.Millisecond):
		// Channel backpressure detected - client rendering slower than generation
		bufferLen := len(userConn.WriteChan)
		log.Printf("⚠️ [STREAM] WriteChan backpressure for %s (buffer: %d/100), chunk buffered for resume",
			userConn.ConnID, bufferLen)

		// Chunk is already buffered in streamBuffer via AppendChunk before this call
		// If backpressure persists, client may need to reconnect and resume
	}
}

// processStream processes the SSE stream from the AI provider
func (s *ChatService) processStream(reader io.Reader, userConn *models.UserConnection, modelName string) error {
	scanner := bufio.NewScanner(reader)

	// Increase buffer to 1MB for large SSE chunks (default is 64KB)
	// Prevents "bufio.Scanner: token too long" errors with large tool call arguments
	const maxCapacity = 1024 * 1024 // 1MB
	buf := make([]byte, maxCapacity)
	scanner.Buffer(buf, maxCapacity)

	// turnStart times the wall-clock latency of this assistant turn so we
	// can surface it on the cost chip in the UI.
	turnStart := time.Now()
	// turnUsage accumulates the per-turn usage we report on stream_end:
	// prompt + completion tokens, cached tokens from cache_control hits,
	// and an estimated USD cost (best-effort from a small price map).
	var turnPromptTokens, turnCompletionTokens, turnCachedTokens int
	var fullContent strings.Builder

	// Create stream buffer for this conversation (for resume capability)
	s.streamBuffer.CreateBuffer(userConn.ConversationID, userConn.UserID, userConn.ConnID)
	log.Printf("📦 [STREAM] Buffer created for conversation %s", userConn.ConversationID)

	// Track tool calls by index to accumulate streaming arguments
	toolCallsMap := make(map[int]*ToolCallAccumulator)
	var finishReason string

	// gpt-oss (Bedrock Harmony) emits chain-of-thought inline as
	// <reasoning>...</reasoning> within the content delta; this stripper
	// pulls those spans out and routes them to reasoning_chunk so the UI's
	// existing ThinkingBlock renders them collapsibly instead of leaking
	// to the chat. Stateful across chunks to handle tags split mid-tag.
	var harmony harmonyStripper

	for scanner.Scan() {
		select {
		case <-userConn.StopChan:
			log.Printf("⏹️  Generation stopped for %s", userConn.ConnID)
			// Clear buffer on stop - user explicitly cancelled
			s.streamBuffer.ClearBuffer(userConn.ConversationID)
			return nil
		default:
		}

		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}

		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}

		var chunk map[string]interface{}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}

		// Capture usage from the final SSE event before the choices check —
		// OpenAI/Bedrock emit a chunk with empty `choices` and `usage` set on
		// the last event, which the choices-empty fast-path below would skip.
		// Logs cached/created token totals so chat-path turns show the same
		// 💾 cache-hit metric daemons already log, and stores them so we can
		// attach to stream_end as a TokenUsage block (cost chip).
		if usageRaw, ok := chunk["usage"].(map[string]interface{}); ok {
			promptTokens := intFromJSON(usageRaw["prompt_tokens"])
			completionTokens := intFromJSON(usageRaw["completion_tokens"])
			cached := 0
			if details, ok := usageRaw["prompt_tokens_details"].(map[string]interface{}); ok {
				cached = intFromJSON(details["cached_tokens"])
			}
			if promptTokens > 0 {
				turnPromptTokens = promptTokens
				turnCompletionTokens = completionTokens
				turnCachedTokens = cached
			}
			if cached > 0 && promptTokens > 0 {
				pct := float64(cached) / float64(promptTokens) * 100
				log.Printf("💾 [CACHE] chat usage: %d prompt (%d cached, %.0f%% hit) / %d completion",
					promptTokens, cached, pct, completionTokens)
			} else if promptTokens > 0 {
				log.Printf("📊 [USAGE] chat: %d prompt / %d completion (cache: 0)", promptTokens, completionTokens)
			}
		}

		choices, ok := chunk["choices"].([]interface{})
		if !ok || len(choices) == 0 {
			continue
		}

		choice := choices[0].(map[string]interface{})
		delta, ok := choice["delta"].(map[string]interface{})
		if !ok {
			continue
		}

		// Check for finish reason
		if reason, ok := choice["finish_reason"].(string); ok && reason != "" {
			finishReason = reason
		}

		// Handle reasoning/thinking content (o1/o3 models)
		if reasoningContent, ok := delta["reasoning_content"].(string); ok {
			userConn.WriteChan <- models.ServerMessage{
				Type:    "reasoning_chunk",
				Content: reasoningContent,
			}
		}

		// Handle content chunks
		if content, ok := delta["content"].(string); ok {
			visible, reasoning := harmony.process(content)

			if reasoning != "" {
				userConn.WriteChan <- models.ServerMessage{
					Type:    "reasoning_chunk",
					Content: reasoning,
				}
			}

			if visible != "" {
				fullContent.WriteString(visible)
				s.streamBuffer.AppendChunk(userConn.ConversationID, visible)
				s.safeSendChunk(userConn, visible)
			}
		}

		// Handle tool calls - ACCUMULATE, don't execute yet!
		if toolCallsData, ok := delta["tool_calls"].([]interface{}); ok {
			for _, tc := range toolCallsData {
				toolCallChunk := tc.(map[string]interface{})

				// Get tool call index
				var index int
				if idx, ok := toolCallChunk["index"].(float64); ok {
					index = int(idx)
				}

				// Initialize accumulator if needed
				if _, exists := toolCallsMap[index]; !exists {
					toolCallsMap[index] = &ToolCallAccumulator{}
				}

				acc := toolCallsMap[index]

				// Accumulate fields
				if id, ok := toolCallChunk["id"].(string); ok {
					acc.ID = truncateToolCallID(id) // Truncate to 40 chars (OpenAI constraint)
				}
				if typ, ok := toolCallChunk["type"].(string); ok {
					acc.Type = typ
				}
				if function, ok := toolCallChunk["function"].(map[string]interface{}); ok {
					if name, ok := function["name"].(string); ok {
						acc.Name = name
						log.Printf("🔧 [TOOL] Starting to accumulate tool call: %s (index %d)", name, index)
					}
					// ✅ ACCUMULATE arguments, don't parse yet!
					if args, ok := function["arguments"].(string); ok {
						acc.Arguments.WriteString(args)
					}
				}
				// Capture extra_content (Gemini thought_signature for thinking models)
				// This is required for Gemini 3 models to work with tool calls
				if extraContent, ok := toolCallChunk["extra_content"].(map[string]interface{}); ok {
					acc.ExtraContent = extraContent
					log.Printf("🧠 [TOOL] Captured extra_content/thought_signature for tool call index %d", index)
				}
			}

			// Also check for extra_content at the choice level (some providers may put it there)
			if extraContent, ok := choice["extra_content"].(map[string]interface{}); ok {
				if len(toolCallsMap) > 0 {
					if acc, exists := toolCallsMap[0]; exists && acc.ExtraContent == nil {
						acc.ExtraContent = extraContent
						log.Printf("🧠 [TOOL] Captured thought_signature from choice level for first tool call")
					}
				}
			}
		}
	}

	// Check if we have accumulated tool calls (some providers like Gemini may not
	// return finish_reason="tool_calls" but still include tool call data in the stream)
	hasAccumulatedToolCalls := false
	for _, acc := range toolCallsMap {
		if acc.Name != "" {
			hasAccumulatedToolCalls = true
			break
		}
	}

	// Execute tools when finish_reason is "tool_calls" OR when tool call data was
	// accumulated during streaming (handles Gemini and other providers that use
	// different finish_reason values like "stop" even for tool calls)
	if finishReason == "tool_calls" || hasAccumulatedToolCalls {
		if finishReason != "tool_calls" {
			log.Printf("⚠️  [TOOL] finish_reason was '%s' but tool calls were accumulated - treating as tool call response (provider compatibility fix)", finishReason)
		}
		log.Printf("🔧 [TOOL] Streaming complete, executing %d tool call(s) (parallel)", len(toolCallsMap))

		// Get messages from cache
		messages := s.getConversationMessages(userConn.ConversationID)

		// Build tool call messages for conversation history
		var toolCallMessages []map[string]interface{}
		var toolResults []map[string]interface{}

		// Phase 1: build all tool_call messages synchronously (pure data
		// shaping, no I/O). Also collect the runnable tasks for phase 2.
		type pendingTool struct {
			callID  string
			name    string
			argsStr string
		}
		var pending []pendingTool
		for index, acc := range toolCallsMap {
			if acc.Name == "" || acc.Arguments.Len() == 0 {
				continue
			}
			argsStr := acc.Arguments.String()
			log.Printf("🔧 [TOOL] Queueing tool %s (index %d, args length: %d bytes)", acc.Name, index, len(argsStr))

			// Sanitize concatenated JSON before storing in history (Gemini
			// sometimes emits multiple JSON objects concatenated).
			if fixed, ok := sanitizeConcatenatedJSON(argsStr); ok {
				log.Printf("🔧 [FIX] Sanitized concatenated JSON in tool call args for %s before storing in history", acc.Name)
				argsStr = fixed
			}

			tcMsg := map[string]interface{}{
				"id":   acc.ID,
				"type": acc.Type,
				"function": map[string]interface{}{
					"name":      acc.Name,
					"arguments": argsStr,
				},
			}
			// CRITICAL: include Gemini thought_signature when echoing tool
			// calls back in history. Without it Gemini returns INVALID_ARGUMENT.
			// See: https://ai.google.dev/gemini-api/docs/thought-signatures
			if acc.ExtraContent != nil {
				tcMsg["extra_content"] = acc.ExtraContent
				log.Printf("🧠 [TOOL] Including thought_signature in tool call message for %s (required by Gemini)", acc.Name)
			}
			toolCallMessages = append(toolCallMessages, tcMsg)
			pending = append(pending, pendingTool{callID: acc.ID, name: acc.Name, argsStr: argsStr})
		}

		// Phase 2: execute tools concurrently. Each tool is independent —
		// they may touch shared resources (image registry, file uploads)
		// but those services are individually goroutine-safe. Result order
		// in the messages array doesn't matter because each `tool` message
		// is keyed back to its call via tool_call_id.
		if len(pending) > 0 {
			parallelStart := time.Now()
			results := make([]map[string]interface{}, len(pending))
			var wg sync.WaitGroup
			for i := range pending {
				wg.Add(1)
				go func(idx int, t pendingTool) {
					defer wg.Done()
					defer func() {
						if rec := recover(); rec != nil {
							log.Printf("⚠️ [TOOL] Panic recovered in parallel tool %s: %v", t.name, rec)
							results[idx] = map[string]interface{}{
								"role":         "tool",
								"tool_call_id": t.callID,
								"name":         t.name,
								"content":      fmt.Sprintf("tool execution panicked: %v", rec),
							}
						}
					}()
					result := s.executeToolSyncWithResult(t.callID, t.name, t.argsStr, userConn)
					results[idx] = map[string]interface{}{
						"role":         "tool",
						"tool_call_id": t.callID,
						"name":         t.name,
						"content":      result,
					}
				}(i, pending[i])
			}
			wg.Wait()
			toolResults = append(toolResults, results...)
			log.Printf("⏱️ [TOOL] Executed %d tool(s) in parallel in %s",
				len(pending), time.Since(parallelStart))
		}

		// Only add assistant message if we have actual tool calls
		if len(toolCallMessages) > 0 {
			assistantMsg := map[string]interface{}{
				"role":       "assistant",
				"tool_calls": toolCallMessages,
			}
			// Only include content if it's not empty
			if fullContent.Len() > 0 {
				assistantMsg["content"] = fullContent.String()
			}
			messages = append(messages, assistantMsg)

			// Add all tool results
			for _, toolResult := range toolResults {
				messages = append(messages, toolResult)
			}

			// Save updated messages to cache
			s.setConversationMessages(userConn.ConversationID, messages)

			// Clear buffer for tool calls - a new stream will start
			s.streamBuffer.ClearBuffer(userConn.ConversationID)

			// ── Harness guardrails: never let the tool loop run forever ──
			// Signature of this round's tool calls (names + args). If it repeats
			// the previous round, the model is stuck (e.g. retrying a malformed
			// call) and making no progress.
			var sigB strings.Builder
			for _, tc := range toolCallMessages {
				if fn, ok := tc["function"].(map[string]interface{}); ok {
					name, _ := fn["name"].(string)
					argStr, _ := fn["arguments"].(string)
					sigB.WriteString(name)
					sigB.WriteString("|")
					sigB.WriteString(argStr)
					sigB.WriteString("\n")
				}
			}
			toolSig := sigB.String()

			// Generous backstop so genuinely long, multi-step work is NOT blocked.
			// Real runaway loops are caught by the anti-stall (identical consecutive
			// tool call), not by this number — so it can stay high.
			const maxToolIterations = 20
			userConn.ToolIteration++
			stalled := toolSig != "" && toolSig == userConn.LastToolSig
			if userConn.ToolIteration > maxToolIterations || stalled {
				reason := fmt.Sprintf("reached the %d-step tool limit", maxToolIterations)
				if stalled {
					reason = "kept repeating the same tool call without making progress"
				}
				log.Printf("🛑 [TOOL-LOOP] Aborting tool loop for %s: %s (iteration %d)", userConn.ConnID, reason, userConn.ToolIteration)
				if strings.TrimSpace(fullContent.String()) != "" {
					userConn.WriteChan <- models.ServerMessage{Type: "stream_chunk", Content: "\n\n", ConversationID: userConn.ConversationID}
				}
				userConn.WriteChan <- models.ServerMessage{
					Type:         "error",
					ErrorCode:    "tool_loop_aborted",
					ErrorMessage: fmt.Sprintf("Stopped: the model %s. Try rephrasing, or switch models for this task.", reason),
				}
				userConn.WriteChan <- models.ServerMessage{Type: "stream_end", ConversationID: userConn.ConversationID}
				return nil
			}
			userConn.LastToolSig = toolSig

			// After ALL tools complete, continue conversation ONCE. The
			// continuation runs in its own goroutine, so a returned error (or a
			// panic on a late send) would otherwise be discarded, leaving the UI
			// hung on "Generating…" or a blank bubble. Recover, and on failure
			// surface a real message instead of nothing.
			log.Printf("🔄 [TOOL] All tools executed, continuing conversation with %d tool result(s) [iteration %d/%d]", len(toolCallMessages), userConn.ToolIteration, maxToolIterations)
			go func() {
				defer func() {
					if r := recover(); r != nil {
						log.Printf("❌ [TOOL-LOOP] Recovered from panic in continuation for %s: %v", userConn.ConnID, r)
					}
				}()
				if err := s.StreamChatCompletion(userConn); err != nil {
					log.Printf("❌ [TOOL-LOOP] Continuation failed for %s: %v", userConn.ConnID, err)
					s.emitAssistantFallback(userConn, "I ran the tools but hit a problem writing the final answer, so this response is incomplete. Please try again — rephrasing or switching the model usually helps.")
				}
			}()
		} else {
			// Model tried to call tools but the calls were malformed. Surface a
			// visible message instead of a bare error + blank bubble.
			log.Printf("⚠️  [STREAM] Tool calls detected but none were valid")
			s.emitAssistantFallback(userConn, "I tried to use a tool but the request came out malformed, so I couldn't complete that. Please try again — rephrasing usually fixes it.")
		}
	} else {
		// Regular message without tool calls
		content := fullContent.String()

		// Empty-turn guard: the model produced no content AND no tool calls.
		// Never leave the user with a blank bubble or a hung stream — emit an
		// honest fallback + a terminal event.
		if strings.TrimSpace(content) == "" {
			log.Printf("⚠️  [STREAM] Empty assistant turn for %s (no content, no tool calls) — emitting fallback", userConn.ConversationID)
			s.emitAssistantFallback(userConn, "I couldn't generate a response just now — this sometimes happens right after a tool runs or when the model returns nothing. Please try again; rephrasing or switching the model usually fixes it.")
			return nil
		}

		// Only add assistant message if there's actual content
		if content != "" {
			// Get messages from cache and add assistant response
			messages := s.getConversationMessages(userConn.ConversationID)
			messages = append(messages, map[string]interface{}{
				"role":    "assistant",
				"content": content,
			})
			s.setConversationMessages(userConn.ConversationID, messages)

			// Mark stream buffer as complete before sending stream_end
			s.streamBuffer.MarkComplete(userConn.ConversationID, content)
			log.Printf("📦 [STREAM] Buffer marked complete for conversation %s", userConn.ConversationID)

			// Increment message counter
			userConn.Mutex.Lock()
			userConn.MessageCount++
			currentCount := userConn.MessageCount
			userConn.Mutex.Unlock()

			// Attach per-turn usage so the UI can render the cost chip.
			// Always populate token + duration; cost is best-effort.
			var usage *models.TokenUsage
			if turnPromptTokens > 0 || turnCompletionTokens > 0 {
				cost := estimateCostUSD(modelName, turnPromptTokens-turnCachedTokens, turnCachedTokens, turnCompletionTokens)
				usage = &models.TokenUsage{
					Input:            turnPromptTokens,
					Output:           turnCompletionTokens,
					Cached:           turnCachedTokens,
					DurationMs:       int(time.Since(turnStart).Milliseconds()),
					EstimatedCostUSD: cost,
					Model:            modelName,
				}
			}

			// Send completion message
			userConn.WriteChan <- models.ServerMessage{
				Type:           "stream_end",
				ConversationID: userConn.ConversationID,
				Tokens:         usage,
			}

			// Generate title after first user-assistant exchange (2 messages: user + assistant)
			log.Printf("🔍 [TITLE] MessageCount=%d for conversation %s", currentCount, userConn.ConversationID)
			if currentCount == 1 {
				log.Printf("🎯 [TITLE] Triggering title generation for %s", userConn.ConversationID)
				go s.generateConversationTitle(userConn, content)
			} else {
				log.Printf("⏭️  [TITLE] Skipping title generation (MessageCount=%d, need 1)", currentCount)
			}

			// 🗜️ Context optimization - runs AFTER streaming ends (non-blocking)
			// This compacts conversation history for the NEXT message
			go s.optimizeContextAfterStream(userConn)

			// 🧠 Memory extraction - check if threshold reached (non-blocking)
			if s.memoryExtractionService != nil {
				go s.checkAndTriggerMemoryExtraction(userConn)
			}
		} else {
			// Empty response - log warning and send error to client
			log.Printf("⚠️  [STREAM] Received empty response from API for %s", userConn.ConnID)
			userConn.WriteChan <- models.ServerMessage{
				Type:         "error",
				ErrorCode:    "empty_response",
				ErrorMessage: "The model returned an empty response. Please try again.",
			}
		}
	}

	// Check for scanner errors (e.g., buffer overflow, I/O errors)
	if err := scanner.Err(); err != nil {
		log.Printf("❌ [STREAM] Scanner error for %s: %v", userConn.ConnID, err)
		userConn.WriteChan <- models.ServerMessage{
			Type:         "error",
			ErrorCode:    "stream_error",
			ErrorMessage: "An error occurred while processing the stream. Please try again.",
		}
		return fmt.Errorf("stream scanner error: %w", err)
	}

	return nil
}

// executeToolSyncWithResult executes a tool call synchronously and returns the result
func (s *ChatService) executeToolSyncWithResult(toolCallID, toolName, argsJSON string, userConn *models.UserConnection) string {
	// Get tool metadata from registry
	toolDisplayName := toolName
	toolIcon := ""
	toolDescription := ""
	if tool, exists := s.toolRegistry.Get(toolName); exists {
		toolDisplayName = tool.DisplayName
		toolIcon = tool.Icon
		toolDescription = tool.Description
	}

	// Reinforce tool in conversation cache (ground truth: model actually called this tool)
	if s.toolPredictorService != nil {
		s.toolPredictorService.AddToolToCache(context.Background(), userConn.ConversationID, toolName)
	}

	// Parse complete JSON arguments
	var args map[string]interface{}
	originalArgsJSON := argsJSON

	// Try to parse as-is first
	if err := json.Unmarshal([]byte(argsJSON), &args); err != nil {
		log.Printf("❌ Failed to parse tool arguments for %s: %v (length: %d bytes)", toolName, err, len(argsJSON))
		log.Printf("📝 [DEBUG] Malformed JSON: %s", argsJSON)

		// Attempt to fix common Gemini malformations:
		// Gemini's OpenAI-compatible endpoint sometimes concatenates multiple JSON objects
		// into a single arguments string (e.g., {"url":"x"}{"query":"y"})
		if fixed, ok := sanitizeConcatenatedJSON(argsJSON); ok {
			if err2 := json.Unmarshal([]byte(fixed), &args); err2 == nil {
				log.Printf("✅ [FIX] Successfully merged concatenated JSON objects for %s", toolName)
				argsJSON = fixed
				goto parseSuccess
			}
		}

		// If all fixes fail, return a helpful error message for the LLM
		errorMsg := fmt.Sprintf("Invalid tool arguments format. Expected valid JSON object. Please call the tool again with properly formatted arguments.")

		// Send error to client
		userConn.WriteChan <- models.ServerMessage{
			Type:            "tool_result",
			ToolName:        toolName,
			ToolDisplayName: toolDisplayName,
			ToolIcon:        toolIcon,
			ToolDescription: toolDescription,
			Status:          "failed",
			Result:          errorMsg,
		}

		// Return a clear error message for the LLM to understand
		return fmt.Sprintf("Error: %s Original input was: %s", errorMsg, originalArgsJSON)
	}

parseSuccess:

	log.Printf("✅ [TOOL] Successfully parsed arguments for %s: %+v", toolName, args)

	// Inject user context into args (internal use only, not exposed to AI)
	// This allows tools to access authenticated user info without breaking the tool interface
	args["__user_id__"] = userConn.UserID
	args["__conversation_id__"] = userConn.ConversationID

	// Auto-inject credentials for tools that require them
	if s.toolService != nil {
		// Inject credential resolver for secure credential access
		resolver := s.toolService.CreateCredentialResolver(userConn.UserID)
		if resolver != nil {
			args[tools.CredentialResolverKey] = resolver
		}

		// Auto-inject credential_id for tools that need it
		credentialID := s.toolService.GetCredentialForTool(context.Background(), userConn.UserID, toolName)
		if credentialID != "" {
			args["credential_id"] = credentialID
			log.Printf("🔐 [CHAT] Auto-injected credential_id=%s for tool=%s", credentialID, toolName)
		}
	}

	// Inject user connection and waiter for ask_user tool (interactive prompts)
	if toolName == "ask_user" {
		args[tools.UserConnectionKey] = userConn
		args[tools.PromptWaiterKey] = userConn.PromptWaiter
		log.Printf("🔌 [CHAT] Injected user connection and prompt waiter for ask_user tool")
	}

	// Inject the subagent runner (this chat service) so the fan-out tool
	// can spin a fresh agentic loop. Wiring via interface keeps the tools
	// package free of any services import (which would be a cycle).
	if toolName == "spawn_subagent" {
		args[tools.SubagentRunnerKey] = tools.SubagentRunner(s)
		log.Printf("🤖 [CHAT] Injected SubagentRunner for spawn_subagent tool")
	}

	// Inject the memory access shim for the model-callable memory tools.
	// Same interface-injection trick — the tools package only sees the
	// MemoryAccess contract, never the concrete services.
	if toolName == "add_memory" || toolName == "search_memory" {
		args[tools.MemoryAccessKey] = tools.MemoryAccess(s)
		log.Printf("🧠 [CHAT] Injected MemoryAccess for %s tool", toolName)
	}

	// Inject image provider config and registry for generate_image tool
	if toolName == "generate_image" {
		imageProviderService := GetImageProviderService()
		provider := imageProviderService.GetProvider()
		if provider != nil {
			args[tools.ImageProviderConfigKey] = &tools.ImageProviderConfig{
				Name:         provider.Name,
				BaseURL:      provider.BaseURL,
				APIKey:       provider.APIKey,
				DefaultModel: provider.DefaultModel,
			}
			log.Printf("🎨 [CHAT] Injected image provider config for generate_image tool (provider: %s)", provider.Name)
		}
		// Inject image registry for registering generated images
		imageRegistry := GetImageRegistryService()
		args[tools.ImageRegistryKey] = &ImageRegistryAdapter{registry: imageRegistry}

		// Inject usage limiter for tier-based image generation limits
		if s.usageLimiter != nil {
			args[tools.UsageLimiterKey] = s.usageLimiter
		}
	}

	// Inject image edit config and registry for edit_image tool
	if toolName == "edit_image" {
		// Inject image registry adapter for handle lookup (adapter implements tools.ImageRegistryInterface)
		imageRegistry := GetImageRegistryService()
		args[tools.ImageRegistryKey] = &ImageRegistryAdapter{registry: imageRegistry}

		// Inject image edit provider config from dedicated edit provider
		imageEditProviderService := GetImageEditProviderService()
		editProvider := imageEditProviderService.GetProvider()
		if editProvider != nil {
			args[tools.ImageEditConfigKey] = &tools.ImageEditConfig{
				BaseURL: editProvider.BaseURL,
				APIKey:  editProvider.APIKey,
			}
			log.Printf("🖌️ [CHAT] Injected image edit config for edit_image tool (provider: %s)", editProvider.Name)
		} else {
			log.Printf("⚠️ [CHAT] No image edit provider configured - edit_image tool will fail")
		}
	}

	// Inject image registry for describe_image tool (allows using image_id handles)
	if toolName == "describe_image" {
		imageRegistry := GetImageRegistryService()
		args[tools.ImageRegistryKey] = &ImageRegistryAdapter{registry: imageRegistry}
		log.Printf("🖼️ [CHAT] Injected image registry for describe_image tool")
	}

	// Notify client that tool is executing (send original args without internal params)
	displayArgs := make(map[string]interface{})
	for k, v := range args {
		// Filter out internal/sensitive params
		if k != "__user_id__" && k != "__conversation_id__" && k != tools.CredentialResolverKey && k != "credential_id" && k != tools.ImageProviderConfigKey && k != tools.ImageEditConfigKey && k != tools.ImageRegistryKey && k != tools.UsageLimiterKey && k != tools.UserConnectionKey && k != tools.PromptWaiterKey {
			displayArgs[k] = v
		}
	}

	// Use SafeSend to prevent panic if connection was closed
	if !userConn.SafeSend(models.ServerMessage{
		Type:            "tool_call",
		ToolName:        toolName,
		ToolDisplayName: toolDisplayName,
		ToolIcon:        toolIcon,
		ToolDescription: toolDescription,
		Status:          "executing",
		Arguments:       displayArgs,
	}) {
		log.Printf("⚠️ [TOOL] Connection closed before tool execution for %s", toolName)
		return ""
	}

	// Fire PreToolUse hooks — first hook to deny short-circuits the call
	// with its reason in place of a real tool result. Hooks may also mutate
	// args in place (e.g. redact secrets) before the tool sees them.
	if dec := tools.RunPreToolHooks(toolName, args); !dec.Allow {
		reason := dec.Reason
		if reason == "" {
			reason = "blocked by policy"
		}
		userConn.SafeSend(models.ServerMessage{
			Type:            "tool_result",
			ToolName:        toolName,
			ToolDisplayName: toolDisplayName,
			ToolIcon:        toolIcon,
			ToolDescription: toolDescription,
			Status:          "failed",
			Result:          reason,
		})
		return reason
	}

	// Execute tool (with injected user context)
	hookStart := time.Now()

	// Check connection-scoped injected tools FIRST. These are per-turn
	// tools the chat service stitched together (e.g. search_knowledge
	// bound to the user + selected projects). Dispatching them through
	// the registry would either fail (not registered globally) or
	// misroute (registered as user tool → MCP path).
	if injected, ok := userConn.InjectedTools[toolName]; ok && injected.Execute != nil {
		injResult, injErr := injected.Execute(args)
		_ = tools.RunPostToolHooks(toolName, args, injResult, time.Since(hookStart), injErr)
		if injErr != nil {
			log.Printf("❌ [INJECTED-TOOL] %s failed: %v", toolName, injErr)
			errorMsg := fmt.Sprintf("Error: %v", injErr)
			userConn.SafeSend(models.ServerMessage{
				Type:            "tool_result",
				ToolName:        toolName,
				ToolDisplayName: toolDisplayName,
				ToolIcon:        toolIcon,
				ToolDescription: toolDescription,
				Status:          "failed",
				Result:          errorMsg,
			})
			return errorMsg
		}
		userConn.SafeSend(models.ServerMessage{
			Type:            "tool_result",
			ToolName:        toolName,
			ToolDisplayName: toolDisplayName,
			ToolIcon:        toolIcon,
			ToolDescription: toolDescription,
			Status:          "success",
			Result:          injResult,
		})
		return injResult
	}

	// Check if this is a built-in tool or MCP tool
	tool, exists := s.toolRegistry.GetUserTool(userConn.UserID, toolName)
	var result string
	var err error

	if exists && tool.Source == tools.ToolSourceMCPLocal {
		// MCP tool - route to local client
		log.Printf("🔌 [MCP] Routing tool %s to local MCP client for user %s", toolName, userConn.UserID)

		if s.mcpBridge == nil || !s.mcpBridge.IsUserConnected(userConn.UserID) {
			errorMsg := "MCP client not connected. Please start your local MCP client."
			log.Printf("❌ [MCP] No client connected for user %s", userConn.UserID)
			userConn.SafeSend(models.ServerMessage{
				Type:            "tool_result",
				ToolName:        toolName,
				ToolDisplayName: toolDisplayName,
				ToolIcon:        toolIcon,
				ToolDescription: toolDescription,
				Status:          "failed",
				Result:          errorMsg,
			})
			return errorMsg
		}

		// Execute on MCP client with 30 second timeout
		// Use displayArgs instead of args to avoid serialization issues with internal types
		result, err = s.mcpBridge.ExecuteToolOnClient(userConn.UserID, toolName, displayArgs, 30*time.Second)

		// Log execution for audit
		auditErrMsg := ""
		if err != nil {
			auditErrMsg = err.Error()
		}
		s.mcpBridge.LogToolExecution(userConn.UserID, toolName, userConn.ConversationID, err == nil, auditErrMsg)

		if err != nil {
			log.Printf("❌ [MCP] Tool execution failed for %s: %v", toolName, err)
			errorMsg := fmt.Sprintf("Error: %v", err)
			userConn.SafeSend(models.ServerMessage{
				Type:            "tool_result",
				ToolName:        toolName,
				ToolDisplayName: toolDisplayName,
				ToolIcon:        toolIcon,
				ToolDescription: toolDescription,
				Status:          "failed",
				Result:          errorMsg,
			})
			return errorMsg
		}
	} else {
		// Built-in tool - execute locally
		result, err = s.toolRegistry.Execute(toolName, args)
		if err != nil {
			log.Printf("❌ Tool execution failed for %s: %v", toolName, err)
			errorMsg := fmt.Sprintf("Error: %v", err)
			userConn.SafeSend(models.ServerMessage{
				Type:            "tool_result",
				ToolName:        toolName,
				ToolDisplayName: toolDisplayName,
				ToolIcon:        toolIcon,
				ToolDescription: toolDescription,
				Status:          "failed",
				Result:          errorMsg,
			})

			return errorMsg
		}
	}

	log.Printf("✅ [TOOL] Tool %s executed successfully, result length: %d", toolName, len(result))

	// PostToolUse hooks: may rewrite the result (e.g. truncate, redact).
	// Each post hook sees the previous hook's output. err is nil on success
	// — error paths above already returned.
	result = tools.RunPostToolHooks(toolName, args, result, time.Since(hookStart), nil)

	// Try to parse result as JSON to extract plots and files (for E2B tools)
	// We strip base64 data from the LLM result to avoid sending huge payloads
	var resultData map[string]interface{}
	var plots []models.PlotData
	var dataframes []models.DataFrameData
	llmResult := result // Default: send full result to LLM
	needsLLMSummary := false

	if err := json.Unmarshal([]byte(result), &resultData); err == nil {
		// Extract DataFrames emitted by display_df(). The Python bootstrap
		// in python_runner_tool wraps each frame in <<DOBBY_DF>>{...}<</DOBBY_DF>>
		// markers in stdout. Pull them out, hand to the frontend as a
		// renderable artifact, and strip the marker line from the stdout
		// the model sees (replaced with a one-line summary so the model
		// still knows it displayed something).
		if stdoutRaw, ok := resultData["stdout"].(string); ok && strings.Contains(stdoutRaw, "<<DOBBY_DF>>") {
			cleaned, frames := extractDataFrames(stdoutRaw)
			if len(frames) > 0 {
				dataframes = append(dataframes, frames...)
				resultData["stdout"] = cleaned
				needsLLMSummary = true
				log.Printf("📋 [TOOL] Extracted %d dataframe(s) from %s stdout", len(frames), toolName)
			}
		}

		// Check for plots - extract for frontend, strip from LLM
		if plotsRaw, hasPlots := resultData["plots"]; hasPlots {
			if plotsArray, ok := plotsRaw.([]interface{}); ok && len(plotsArray) > 0 {
				// Extract plots for frontend
				for _, p := range plotsArray {
					if plotMap, ok := p.(map[string]interface{}); ok {
						format, _ := plotMap["format"].(string)
						data, _ := plotMap["data"].(string)
						if format != "" && data != "" {
							plots = append(plots, models.PlotData{
								Format: format,
								Data:   data,
							})
						}
					}
				}
				needsLLMSummary = true
				log.Printf("📊 [TOOL] Extracted %d plot(s) from %s result", len(plots), toolName)
			}
		}

		// Check for files - strip base64 data from LLM result
		if filesRaw, hasFiles := resultData["files"]; hasFiles {
			if filesArray, ok := filesRaw.([]interface{}); ok && len(filesArray) > 0 {
				needsLLMSummary = true
				log.Printf("📁 [TOOL] Detected %d file(s) in %s result, stripping base64 from LLM", len(filesArray), toolName)
			}
		}

		// Create LLM-friendly summary (without base64 image/file data)
		if needsLLMSummary {
			llmSummary := map[string]interface{}{
				"success": resultData["success"],
				"stdout":  resultData["stdout"],
				"stderr":  resultData["stderr"],
			}

			// Add plot count if plots exist
			if len(plots) > 0 {
				llmSummary["plot_count"] = len(plots)
				llmSummary["plots_generated"] = fmt.Sprintf("%d visualization(s) generated and shown to user", len(plots))
			}

			// Add file info without base64 data
			if filesRaw, hasFiles := resultData["files"]; hasFiles {
				if filesArray, ok := filesRaw.([]interface{}); ok && len(filesArray) > 0 {
					var fileNames []string
					for _, f := range filesArray {
						if fileMap, ok := f.(map[string]interface{}); ok {
							if filename, ok := fileMap["filename"].(string); ok {
								fileNames = append(fileNames, filename)
							}
						}
					}
					llmSummary["file_count"] = len(filesArray)
					llmSummary["files_generated"] = fileNames
					llmSummary["files_message"] = fmt.Sprintf("%d file(s) generated and available for user download", len(filesArray))
				}
			}

			// Preserve other useful fields
			if analysis, ok := resultData["analysis"]; ok {
				llmSummary["analysis"] = analysis
			}
			if filename, ok := resultData["filename"]; ok {
				llmSummary["filename"] = filename
			}
			if execTime, ok := resultData["execution_time"]; ok {
				llmSummary["execution_time"] = execTime
			}
			if installOutput, ok := resultData["install_output"]; ok {
				llmSummary["install_output"] = installOutput
			}

			llmResultBytes, _ := json.Marshal(llmSummary)
			llmResult = string(llmResultBytes)
		}
	}

	// Send result to client (with plots for frontend visualization)
	// Use SafeSend to prevent panic if connection was closed during long tool execution
	toolResultMsg := models.ServerMessage{
		Type:            "tool_result",
		ToolName:        toolName,
		ToolDisplayName: toolDisplayName,
		ToolIcon:        toolIcon,
		ToolDescription: toolDescription,
		Status:          "completed",
		Result:          result, // Full result for frontend
		Plots:           plots,  // Extracted plots for rendering
		DataFrames:      dataframes,
	}

	// Try to send the tool result
	if !userConn.SafeSend(toolResultMsg) {
		log.Printf("⚠️ [TOOL] Connection closed, could not send tool result for %s", toolName)

		// Buffer tool results with artifacts (images, etc.) for reconnection recovery
		// Only buffer if send failed - this ensures users don't lose generated images
		if (len(plots) > 0 || len(dataframes) > 0) && userConn.ConversationID != "" {
			s.streamBuffer.AppendMessage(userConn.ConversationID, BufferedMessage{
				Type:            "tool_result",
				ToolName:        toolName,
				ToolDisplayName: toolDisplayName,
				ToolIcon:        toolIcon,
				ToolDescription: toolDescription,
				Status:          "completed",
				Result:          result,
				Plots:           plots,
				DataFrames:      dataframes,
			})
			log.Printf("📦 [TOOL] Buffered tool result for %s for reconnection recovery", toolName)
		}
		return llmResult
	}

	log.Printf("✅ [TOOL] Tool result for %s ready (plots: %d, dataframes: %d)", toolName, len(plots), len(dataframes))
	// Return LLM-friendly result (without heavy image data)
	return llmResult
}

// extractDataFrames pulls <<DOBBY_DF>>{json}<</DOBBY_DF>> envelopes out of a
// stdout string and returns (cleanedStdout, frames). The marker is emitted by
// the display_df() helper auto-injected by python_runner_tool. We replace
// each occurrence in stdout with a tiny one-line summary so the model still
// sees that something was displayed (otherwise it might re-emit the table as
// text on the next turn assuming it failed to render).
func extractDataFrames(stdout string) (string, []models.DataFrameData) {
	const startTag = "<<DOBBY_DF>>"
	const endTag = "<</DOBBY_DF>>"
	var frames []models.DataFrameData
	var b strings.Builder
	remaining := stdout
	for {
		i := strings.Index(remaining, startTag)
		if i < 0 {
			b.WriteString(remaining)
			break
		}
		b.WriteString(remaining[:i])
		j := strings.Index(remaining[i+len(startTag):], endTag)
		if j < 0 {
			// Malformed — keep remainder visible so the user can see it
			b.WriteString(remaining[i:])
			break
		}
		payload := remaining[i+len(startTag) : i+len(startTag)+j]
		var df models.DataFrameData
		if err := json.Unmarshal([]byte(payload), &df); err == nil && len(df.Headers) > 0 {
			frames = append(frames, df)
			label := df.Name
			if label == "" {
				label = "dataframe"
			}
			b.WriteString(fmt.Sprintf("[displayed %s: %d rows × %d cols]", label, df.RowCount, df.ColCount))
		}
		// Skip past the closing tag
		remaining = remaining[i+len(startTag)+j+len(endTag):]
	}
	return b.String(), frames
}

// getMarkdownFormattingGuidelines returns formatting rules appended to all system prompts
// getAskUserInstructions returns intelligent guidance for ask_user tool usage
// Balanced approach: use when it adds value, skip when it interrupts natural flow
func getAskUserInstructions() string {
	return `

## 🎯 Interactive Tool - ask_user

You have an **ask_user** tool that creates interactive modal dialogs. Use it intelligently for gathering structured input.

**When to USE ask_user (high value scenarios):**

1. **Planning complex tasks** - Gathering requirements before implementation
   - Example: "Create a website" → ask: style, colors, features, pages
   - Example: "Build a game" → ask: language, library, controls, difficulty

2. **User explicitly requests questions**
   - User: "Ask me questions to understand what I need"
   - User: "Help me figure out what I want"
   - User: "Guide me through this"

3. **Important decisions with multiple valid options**
   - Technical choices: "Which framework? React/Vue/Angular"
   - Approach selection: "Approach A (fast) or B (thorough)?"
   - Confirmation for destructive actions: "Delete all files?"

4. **Missing critical information for task execution**
   - Need specific values: project name, API key, configuration
   - Need preferences that significantly impact output: code style, documentation level

**When NOT to use ask_user (let conversation flow naturally):**

1. **Casual conversation** - Just chat normally
2. **Emotional support** - Be empathetic in text, don't interrupt with modals
3. **Simple clarifications** - Ask in text: "Did you mean X or Y?"
4. **Follow-up questions in dialogue** - Natural back-and-forth
5. **Rhetorical questions** - Part of your explanation style

**Smart Usage Examples:**

✅ GOOD:
- User: "Create a landing page" → ask_user: Design style? Color scheme? Sections?
- User: "I need help planning my app" → ask_user: Features? Users? Platform?
- User: "Build me a calculator" → ask_user: Basic or scientific? UI style?

❌ NOT NEEDED:
- User: "I'm feeling lost" → Just respond with empathy, don't open modal
- User: "Tell me about React" → Just explain, don't ask questions
- Natural conversation → Keep it flowing, don't interrupt

**Guideline:** Use ask_user when it **helps you gather structured input for better results**. Skip it when it would **interrupt natural conversation flow**.
`
}

func getMarkdownFormattingGuidelines() string {
	return `

## Response Style (CRITICAL)
- **Answer first**: Lead with the direct answer or solution. Context and explanation come after.
- **No filler phrases**: Never start with "Great question!", "Certainly!", "Of course!", "I'd be happy to", "Absolutely!", or similar. Just answer.
- **Be concise**: Give complete answers without unnecessary padding. Every sentence should add value.
- **No excessive caveats**: Don't lead with disclaimers or hedging. If caveats are needed, put them at the end.
- **Use structure for complex answers**: Use headers and lists for multi-part responses, but avoid over-formatting simple answers.
- **Match response length to question complexity**: Simple questions get short answers. Complex questions get thorough answers.

## Markdown Formatting
- **Tables**: Use standard syntax with ` + "`|`" + ` separators and ` + "`---`" + ` header dividers
- **Lists**: Use ` + "`-`" + ` for unordered lists, ` + "`1.`" + ` for ordered lists (not ` + "`1)`" + `)
- **Headers**: Always include a space after ` + "`#`" + ` symbols (` + "`## Title`" + ` not ` + "`##Title`" + `)
- **Code blocks**: Always specify language after ` + "` + \"```\" + `" + ` (e.g., ` + "` + \"```python\" + `" + `, ` + "` + \"```json\" + `" + `)
- **Links**: Use ` + "`[text](url)`" + ` with no space between ` + "`]`" + ` and ` + "`(`" + `
- **Avoid**: Citation-style ` + "`[1]`" + ` references, decorative unicode lines, non-standard bullets, emojis (unless user requests them)`
}

// buildTemporalContext builds context string with current date/time and user name
// This provides the model with temporal awareness and personalization
func (s *ChatService) buildTemporalContext(userID string) string {
	now := time.Now()

	// Format date and time
	currentDate := now.Format("Monday, January 2, 2006")
	currentTime := now.Format("3:04 PM MST")

	// Try to get user's name from database (if MongoDB is available)
	userName := "User" // Default fallback

	// Check if we have MongoDB access to get user name
	// Note: ChatService doesn't have direct MongoDB access, but we can try via the database
	// For now, use a simple approach - just use UserID as identifier
	// TODO: Could enhance this with UserService integration if needed
	if userID != "" {
		userName = userID // Use user ID as fallback
	}

	// Build temporal context
	context := fmt.Sprintf(`# Current Context
- **User**: %s
- **Date**: %s
- **Time**: %s

`, userName, currentDate, currentTime)

	return context
}

// buildMemoryContext selects and formats relevant memories for injection.
//
// Two independent tiers get concatenated (MemGPT/Letta-style layering):
//   - Pinned ("core"): models.Memory.Pinned facts, fetched unconditionally
//     by a plain filter query (no embedding/LLM call) — so it runs even
//     when every gate below would otherwise skip memory entirely (lite
//     mode, no history yet, a simple greeting). The whole point of pinning
//     is "don't rely on this turn's relevance search to surface it."
//   - Relevance-based ("recall"): the pre-existing behavior, gated as
//     before — embedding/LLM search scoped to what's relevant to THIS turn.
//
// Native only for now — Hindsight has its own fact-typing model (world/
// experience/mental-model) rather than a pinned flag, so its recall() path
// is unaffected by this tier.
func (s *ChatService) buildMemoryContext(userConn *models.UserConnection) string {
	if s.hindsightClient == nil && s.memorySelectionService == nil {
		return ""
	}

	pinnedContext := ""
	if s.hindsightClient == nil {
		pinnedContext = s.buildPinnedMemoryContext(userConn.UserID)
	}

	// Lite models skip the LLM-based memory selector — without a fast vector
	// path, that call blocks the turn for up to 3 seconds. But when an
	// embedding service is wired (see embedding_service.go), selection is a
	// local cosine-similarity search, not an LLM call, so there's no latency
	// reason to skip it — a lite-mode model was flagged for turn-latency
	// reasons, not necessarily because it can't make use of memory context.
	// Hindsight's recall() is likewise not an LLM call (hybrid search +
	// cross-encoder rerank, both local), so it's never skipped for lite models.
	if s.hindsightClient == nil && s.turnPolicyFor(userConn.ModelID).SkipMemorySelection && !s.memorySelectionService.HasEmbedding(context.Background()) {
		return pinnedContext
	}

	// Get recent messages from cache for context
	messages := s.getConversationMessages(userConn.ConversationID)
	if len(messages) == 0 {
		return pinnedContext // No conversation history yet for relevance search
	}

	// 🎯 OPTIMIZATION: Skip relevance-based injection for simple greetings
	// (saves tokens) — pinned facts still apply, a greeting doesn't gate those.
	lastUserMessage := extractLastUserMessage(messages)
	if isSimpleGreeting(lastUserMessage) {
		log.Printf("👋 [MEMORY-OPTIMIZATION] Simple greeting detected - skipping relevance-based injection to save tokens")
		return pinnedContext
	}

	if s.hindsightClient != nil {
		queryText := buildQueryTextFromMessages(messages)
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		hits, err := s.hindsightClient.Recall(ctx, userConn.UserID, queryText, 2)
		if err != nil {
			log.Printf("⚠️ [MEMORY-HINDSIGHT] Recall failed: %v", err)
			return ""
		}
		if len(hits) == 0 {
			return ""
		}
		var b strings.Builder
		b.WriteString("\n\n## Relevant Context from Previous Conversations\n\n")
		for i, m := range hits {
			b.WriteString(fmt.Sprintf("%d. %s\n", i+1, m.Text))
		}
		log.Printf("🧠 [MEMORY-HINDSIGHT] Injected %d memories into system prompt for user %s", len(hits), userConn.UserID)
		return b.String()
	}

	// Limit to last 10 messages for context
	recentMessages := messages
	if len(messages) > 10 {
		recentMessages = messages[len(messages)-10:]
	}

	// 🎯 OPTIMIZATION: Reduced from 5 to 2 memories to save ~2-3k tokens
	// Can be overridden by user preferences in the future
	maxMemories := 2

	// Select relevant memories
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	selectedMemories, err := s.memorySelectionService.SelectRelevantMemories(
		ctx,
		userConn.UserID,
		recentMessages,
		maxMemories,
	)

	if err != nil {
		log.Printf("⚠️ [MEMORY] Failed to select memories: %v", err)
		return pinnedContext
	}

	if len(selectedMemories) == 0 {
		return pinnedContext // No relevant memories beyond what's pinned
	}

	// Build memory context string
	var builder strings.Builder
	builder.WriteString("\n\n## Relevant Context from Previous Conversations\n\n")
	builder.WriteString("The following information was extracted from your past interactions with this user:\n\n")

	for i, mem := range selectedMemories {
		builder.WriteString(fmt.Sprintf("%d. %s\n", i+1, mem.DecryptedContent))
	}

	builder.WriteString("\nUse this context to personalize responses and avoid asking for information the user has already provided.\n")

	log.Printf("🧠 [MEMORY] Injected %d memories into system prompt for user %s", len(selectedMemories), userConn.UserID)

	return pinnedContext + builder.String()
}

// buildPinnedMemoryContext formats the always-inject core-memory tier. See
// buildMemoryContext's doc comment for the layering rationale.
func (s *ChatService) buildPinnedMemoryContext(userID string) string {
	storage := s.memoryStorageServiceFromExtraction()
	if storage == nil {
		return ""
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	pinned, err := storage.GetPinnedMemories(ctx, userID)
	if err != nil {
		log.Printf("⚠️ [MEMORY] Failed to fetch pinned memories: %v", err)
		return ""
	}
	if len(pinned) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteString("\n\n## Always Remember About This User\n\n")
	for i, mem := range pinned {
		b.WriteString(fmt.Sprintf("%d. %s\n", i+1, mem.DecryptedContent))
	}
	log.Printf("📌 [MEMORY] Injected %d pinned memories into system prompt for user %s", len(pinned), userID)
	return b.String()
}

// turnPolicyFor loads the lite_mode flag for a model and resolves the policy.
// Any lookup failure yields the zero policy, which is the full-featured path.
func (s *ChatService) turnPolicyFor(modelID string) TurnPolicy {
	if modelID == "" || s.db == nil {
		return TurnPolicy{}
	}
	var lite bool
	if err := s.db.QueryRow(`SELECT lite_mode FROM models WHERE id = ?`, modelID).Scan(&lite); err != nil {
		return TurnPolicy{}
	}
	return resolveTurnPolicy(&models.Model{ID: modelID, LiteMode: lite})
}

// GetSystemPrompt returns the appropriate system prompt based on priority hierarchy
// includeAskUser: whether to include ask_user tool instructions (should be true if tools are available)
func (s *ChatService) GetSystemPrompt(userConn *models.UserConnection, includeAskUser bool) string {
	formattingGuidelines := getMarkdownFormattingGuidelines()

	// Only include ask_user instructions if tools will be available in the request
	// Otherwise models like Gemini will fail with MALFORMED_FUNCTION_CALL when trying to use a tool that doesn't exist
	var appendix string
	if includeAskUser {
		appendix = getAskUserInstructions() + formattingGuidelines
	} else {
		appendix = formattingGuidelines
		log.Printf("📝 [SYSTEM] Skipping ask_user instructions (no tools selected)")
	}

	// Build temporal context (user name, date, time) - prepended to all prompts
	temporalContext := s.buildTemporalContext(userConn.UserID)

	// 🧠 Build memory context (injected memories from user's memory bank)
	memoryContext := s.buildMemoryContext(userConn)

	if s.turnPolicyFor(userConn.ModelID).LiteSystemPrompt {
		base := getLiteSystemPrompt()
		if userConn.SystemInstructions != "" {
			base = userConn.SystemInstructions
		}
		liteAppendix := ""
		if includeAskUser {
			liteAppendix = getAskUserInstructions()
		}
		log.Printf("⚡ [LITE] Using compact system prompt for %s", userConn.ModelID)
		return temporalContext + base + memoryContext + liteAppendix
	}

	// Priority 1: User-provided system instructions (per-request override)
	if userConn.SystemInstructions != "" {
		log.Printf("🎯 [SYSTEM] Using user-provided system instructions for %s", userConn.ConnID)
		log.Printf("✅ [SYSTEM] Appending MANDATORY ask_user instructions")
		return temporalContext + userConn.SystemInstructions + memoryContext + appendix
	}

	// Priority 2: Model-specific system prompt (from database)
	if userConn.ModelID != "" {
		var modelSystemPrompt string
		err := s.db.QueryRow(`
			SELECT system_prompt FROM models WHERE id = ? AND system_prompt IS NOT NULL AND system_prompt != ''
		`, userConn.ModelID).Scan(&modelSystemPrompt)

		if err == nil && modelSystemPrompt != "" {
			log.Printf("📋 [SYSTEM] Using model-specific system prompt for %s (model: %s)", userConn.ConnID, userConn.ModelID)
			log.Printf("✅ [SYSTEM] Appending MANDATORY ask_user instructions to database prompt")
			return temporalContext + modelSystemPrompt + memoryContext + appendix
		}
	}

	// Priority 3: Provider default system prompt (from providers table)
	if userConn.ModelID != "" {
		var providerSystemPrompt string
		err := s.db.QueryRow(`
			SELECT p.system_prompt
			FROM providers p
			JOIN models m ON m.provider_id = p.id
			WHERE m.id = ? AND p.system_prompt IS NOT NULL AND p.system_prompt != ''
		`, userConn.ModelID).Scan(&providerSystemPrompt)

		if err == nil && providerSystemPrompt != "" {
			log.Printf("🏢 [SYSTEM] Using provider default system prompt for %s", userConn.ConnID)
			log.Printf("✅ [SYSTEM] Appending MANDATORY ask_user instructions to provider prompt")
			return temporalContext + providerSystemPrompt + memoryContext + appendix
		}
	}

	// Priority 4: Global fallback prompt
	log.Printf("🌐 [SYSTEM] Using global fallback system prompt for %s", userConn.ConnID)
	defaultPrompt := getDefaultSystemPrompt()

	if includeAskUser {
		log.Printf("✅ [SYSTEM] Appending ask_user instructions to global fallback prompt")
	}

	return temporalContext + defaultPrompt + memoryContext + appendix
}

// getLiteSystemPrompt returns the compact prompt used for models flagged
// lite_mode. It states identity and the tool contract and stops there: the
// artifact conventions, formatting rules and extended tool guidance in the
// default prompt are routinely ignored or echoed back verbatim by small
// models, so including them costs tokens and buys nothing.
func getLiteSystemPrompt() string {
	return `You are ClaraVerse, a helpful AI assistant.

Answer directly and concisely. Prefer a short, correct answer over a long one.

You may be given tools. Call a tool only when you cannot answer without it, and use the exact tool name and argument names supplied. If no tool fits, answer from your own knowledge.

If a request is ambiguous, ask one short clarifying question instead of guessing.`
}

// getDefaultSystemPrompt returns the ClaraVerse-specific system prompt
// Minimal prompt - models can see tool definitions directly in the API call
func getDefaultSystemPrompt() string {
	return `You are ClaraVerse, a helpful and intelligent assistant.

## Response Style

- Start with the answer, no preambles
- Match complexity to the question (brief for simple, detailed for complex)
- Use proper markdown: headers, lists, code blocks with language tags
- When using search tools, cite sources: [Source](url)
- No emojis unless user uses them first

## Artifacts

Create interactive content when appropriate:
- **html** blocks for web interfaces
- **svg** blocks for vector graphics
- **mermaid** blocks for diagrams

## Guidelines

- Be direct and efficient
- Use available tools when they help accomplish the task
- Cite sources when presenting information from external searches
- Ask clarifying questions when requirements are ambiguous`
}

// modelPricing is a small static map of $/Mtok (input, cached-input, output)
// for models we know. Cached-input rate captures the discount providers like
// Bedrock/Anthropic give on cache_control hits (typically ~10% of base in).
// Missing entries return 0 cost — the UI hides the cost chip in that case.
//
// Keep this list short and intentional. The goal is "you can see what each
// turn cost when we know"; it's not a full billing system. Prices are
// USD per 1M tokens, accurate as of May 2026 from each provider's page.
var modelPricing = map[string]struct{ inUSD, cachedUSD, outUSD float64 }{
	// Bedrock OpenAI shim — current accessible set on the user's key
	"qwen.qwen3-32b-v1:0":               {0.15, 0.015, 0.60},
	"qwen.qwen3-coder-480b-a35b-v1:0":   {2.00, 0.20, 6.00},
	"moonshotai.kimi-k2.5":              {0.60, 0.06, 2.50},
	"zai.glm-5":                         {0.60, 0.06, 2.20},
	"openai.gpt-oss-20b-1:0":            {0.10, 0.01, 0.40},
	"openai.gpt-oss-120b-1:0":           {0.60, 0.06, 2.40},
}

// estimateCostUSD totals the cost for one turn. inputTokens already excludes
// cachedTokens (caller subtracts) so we don't double-count.
func estimateCostUSD(model string, freshInput, cached, output int) float64 {
	p, ok := modelPricing[model]
	if !ok {
		return 0
	}
	const oneMillion = 1_000_000.0
	cost := float64(freshInput)*p.inUSD/oneMillion +
		float64(cached)*p.cachedUSD/oneMillion +
		float64(output)*p.outUSD/oneMillion
	if cost < 0 {
		return 0
	}
	return cost
}

// intFromJSON pulls an int out of a json.Unmarshal'd interface{} field that
// may be a float64 (Go's default for unstructured JSON numbers) or an int.
// Returns 0 for nil / wrong type.
func intFromJSON(v interface{}) int {
	switch n := v.(type) {
	case float64:
		return int(n)
	case int:
		return n
	case int64:
		return int(n)
	}
	return 0
}

// providerSupportsPromptCaching reports whether the provider behind baseURL
// honors message-level cache_control markers on chat-completions requests.
//
// Bedrock removed from the list as of the 400-loop incident: their
// /openai/v1 shim rejects message-level cache_control with a JSON parse
// error ("Unterminated string starting at: line 1 column 11") which
// triggers infinite 3-retry loops on every daemon. Bedrock auto-caches
// prompts >1024 tokens server-side without needing this marker, so we
// lose nothing by dropping it.
//
// Anthropic's native /v1/messages API does honor cache_control, but
// inside content BLOCKS (not on the message itself). The marker we
// shipped before was wrong even for Anthropic — we'd need to restructure
// content from string to [{type:"text", text:..., cache_control:...}].
// Until that refactor lands, returning false everywhere is the safe
// behaviour; we forfeit some explicit caching wins on Anthropic native
// in exchange for never crashing a daemon mid-task.
func providerSupportsPromptCaching(baseURL string) bool {
	_ = baseURL
	return false
}

// applyPromptCaching annotates the system message with cache_control:ephemeral
// when the target provider supports it. System prompts in this codebase are
// large (>1k tokens) and re-sent every turn — caching them gives a ~98% hit
// rate on the system block once warm.
//
// We deliberately mutate the message map in place (callers pass slices of
// maps by reference). Returns true if caching was applied.
func applyPromptCaching(messages []map[string]interface{}, baseURL string) bool {
	if !providerSupportsPromptCaching(baseURL) {
		return false
	}
	if len(messages) == 0 {
		return false
	}
	if role, ok := messages[0]["role"].(string); ok && role == "system" {
		if _, already := messages[0]["cache_control"]; !already {
			messages[0]["cache_control"] = map[string]interface{}{"type": "ephemeral"}
		}
		return true
	}
	return false
}

// buildMessagesWithSystemPrompt ensures system prompt is the first message
func (s *ChatService) buildMessagesWithSystemPrompt(systemPrompt string, messages []map[string]interface{}) []map[string]interface{} {
	// Check if first message is already a system message
	if len(messages) > 0 {
		if role, ok := messages[0]["role"].(string); ok && role == "system" {
			// Update existing system message
			messages[0]["content"] = systemPrompt
			return messages
		}
	}

	// Prepend system message
	systemMessage := map[string]interface{}{
		"role":    "system",
		"content": systemPrompt,
	}

	return append([]map[string]interface{}{systemMessage}, messages...)
}

// generateConversationTitle generates a short title from the conversation
func (s *ChatService) generateConversationTitle(userConn *models.UserConnection, assistantResponse string) {
	// Recover from panics (e.g., send on closed channel if user disconnects)
	defer func() {
		if r := recover(); r != nil {
			log.Printf("⚠️  [TITLE] Recovered from panic (user likely disconnected): %v", r)
		}
	}()

	// Get the first user message from cache
	messages := s.getConversationMessages(userConn.ConversationID)
	var firstUserMessage string
	for _, msg := range messages {
		if role, ok := msg["role"].(string); ok && role == "user" {
			if content, ok := msg["content"].(string); ok {
				firstUserMessage = content
				break
			}
		}
	}

	if firstUserMessage == "" {
		log.Printf("⚠️  [TITLE] No user message found for title generation")
		return
	}

	// Check for system-assigned title generator model first
	modelID := userConn.ModelID
	if s.settingsService != nil {
		assignments, err := s.settingsService.GetSystemModelAssignments(context.Background())
		if err == nil && assignments.TitleGenerator != "" {
			modelID = assignments.TitleGenerator
			log.Printf("🎯 [TITLE] Using system-assigned model: %s", modelID)
		}
	}

	config, err := s.GetEffectiveConfig(userConn, modelID)
	if err != nil {
		log.Printf("❌ [TITLE] Failed to get config: %v", err)
		return
	}

	// Create a simple prompt for title generation
	titlePrompt := []map[string]interface{}{
		{
			"role":    "system",
			"content": "Generate a short, descriptive title (4-5 words maximum) for this conversation. Respond with only the title, no quotes or punctuation.",
		},
		{
			"role":    "user",
			"content": fmt.Sprintf("First message: %s\n\nAssistant response: %s", firstUserMessage, assistantResponse),
		},
	}

	// Make a non-streaming request for title
	chatReq := models.ChatRequest{
		Model:       config.Model,
		Messages:    titlePrompt,
		Stream:      false,
		Temperature: 0.7,
	}

	reqBody, err := json.Marshal(chatReq)
	if err != nil {
		log.Printf("❌ [TITLE] Failed to marshal request: %v", err)
		return
	}

	req, err := http.NewRequest("POST", config.BaseURL+"/chat/completions", bytes.NewBuffer(reqBody))
	if err != nil {
		log.Printf("❌ [TITLE] Failed to create request: %v", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+config.APIKey)

	client := &http.Client{Timeout: 600 * time.Second} // 10 min — local models may cold start
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ [TITLE] Request failed: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		log.Printf("❌ [TITLE] API error (status %d): %s", resp.StatusCode, string(body))
		return
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		log.Printf("❌ [TITLE] Failed to decode response: %v", err)
		return
	}

	if len(result.Choices) == 0 {
		log.Printf("⚠️  [TITLE] No choices in response")
		return
	}

	title := strings.TrimSpace(result.Choices[0].Message.Content)
	title = strings.Trim(title, `"'`) // Remove quotes if present

	// Limit to 5 words
	words := strings.Fields(title)
	if len(words) > 5 {
		words = words[:5]
		title = strings.Join(words, " ")
	}

	log.Printf("📝 [TITLE] Generated title for %s (length: %d chars)", userConn.ConversationID, len(title))

	// Send title to client (safe send - channel may be closed if user disconnected)
	select {
	case userConn.WriteChan <- models.ServerMessage{
		Type:           "conversation_title",
		ConversationID: userConn.ConversationID,
		Title:          title,
	}:
		log.Printf("✅ [TITLE] Sent title to client for %s", userConn.ConversationID)
	default:
		log.Printf("⚠️  [TITLE] Channel closed or full, skipping title send for %s", userConn.ConversationID)
	}
}

// ChatCompletionSync performs a synchronous (non-streaming) chat completion
// Used for channel integrations (Telegram, etc.) where we need the full response
func (s *ChatService) ChatCompletionSync(ctx context.Context, userID, modelID string, messages []map[string]interface{}, systemPrompt *string) (string, error) {
	// Get provider config for the model
	config, err := s.getConfigForModel(modelID)
	if err != nil {
		return "", fmt.Errorf("failed to get config for model %s: %w", modelID, err)
	}

	// Prepare messages with optional system prompt override
	preparedMessages := messages
	if systemPrompt != nil && *systemPrompt != "" {
		// Prepend system message if not already present
		hasSystem := false
		for _, msg := range messages {
			if role, _ := msg["role"].(string); role == "system" {
				hasSystem = true
				break
			}
		}
		if !hasSystem {
			preparedMessages = append([]map[string]interface{}{
				{"role": "system", "content": *systemPrompt},
			}, messages...)
		}
	}

	// Build request body (non-streaming)
	reqBody := map[string]interface{}{
		"model":    config.Model,
		"messages": preparedMessages,
		"stream":   false,
	}

	// HTML-escape OFF — same Bedrock /openai/v1 issue documented in
	// daemon_runner.go: default json.Marshal converts <, >, & to escapes
	// that the shim rejects. Must keep parity here so chat-side requests
	// don't trip the same loop.
	var reqBuf bytes.Buffer
	enc := json.NewEncoder(&reqBuf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(reqBody); err != nil {
		return "", fmt.Errorf("failed to marshal request: %w", err)
	}
	reqJSON := bytes.TrimRight(reqBuf.Bytes(), "\n")

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", config.BaseURL+"/chat/completions", bytes.NewBuffer(reqJSON))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+config.APIKey)

	// Send request (10 min timeout — local models may cold start)
	client := &http.Client{Timeout: 600 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
	}

	// Parse response
	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	if len(result.Choices) == 0 {
		return "", fmt.Errorf("no choices in response")
	}

	content := result.Choices[0].Message.Content
	log.Printf("📡 [CHANNEL-CHAT] Sync completion for user %s: %d chars", userID, len(content))

	return content, nil
}

// ChannelToolResult contains the response text and any generated artifacts (like images)
type ChannelToolResult struct {
	Response        string   // The text response from the AI
	GeneratedImages [][]byte // Base64-decoded image data from generate_image tool
}

// ChatCompletionWithTools performs a synchronous chat completion with tool calling support
// Used for channel integrations (Telegram, etc.) where we need the full response with tools
// This handles the complete tool calling loop until a final text response is returned
func (s *ChatService) ChatCompletionWithTools(ctx context.Context, userID, conversationID, modelID string, messages []map[string]interface{}, availableTools []map[string]interface{}, maxIterations int) (string, error) {
	result, err := s.ChatCompletionWithToolsEx(ctx, userID, conversationID, modelID, messages, availableTools, maxIterations)
	if err != nil {
		return "", err
	}
	return result.Response, nil
}

// ChatCompletionWithToolsEx performs chat completion with tools and returns extended results
// including generated images for channel integrations
// conversationID is required for tools that need to look up resources (e.g., edit_image needs image registry)
func (s *ChatService) ChatCompletionWithToolsEx(ctx context.Context, userID, conversationID, modelID string, messages []map[string]interface{}, availableTools []map[string]interface{}, maxIterations int) (*ChannelToolResult, error) {
	// A standalone agent run still needs one identity across tool iterations.
	if conversationID == "" {
		conversationID = uuid.NewString()
	}
	if maxIterations <= 0 {
		maxIterations = 10 // Default max iterations to prevent infinite loops
	}

	result := &ChannelToolResult{
		GeneratedImages: [][]byte{},
	}

	// Get provider config for the model
	config, err := s.getConfigForModel(modelID)
	if err != nil {
		return nil, fmt.Errorf("failed to get config for model %s: %w", modelID, err)
	}

	// Copy messages to avoid modifying the original
	workingMessages := make([]map[string]interface{}, len(messages))
	copy(workingMessages, messages)

	for iteration := 0; iteration < maxIterations; iteration++ {
		log.Printf("🔧 [CHANNEL-TOOLS] Iteration %d/%d for user %s", iteration+1, maxIterations, userID)

		// Build request body with tools
		reqBody := map[string]interface{}{
			"model":    config.Model,
			"messages": workingMessages,
			"stream":   false,
		}

		// Only add tools if available
		if len(availableTools) > 0 {
			reqBody["tools"] = availableTools
		}

		// HTML-escape OFF — Bedrock /openai/v1 rejects requests with the
		// HTML-escaped <, >, & sequences Go's json.Marshal emits by default.
		var reqBuf bytes.Buffer
		enc := json.NewEncoder(&reqBuf)
		enc.SetEscapeHTML(false)
		if err := enc.Encode(reqBody); err != nil {
			return nil, fmt.Errorf("failed to marshal request: %w", err)
		}
		reqJSON := bytes.TrimRight(reqBuf.Bytes(), "\n")

		// Create HTTP request
		req, err := http.NewRequestWithContext(ctx, "POST", config.BaseURL+"/chat/completions", bytes.NewBuffer(reqJSON))
		if err != nil {
			return nil, fmt.Errorf("failed to create request: %w", err)
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+config.APIKey)

		// Send request with longer timeout for tool execution + local model cold starts
		client := &http.Client{Timeout: 600 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			return nil, fmt.Errorf("request failed: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			return nil, fmt.Errorf("API error (status %d): %s", resp.StatusCode, string(body))
		}

		// Parse response
		var apiResult struct {
			Choices []struct {
				Message struct {
					Content   string `json:"content"`
					ToolCalls []struct {
						ID           string                 `json:"id"`
						Type         string                 `json:"type"`
						ExtraContent map[string]interface{} `json:"extra_content,omitempty"` // Gemini thought_signature
						Function     struct {
							Name      string `json:"name"`
							Arguments string `json:"arguments"`
						} `json:"function"`
					} `json:"tool_calls"`
				} `json:"message"`
				FinishReason string `json:"finish_reason"`
			} `json:"choices"`
		}

		if err := json.NewDecoder(resp.Body).Decode(&apiResult); err != nil {
			return nil, fmt.Errorf("failed to decode response: %w", err)
		}

		if len(apiResult.Choices) == 0 {
			return nil, fmt.Errorf("no choices in response")
		}

		choice := apiResult.Choices[0]
		message := choice.Message

		// Check if the model wants to call tools
		// Also handle providers (like Gemini) that return tool calls with finish_reason != "tool_calls"
		if len(message.ToolCalls) > 0 && (choice.FinishReason == "tool_calls" || choice.FinishReason == "stop" || choice.FinishReason == "") {
			log.Printf("🔧 [CHANNEL-TOOLS] Model requested %d tool call(s)", len(message.ToolCalls))

			// Add assistant message with tool calls to conversation
			toolCallsForMessage := make([]map[string]interface{}, 0, len(message.ToolCalls))
			for _, tc := range message.ToolCalls {
				// Sanitize concatenated JSON before storing in history
				sanitizedArgs := tc.Function.Arguments
				if fixed, ok := sanitizeConcatenatedJSON(sanitizedArgs); ok {
					log.Printf("🔧 [FIX] Sanitized concatenated JSON in channel tool call args for %s", tc.Function.Name)
					sanitizedArgs = fixed
				}
				tcMsg := map[string]interface{}{
					"id":   tc.ID,
					"type": tc.Type,
					"function": map[string]interface{}{
						"name":      tc.Function.Name,
						"arguments": sanitizedArgs,
					},
				}
				// CRITICAL: Include extra_content (Gemini thought_signature) if present
				// Gemini REQUIRES it when echoing back tool calls in conversation history
				if tc.ExtraContent != nil {
					tcMsg["extra_content"] = tc.ExtraContent
					log.Printf("🧠 [CHANNEL-TOOLS] Including thought_signature for tool call %s (required by Gemini)", tc.Function.Name)
				}
				toolCallsForMessage = append(toolCallsForMessage, tcMsg)
			}

			assistantMsg := map[string]interface{}{
				"role":       "assistant",
				"tool_calls": toolCallsForMessage,
			}
			if message.Content != "" {
				assistantMsg["content"] = message.Content
			}
			workingMessages = append(workingMessages, assistantMsg)

			// Execute each tool and add results
			for _, tc := range message.ToolCalls {
				toolName := tc.Function.Name
				argsJSON := tc.Function.Arguments

				log.Printf("🔧 [CHANNEL-TOOLS] Executing tool: %s", toolName)

				// Execute the tool and capture generated images
				toolResult, generatedImage := s.executeToolForChannelEx(ctx, userID, conversationID, toolName, argsJSON)

				// If image was generated, add to result
				if generatedImage != nil {
					result.GeneratedImages = append(result.GeneratedImages, generatedImage)
					log.Printf("🖼️ [CHANNEL-TOOLS] Captured generated image (%d bytes)", len(generatedImage))
				}

				// Add tool result to messages
				workingMessages = append(workingMessages, map[string]interface{}{
					"role":         "tool",
					"tool_call_id": tc.ID,
					"name":         toolName,
					"content":      toolResult,
				})

				log.Printf("✅ [CHANNEL-TOOLS] Tool %s executed, result length: %d", toolName, len(toolResult))
			}

			// Continue to next iteration to get response after tools
			continue
		}

		// No tool calls - return the content
		content := message.Content
		log.Printf("📡 [CHANNEL-TOOLS] Final response for user %s: %d chars after %d iteration(s)", userID, len(content), iteration+1)
		result.Response = content
		return result, nil
	}

	return nil, fmt.Errorf("max iterations (%d) reached without final response", maxIterations)
}

// executeToolForChannel executes a tool for channel integrations (simplified, no WebSocket)
func (s *ChatService) executeToolForChannel(ctx context.Context, userID, toolName, argsJSON string) string {
	result, _ := s.executeToolForChannelEx(ctx, userID, "", toolName, argsJSON)
	return result
}

// executeToolForChannelEx executes a tool and returns both the result text and any generated image
func (s *ChatService) executeToolForChannelEx(ctx context.Context, userID, conversationID, toolName, argsJSON string) (string, []byte) {
	// Parse arguments
	var args map[string]interface{}
	if err := json.Unmarshal([]byte(argsJSON), &args); err != nil {
		log.Printf("❌ [CHANNEL-TOOLS] Failed to parse tool arguments for %s: %v", toolName, err)
		return fmt.Sprintf("Error parsing arguments: %v", err), nil
	}

	// Inject user and conversation context (required for tools like edit_image)
	args["__user_id__"] = userID
	args["__conversation_id__"] = conversationID

	// Auto-inject credentials for tools that require them
	if s.toolService != nil {
		resolver := s.toolService.CreateCredentialResolver(userID)
		if resolver != nil {
			args[tools.CredentialResolverKey] = resolver
		}

		credentialID := s.toolService.GetCredentialForTool(ctx, userID, toolName)
		if credentialID != "" {
			args["credential_id"] = credentialID
			log.Printf("🔐 [CHANNEL-TOOLS] Auto-injected credential_id=%s for tool=%s", credentialID, toolName)
		}
	}

	// Inject image provider config for generate_image tool
	if toolName == "generate_image" {
		imageProviderService := GetImageProviderService()
		provider := imageProviderService.GetProvider()
		if provider != nil {
			args[tools.ImageProviderConfigKey] = &tools.ImageProviderConfig{
				Name:         provider.Name,
				BaseURL:      provider.BaseURL,
				APIKey:       provider.APIKey,
				DefaultModel: provider.DefaultModel,
			}
		}
		imageRegistry := GetImageRegistryService()
		args[tools.ImageRegistryKey] = &ImageRegistryAdapter{registry: imageRegistry}
		if s.usageLimiter != nil {
			args[tools.UsageLimiterKey] = s.usageLimiter
		}
	}

	// Inject image edit config for edit_image tool
	if toolName == "edit_image" {
		imageRegistry := GetImageRegistryService()
		args[tools.ImageRegistryKey] = &ImageRegistryAdapter{registry: imageRegistry}
		imageEditProviderService := GetImageEditProviderService()
		editProvider := imageEditProviderService.GetProvider()
		if editProvider != nil {
			args[tools.ImageEditConfigKey] = &tools.ImageEditConfig{
				BaseURL: editProvider.BaseURL,
				APIKey:  editProvider.APIKey,
			}
		}
	}

	// Inject image registry for describe_image tool
	if toolName == "describe_image" {
		imageRegistry := GetImageRegistryService()
		args[tools.ImageRegistryKey] = &ImageRegistryAdapter{registry: imageRegistry}
	}

	// Check if this is an MCP tool — route to local client if so
	tool, exists := s.toolRegistry.GetUserTool(userID, toolName)
	var result string
	var err error

	if exists && tool.Source == tools.ToolSourceMCPLocal {
		log.Printf("🔌 [CHANNEL-MCP] Routing tool %s to local MCP client for user %s", toolName, userID)

		if s.mcpBridge == nil || !s.mcpBridge.IsUserConnected(userID) {
			log.Printf("❌ [CHANNEL-MCP] No MCP client connected for user %s", userID)
			return "Error: MCP client not connected. Please start your local MCP client.", nil
		}

		result, err = s.mcpBridge.ExecuteToolOnClient(userID, toolName, args, 30*time.Second)

		auditErr := ""
		if err != nil {
			auditErr = err.Error()
		}
		s.mcpBridge.LogToolExecution(userID, toolName, conversationID, err == nil, auditErr)

		if err != nil {
			log.Printf("❌ [CHANNEL-MCP] Tool execution failed for %s: %v", toolName, err)
			return fmt.Sprintf("Error: %v", err), nil
		}
	} else {
		// Built-in tool — execute locally
		result, err = s.toolRegistry.ExecuteContext(ctx, toolName, args)
		if err != nil {
			log.Printf("❌ [CHANNEL-TOOLS] Tool execution failed for %s: %v", toolName, err)
			return fmt.Sprintf("Error: %v", err), nil
		}
	}

	// For tools that return JSON with large data (like plots), extract image and summary
	var resultData map[string]interface{}
	var generatedImage []byte
	if err := json.Unmarshal([]byte(result), &resultData); err == nil {
		// Check if result has plots - extract base64 image data
		if plots, hasPlots := resultData["plots"]; hasPlots {
			if plotsArray, ok := plots.([]interface{}); ok && len(plotsArray) > 0 {
				// Try to extract image data from first plot
				if firstPlot, ok := plotsArray[0].(map[string]interface{}); ok {
					if data, ok := firstPlot["data"].(string); ok && data != "" {
						// Decode base64 image
						if decoded, err := base64.StdEncoding.DecodeString(data); err == nil {
							generatedImage = decoded
							log.Printf("🖼️ [CHANNEL-TOOLS] Extracted generated image: %d bytes", len(generatedImage))
						}
					}
				}
				// Return summary without base64 data (for LLM context)
				resultData["plots"] = fmt.Sprintf("[%d plot(s) generated]", len(plotsArray))
				summaryJSON, _ := json.Marshal(resultData)
				return string(summaryJSON), generatedImage
			}
		}
	}

	return result, generatedImage
}

// GetModelConfig resolves a model ID to its provider configuration.
// Public wrapper used by the agent chat proxy endpoint.
func (s *ChatService) GetModelConfig(modelID string) (*models.Config, error) {
	return s.getConfigForModel(modelID)
}

// getConfigForModel gets the provider config for a specific model
func (s *ChatService) getConfigForModel(modelID string) (*models.Config, error) {
	// First, check if it's an alias
	if providerID, actualModel, isAlias := s.resolveModelAlias(modelID); isAlias {
		provider, err := s.providerService.GetByID(providerID)
		if err != nil {
			return nil, err
		}
		if !provider.Enabled {
			return nil, fmt.Errorf("provider for model alias %s is disabled", modelID)
		}
		return &models.Config{
			BaseURL:    provider.BaseURL,
			APIKey:     provider.APIKey,
			Model:      actualModel,
			ProviderID: provider.ID,
		}, nil
	}

	// Try to find the provider using GetByModelIDWithName so we forward
	// the upstream API name (not the row id) to the model.
	if provider, apiName, err := s.providerService.GetByModelIDWithName(modelID); err == nil && provider.Enabled {
		return &models.Config{
			BaseURL:    provider.BaseURL,
			APIKey:     provider.APIKey,
			Model:      apiName,
			ProviderID: provider.ID,
		}, nil
	}

	// Fall back to default provider
	provider, modelName, err := s.GetDefaultProviderWithModel()
	if err != nil {
		return nil, fmt.Errorf("no provider found for model %s and no default available", modelID)
	}

	return &models.Config{
		BaseURL:    provider.BaseURL,
		APIKey:     provider.APIKey,
		Model:      modelName,
		ProviderID: provider.ID,
	}, nil
}

// extractLastUserMessage extracts the last user message content from messages array
// Handles both string content and array content (for vision messages)
func extractLastUserMessage(messages []map[string]interface{}) string {
	for i := len(messages) - 1; i >= 0; i-- {
		msg := messages[i]
		role, _ := msg["role"].(string)
		if role == "user" {
			// Handle string content
			if content, ok := msg["content"].(string); ok {
				return content
			}
			// Handle array content (vision messages)
			if contentArr, ok := msg["content"].([]interface{}); ok {
				for _, part := range contentArr {
					if partMap, ok := part.(map[string]interface{}); ok {
						if partType, _ := partMap["type"].(string); partType == "text" {
							if text, ok := partMap["text"].(string); ok {
								return text
							}
						}
					}
				}
			}
		}
	}
	return ""
}

// isSimpleGreeting detects if a message is a simple greeting that doesn't need tools
func isSimpleGreeting(message string) bool {
	if message == "" {
		return false
	}

	// Normalize: lowercase and trim
	normalized := strings.ToLower(strings.TrimSpace(message))

	// Remove common punctuation
	normalized = strings.Trim(normalized, ".,!?")

	// Simple greetings that don't need tools
	simpleGreetings := []string{
		"hi", "hello", "hey", "yo", "sup", "howdy",
		"good morning", "good afternoon", "good evening", "good night",
		"morning", "afternoon", "evening", "night",
		"what's up", "whats up", "wassup",
		"how are you", "how are you doing", "how do you do",
		"hiya", "greetings", "salutations",
	}

	for _, greeting := range simpleGreetings {
		if normalized == greeting {
			return true
		}
	}

	return false
}

// AddMemory satisfies tools.MemoryAccess — the contract the add_memory
// built-in tool calls into when the model decides something is worth
// remembering across conversations.
func (s *ChatService) AddMemory(ctx context.Context, userID, content, category, conversationID string, tags []string, pinned bool) (string, error) {
	storage := s.memoryStorageServiceFromExtraction()
	if storage == nil {
		return "", fmt.Errorf("memory storage not available")
	}
	mem, err := storage.CreateMemory(ctx, userID, content, category, tags, pinned, 0.5, conversationID)
	if err != nil {
		return "", err
	}
	return mem.ID.Hex(), nil
}

// SearchMemory satisfies tools.MemoryAccess. Uses the same vector pipeline
// the inline memory selector uses, so what the model can fish for matches
// what the system would inject automatically.
func (s *ChatService) SearchMemory(ctx context.Context, userID, query string, limit int) ([]tools.MemorySearchHit, error) {
	storage := s.memoryStorageServiceFromExtraction()
	if storage == nil {
		return nil, fmt.Errorf("memory storage not available")
	}
	if s.memorySelectionService == nil {
		return nil, fmt.Errorf("memory selection not available")
	}
	// Reuse the embedding service via the selection service path. If
	// embeddings aren't configured, fall back to score-ordered top-K.
	if s.memorySelectionService.HasEmbedding(ctx) {
		vec, err := s.memorySelectionService.EmbedQuery(ctx, query)
		if err == nil && len(vec) > 0 {
			hits, sErr := storage.SearchByEmbedding(ctx, userID, vec, limit)
			if sErr == nil {
				out := make([]tools.MemorySearchHit, 0, len(hits))
				for _, h := range hits {
					out = append(out, tools.MemorySearchHit{
						ID:        h.Memory.ID.Hex(),
						Content:   h.Memory.DecryptedContent,
						Relevance: h.Similarity,
					})
				}
				return out, nil
			}
		}
	}
	// Score-ordered fallback.
	mems, err := storage.GetActiveMemories(ctx, userID)
	if err != nil {
		return nil, err
	}
	if limit > len(mems) {
		limit = len(mems)
	}
	out := make([]tools.MemorySearchHit, 0, limit)
	for i := 0; i < limit; i++ {
		out = append(out, tools.MemorySearchHit{
			ID:      mems[i].ID.Hex(),
			Content: mems[i].DecryptedContent,
		})
	}
	return out, nil
}

// memoryStorageServiceFromExtraction is a tiny accessor — the chat service
// doesn't hold a direct reference to MemoryStorageService (only to the
// selection + extraction services), but the extraction service does. This
// keeps us from threading another field through every constructor.
func (s *ChatService) memoryStorageServiceFromExtraction() *MemoryStorageService {
	if s.memoryExtractionService == nil {
		return nil
	}
	return s.memoryExtractionService.StorageService()
}

// RunSubagent satisfies tools.SubagentRunner — the contract the
// spawn_subagent built-in tool calls into. The model invokes spawn_subagent
// with a self-contained task; this method runs a fresh agentic loop on a
// throwaway conversation ID, with a filtered tool subset (parent's tools
// minus spawn_subagent to prevent recursion), and returns only the final
// summary. Intermediate tool calls and reasoning never enter the parent's
// context — the 2026 fan-out pattern.
func (s *ChatService) RunSubagent(ctx context.Context, params tools.SubagentParams) (tools.SubagentResult, error) {
	if strings.TrimSpace(params.Task) == "" {
		return tools.SubagentResult{}, fmt.Errorf("task is required")
	}

	// Inherit model from parent if not specified. Without a UserConnection
	// handy in this synchronous code path, fall back to the provider's
	// default text model via the alias / config system.
	modelID := params.ModelID
	if modelID == "" {
		_, m, err := s.GetTextProviderWithModel()
		if err != nil {
			return tools.SubagentResult{}, fmt.Errorf("no model available for subagent: %w", err)
		}
		modelID = m
	}

	systemPrompt := params.SystemPrompt
	if systemPrompt == "" {
		systemPrompt = `You are a focused subagent dispatched by a parent agent to complete one specific task. Use the tools available to you to accomplish the task end-to-end. When done, reply with a single concise summary of what you found / did — your parent does not see your intermediate steps.`
	}

	messages := []map[string]interface{}{
		{"role": "system", "content": systemPrompt},
		{"role": "user", "content": params.Task},
	}

	// Build the tool set the child sees. Drop spawn_subagent to prevent
	// runaway recursion; allow_tools whitelist further narrows if set.
	registry := tools.GetRegistry()
	allowedSet := map[string]bool{}
	for _, name := range params.AllowedTools {
		allowedSet[name] = true
	}
	var availableTools []map[string]interface{}
	for _, t := range registry.List() {
		fn, _ := t["function"].(map[string]interface{})
		name, _ := fn["name"].(string)
		if name == "spawn_subagent" {
			continue // no recursion
		}
		if len(allowedSet) > 0 && !allowedSet[name] {
			continue
		}
		availableTools = append(availableTools, t)
	}

	maxIter := params.MaxIterations
	if maxIter <= 0 {
		maxIter = 10
	}

	// Fresh conversation ID — keeps subagent's intermediate messages out
	// of the parent's cache.
	childConvID := fmt.Sprintf("subagent-%s-%d", params.ParentConvID, time.Now().UnixNano())

	log.Printf("🤖 [SUBAGENT-RUN] user=%s child_conv=%s model=%s tools=%d max_iter=%d",
		params.UserID, childConvID, modelID, len(availableTools), maxIter)

	result, err := s.ChatCompletionWithToolsEx(ctx, params.UserID, childConvID, modelID, messages, availableTools, maxIter)
	if err != nil {
		return tools.SubagentResult{}, err
	}

	return tools.SubagentResult{
		Summary: result.Response,
	}, nil
}

// essentialToolNames are the core utilities that pass through any narrowing of
// the tool set — skill-driven selection and the lite tool strategy alike.
var essentialToolNames = map[string]bool{
	"ask_user":         true, // Always allow asking user for clarification
	"search_web":       true, // Web search for research
	"search_images":    true, // Image search
	"get_current_time": true, // Time utility
	"calculate_math":   true, // Math utility
	"scrape_web":       true, // Read web page content
	"download_file":    true, // Download files from URLs
	"describe_image":   true, // Understand uploaded images
}

var dataAnalysisGroupTools = map[string]bool{
	"read_spreadsheet": true, "read_data_file": true, "read_document": true, "download_file": true,
	"run_python": true, "analyze_data": true, "calculate_math": true, "train_model": true,
	"create_document": true, "html_to_pdf": true, "create_text_file": true, "create_presentation": true,
}

// alwaysOnCoreTools accompany every turn so universally-useful capabilities are
// never missing regardless of what the predictor chose.
var alwaysOnCoreTools = map[string]bool{
	"ask_user": true, "get_current_time": true, "calculate_math": true,
	"search_memory": true, "add_memory": true,
}

func messagesHaveDataFile(messages []map[string]interface{}) bool {
	hit := func(s string) bool {
		return strings.Contains(s, "[Data File:") || strings.Contains(s, "[Document:") ||
			strings.Contains(s, "clara_load(") || strings.Contains(s, "read_document(")
	}
	for _, m := range messages {
		switch c := m["content"].(type) {
		case string:
			if hit(c) {
				return true
			}
		case []interface{}:
			for _, part := range c {
				if pm, ok := part.(map[string]interface{}); ok {
					if t, ok := pm["text"].(string); ok && hit(t) {
						return true
					}
				}
			}
		}
	}
	return false
}
