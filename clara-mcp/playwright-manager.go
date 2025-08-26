package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/playwright-community/playwright-go"
)

// PlaywrightManager handles browser automation with progressive enhancement and auto-download
type PlaywrightManager struct {
	pw            *playwright.Playwright
	browser       playwright.Browser
	isAvailable   bool
	isDownloading bool
	downloadError error
	mu            sync.RWMutex
	userDataDir   string
	hasPlaywright bool // Track if Playwright library is available
}

// PlaywrightConfig holds configuration for Playwright
type PlaywrightConfig struct {
	Headless       bool
	Timeout        time.Duration
	UserAgent      string
	ViewportWidth  int
	ViewportHeight int
}

// NewPlaywrightManager creates a new Playwright manager with progressive enhancement
func NewPlaywrightManager() *PlaywrightManager {
	pm := &PlaywrightManager{
		isAvailable:   false,
		isDownloading: false,
		hasPlaywright: true, // Now we have the library available
		userDataDir:   getDefaultUserDataDir(),
	}

	// Start auto-download in background during initialization
	go pm.StartDownload()

	return pm
}

// getDefaultUserDataDir returns a platform-specific directory for browser data
func getDefaultUserDataDir() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "./playwright-data"
	}

	switch runtime.GOOS {
	case "windows":
		return filepath.Join(homeDir, "AppData", "Local", "ClaraVerse", "playwright")
	case "darwin":
		return filepath.Join(homeDir, "Library", "Application Support", "ClaraVerse", "playwright")
	default:
		return filepath.Join(homeDir, ".local", "share", "ClaraVerse", "playwright")
	}
}

// IsAvailable returns whether Playwright is available for use
func (pm *PlaywrightManager) IsAvailable() bool {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.isAvailable && pm.hasPlaywright
}

// IsDownloading returns whether Playwright browsers are currently being downloaded
func (pm *PlaywrightManager) IsDownloading() bool {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.isDownloading
}

// GetDownloadError returns any error from the last download attempt
func (pm *PlaywrightManager) GetDownloadError() error {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.downloadError
}

// EnsureAvailable attempts to make Playwright available - forces download if needed
func (pm *PlaywrightManager) EnsureAvailable() error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if pm.isAvailable && pm.hasPlaywright {
		return nil
	}

	if !pm.hasPlaywright {
		pm.downloadError = fmt.Errorf("playwright library not available - using fallback mode")
		return pm.downloadError
	}

	// Force download start if not already downloading
	if !pm.isDownloading {
		pm.mu.Unlock() // Unlock before calling StartDownload
		go pm.StartDownload()
		pm.mu.Lock() // Re-lock for defer
		log.Printf("EnsureAvailable: Triggered Playwright download")
	}

	return pm.downloadError
}

// StartDownload begins downloading Playwright browsers in the background
func (pm *PlaywrightManager) StartDownload() {
	pm.mu.Lock()
	if pm.isDownloading || pm.isAvailable {
		pm.mu.Unlock()
		return
	}

	if !pm.hasPlaywright {
		pm.downloadError = fmt.Errorf("playwright library not available")
		pm.mu.Unlock()
		return
	}

	pm.isDownloading = true
	pm.downloadError = nil
	pm.mu.Unlock()

	defer func() {
		pm.mu.Lock()
		pm.isDownloading = false
		pm.mu.Unlock()
	}()

	log.Println("PlaywrightManager: Starting browser download...")

	// Create user data directory
	if err := os.MkdirAll(pm.userDataDir, 0755); err != nil {
		pm.mu.Lock()
		pm.downloadError = fmt.Errorf("failed to create user data directory: %v", err)
		pm.mu.Unlock()
		log.Printf("PlaywrightManager: Failed to create data dir: %v", err)
		return
	}

	// Install Playwright browsers (this will skip if already installed)
	err := playwright.Install(&playwright.RunOptions{
		Browsers: []string{"chromium"}, // Only install Chromium to save space
		Verbose:  false,                // Reduce verbosity
	})

	if err != nil {
		pm.mu.Lock()
		pm.downloadError = fmt.Errorf("failed to install browsers: %v", err)
		pm.mu.Unlock()
		log.Printf("PlaywrightManager: Browser installation failed: %v", err)
		return
	}

	// Initialize Playwright
	pw, err := playwright.Run()
	if err != nil {
		pm.mu.Lock()
		pm.downloadError = fmt.Errorf("failed to start playwright: %v", err)
		pm.mu.Unlock()
		log.Printf("PlaywrightManager: Failed to start Playwright: %v", err)
		return
	}

	pm.mu.Lock()
	pm.pw = pw
	pm.isAvailable = true
	pm.downloadError = nil
	pm.mu.Unlock()

	log.Println("PlaywrightManager: Browser download and initialization completed successfully!")
}

