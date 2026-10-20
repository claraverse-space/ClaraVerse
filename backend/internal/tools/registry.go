package tools

import (
	"context"
	"fmt"
	"sync"
)

// ToolSource represents where a tool comes from
type ToolSource string

const (
	ToolSourceBuiltin  ToolSource = "builtin"
	ToolSourceMCPLocal ToolSource = "mcp_local"
	ToolSourceComposio ToolSource = "composio"
)

// Tool represents a callable tool with its metadata and execution function
type Tool struct {
	Name           string
	DisplayName    string // User-friendly name (e.g., "Search Web", "Calculate Math")
	Description    string
	Parameters     map[string]interface{}
	Icon           string // Lucide React icon name (e.g., "Calculator", "Search", "Clock")
	Execute        ExecuteFunc
	ExecuteContext ContextExecuteFunc // Optional cancellation-aware implementation
	Source         ToolSource         // "builtin" or "mcp_local"
	UserID         string             // For user-specific MCP tools (empty for built-in)
	Category       string             // Tool category: data_sources, computation, time, output, integration
	Keywords       []string           // Keywords for smart recommendations
}

// ExecuteFunc is the function signature for tool execution
type ExecuteFunc func(args map[string]interface{}) (string, error)

// ContextExecuteFunc supports cancellation for tools that perform network I/O.
type ContextExecuteFunc func(context.Context, map[string]interface{}) (string, error)

// Registry manages all available tools
type Registry struct {
	tools     map[string]*Tool            // Built-in tools (global)
	userTools map[string]map[string]*Tool // User-specific tools: userID -> toolName -> Tool
	mutex     sync.RWMutex
}

var (
	globalRegistry *Registry
	once           sync.Once
)

// GetRegistry returns the global tool registry (singleton)
func GetRegistry() *Registry {
	once.Do(func() {
		globalRegistry = &Registry{
			tools:     make(map[string]*Tool),
			userTools: make(map[string]map[string]*Tool),
		}
		// Register built-in tools
		registerBuiltInTools(globalRegistry)
	})
	return globalRegistry
}

// Register adds a new tool to the registry
func (r *Registry) Register(tool *Tool) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	if tool.Name == "" {
		return fmt.Errorf("tool name cannot be empty")
	}

	if tool.Execute == nil {
		return fmt.Errorf("tool %s must have an Execute function", tool.Name)
	}

	if _, exists := r.tools[tool.Name]; exists {
		return fmt.Errorf("tool %s is already registered", tool.Name)
	}

	r.tools[tool.Name] = tool
	return nil
}

// Get retrieves a tool by name
func (r *Registry) Get(name string) (*Tool, bool) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()
	tool, exists := r.tools[name]
	return tool, exists
}

// List returns all registered tools in OpenAI tool format
func (r *Registry) List() []map[string]interface{} {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	tools := make([]map[string]interface{}, 0, len(r.tools))
	for _, tool := range r.tools {
		tools = append(tools, map[string]interface{}{
			"type": "function",
			"function": map[string]interface{}{
				"name":        tool.Name,
				"description": tool.Description,
				"parameters":  tool.Parameters,
			},
		})
	}
	return tools
}

// Execute runs a tool by name with given arguments
func (r *Registry) Execute(name string, args map[string]interface{}) (string, error) {
	return r.ExecuteContext(context.Background(), name, args)
}

// ExecuteContext runs a tool with cancellation when the implementation supports it.
func (r *Registry) ExecuteContext(ctx context.Context, name string, args map[string]interface{}) (string, error) {
	tool, exists := r.Get(name)
	if !exists {
		return "", fmt.Errorf("tool %s not found", name)
	}
	if tool.ExecuteContext != nil {
		return tool.ExecuteContext(ctx, args)
	}
	return tool.Execute(args)
}

// Count returns the number of registered tools
func (r *Registry) Count() int {
	r.mutex.RLock()
	defer r.mutex.RUnlock()
	return len(r.tools)
}

