package tools

import (
	"claraverse/internal/filecache"
	"claraverse/internal/security"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
)

// NewDownloadFileTool creates the download_file tool for fetching files from URLs
func NewDownloadFileTool() *Tool {
	return &Tool{
		Name:        "download_file",
		DisplayName: "Download File",
		Description: "Downloads a file from a URL and stores it for further processing. Use this to fetch images, documents, or data files from external sources.",
		Icon:        "Download",
		Parameters: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"url": map[string]interface{}{
					"type":        "string",
					"description": "The URL to download the file from (must be https)",
				},
				"filename": map[string]interface{}{
					"type":        "string",
					"description": "Optional filename to save as (auto-detected from URL if not provided)",
				},
			},
			"required": []string{"url"},
		},
		Execute:  executeDownloadFile,
		Source:   ToolSourceBuiltin,
		Category: "data_sources",
		Keywords: []string{"download", "fetch", "url", "file", "web", "http", "image", "document"},
	}
}

// Size limits for different file types
const (
	maxImageSize    = 20 * 1024 * 1024 // 20MB for images
	maxDocSize      = 10 * 1024 * 1024 // 10MB for documents
	maxAudioSize    = 25 * 1024 * 1024 // 25MB for audio (Whisper limit)
	maxDefaultSize  = 10 * 1024 * 1024 // 10MB default
	downloadTimeout = 30 * time.Second
)

func executeDownloadFile(args map[string]interface{}) (string, error) {
	// Extract URL parameter
	urlStr, ok := args["url"].(string)
	if !ok || urlStr == "" {
		return "", fmt.Errorf("url parameter is required and must be a string")
	}

	// Extract optional filename
	filename := ""
	if f, ok := args["filename"].(string); ok {
		filename = f
	}

	// Extract user context (injected by tool executor)
	userID, _ := args["__user_id__"].(string)
	conversationID, _ := args["__conversation_id__"].(string)

	// Clean up internal parameters
	delete(args, "__user_id__")
	delete(args, "__conversation_id__")

	log.Printf("📥 [DOWNLOAD-FILE] Downloading from %s (user=%s)", urlStr, userID)

	// Validate and sanitize URL
	parsedURL, err := validateDownloadURL(urlStr)
	if err != nil {
		log.Printf("❌ [DOWNLOAD-FILE] Invalid URL: %v", err)
		return "", fmt.Errorf("invalid URL: %v", err)
	}

	// Create HTTP client with timeout
	client := &http.Client{
		Timeout: downloadTimeout,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return fmt.Errorf("too many redirects")
			}
			// Validate redirect URL
			if _, err := validateDownloadURL(req.URL.String()); err != nil {
				return fmt.Errorf("redirect blocked: %v", err)
			}
			return nil
		},
	}

	// Create request
	req, err := http.NewRequest("GET", parsedURL.String(), nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %v", err)
	}

	// Set a reasonable User-Agent
	req.Header.Set("User-Agent", "ClaraVerse/1.0 (File Downloader)")

	// Make request
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("❌ [DOWNLOAD-FILE] Request failed: %v", err)
		return "", fmt.Errorf("failed to download file: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("download failed with status: %d", resp.StatusCode)
	}

	// Get content type
	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	// Strip charset suffix if present
	if idx := strings.Index(contentType, ";"); idx != -1 {
		contentType = strings.TrimSpace(contentType[:idx])
	}

	// Determine max size based on content type
	maxSize := getMaxSize(contentType)

	// Check content length if available
	if resp.ContentLength > maxSize {
		return "", fmt.Errorf("file too large: %d bytes (max %d bytes for %s)", resp.ContentLength, maxSize, contentType)
	}

	// Read body with size limit
	limitedReader := io.LimitReader(resp.Body, maxSize+1)
	content, err := io.ReadAll(limitedReader)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %v", err)
	}

	if int64(len(content)) > maxSize {
		return "", fmt.Errorf("file too large: max %d bytes for %s", maxSize, contentType)
	}

	// Determine filename
	if filename == "" {
		filename = extractFilename(parsedURL, contentType, resp.Header.Get("Content-Disposition"))
	}

	// Validate filename
	filename = sanitizeFilename(filename)

	// Generate file ID
	fileID := uuid.New().String()

	// Determine file extension
	ext := filepath.Ext(filename)
	if ext == "" {
		ext = getExtensionFromContentType(contentType)
		filename = filename + ext
	}

	// Save to uploads directory
	uploadDir := "./uploads"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		return "", fmt.Errorf("failed to create uploads directory: %v", err)
	}

	filePath := filepath.Join(uploadDir, fileID+ext)
	if err := os.WriteFile(filePath, content, 0644); err != nil {
		return "", fmt.Errorf("failed to save file: %v", err)
	}

	// Calculate hash
	hash := sha256.Sum256(content)
	var fileHash security.Hash
	copy(fileHash[:], hash[:])

	// Store in file cache
	fileCacheService := filecache.GetService()
	cachedFile := &filecache.CachedFile{
		FileID:         fileID,
		UserID:         userID,
		ConversationID: conversationID,
		Filename:       filename,
		MimeType:       contentType,
		Size:           int64(len(content)),
		FilePath:       filePath,
		FileHash:       fileHash,
		UploadedAt:     time.Now(),
	}
	fileCacheService.Store(cachedFile)

	// Build response
	response := map[string]interface{}{
		"success":     true,
		"file_id":     fileID,
		"filename":    filename,
		"mime_type":   contentType,
		"size":        len(content),
		"source_url":  parsedURL.String(),
		"file_type":   getFileType(contentType),
		"message":     fmt.Sprintf("Downloaded %s (%d bytes). Use file_id '%s' with read_document, read_data_file, describe_image, or transcribe_audio tools.", filename, len(content), fileID),
	}

	responseJSON, err := json.Marshal(response)
	if err != nil {
		return "", fmt.Errorf("failed to marshal response: %w", err)
	}

	log.Printf("✅ [DOWNLOAD-FILE] Successfully downloaded %s (%d bytes) from %s", filename, len(content), parsedURL.Host)

	return string(responseJSON), nil
}

