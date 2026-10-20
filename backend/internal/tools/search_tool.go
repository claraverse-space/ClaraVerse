package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"sync/atomic"
	"time"
)

// SearchBalancer manages round-robin load balancing across multiple SearXNG instances
type SearchBalancer struct {
	urls    []string
	counter uint64
}

// Search result cache with TTL
type searchCache struct {
	mu      sync.RWMutex
	cache   map[string]*cacheEntry
	maxSize int
}

type cacheEntry struct {
	result    string
	timestamp time.Time
	ttl       time.Duration
}

var searchBalancer *SearchBalancer
var globalSearchCache = &searchCache{
	cache:   make(map[string]*cacheEntry),
	maxSize: 100, // Store up to 100 recent searches
}

func init() {
	searchBalancer = &SearchBalancer{}
	searchBalancer.loadURLs()
}

// loadURLs loads SearXNG URLs from environment variables
func (sb *SearchBalancer) loadURLs() {
	// Check for SEARXNG_URLS (comma-separated list) first
	urlsEnv := os.Getenv("SEARXNG_URLS")
	if urlsEnv != "" {
		urls := strings.Split(urlsEnv, ",")
		for _, u := range urls {
			trimmed := strings.TrimSpace(u)
			if trimmed != "" {
				// Normalize URL (remove trailing slash)
				trimmed = strings.TrimSuffix(trimmed, "/")
				sb.urls = append(sb.urls, trimmed)
			}
		}
	}

	// Fallback to single SEARXNG_URL if SEARXNG_URLS is not set
	if len(sb.urls) == 0 {
		singleURL := os.Getenv("SEARXNG_URL")
		if singleURL == "" {
			singleURL = "http://localhost:8080"
		}
		singleURL = strings.TrimSuffix(singleURL, "/")
		sb.urls = append(sb.urls, singleURL)
	}

	log.Printf("🔍 [SEARCH] Initialized round-robin balancer with %d SearXNG instance(s): %v", len(sb.urls), sb.urls)
}

// getNextURL returns the next URL in round-robin fashion
func (sb *SearchBalancer) getNextURL() string {
	if len(sb.urls) == 0 {
		return "http://localhost:8080"
	}
	idx := atomic.AddUint64(&sb.counter, 1) - 1
	return sb.urls[idx%uint64(len(sb.urls))]
}

// getURLCount returns the number of available URLs
func (sb *SearchBalancer) getURLCount() int {
	return len(sb.urls)
}

// getURLAtIndex returns URL at specific index (for retry logic)
func (sb *SearchBalancer) getURLAtIndex(startIdx uint64, offset int) string {
	if len(sb.urls) == 0 {
		return "http://localhost:8080"
	}
	idx := (startIdx + uint64(offset)) % uint64(len(sb.urls))
	return sb.urls[idx]
}

func (c *searchCache) get(key string) (string, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, exists := c.cache[key]
	if !exists {
		return "", false
	}

	// Check if cache entry is still valid
	if time.Since(entry.timestamp) > entry.ttl {
		return "", false
	}

	return entry.result, true
}

func (c *searchCache) set(key, result string, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Simple LRU: if cache is full, remove oldest entry
	if len(c.cache) >= c.maxSize {
		var oldestKey string
		var oldestTime time.Time
		for k, v := range c.cache {
			if oldestKey == "" || v.timestamp.Before(oldestTime) {
				oldestKey = k
				oldestTime = v.timestamp
			}
		}
		delete(c.cache, oldestKey)
	}

	c.cache[key] = &cacheEntry{
		result:    result,
		timestamp: time.Now(),
		ttl:       ttl,
	}
}