// ToolInfo is a JSON-serializable representation of a Tool (without the Execute function)
type ToolInfo struct {
	Name        string                 `json:"name"`
	DisplayName string                 `json:"displayName"`
	Description string                 `json:"description"`
	Icon        string                 `json:"icon"`
	Category    string                 `json:"category"`
	Parameters  map[string]interface{} `json:"parameters"`
	Keywords    []string               `json:"keywords"`
	Source      ToolSource             `json:"source"`
}

// ListDetailed returns all built-in tools with full metadata (for the block palette API)
func (r *Registry) ListDetailed() []ToolInfo {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	result := make([]ToolInfo, 0, len(r.tools))
	for _, tool := range r.tools {
		result = append(result, ToolInfo{
			Name:        tool.Name,
			DisplayName: tool.DisplayName,
			Description: tool.Description,
			Icon:        tool.Icon,
			Category:    tool.Category,
			Parameters:  tool.Parameters,
			Keywords:    tool.Keywords,
			Source:      tool.Source,
		})
	}
	return result
}

// GetToolsByCategory returns all tools in a specific category
func (r *Registry) GetToolsByCategory(category string) []*Tool {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	var categoryTools []*Tool
	for _, tool := range r.tools {
		if tool.Category == category {
			categoryTools = append(categoryTools, tool)
		}
	}
	return categoryTools
}

// GetCategories returns a map of category names to their tool counts
func (r *Registry) GetCategories() map[string]int {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	categories := make(map[string]int)
	for _, tool := range r.tools {
		if tool.Category != "" {
			categories[tool.Category]++
		}
	}
	return categories
}

