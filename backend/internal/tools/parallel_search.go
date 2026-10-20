package tools

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/modelcontextprotocol/go-sdk/mcp"
)

const parallelSearchEndpoint = "https://search.parallel.ai/mcp"

// parallelSearchTransport identifies requests without forwarding application
// credentials. It wraps the default transport so its connection pool is reused.
type parallelSearchTransport struct{}

func (parallelSearchTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	req = req.Clone(req.Context())
	req.Header.Set("User-Agent", "ClaraVerse (+https://github.com/claraverse-space/ClaraVerse)")
	return http.DefaultTransport.RoundTrip(req)
}

func executeParallelSearch(ctx context.Context, query string, args map[string]interface{}) (string, error) {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	version := os.Getenv("CLARAVERSE_VERSION")
	if version == "" {
		version = "dev"
	}
	client := mcp.NewClient(&mcp.Implementation{Name: "ClaraVerse", Version: version}, nil)
	session, err := client.Connect(ctx, &mcp.StreamableClientTransport{
		Endpoint:             parallelSearchEndpoint,
		HTTPClient:           &http.Client{Transport: parallelSearchTransport{}},
		DisableStandaloneSSE: true,
		MaxRetries:           -1,
	}, nil)
	if err != nil {
		return "", fmt.Errorf("connect to Parallel Search MCP: %w", err)
	}
	defer func() { _ = session.Close() }()

	available, err := session.ListTools(ctx, nil)
	if err != nil {
		return "", fmt.Errorf("discover Parallel search tools: %w", err)
	}
	found := false
	for _, tool := range available.Tools {
		if tool.Name == "web_search" {
			found = true
			break
		}
	}
	if !found {
		return "", fmt.Errorf("parallel Search MCP does not expose web_search")
	}

	// The application owns conversation IDs. Derive an opaque, stable UUID from
	// that internal context, rather than sending user identity or keeping state
	// on a shared client. A call outside a conversation is a standalone search.
	sessionID := uuid.NewString()
	if conversationID, _ := args["__conversation_id__"].(string); conversationID != "" {
		sessionID = uuid.NewSHA1(uuid.NameSpaceURL, []byte("claraverse/search/"+conversationID)).String()
	}
	result, err := session.CallTool(ctx, &mcp.CallToolParams{
		Name: "web_search",
		Arguments: map[string]interface{}{
			"objective":      query,
			"search_queries": []string{query},
			"session_id":     sessionID,
		},
	})
	if err != nil {
		return "", fmt.Errorf("parallel web search: %w", err)
	}

	// Preserve the server's titles, excerpts and source URLs for the existing
	// string-valued tool-result consumer. Do not treat a tool error as a result.
	var text []string
	for _, content := range result.Content {
		if item, ok := content.(*mcp.TextContent); ok && strings.TrimSpace(item.Text) != "" {
			text = append(text, item.Text)
		}
	}
	output := strings.Join(text, "\n\n")
	if result.IsError {
		return "", fmt.Errorf("parallel web search failed: %s", output)
	}
	if output == "" {
		return "", fmt.Errorf("parallel web search returned no text content")
	}
	// Workflow tool blocks automatically decode JSON-looking strings. Keep the
	// search_web text contract even when MCP returns JSON inside TextContent.
	return "Parallel search results:\n\n" + output, nil
}