// NewSearchTool creates the search_web tool
func NewSearchTool() *Tool {
	return &Tool{
		Name:        "search_web",
		DisplayName: "Search Web",
		Description: "Search the web for current information, news, articles, or any topic",
		Icon:        "Search",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"query": map[string]interface{}{
					"type":        "string",
					"description": "The search query to look up on the web",
				},
			},
			"required": []string{"query"},
		},
		Execute:        executeSearchWeb,
		ExecuteContext: executeSearchWebContext,
		Source:         ToolSourceBuiltin,
		Category:       "data_sources",
		Keywords:       []string{"search", "find", "lookup", "research", "web", "internet", "news", "articles", "information", "query", "google"},
	}
}

func executeSearchWeb(args map[string]interface{}) (string, error) {
	return executeSearchWebContext(context.Background(), args)
}

func executeSearchWebContext(ctx context.Context, args map[string]interface{}) (string, error) {
	query, ok := args["query"].(string)
	if !ok {
		return "", fmt.Errorf("query parameter is required and must be a string")
	}

	query = strings.TrimSpace(query)
	if query == "" {
		return "", fmt.Errorf("query parameter must not be empty")
	}
	// Choose before consulting the SearXNG cache. An explicit Parallel failure
	// must never fall back to a different service or a cached SearXNG result.
	switch provider := strings.ToLower(strings.TrimSpace(os.Getenv("SEARCH_PROVIDER"))); provider {
	case "", "searxng":
		// Preserve the existing default, configured instances and cache behavior.
	case "parallel":
		return executeParallelSearch(ctx, query, args)
	default:
		return "", fmt.Errorf("unknown SEARCH_PROVIDER %q: use searxng or parallel", provider)
	}
	log.Printf("🔍 [SEARCH-WEB] Starting search for: '%s'", query)

	// Check cache first (5 minute TTL)
	cacheKey := strings.ToLower(query)
	if cached, found := globalSearchCache.get(cacheKey); found {
		log.Printf("✅ [SEARCH-WEB] Cache hit for: '%s'", query)
		return cached, nil
	}

	// Get the starting index for this request
	startIdx := atomic.LoadUint64(&searchBalancer.counter)
	urlCount := searchBalancer.getURLCount()

	// Try search with round-robin load balancing
	result, err := searchWithBalancer(query, startIdx, urlCount)
	if err != nil || strings.Contains(result, "No results found") {
		// Try simplified query
		log.Printf("⚠️ [SEARCH-WEB] Original query failed, trying simplified version")
		simplifiedQuery := simplifyQuery(query)
		if simplifiedQuery != query {
			log.Printf("🔄 [SEARCH-WEB] Simplified query: '%s' -> '%s'", query, simplifiedQuery)
			result, err = searchWithBalancer(simplifiedQuery, startIdx, urlCount)
		}
	}

	if err != nil {
		log.Printf("❌ [SEARCH-WEB] Search failed after retries: %v", err)
		return "", err
	}

	// Cache successful results
	if !strings.Contains(result, "No results found") {
		globalSearchCache.set(cacheKey, result, 5*time.Minute)
		log.Printf("✅ [SEARCH-WEB] Cached results for: '%s'", query)
	}

	return result, nil
}

// searchWithBalancer performs search using round-robin load balancing across multiple instances
func searchWithBalancer(query string, startIdx uint64, urlCount int) (string, error) {
	var lastErr error

	// Try each SearXNG instance in round-robin order
	for attempt := 0; attempt < urlCount; attempt++ {
		// Get next URL (first attempt uses round-robin, subsequent attempts try next in sequence)
		var searxngURL string
		if attempt == 0 {
			searxngURL = searchBalancer.getNextURL()
		} else {
			searxngURL = searchBalancer.getURLAtIndex(startIdx, attempt)
		}

		log.Printf("🔍 [SEARCH] Attempt %d/%d using SearXNG instance: %s", attempt+1, urlCount, searxngURL)

		result, err := performSearch(searxngURL, query)
		if err == nil {
			log.Printf("✅ [SEARCH] Success with instance: %s", searxngURL)
			return result, nil
		}

		log.Printf("⚠️ [SEARCH] Instance %s failed: %v", searxngURL, err)
		lastErr = err

		// Brief delay before trying next instance
		if attempt < urlCount-1 {
			time.Sleep(100 * time.Millisecond)
		}
	}

	return "", fmt.Errorf("all %d SearXNG instances failed, last error: %v", urlCount, lastErr)
}