// registerBuiltInTools registers the default tools
func registerBuiltInTools(r *Registry) {
	// Register time tool
	_ = r.Register(NewTimeTool())

	// Register search tool
	_ = r.Register(NewSearchTool())

	// Register image search tool
	_ = r.Register(NewImageSearchTool())

	// Register math tool
	_ = r.Register(NewMathTool())

	// Register scraper tool
	_ = r.Register(NewScraperTool())

	// Register document tool
	_ = r.Register(NewDocumentTool())

	// Register text file tool
	_ = r.Register(NewTextFileTool())

	// Register E2B-powered tools
	_ = r.Register(NewDataAnalystTool())
	_ = r.Register(NewMLTrainerTool())
	_ = r.Register(NewAPITesterTool())
	_ = r.Register(NewPythonRunnerTool())
	_ = r.Register(NewHTMLToPDFTool())

	// Register integration tools (webhook, discord, slack, telegram, google chat, sendgrid, brevo, zoom, twilio, referralmonk)
	_ = r.Register(NewWebhookTool())
	_ = r.Register(NewDiscordTool())
	_ = r.Register(NewSlackTool())
	_ = r.Register(NewTelegramTool())
	_ = r.Register(NewGoogleChatTool())
	_ = r.Register(NewSendGridTool())
	_ = r.Register(NewBrevoTool())
	_ = r.Register(NewZoomTool())
	_ = r.Register(NewTwilioSMSTool())
	_ = r.Register(NewTwilioWhatsAppTool())
	_ = r.Register(NewReferralMonkWhatsAppTool())

	// Register Unipile tools (WhatsApp + LinkedIn messaging)
	_ = r.Register(NewUnipileListAccountsTool())
	_ = r.Register(NewUnipileListAttendeesTool())
	_ = r.Register(NewUnipileWhatsAppSendMessageTool())
	_ = r.Register(NewUnipileWhatsAppSendToPhoneTool())
	_ = r.Register(NewUnipileWhatsAppListChatsTool())
	_ = r.Register(NewUnipileWhatsAppGetMessagesTool())
	_ = r.Register(NewUnipileLinkedInSendMessageTool())
	_ = r.Register(NewUnipileLinkedInListChatsTool())
	_ = r.Register(NewUnipileLinkedInGetMessagesTool())
	_ = r.Register(NewUnipileLinkedInSearchProfilesTool())

	// Register productivity tools (ClickUp, Calendly)
	_ = r.Register(NewClickUpTasksTool())
	_ = r.Register(NewClickUpCreateTaskTool())
	_ = r.Register(NewClickUpUpdateTaskTool())
	_ = r.Register(NewCalendlyEventsTool())
	_ = r.Register(NewCalendlyEventTypesTool())
	_ = r.Register(NewCalendlyInviteesTool())

	// Register CRM tools (LeadSquared)
	_ = r.Register(NewLeadSquaredLeadsTool())
	_ = r.Register(NewLeadSquaredCreateLeadTool())
	_ = r.Register(NewLeadSquaredActivitiesTool())

	// Register analytics tools (Mixpanel, PostHog)
	_ = r.Register(NewMixpanelTrackTool())
	_ = r.Register(NewMixpanelUserProfileTool())
	_ = r.Register(NewPostHogCaptureTool())
	_ = r.Register(NewPostHogIdentifyTool())
	_ = r.Register(NewPostHogQueryTool())

	// Register e-commerce tools (Shopify)
	_ = r.Register(NewShopifyProductsTool())
	_ = r.Register(NewShopifyOrdersTool())
	_ = r.Register(NewShopifyCustomersTool())

	// Register deployment tools (Netlify)
	_ = r.Register(NewNetlifySitesTool())
	_ = r.Register(NewNetlifyDeploysTool())
	_ = r.Register(NewNetlifyTriggerBuildTool())

	// Register Notion tools
	_ = r.Register(NewNotionSearchTool())
	_ = r.Register(NewNotionQueryDatabaseTool())
	_ = r.Register(NewNotionCreatePageTool())
	_ = r.Register(NewNotionUpdatePageTool())

	// Register GitHub tools
	_ = r.Register(NewGitHubCreateIssueTool())
	_ = r.Register(NewGitHubListIssuesTool())
	_ = r.Register(NewGitHubGetRepoTool())
	_ = r.Register(NewGitHubAddCommentTool())

	// Register Microsoft Teams tools
	_ = r.Register(NewTeamsTool())

	// Register GitLab tools
	_ = r.Register(NewGitLabProjectsTool())
	_ = r.Register(NewGitLabIssuesTool())
	_ = r.Register(NewGitLabMRsTool())

	// Register Linear tools
	_ = r.Register(NewLinearIssuesTool())
	_ = r.Register(NewLinearCreateIssueTool())
	_ = r.Register(NewLinearUpdateIssueTool())

	// Register Jira tools
	_ = r.Register(NewJiraIssuesTool())
	_ = r.Register(NewJiraCreateIssueTool())
	_ = r.Register(NewJiraUpdateIssueTool())

	// Register Airtable tools
	_ = r.Register(NewAirtableListTool())
	_ = r.Register(NewAirtableReadTool())
	_ = r.Register(NewAirtableCreateTool())
	_ = r.Register(NewAirtableUpdateTool())

	// Register Trello tools
	_ = r.Register(NewTrelloBoardsTool())
	_ = r.Register(NewTrelloListsTool())
	_ = r.Register(NewTrelloCardsTool())
	_ = r.Register(NewTrelloCreateCardTool())

	// Register HubSpot tools
	_ = r.Register(NewHubSpotContactsTool())
	_ = r.Register(NewHubSpotDealsTool())
	_ = r.Register(NewHubSpotCompaniesTool())

	// Register Mailchimp tools
	_ = r.Register(NewMailchimpListsTool())
	_ = r.Register(NewMailchimpAddSubscriberTool())

	// Register AWS S3 tools
	_ = r.Register(NewS3ListTool())
	_ = r.Register(NewS3UploadTool())
	_ = r.Register(NewS3DownloadTool())
	_ = r.Register(NewS3DeleteTool())

	// Register REST API tool
	_ = r.Register(NewRESTAPITool())

	// Register X (Twitter) tools
	_ = r.Register(NewXSearchPostsTool())
	_ = r.Register(NewXPostTweetTool())
	_ = r.Register(NewXGetUserTool())
	_ = r.Register(NewXGetUserPostsTool())

	// Register presentation tool
	_ = r.Register(NewPresentationTool())

	// Register file reading tools
	_ = r.Register(NewReadDocumentTool())
	_ = r.Register(NewReadDataFileTool())
	_ = r.Register(NewReadSpreadsheetTool())

	// Register image description tool
	_ = r.Register(NewDescribeImageTool())

	// Register file download tool
	_ = r.Register(NewDownloadFileTool())

	// Register audio transcription tool
	_ = r.Register(NewTranscribeAudioTool())

	// Register image generation tool
	_ = r.Register(NewImageGenerationTool())

	// Register image edit tool
	_ = r.Register(NewImageEditTool())

	// Register MongoDB tools
	_ = r.Register(NewMongoDBQueryTool())
	_ = r.Register(NewMongoDBWriteTool())

	// Register Redis tools
	_ = r.Register(NewRedisReadTool())
	_ = r.Register(NewRedisWriteTool())

	// Register Composio Google Sheets tools
	_ = r.Register(NewComposioGoogleSheetsReadTool())
	_ = r.Register(NewComposioGoogleSheetsWriteTool())
	_ = r.Register(NewComposioGoogleSheetsAppendTool())
	_ = r.Register(NewComposioGoogleSheetsCreateTool())
	_ = r.Register(NewComposioGoogleSheetsInfoTool())
	_ = r.Register(NewComposioGoogleSheetsListSheetsTool())
	_ = r.Register(NewComposioGoogleSheetsSearchTool())
	_ = r.Register(NewComposioGoogleSheetsClearTool())
	_ = r.Register(NewComposioGoogleSheetsAddSheetTool())
	_ = r.Register(NewComposioGoogleSheetsDeleteSheetTool())
	_ = r.Register(NewComposioGoogleSheetsFindReplaceTool())
	_ = r.Register(NewComposioGoogleSheetsUpsertRowsTool())

	// Register Composio Gmail tools
	_ = r.Register(NewComposioGmailSendTool())
	_ = r.Register(NewComposioGmailFetchTool())
	_ = r.Register(NewComposioGmailGetMessageTool())
	_ = r.Register(NewComposioGmailReplyTool())
	_ = r.Register(NewComposioGmailCreateDraftTool())
	_ = r.Register(NewComposioGmailSendDraftTool())
	_ = r.Register(NewComposioGmailListDraftsTool())
	_ = r.Register(NewComposioGmailAddLabelTool())
	_ = r.Register(NewComposioGmailListLabelsTool())
	_ = r.Register(NewComposioGmailTrashTool())

	// Register Composio LinkedIn tools
	_ = r.Register(NewComposioLinkedInCreateCommentTool())
	_ = r.Register(NewComposioLinkedInCreatePostTool())
	_ = r.Register(NewComposioLinkedInDeletePostTool())
	_ = r.Register(NewComposioLinkedInDeleteUGCPostTool())
	_ = r.Register(NewComposioLinkedInDeleteUGCPostsTool())
	_ = r.Register(NewComposioLinkedInGetCompanyInfoTool())
	_ = r.Register(NewComposioLinkedInGetImagesTool())
	_ = r.Register(NewComposioLinkedInGetMyInfoTool())
	_ = r.Register(NewComposioLinkedInGetVideoTool())
	_ = r.Register(NewComposioLinkedInGetVideosTool())
	_ = r.Register(NewComposioLinkedInRegisterImageUploadTool())

	// Register Composio Google Calendar tools
	_ = r.Register(NewGoogleCalendarCreateEventTool())
	_ = r.Register(NewGoogleCalendarListEventsTool())
	_ = r.Register(NewGoogleCalendarFindFreeSlotsTool())
	_ = r.Register(NewGoogleCalendarQuickAddEventTool())
	_ = r.Register(NewGoogleCalendarDeleteEventTool())
	_ = r.Register(NewGoogleCalendarGetEventTool())
	_ = r.Register(NewGoogleCalendarUpdateEventTool())
	_ = r.Register(NewGoogleCalendarListCalendarsTool())

	// Register Composio Google Drive tools
	_ = r.Register(NewGoogleDriveListFilesTool())
	_ = r.Register(NewGoogleDriveGetFileTool())
	_ = r.Register(NewGoogleDriveCreateFolderTool())
	_ = r.Register(NewGoogleDriveSearchFilesTool())
	_ = r.Register(NewGoogleDriveDeleteFileTool())
	_ = r.Register(NewGoogleDriveCopyFileTool())
	_ = r.Register(NewGoogleDriveMoveFileTool())
	_ = r.Register(NewGoogleDriveDownloadFileTool())

	// Register Composio Canva tools
	_ = r.Register(NewCanvaListDesignsTool())
	_ = r.Register(NewCanvaGetDesignTool())
	_ = r.Register(NewCanvaCreateDesignTool())
	_ = r.Register(NewCanvaExportDesignTool())
	_ = r.Register(NewCanvaListBrandTemplatesTool())
	_ = r.Register(NewCanvaUploadAssetTool())

	// Register Composio Twitter tools
	_ = r.Register(NewTwitterPostTweetTool())
	_ = r.Register(NewTwitterGetTimelineTool())
	_ = r.Register(NewTwitterSearchTweetsTool())
	_ = r.Register(NewTwitterGetUserTool())
	_ = r.Register(NewTwitterGetMeTool())
	_ = r.Register(NewTwitterLikeTweetTool())
	_ = r.Register(NewTwitterRetweetTool())
	_ = r.Register(NewTwitterDeleteTweetTool())

	// Register Composio YouTube tools
	_ = r.Register(NewYouTubeSearchVideosTool())
	_ = r.Register(NewYouTubeGetVideoTool())
	_ = r.Register(NewYouTubeGetChannelTool())
	_ = r.Register(NewYouTubeGetMyChannelTool())
	_ = r.Register(NewYouTubeListPlaylistsTool())
	_ = r.Register(NewYouTubeGetPlaylistItemsTool())
	_ = r.Register(NewYouTubeGetCommentsTool())
	_ = r.Register(NewYouTubeSubscribeTool())

	// Register Composio Zoom tools
	_ = r.Register(NewZoomCreateMeetingTool())
	_ = r.Register(NewZoomListMeetingsTool())
	_ = r.Register(NewZoomGetMeetingTool())
	_ = r.Register(NewZoomUpdateMeetingTool())
	_ = r.Register(NewZoomDeleteMeetingTool())
	_ = r.Register(NewZoomGetUserTool())
	_ = r.Register(NewZoomAddMeetingRegistrantTool())

	// Register interactive prompt tool
	_ = r.Register(NewAskUserTool())

	// Register subagent dispatch tool (2026 fan-out pattern). The concrete
	// SubagentRunner is injected at execution time by chat_service.
	_ = r.Register(NewSpawnSubagentTool())

	// Model-callable memory tools (Anthropic memory-tool pattern). The
	// MemoryAccess implementation is injected at execution time.
	_ = r.Register(NewAddMemoryTool())
	_ = r.Register(NewSearchMemoryTool())

	// Register 0G blockchain tools
	_ = r.Register(NewZeroGTokenTransfersTool())
	_ = r.Register(NewZeroGContractABITool())
	_ = r.Register(NewZeroGNativeTransactionsTool())
	_ = r.Register(NewZeroGNetworkStatsTool())
	_ = r.Register(NewZeroGBalanceTool())
	_ = r.Register(NewZeroGTokenBalanceTool())
	_ = r.Register(NewZeroGContractInfoTool())
	_ = r.Register(NewZeroGTxStatusTool())
	_ = r.Register(NewZeroGTokenSupplyTool())
	_ = r.Register(NewZeroGNFTDataTool())
	_ = r.Register(NewZeroGDecodeMethodTool())
	_ = r.Register(NewZeroGBlockByTimeTool())
}

