package tools

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"
)

type searchTestTransport func(*http.Request) (*http.Response, error)

func (f searchTestTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func searchTestResponse(body string) *http.Response {
	return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": {"application/json"}}, Body: io.NopCloser(strings.NewReader(body))}
}

// This fixture speaks JSON-RPC at the HTTP boundary; selection, initialization,
// tool discovery, argument construction and result consumption remain real.
func installParallelSearchFixture(t *testing.T, call func(map[string]interface{}) (string, error)) *int {
	t.Helper()
	original := http.DefaultTransport
	t.Cleanup(func() { http.DefaultTransport = original })
	calls := 0
	http.DefaultTransport = searchTestTransport(func(r *http.Request) (*http.Response, error) {
		if r.URL.String() != parallelSearchEndpoint {
			t.Errorf("unexpected destination: %s", r.URL)
		}
		if !strings.HasPrefix(r.UserAgent(), "ClaraVerse ") || r.Header.Get("Authorization") != "" {
			t.Errorf("expected anonymous ClaraVerse request, headers: %v", r.Header)
		}
		var request struct {
			ID     interface{} `json:"id"`
			Method string      `json:"method"`
			Params struct {
				ProtocolVersion string                 `json:"protocolVersion"`
				Name            string                 `json:"name"`
				Arguments       map[string]interface{} `json:"arguments"`
			} `json:"params"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			return nil, err
		}
		var result interface{}
		switch request.Method {
		case "server/discover":
			// Also cover the SDK's fallback to a legacy MCP handshake.
			return searchTestResponse(fmt.Sprintf(`{"jsonrpc":"2.0","id":%v,"error":{"code":-32601,"message":"method not found"}}`, request.ID)), nil
		case "initialize":
			result = map[string]interface{}{"protocolVersion": request.Params.ProtocolVersion, "capabilities": map[string]interface{}{"tools": map[string]interface{}{}}, "serverInfo": map[string]interface{}{"name": "search-fixture", "version": "1"}}
		case "notifications/initialized", "notifications/cancelled":
			response := searchTestResponse("")
			response.StatusCode = http.StatusAccepted
			return response, nil
		case "tools/list":
			result = map[string]interface{}{"tools": []interface{}{map[string]interface{}{"name": "web_search", "inputSchema": map[string]interface{}{"type": "object"}}}}
		case "tools/call":
			calls++
			if request.Params.Name != "web_search" {
				t.Errorf("unexpected tool: %s", request.Params.Name)
			}
			text, err := call(request.Params.Arguments)
			if err != nil {
				return nil, err
			}
			return searchTestResponse(fmt.Sprintf(`{"jsonrpc":"2.0","id":%v,"result":%s}`, request.ID, text)), nil
		default:
			return nil, fmt.Errorf("unexpected MCP method: %s", request.Method)
		}
		body, err := json.Marshal(map[string]interface{}{"jsonrpc": "2.0", "id": request.ID, "result": result})
		if err != nil {
			return nil, err
		}
		return searchTestResponse(string(body)), nil
	})
	return &calls
}

func TestSearchProviderParallel(t *testing.T) {
	t.Setenv("SEARCH_PROVIDER", "parallel")
	t.Setenv("PARALLEL_API_KEY", "")
	calls := installParallelSearchFixture(t, func(args map[string]interface{}) (string, error) {
		if args["objective"] != "Go release notes" || args["search_queries"].([]interface{})[0] != "Go release notes" {
			t.Errorf("incorrect search arguments: %v", args)
		}
		if sessionID, _ := args["session_id"].(string); len(sessionID) != 36 {
			t.Errorf("missing opaque session UUID: %v", args)
		}
		return `{"content":[{"type":"text","text":"Go releases: https://go.dev/doc/devel/release\nRelease notes excerpt"}]}`, nil
	})
	result, err := GetRegistry().Execute("search_web", map[string]interface{}{"query": " Go release notes ", "__conversation_id__": "conversation-one"})
	if err != nil || !strings.Contains(result, "https://go.dev/doc/devel/release") || !strings.Contains(result, "Release notes excerpt") || *calls != 1 {
		t.Fatalf("unexpected search result: %q, err=%v, calls=%d", result, err, *calls)
	}
}

func TestSearchProviderPreservesSearXNG(t *testing.T) {
	originalTransport, originalBalancer, originalCache := http.DefaultTransport, searchBalancer, globalSearchCache
	t.Cleanup(func() {
		http.DefaultTransport, searchBalancer, globalSearchCache = originalTransport, originalBalancer, originalCache
	})
	searchBalancer = &SearchBalancer{urls: []string{"https://configured-searxng.test"}}
	globalSearchCache = &searchCache{cache: make(map[string]*cacheEntry), maxSize: 100}
	requests := 0
	http.DefaultTransport = searchTestTransport(func(r *http.Request) (*http.Response, error) {
		requests++
		if r.URL.Host != "configured-searxng.test" || r.URL.Query().Get("q") != "searxng fixture" {
			t.Errorf("configured SearXNG URL lost: %s", r.URL)
		}
		return searchTestResponse(`{"results":[{"title":"Self hosted","url":"https://example.org/source","content":"Search excerpt"}]}`), nil
	})
	for _, provider := range []string{"", "searxng"} {
		t.Setenv("SEARCH_PROVIDER", provider)
		result, err := GetRegistry().Execute("search_web", map[string]interface{}{"query": "searxng fixture"})
		if err != nil || !strings.Contains(result, "SOURCES FOR CITATION") || !strings.Contains(result, "https://example.org/source") {
			t.Fatalf("default/explicit SearXNG failed: %q, %v", result, err)
		}
	}
	if requests != 1 {
		t.Errorf("existing SearXNG cache was not preserved: %d requests", requests)
	}
}

func TestSearchProviderErrors(t *testing.T) {
	for _, tc := range []struct{ name, response, want string }{
		{"tool error", `{"isError":true,"content":[{"type":"text","text":"quota exceeded"}]}`, "quota exceeded"},
		{"empty", `{"content":[]}`, "no text content"},
		{"malformed", `{broken`, "parallel web search"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("SEARCH_PROVIDER", "parallel")
			calls := installParallelSearchFixture(t, func(map[string]interface{}) (string, error) { return tc.response, nil })
			result, err := GetRegistry().Execute("search_web", map[string]interface{}{"query": "parallel error fixture"})
			if result != "" || err == nil || !strings.Contains(err.Error(), tc.want) || *calls != 1 {
				t.Fatalf("expected visible provider error without fallback, got %q, %v (calls=%d)", result, err, *calls)
			}
		})
	}
	t.Run("configuration and input", func(t *testing.T) {
		t.Setenv("SEARCH_PROVIDER", "invalid")
		calls := installParallelSearchFixture(t, func(map[string]interface{}) (string, error) { t.Error("unexpected call"); return "", nil })
		for _, args := range []map[string]interface{}{{"query": "test"}, {"query": " "}, {"query": 12}, {}} {
			if _, err := GetRegistry().Execute("search_web", args); err == nil {
				t.Errorf("expected validation error: %v", args)
			}
		}
		if *calls != 0 {
			t.Fatal("validation dispatched a network call")
		}
	})
}

func TestSearchProviderCancellation(t *testing.T) {
	t.Setenv("SEARCH_PROVIDER", "parallel")
	original := http.DefaultTransport
	t.Cleanup(func() { http.DefaultTransport = original })
	http.DefaultTransport = searchTestTransport(func(r *http.Request) (*http.Response, error) {
		<-r.Context().Done()
		return nil, r.Context().Err()
	})
	for _, timeout := range []bool{false, true} {
		var ctx context.Context
		var cancel context.CancelFunc
		if timeout {
			ctx, cancel = context.WithTimeout(context.Background(), 20*time.Millisecond)
		} else {
			ctx, cancel = context.WithCancel(context.Background())
			cancel()
		}
		_, err := GetRegistry().ExecuteContext(ctx, "search_web", map[string]interface{}{"query": "cancel fixture"})
		cancel()
		want := context.Canceled
		if timeout {
			want = context.DeadlineExceeded
		}
		if !errors.Is(err, want) {
			t.Fatalf("context did not reach HTTP request: %v", err)
		}
	}
}

// Opt in explicitly so normal test runs never depend on a hosted service.
func TestParallelSearchLive(t *testing.T) {
	if os.Getenv("CLARAVERSE_PARALLEL_LIVE_TEST") != "1" {
		t.Skip("set CLARAVERSE_PARALLEL_LIVE_TEST=1 for anonymous hosted search")
	}
	t.Setenv("SEARCH_PROVIDER", "parallel")
	t.Setenv("PARALLEL_API_KEY", "")
	original := http.DefaultTransport
	t.Cleanup(func() { http.DefaultTransport = original })
	http.DefaultTransport = searchTestTransport(func(r *http.Request) (*http.Response, error) {
		if r.URL.String() != parallelSearchEndpoint || !strings.HasPrefix(r.UserAgent(), "ClaraVerse ") || r.Header.Get("Authorization") != "" {
			t.Errorf("unexpected live request: %s, User-Agent=%s", r.URL, r.UserAgent())
		}
		t.Logf("%s %s User-Agent=%s", r.Method, r.URL, r.UserAgent())
		response, err := original.RoundTrip(r)
		if response != nil {
			t.Logf("UTC=%s status=%d Retry-After=%q Date=%q", time.Now().UTC().Format(time.RFC3339), response.StatusCode, response.Header.Get("Retry-After"), response.Header.Get("Date"))
		}
		return response, err
	})
	result, err := GetRegistry().Execute("search_web", map[string]interface{}{"query": "Go programming language release notes"})
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("Live search output: %s", result)
	if !strings.Contains(result, "https://") {
		t.Fatal("search did not produce usable source URLs")
	}
}
