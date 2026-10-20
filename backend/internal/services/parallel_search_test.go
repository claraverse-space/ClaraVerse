package services

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
	"time"

	"claraverse/internal/database"
	"claraverse/internal/models"
	"claraverse/internal/tools"

	"github.com/google/uuid"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	cache "github.com/patrickmn/go-cache"
	_ "modernc.org/sqlite"
)

type searchCallerTransport func(*http.Request) (*http.Response, error)

func (f searchCallerTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

// Exercise the real ChatService dispatcher and MCP SDK against a local MCP
// server, observing the production URL and headers before redirecting traffic.
func TestParallelSearchChatCaller(t *testing.T) {
	t.Setenv("SEARCH_PROVIDER", "parallel")
	t.Setenv("PARALLEL_API_KEY", "")
	var mu sync.Mutex
	sessions := make(map[string]string)
	methods := make(map[string]int)
	server := mcp.NewServer(&mcp.Implementation{Name: "search-caller-fixture", Version: "1"}, nil)
	server.AddTool(&mcp.Tool{Name: "web_search", InputSchema: map[string]interface{}{"type": "object"}}, func(ctx context.Context, request *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		var args struct {
			Objective string `json:"objective"`
			SessionID string `json:"session_id"`
		}
		if err := json.Unmarshal(request.Params.Arguments, &args); err != nil {
			return nil, err
		}
		if uuid.Validate(args.SessionID) != nil {
			t.Errorf("expected opaque conversation UUID, got %q", args.SessionID)
		}
		mu.Lock()
		sessions[args.Objective] = args.SessionID
		mu.Unlock()
		if args.Objective == "quota fixture" {
			return &mcp.CallToolResult{IsError: true, Content: []mcp.Content{&mcp.TextContent{Text: "quota fixture error"}}}, nil
		}
		return &mcp.CallToolResult{Content: []mcp.Content{&mcp.TextContent{Text: "Fixture title\nURL: https://example.org/research\nUseful research excerpt"}}}, nil
	})
	handler := mcp.NewStreamableHTTPHandler(func(*http.Request) *mcp.Server { return server }, &mcp.StreamableHTTPOptions{Stateless: true, JSONResponse: true})
	local := httptest.NewServer(handler)
	t.Cleanup(local.Close)
	localURL, err := url.Parse(local.URL)
	if err != nil {
		t.Fatal(err)
	}
	baseTransport := http.DefaultTransport
	t.Cleanup(func() { http.DefaultTransport = baseTransport })
	modelRequests := 0
	http.DefaultTransport = searchCallerTransport(func(r *http.Request) (*http.Response, error) {
		if r.URL.Host == "model.fixture" {
			// A scripted model requests two searches, consumes their real tool
			// results, then finishes. No model inference is performed here.
			modelRequests++
			var body struct {
				Messages []map[string]interface{} `json:"messages"`
			}
			if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
				return nil, err
			}
			if r.Header.Get("Authorization") != "Bearer fixture-model-key" {
				t.Error("configured model credential lost")
			}
			if modelRequests%3 != 1 {
				last := body.Messages[len(body.Messages)-1]
				if last["role"] != "tool" || !strings.Contains(fmt.Sprint(last["content"]), "https://example.org/research") {
					t.Errorf("model did not consume search result: %v", last)
				}
			}
			message := map[string]interface{}{"content": "Research complete"}
			finish := "stop"
			if modelRequests%3 != 0 {
				query := fmt.Sprintf("run %d search %d", (modelRequests-1)/3+1, modelRequests%3)
				arguments, _ := json.Marshal(map[string]interface{}{"query": query})
				message = map[string]interface{}{"tool_calls": []interface{}{map[string]interface{}{"id": query, "type": "function", "function": map[string]interface{}{"name": "search_web", "arguments": string(arguments)}}}}
				finish = "tool_calls"
			}
			response, err := json.Marshal(map[string]interface{}{"choices": []interface{}{map[string]interface{}{"message": message, "finish_reason": finish}}})
			if err != nil {
				return nil, err
			}
			return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": {"application/json"}}, Body: io.NopCloser(bytes.NewReader(response))}, nil
		}
		if r.URL.String() != "https://search.parallel.ai/mcp" || !strings.HasPrefix(r.UserAgent(), "ClaraVerse ") || r.Header.Get("Authorization") != "" {
			t.Errorf("unexpected destination or identity: %s, %v", r.URL, r.Header)
		}
		forward := r.Clone(r.Context())
		if r.Body != nil {
			body, err := io.ReadAll(r.Body)
			if err != nil {
				return nil, err
			}
			_ = r.Body.Close()
			forward.Body = io.NopCloser(bytes.NewReader(body))
			var request struct{ Method string }
			_ = json.Unmarshal(body, &request)
			mu.Lock()
			methods[request.Method]++
			mu.Unlock()
		}
		forward.URL.Scheme, forward.URL.Host = localURL.Scheme, localURL.Host
		forward.Host = localURL.Host
		return baseTransport.RoundTrip(forward)
	})

	svc := &ChatService{toolRegistry: tools.GetRegistry()}
	conversation := func(id string) *models.UserConnection {
		return &models.UserConnection{UserID: "private-user-id", ConversationID: id, WriteChan: make(chan models.ServerMessage, 32)}
	}
	a, b := conversation(uuid.NewString()), conversation(uuid.NewString())
	call := func(conn *models.UserConnection, query string) {
		t.Helper()
		// Internal context supplied by a model must be overwritten by the host.
		arguments, _ := json.Marshal(map[string]interface{}{"query": query, "__conversation_id__": "untrusted", "session_id": "untrusted"})
		result := svc.executeToolSyncWithResult("call-"+query, "search_web", string(arguments), conn)
		if query == "quota fixture" {
			if !strings.Contains(result, "quota fixture error") {
				t.Errorf("provider error lost: %s", result)
			}
		} else if !strings.Contains(result, "https://example.org/research") || !strings.Contains(result, "Useful research excerpt") {
			t.Errorf("search content did not reach model consumer: %q", result)
		}
		<-conn.WriteChan // tool_call
		message := <-conn.WriteChan
		if message.Type != "tool_result" || !strings.Contains(message.Result, strings.TrimPrefix(result, "Error: ")) {
			t.Errorf("search content did not reach frontend consumer: %+v", message)
		}
	}
	call(a, "first search")
	call(a, "quota fixture")
	call(a, "retry search")
	var wg sync.WaitGroup
	wg.Add(2)
	go func() { defer wg.Done(); call(a, "a concurrent") }()
	go func() { defer wg.Done(); call(b, "b concurrent") }()
	wg.Wait()
	// A new conversation on the same connection starts a different session.
	a.ConversationID = uuid.NewString()
	call(a, "new chat")

	// Use a small SQL fixture for the normal provider resolver. This does not
	// use the removed SQLite application initialization path.
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	for _, statement := range []string{
		`CREATE TABLE models (id TEXT, provider_id INTEGER, name TEXT)`,
		`INSERT INTO models VALUES ('fixture-model', 1, 'fixture-model')`,
		`CREATE TABLE providers (id INTEGER, name TEXT, base_url TEXT, api_key TEXT, enabled BOOLEAN, audio_only BOOLEAN, image_only BOOLEAN, image_edit_only BOOLEAN, secure BOOLEAN, default_model TEXT, system_prompt TEXT, favicon TEXT, created_at TIMESTAMP, updated_at TIMESTAMP)`,
		`INSERT INTO providers VALUES (1, 'fixture', 'https://model.fixture', 'fixture-model-key', 1, 0, 0, 0, 0, NULL, NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
	} {
		if _, err := db.Exec(statement); err != nil {
			t.Fatal(err)
		}
	}
	svc.providerService = NewProviderService(&database.DB{DB: db})
	availableTools := []map[string]interface{}{{"type": "function", "function": map[string]interface{}{"name": "search_web", "parameters": tools.NewSearchTool().Parameters}}}
	for range 2 {
		result, err := svc.ChatCompletionWithToolsEx(context.Background(), "private-user", "", "fixture-model", []map[string]interface{}{{"role": "user", "content": "Research current releases"}}, availableTools, 3)
		if err != nil || result.Response != "Research complete" {
			t.Fatalf("scripted agent loop failed: %+v, %v", result, err)
		}
	}
	mu.Lock()
	defer mu.Unlock()
	if sessions["first search"] != sessions["quota fixture"] || sessions["first search"] != sessions["retry search"] || sessions["first search"] != sessions["a concurrent"] {
		t.Errorf("conversation identity changed across related calls: %v", sessions)
	}
	if sessions["first search"] == sessions["b concurrent"] || sessions["first search"] == sessions["new chat"] {
		t.Errorf("independent conversations shared identity: %v", sessions)
	}
	if sessions["run 1 search 1"] != sessions["run 1 search 2"] || sessions["run 2 search 1"] != sessions["run 2 search 2"] || sessions["run 1 search 1"] == sessions["run 2 search 1"] {
		t.Errorf("standalone run identity was not isolated and reused: %v", sessions)
	}
	for _, method := range []string{"server/discover", "tools/list", "tools/call"} {
		if methods[method] != 10 {
			t.Errorf("expected ten observed %s requests, got %d", method, methods[method])
		}
	}
}

type denyParallelSearchFixture struct{}

func (denyParallelSearchFixture) Name() string { return "deny-parallel-search-fixture" }
func (denyParallelSearchFixture) PreToolUse(name string, args map[string]interface{}) tools.PreToolDecision {
	return tools.PreToolDecision{Allow: name != "search_web" || args["query"] != "denied parallel fixture", Reason: "search denied by fixture permission"}
}

func TestParallelSearchPermissionAndChannelCancellation(t *testing.T) {
	t.Setenv("SEARCH_PROVIDER", "parallel")
	tools.RegisterPreToolHook(denyParallelSearchFixture{})
	svc := &ChatService{toolRegistry: tools.GetRegistry()}
	conn := &models.UserConnection{ConversationID: uuid.NewString(), WriteChan: make(chan models.ServerMessage, 4)}
	original := http.DefaultTransport
	t.Cleanup(func() { http.DefaultTransport = original })
	http.DefaultTransport = searchCallerTransport(func(r *http.Request) (*http.Response, error) {
		t.Error("permission denied search reached network")
		return nil, fmt.Errorf("unexpected request")
	})
	result := svc.executeToolSyncWithResult("denied", "search_web", `{"query":"denied parallel fixture"}`, conn)
	if !strings.Contains(result, "search denied by fixture permission") {
		t.Fatalf("permission hook did not block search: %s", result)
	}
	http.DefaultTransport = searchCallerTransport(func(r *http.Request) (*http.Response, error) {
		<-r.Context().Done()
		return nil, r.Context().Err()
	})
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	result, _ = svc.executeToolForChannelEx(ctx, "user", uuid.NewString(), "search_web", `{"query":"channel timeout fixture"}`)
	if !strings.Contains(result, "context deadline exceeded") {
		t.Fatalf("channel caller did not propagate cancellation: %s", result)
	}
}

func TestParallelSearchDisabledTools(t *testing.T) {
	t.Setenv("SEARCH_PROVIDER", "parallel")
	original := http.DefaultTransport
	t.Cleanup(func() { http.DefaultTransport = original })
	requests := 0
	http.DefaultTransport = searchCallerTransport(func(r *http.Request) (*http.Response, error) {
		requests++
		if r.URL.String() != "https://model.fixture/chat/completions" {
			t.Errorf("disabled search reached an external tool: %s", r.URL)
		}
		var request map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			return nil, err
		}
		if _, present := request["tools"]; present {
			t.Error("disabled tools were advertised to the model")
		}
		// Stop after inspecting the actual model request; this is a request
		// construction test, not a successful model inference claim.
		return &http.Response{StatusCode: http.StatusBadRequest, Header: make(http.Header), Body: io.NopCloser(strings.NewReader("disabled-tools fixture stop"))}, nil
	})
	svc := &ChatService{toolRegistry: tools.GetRegistry(), conversationCache: cache.New(time.Minute, 0)}
	conn := &models.UserConnection{
		ConversationID: uuid.NewString(), DisableTools: true, WriteChan: make(chan models.ServerMessage, 16),
		SystemInstructions: "Fixture system prompt",
		CustomConfig:       &models.CustomAPIConfig{BaseURL: "https://model.fixture", APIKey: "fixture-model-key", Model: "fixture-model"},
	}
	svc.setConversationMessages(conn.ConversationID, []map[string]interface{}{{"role": "user", "content": "Search the web for current releases"}})
	if err := svc.StreamChatCompletion(conn); err == nil || !strings.Contains(err.Error(), "disabled-tools fixture stop") || requests != 1 {
		t.Fatalf("unexpected disabled-tools request path: %v, requests=%d", err, requests)
	}
}
