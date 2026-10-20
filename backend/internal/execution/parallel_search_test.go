package execution

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"claraverse/internal/models"
	"claraverse/internal/tools"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type workflowSearchTransport func(*http.Request) (*http.Response, error)

func (f workflowSearchTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestParallelSearchWorkflowTextContract(t *testing.T) {
	t.Setenv("SEARCH_PROVIDER", "parallel")
	t.Setenv("PARALLEL_API_KEY", "")
	server := mcp.NewServer(&mcp.Implementation{Name: "workflow-search-fixture", Version: "1"}, nil)
	server.AddTool(&mcp.Tool{Name: "web_search", InputSchema: map[string]interface{}{"type": "object"}}, func(context.Context, *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return &mcp.CallToolResult{Content: []mcp.Content{&mcp.TextContent{Text: `{"results":[{"title":"Source","url":"https://example.org/source","excerpts":["Useful excerpt"]}]}`}}}, nil
	})
	local := httptest.NewServer(mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server { return server }, &mcp.StreamableHTTPOptions{Stateless: true, JSONResponse: true}))
	t.Cleanup(local.Close)
	destination, err := url.Parse(local.URL)
	if err != nil {
		t.Fatal(err)
	}
	original := http.DefaultTransport
	t.Cleanup(func() { http.DefaultTransport = original })
	http.DefaultTransport = workflowSearchTransport(func(r *http.Request) (*http.Response, error) {
		if r.URL.String() != "https://search.parallel.ai/mcp" {
			return nil, fmt.Errorf("unexpected search destination: %s", r.URL)
		}
		forward := r.Clone(r.Context())
		forward.URL.Scheme, forward.URL.Host = destination.Scheme, destination.Host
		forward.Host = destination.Host
		return original.RoundTrip(forward)
	})
	executor := NewToolExecutor(tools.GetRegistry(), nil)
	result, err := executor.Execute(context.Background(), models.Block{
		Config: map[string]interface{}{"toolName": "search_web", "argumentMapping": map[string]interface{}{"query": "workflow fixture"}},
	}, nil)
	if err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"response", "result", "data", "raw"} {
		text, ok := result[key].(string)
		if !ok || !strings.Contains(text, "https://example.org/source") || !strings.Contains(text, "Useful excerpt") {
			t.Errorf("workflow %s must retain the search text contract, got %#v", key, result[key])
		}
	}
}