// validateDownloadURL validates and sanitizes the URL to prevent SSRF attacks
func validateDownloadURL(urlStr string) (*url.URL, error) {
	// Parse URL
	parsedURL, err := url.Parse(urlStr)
	if err != nil {
		return nil, fmt.Errorf("invalid URL format")
	}

	// Must be HTTPS (or HTTP for development)
	if parsedURL.Scheme != "https" && parsedURL.Scheme != "http" {
		return nil, fmt.Errorf("only http/https URLs are allowed")
	}

	// Must have a host
	if parsedURL.Host == "" {
		return nil, fmt.Errorf("URL must have a host")
	}

	// Block internal/private IP ranges and cloud metadata endpoints, resolving
	// the hostname and rejecting a NAT64/6to4/Teredo-encoded destination the
	// same way the security package's shared SSRF guard does.
	if err := security.ValidateURLForSSRF(urlStr); err != nil {
		return nil, err
	}

	return parsedURL, nil
}

// getMaxSize returns the max allowed size for a content type
func getMaxSize(contentType string) int64 {
	if strings.HasPrefix(contentType, "image/") {
		return maxImageSize
	}
	if strings.HasPrefix(contentType, "audio/") {
		return maxAudioSize
	}
	if contentType == "application/pdf" ||
	   strings.Contains(contentType, "word") ||
	   strings.Contains(contentType, "powerpoint") ||
	   strings.Contains(contentType, "presentation") {
		return maxDocSize
	}
	return maxDefaultSize
}

// extractFilename extracts filename from URL, Content-Disposition, or generates one
func extractFilename(parsedURL *url.URL, contentType, contentDisposition string) string {
	// Try Content-Disposition header
	if contentDisposition != "" {
		if strings.Contains(contentDisposition, "filename=") {
			parts := strings.Split(contentDisposition, "filename=")
			if len(parts) > 1 {
				name := strings.Trim(parts[1], `"' `)
				if name != "" {
					return name
				}
			}
		}
	}

	// Try URL path
	path := parsedURL.Path
	if path != "" && path != "/" {
		name := filepath.Base(path)
		if name != "" && name != "." && name != "/" {
			return name
		}
	}

	// Generate from content type
	ext := getExtensionFromContentType(contentType)
	return "downloaded_file" + ext
}

// sanitizeFilename removes unsafe characters from filename
func sanitizeFilename(filename string) string {
	// Remove path separators and other dangerous characters
	filename = filepath.Base(filename)
	filename = strings.Map(func(r rune) rune {
		if r == '/' || r == '\\' || r == ':' || r == '*' || r == '?' || r == '"' || r == '<' || r == '>' || r == '|' {
			return '_'
		}
		return r
	}, filename)

	// Limit length
	if len(filename) > 255 {
		ext := filepath.Ext(filename)
		name := strings.TrimSuffix(filename, ext)
		if len(name) > 250 {
			name = name[:250]
		}
		filename = name + ext
	}

	return filename
}

// getExtensionFromContentType returns a file extension for a content type
func getExtensionFromContentType(contentType string) string {
	extensions := map[string]string{
		"image/jpeg":       ".jpg",
		"image/png":        ".png",
		"image/gif":        ".gif",
		"image/webp":       ".webp",
		"image/svg+xml":    ".svg",
		"application/pdf":  ".pdf",
		"text/plain":       ".txt",
		"text/csv":         ".csv",
		"text/html":        ".html",
		"application/json": ".json",
		"audio/mpeg":       ".mp3",
		"audio/wav":        ".wav",
		"audio/mp4":        ".m4a",
		"audio/webm":       ".webm",
		"audio/ogg":        ".ogg",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
		"application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
		"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
	}

	if ext, ok := extensions[contentType]; ok {
		return ext
	}
	return ".bin"
}

// getFileType returns a human-readable file type category
func getFileType(contentType string) string {
	if strings.HasPrefix(contentType, "image/") {
		return "image"
	}
	if strings.HasPrefix(contentType, "audio/") {
		return "audio"
	}
	if contentType == "application/pdf" ||
	   strings.Contains(contentType, "word") ||
	   strings.Contains(contentType, "powerpoint") ||
	   strings.Contains(contentType, "presentation") {
		return "document"
	}
	if contentType == "text/csv" || contentType == "application/json" ||
	   strings.Contains(contentType, "spreadsheet") {
		return "data"
	}
	if strings.HasPrefix(contentType, "text/") {
		return "text"
	}
	return "file"
}