// performSearch executes a single search request
func performSearch(searxngURL, query string) (string, error) {
	// Build search URL (let SearXNG use all enabled engines for better redundancy)
	searchURL := fmt.Sprintf("%s/search?q=%s&format=json&safesearch=1",
		searxngURL, url.QueryEscape(query))

	// Make HTTP request with required headers
	req, err := http.NewRequest("GET", searchURL, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %v", err)
	}
	req.Header.Set("User-Agent", "ClaraVerse/1.0 (Bot)")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-Forwarded-For", "127.0.0.1")
	req.Header.Set("X-Real-IP", "127.0.0.1")

	client := &http.Client{
		Timeout: 30 * time.Second, // Add timeout to prevent hanging
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("search request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("search failed with status: %d", resp.StatusCode)
	}

	// Parse response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read search response: %v", err)
	}

	var searchResults struct {
		Results []struct {
			Title   string `json:"title"`
			URL     string `json:"url"`
			Content string `json:"content"`
		} `json:"results"`
	}

	if err := json.Unmarshal(body, &searchResults); err != nil {
		return "", fmt.Errorf("failed to parse search results: %v", err)
	}

	if len(searchResults.Results) == 0 {
		return "No results found for your query.", nil
	}

	// Format results (limit to top 10 for better coverage)
	result := fmt.Sprintf("Found %d results for '%s':\n\n", len(searchResults.Results), query)
	maxResults := 10
	if len(searchResults.Results) < maxResults {
		maxResults = len(searchResults.Results)
	}

	for i := 0; i < maxResults; i++ {
		res := searchResults.Results[i]
		result += fmt.Sprintf("[%d] %s\n    URL: %s\n    %s\n\n",
			i+1, res.Title, res.URL, res.Content)
	}

	// Add citation reference section for easy copying
	result += "\n---\nSOURCES FOR CITATION (use these in your response):\n"
	for i := 0; i < maxResults; i++ {
		res := searchResults.Results[i]
		result += fmt.Sprintf("[%d]: [%s](%s)\n", i+1, res.Title, res.URL)
	}

	log.Printf("✅ [SEARCH-WEB] Found %d results for '%s'", len(searchResults.Results), query)
	return result, nil
}

// simplifyQuery removes complex filters and date ranges to get broader results
func simplifyQuery(query string) string {
	// Remove years (2024, 2025, etc.)
	query = strings.ReplaceAll(query, "2024", "")
	query = strings.ReplaceAll(query, "2025", "")

	// Remove common date-related words
	dateWords := []string{"latest", "recent", "new", "updates", "update", "news"}
	for _, word := range dateWords {
		query = strings.ReplaceAll(query, " "+word, "")
		query = strings.ReplaceAll(query, word+" ", "")
	}

	// Remove version numbers (v0.1.2, 0.1.2, etc.)
	query = strings.ReplaceAll(query, "v0.1.2", "")
	query = strings.ReplaceAll(query, "0.1.2", "")

	// Remove release-related words
	releaseWords := []string{"release", "released", "version"}
	for _, word := range releaseWords {
		query = strings.ReplaceAll(query, " "+word, "")
		query = strings.ReplaceAll(query, word+" ", "")
	}

	// Remove quotes
	query = strings.ReplaceAll(query, "\"", "")

	// Clean up multiple spaces
	query = strings.Join(strings.Fields(query), " ")

	// If query is now too short, return original
	if len(strings.TrimSpace(query)) < 3 {
		return strings.TrimSpace(query)
	}

	return strings.TrimSpace(query)
}