// RegisterUserTool adds a user-specific MCP tool
func (r *Registry) RegisterUserTool(userID string, tool *Tool) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	if tool.Name == "" {
		return fmt.Errorf("tool name cannot be empty")
	}

	if userID == "" {
		return fmt.Errorf("user ID cannot be empty for user-specific tools")
	}

	// Initialize user's tool map if it doesn't exist
	if r.userTools[userID] == nil {
		r.userTools[userID] = make(map[string]*Tool)
	}

	// Set tool metadata
	tool.UserID = userID
	tool.Source = ToolSourceMCPLocal

	r.userTools[userID][tool.Name] = tool
	return nil
}

// UnregisterUserTool removes a specific tool for a user
func (r *Registry) UnregisterUserTool(userID string, toolName string) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	if r.userTools[userID] == nil {
		return fmt.Errorf("no tools registered for user %s", userID)
	}

	delete(r.userTools[userID], toolName)

	// Clean up user's map if empty
	if len(r.userTools[userID]) == 0 {
		delete(r.userTools, userID)
	}

	return nil
}

// UnregisterAllUserTools removes all tools for a user (on disconnect)
func (r *Registry) UnregisterAllUserTools(userID string) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	delete(r.userTools, userID)
}

// GetUserTools returns all tools available to a specific user (built-in + user's MCP tools)
func (r *Registry) GetUserTools(userID string) []map[string]interface{} {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	tools := make([]map[string]interface{}, 0)

	// Add built-in tools
	for _, tool := range r.tools {
		tools = append(tools, map[string]interface{}{
			"type": "function",
			"function": map[string]interface{}{
				"name":        tool.Name,
				"description": tool.Description,
				"parameters":  tool.Parameters,
			},
		})
	}

	// Add user's MCP tools
	if r.userTools[userID] != nil {
		for _, tool := range r.userTools[userID] {
			tools = append(tools, map[string]interface{}{
				"type": "function",
				"function": map[string]interface{}{
					"name":        tool.Name,
					"description": tool.Description,
					"parameters":  tool.Parameters,
				},
			})
		}
	}

	return tools
}