// FetchContent attempts to fetch web content using Playwright
func (pm *PlaywrightManager) FetchContent(targetURL string, config interface{}) (*WebContent, error) {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	if !pm.isAvailable || !pm.hasPlaywright || pm.pw == nil {
		return nil, fmt.Errorf("playwright not available")
	}

	// Use default config if none provided
	playwrightConfig := PlaywrightConfig{
		Headless:       true,
		Timeout:        30 * time.Second,
		UserAgent:      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
		ViewportWidth:  1920,
		ViewportHeight: 1080,
	}

	// Override with provided config if available
	if config != nil {
		if cfg, ok := config.(PlaywrightConfig); ok {
			playwrightConfig = cfg
		}
	}

	// Launch browser if not already done
	if pm.browser == nil {
		browser, err := pm.pw.Chromium.Launch(playwright.BrowserTypeLaunchOptions{
			Headless: playwright.Bool(playwrightConfig.Headless),
		})
		if err != nil {
			return nil, fmt.Errorf("failed to launch browser: %v", err)
		}
		pm.browser = browser
	}

	// Create new context for this request
	context, err := pm.browser.NewContext(playwright.BrowserNewContextOptions{
		UserAgent: playwright.String(playwrightConfig.UserAgent),
		Viewport: &playwright.Size{
			Width:  playwrightConfig.ViewportWidth,
			Height: playwrightConfig.ViewportHeight,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create context: %v", err)
	}
	defer context.Close()

	// Create new page
	page, err := context.NewPage()
	if err != nil {
		return nil, fmt.Errorf("failed to create page: %v", err)
	}

	// Navigate to the URL and wait for network to be idle
	startTime := time.Now()
	response, err := page.Goto(targetURL, playwright.PageGotoOptions{
		WaitUntil: playwright.WaitUntilStateNetworkidle,
		Timeout:   playwright.Float(float64(playwrightConfig.Timeout.Milliseconds())),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to navigate: %v", err)
	}

	// Wait a bit more for any dynamic content to load
	page.WaitForTimeout(2000) // 2 seconds

	// Extract semantic text content from specific HTML elements
	title, _ := page.Title()

	// First, remove script and style elements to avoid extracting their content
	page.Evaluate("() => { document.querySelectorAll('script, style, noscript').forEach(el => el.remove()); }")

	// Define semantic content selectors for text extraction
	contentSelectors := []string{
		"h1, h2, h3, h4, h5, h6", // Headings
		"p",                      // Paragraphs
		"span",                   // Spans
		"div",                    // Divs (common content containers)
		"article",                // Article content
		"section",                // Section content
		"main",                   // Main content area
		"li",                     // List items
		"td, th",                 // Table cells
		"blockquote",             // Quotes
		"figcaption",             // Figure captions
		"address",                // Address elements
		"time",                   // Time elements
		"strong, b, em, i",       // Emphasized text
		"code, pre",              // Code blocks
		"cite",                   // Citations
		"mark",                   // Highlighted text
		"small",                  // Small text
		"sub, sup",               // Subscript/superscript
		"ins, del",               // Inserted/deleted text
		"kbd",                    // Keyboard input
		"samp",                   // Sample output
		"var",                    // Variables
		"abbr",                   // Abbreviations
		"dfn",                    // Definitions
		"q",                      // Inline quotes
		"s",                      // Strikethrough
		"u",                      // Underlined text
		"data",                   // Data values
		"output",                 // Output elements
		"a",                      // Links (text content only)
		"button",                 // Button text
		"label",                  // Form labels
		"legend",                 // Fieldset legends
		"caption",                // Table captions
		"summary",                // Details summary
		"dt, dd",                 // Definition terms and descriptions
	}

	var contentParts []string

	// Extract text from each type of semantic element
	for _, selector := range contentSelectors {
		elements, err := page.QuerySelectorAll(selector)
		if err != nil {
			continue
		}

		for _, element := range elements {
			// Get text content and clean it up
			if textContent, err := element.TextContent(); err == nil && textContent != "" {
				trimmed := strings.TrimSpace(textContent)
				// Filter out CSS-like content and other noise
				if isValidContentText(trimmed) {
					contentParts = append(contentParts, trimmed)
				}
			}
		}
	}

	// Join all content with newlines and remove duplicates
	content := strings.Join(removeDuplicateStrings(contentParts), "\n")

	// Try to get meta description
	description := ""
	if metaDesc, err := page.GetAttribute("meta[name='description']", "content"); err == nil && metaDesc != "" {
		description = metaDesc
	}

	statusCode := 200
	if response != nil {
		statusCode = response.Status()
	}

	return &WebContent{
		URL:             targetURL,
		Title:           title,
		Content:         content,
		Description:     description,
		StatusCode:      statusCode,
		IsDynamic:       true,
		LoadingStrategy: "playwright",
		LoadTime:        time.Since(startTime),
	}, nil
}

// removeDuplicateStrings removes duplicate strings from a slice while preserving order
func removeDuplicateStrings(slice []string) []string {
	seen := make(map[string]bool)
	result := make([]string, 0, len(slice))

	for _, str := range slice {
		if !seen[str] {
			seen[str] = true
			result = append(result, str)
		}
	}

	return result
}

// isValidContentText filters out CSS, JavaScript, and other non-content text
func isValidContentText(text string) bool {
	// Minimum length check
	if len(text) <= 2 {
		return false
	}

	// Check for CSS-like patterns
	cssPatterns := []string{
		"color:", "background:", "border:", "width:", "height:", "margin:", "padding:",
		"font-", "text-", "display:", "position:", "top:", "left:", "right:", "bottom:",
		"z-index:", "opacity:", "transform:", "transition:", "animation:",
		"@media", "@import", "@keyframes", "rgba(", "rgb(", "#", "px", "rem", "em", "%",
		"!important", "hover:", "active:", "focus:", "before:", "after:",
		"flex", "grid", "absolute", "relative", "fixed", "sticky",
	}

	lowerText := strings.ToLower(text)

	// Check if text contains too many CSS indicators
	cssCount := 0
	for _, pattern := range cssPatterns {
		if strings.Contains(lowerText, pattern) {
			cssCount++
		}
	}

	// If more than 2 CSS patterns are found, likely CSS content
	if cssCount > 2 {
		return false
	}

	// Check for long strings of CSS-like content (selectors, properties)
	if strings.Contains(text, "{") && strings.Contains(text, "}") {
		return false
	}

	// Check for CSS selector patterns
	if strings.Contains(text, ".") && strings.Contains(text, "-") && len(strings.Fields(text)) <= 3 {
		return false
	}

	// Filter out JavaScript-like content
	jsPatterns := []string{
		"function(", "var ", "let ", "const ", "return ", "if(", "for(", "while(",
		"document.", "window.", "console.", "alert(", "parseInt(", "parseFloat(",
		"getElementById", "querySelector", "addEventListener",
	}

	for _, pattern := range jsPatterns {
		if strings.Contains(lowerText, pattern) {
			return false
		}
	}

	// Filter out data attributes and technical strings
	if strings.HasPrefix(text, "data-") || strings.HasPrefix(text, "aria-") {
		return false
	}

	// Filter out URLs and file paths
	if strings.Contains(text, "http://") || strings.Contains(text, "https://") ||
		strings.Contains(text, ".com") || strings.Contains(text, ".css") ||
		strings.Contains(text, ".js") || strings.Contains(text, ".png") ||
		strings.Contains(text, ".jpg") || strings.Contains(text, ".gif") {
		return false
	}

	// Accept if it looks like readable content
	return true
}

// GetCapabilities returns information about Playwright capabilities
func (pm *PlaywrightManager) GetCapabilities() map[string]interface{} {
	pm.mu.RLock()
	defer pm.mu.RUnlock()

	return map[string]interface{}{
		"is_available":         pm.isAvailable && pm.hasPlaywright,
		"is_downloading":       pm.isDownloading,
		"has_playwright_lib":   pm.hasPlaywright,
		"javascript_execution": pm.isAvailable && pm.hasPlaywright,
		"network_interception": pm.isAvailable && pm.hasPlaywright,
		"screenshot_capture":   pm.isAvailable && pm.hasPlaywright,
		"download_status":      pm.getDownloadStatus(),
		"estimated_size":       "~50MB (Chromium only)",
		"download_error":       pm.downloadError,
	}
}

func (pm *PlaywrightManager) getDownloadStatus() string {
	if pm.isAvailable && pm.hasPlaywright {
		return "installed"
	}
	if pm.isDownloading {
		return "downloading"
	}
	if !pm.hasPlaywright {
		return "library_not_available"
	}
	return "not_installed"
}

// GetInstallationStatus returns detailed installation information
func (pm *PlaywrightManager) GetInstallationStatus() map[string]interface{} {
	return map[string]interface{}{
		"playwright_library":    pm.hasPlaywright,
		"browsers_installed":    pm.isAvailable,
		"currently_downloading": pm.isDownloading,
		"last_error": func() string {
			if pm.downloadError != nil {
				return pm.downloadError.Error()
			}
			return ""
		}(),
		"capabilities": pm.GetCapabilities(),
	}
}

// Cleanup performs cleanup operations
func (pm *PlaywrightManager) Cleanup() {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	if pm.browser != nil {
		pm.browser.Close()
		pm.browser = nil
	}

	if pm.pw != nil {
		pm.pw.Stop()
		pm.pw = nil
	}

	log.Println("PlaywrightManager: Cleanup completed")
}

// GetUserDataDir returns the user data directory for browser sessions
func (pm *PlaywrightManager) GetUserDataDir() string {
	pm.mu.RLock()
	defer pm.mu.RUnlock()
	return pm.userDataDir
}

// SetUserDataDir sets the user data directory for browser sessions
func (pm *PlaywrightManager) SetUserDataDir(dir string) {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	pm.userDataDir = dir
}

// EnablePlaywright enables Playwright functionality when the library becomes available
func (pm *PlaywrightManager) EnablePlaywright() {
	pm.mu.Lock()
	defer pm.mu.Unlock()
	pm.hasPlaywright = true
	log.Println("PlaywrightManager: Playwright library enabled")
}

// Version returns version information
func (pm *PlaywrightManager) Version() map[string]interface{} {
	return map[string]interface{}{
		"manager_version":    "1.0.0-full",
		"playwright_version": "v0.5200.0",
		"implementation":     "full",
		"ready_for_upgrade":  false,
	}
}