// GetMCPTools returns ONLY the user's MCP tools (not built-in).
// These are the tools registered by the user's desktop MCP client (Dobby's Claw).
//
// IMPORTANT: filters by Source explicitly. Per-user built-in tools
// (e.g. search_knowledge, which is registered into userTools so it
// can carry user/project context as a closure) live in the same map
// but are NOT MCP. Without this filter the daemon dispatcher would
// route them through the MCP bridge and fail with "client not
// connected" when no Dobby's Claw is running.
func (r *Registry) GetMCPTools(userID string) []map[string]interface{} {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	var mcpTools []map[string]interface{}
	if r.userTools[userID] != nil {
		for _, tool := range r.userTools[userID] {
			if tool.Source != ToolSourceMCPLocal {
				continue
			}
			mcpTools = append(mcpTools, map[string]interface{}{
				"type": "function",
				"function": map[string]interface{}{
					"name":        tool.Name,
					"description": tool.Description,
					"parameters":  tool.Parameters,
				},
			})
		}
	}
	return mcpTools
}

// GetUserTool retrieves a tool by name for a specific user (checks both built-in and user tools)
func (r *Registry) GetUserTool(userID string, toolName string) (*Tool, bool) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	// Check built-in tools first
	if tool, exists := r.tools[toolName]; exists {
		return tool, true
	}

	// Check user's MCP tools
	if r.userTools[userID] != nil {
		if tool, exists := r.userTools[userID][toolName]; exists {
			return tool, true
		}
	}

	return nil, false
}

// CountUserTools returns the count of tools available to a user
func (r *Registry) CountUserTools(userID string) int {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	count := len(r.tools) // Built-in tools

	if r.userTools[userID] != nil {
		count += len(r.userTools[userID])
	}

	return count
}
