package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

// MCPRequest represents an incoming MCP request
type MCPRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	Method  string          `json:"method"`
	ID      interface{}     `json:"id"`
	Params  json.RawMessage `json:"params"`
}

// MCPResponse represents an MCP response
type MCPResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      interface{} `json:"id"`
	Result  interface{} `json:"result,omitempty"`
	Error   *MCPError   `json:"error,omitempty"`
}

// MCPError represents an error response
type MCPError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// Tool represents an available tool
type Tool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"inputSchema"`
}

// StandardResponse is the unified response format for all tools
type StandardResponse struct {
	Success bool   `json:"success"`
	Result  string `json:"result"`
	Error   string `json:"error,omitempty"`
	Hint    string `json:"hint,omitempty"`
}

// PythonEnvironment represents an isolated Python environment
type PythonEnvironment struct {
	ID         string
	Path       string
	PythonPath string
	PipPath    string
	CreatedAt  time.Time
	IsVirtual  bool
	mu         sync.Mutex
}

// PythonMCPServer handles Python operations
type PythonMCPServer struct {
	pythonPath string // Single Python path for simplicity
	workingDir string
	mu         sync.RWMutex
}

// NewPythonMCPServer creates a new server instance
func NewPythonMCPServer() *PythonMCPServer {
	server := &PythonMCPServer{
		workingDir: ".",
	}
	server.pythonPath = server.findPython()
	log.Printf("Python MCP Server started with Python: %s", server.pythonPath)
	return server
}

// findPython finds the best available Python installation
func (s *PythonMCPServer) findPython() string {
	// Try common Python commands
	commands := []string{"python3", "python", "py"}

	for _, cmd := range commands {
		if path, err := exec.LookPath(cmd); err == nil {
			// Verify it's Python 3
			out, err := exec.Command(path, "--version").Output()
			if err == nil && strings.Contains(string(out), "Python 3") {
				return path
			}
		}
	}

	// Platform-specific fallbacks
	if runtime.GOOS == "windows" {
		// Check common Windows locations
		paths := []string{
			`C:\Python\Python313\python.exe`,
			`C:\Python\Python312\python.exe`,
			`C:\Python\Python311\python.exe`,
			`C:\Python\Python310\python.exe`,
			`C:\Python\Python39\python.exe`,
			`C:\Program Files\Python313\python.exe`,
			`C:\Program Files\Python312\python.exe`,
			`C:\Program Files\Python311\python.exe`,
		}

		for _, path := range paths {
			if _, err := os.Stat(path); err == nil {
				return path
			}
		}
	}

	// Default fallback
	return "python"
}

// getTools returns available tools with optimized descriptions
func (s *PythonMCPServer) getTools() []Tool {
	// Determine shell description based on OS
	shellDesc := "Run shell command"
	shellExample := "shell command"

	switch runtime.GOOS {
	case "windows":
		shellDesc = "Run PowerShell command"
		shellExample = "PowerShell command (e.g. 'Get-ChildItem' or 'dir')"
	case "darwin":
		shellDesc = "Run macOS shell command"
		shellExample = "bash command (e.g. 'ls -la' or 'brew list')"
	case "linux":
		shellDesc = "Run Linux shell command"
		shellExample = "bash command (e.g. 'ls -la' or 'apt list')"
	}

	return []Tool{
		{
			Name:        "run",
			Description: "Run Python code",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"code": map[string]interface{}{
						"type":        "string",
						"description": "Python code to execute",
					},
				},
				"required": []string{"code"},
			},
		},
		{
			Name:        "shell",
			Description: shellDesc,
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"command": map[string]interface{}{
						"type":        "string",
						"description": shellExample,
					},
				},
				"required": []string{"command"},
			},
		},
		{
			Name:        "install",
			Description: "Install Python package",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"package": map[string]interface{}{
						"type":        "string",
						"description": "Package name (e.g. 'pillow' or 'numpy==1.21.0')",
					},
				},
				"required": []string{"package"},
			},
		},
		{
			Name:        "check",
			Description: "Check if package exists",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"package": map[string]interface{}{
						"type":        "string",
						"description": "Package name to check",
					},
				},
				"required": []string{"package"},
			},
		},
		{
			Name:        "save",
			Description: "Save content to file",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"path": map[string]interface{}{
						"type":        "string",
						"description": "File path",
					},
					"content": map[string]interface{}{
						"type":        "string",
						"description": "File content",
					},
				},
				"required": []string{"path", "content"},
			},
		},
		{
			Name:        "read",
			Description: "Read file content",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"path": map[string]interface{}{
						"type":        "string",
						"description": "File path",
					},
				},
				"required": []string{"path"},
			},
		},
		{
			Name:        "list",
			Description: "List files in directory",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"path": map[string]interface{}{
						"type":        "string",
						"description": "Directory path (default: current)",
						"default":     ".",
					},
				},
			},
		},
	}
}

// run executes Python code
func (s *PythonMCPServer) run(params map[string]interface{}) StandardResponse {
	code, ok := params["code"].(string)
	if !ok {
		return StandardResponse{
			Success: false,
			Error:   "Missing 'code' parameter",
			Hint:    "Provide Python code to execute",
			Result:  "",
		}
	}

	// Check if the code ends with an expression (common pattern)
	// If so, wrap it to print the last expression
	lines := strings.Split(strings.TrimSpace(code), "\n")
	if len(lines) > 0 {
		lastLine := strings.TrimSpace(lines[len(lines)-1])
		// Check if last line is likely an expression (not a statement)
		if lastLine != "" && !strings.HasPrefix(lastLine, "print") &&
			!strings.HasPrefix(lastLine, "return") &&
			!strings.Contains(lastLine, "=") &&
			!strings.HasPrefix(lastLine, "if") &&
			!strings.HasPrefix(lastLine, "for") &&
			!strings.HasPrefix(lastLine, "while") &&
			!strings.HasPrefix(lastLine, "def") &&
			!strings.HasPrefix(lastLine, "class") &&
			!strings.HasPrefix(lastLine, "import") &&
			!strings.HasPrefix(lastLine, "from") {
			// Wrap the last line in a print statement
			lines[len(lines)-1] = fmt.Sprintf("print(%s)", lastLine)
			code = strings.Join(lines, "\n")
		}
	}

	// Create temporary Python file
	tmpFile, err := ioutil.TempFile("", "code_*.py")
	if err != nil {
		return StandardResponse{
			Success: false,
			Error:   "Failed to create temporary file",
			Hint:    "Check system permissions",
			Result:  "",
		}
	}
	defer os.Remove(tmpFile.Name())

	if _, err := tmpFile.WriteString(code); err != nil {
		return StandardResponse{
			Success: false,
			Error:   "Failed to write code",
			Hint:    "Check disk space",
			Result:  "",
		}
	}
	tmpFile.Close()

	// Execute Python code
	cmd := exec.Command(s.pythonPath, tmpFile.Name())
	cmd.Dir = s.workingDir
	output, err := cmd.CombinedOutput()

	// Always ensure Result has a value
	outputStr := strings.TrimSpace(string(output))
	if outputStr == "" && err == nil {
		outputStr = "Code executed successfully (no output)"
	}

	if err != nil {
		return StandardResponse{
			Success: false,
			Result:  outputStr,
			Error:   fmt.Sprintf("Execution failed: %v", err),
			Hint:    "Check code syntax and imports",
		}
	}

	return StandardResponse{
		Success: true,
		Result:  outputStr,
		Error:   "",
		Hint:    "",
	}
}

// install installs a Python package
func (s *PythonMCPServer) install(params map[string]interface{}) StandardResponse {
	packageName, ok := params["package"].(string)
	if !ok {
		return StandardResponse{
			Success: false,
			Error:   "Missing 'package' parameter",
			Hint:    "Provide package name like 'pillow' or 'numpy==1.21.0'",
		}
	}

	cmd := exec.Command(s.pythonPath, "-m", "pip", "install", packageName)
	output, err := cmd.CombinedOutput()

	if err != nil {
		return StandardResponse{
			Success: false,
			Result:  string(output),
			Error:   "Installation failed",
			Hint:    fmt.Sprintf("Try 'pip install %s' manually", packageName),
		}
	}

	return StandardResponse{
		Success: true,
		Result:  fmt.Sprintf("Successfully installed %s", packageName),
		Hint:    fmt.Sprintf("You can now import and use %s", packageName),
	}
}

// check verifies if a package is installed
func (s *PythonMCPServer) check(params map[string]interface{}) StandardResponse {
	packageName, ok := params["package"].(string)
	if !ok {
		return StandardResponse{
			Success: false,
			Error:   "Missing 'package' parameter",
			Hint:    "Provide package name to check",
		}
	}

	cmd := exec.Command(s.pythonPath, "-m", "pip", "show", packageName)
	output, err := cmd.Output()

	if err != nil {
		return StandardResponse{
			Success: true,
			Result:  fmt.Sprintf("Package '%s' is NOT installed", packageName),
			Hint:    fmt.Sprintf("Use install tool with package='%s' to install it", packageName),
		}
	}

	// Extract version from output
	lines := strings.Split(string(output), "\n")
	version := "unknown"
	for _, line := range lines {
		if strings.HasPrefix(line, "Version:") {
			version = strings.TrimSpace(strings.TrimPrefix(line, "Version:"))
			break
		}
	}

	return StandardResponse{
		Success: true,
		Result:  fmt.Sprintf("Package '%s' version %s is installed", packageName, version),
	}
}

// save creates or overwrites a file
func (s *PythonMCPServer) save(params map[string]interface{}) StandardResponse {
	path, ok := params["path"].(string)
	if !ok {
		return StandardResponse{
			Success: false,
			Error:   "Missing 'path' parameter",
			Hint:    "Provide file path",
		}
	}

	content, ok := params["content"].(string)
	if !ok {
		return StandardResponse{
			Success: false,
			Error:   "Missing 'content' parameter",
			Hint:    "Provide file content",
		}
	}

	// Clean path for safety
	fullPath := filepath.Clean(filepath.Join(s.workingDir, path))

	// Create directory if needed
	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return StandardResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to create directory: %v", err),
			Hint:    "Check directory permissions",
		}
	}

	// Write file
	if err := ioutil.WriteFile(fullPath, []byte(content), 0644); err != nil {
		return StandardResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to write file: %v", err),
			Hint:    "Check file permissions",
		}
	}

	return StandardResponse{
		Success: true,
		Result:  fmt.Sprintf("Saved %d bytes to %s", len(content), path),
	}
}

// read reads file content
func (s *PythonMCPServer) read(params map[string]interface{}) StandardResponse {
	path, ok := params["path"].(string)
	if !ok {
		return StandardResponse{
			Success: false,
			Error:   "Missing 'path' parameter",
			Hint:    "Provide file path to read",
		}
	}

	fullPath := filepath.Clean(filepath.Join(s.workingDir, path))

	content, err := ioutil.ReadFile(fullPath)
	if err != nil {
		return StandardResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to read file: %v", err),
			Hint:    "Check if file exists and is readable",
		}
	}

	return StandardResponse{
		Success: true,
		Result:  string(content),
	}
}

// list lists files in a directory
func (s *PythonMCPServer) list(params map[string]interface{}) StandardResponse {
	path := "."
	if p, ok := params["path"].(string); ok {
		path = p
	}

	fullPath := filepath.Clean(filepath.Join(s.workingDir, path))

	files, err := ioutil.ReadDir(fullPath)
	if err != nil {
		return StandardResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to read directory: %v", err),
			Hint:    "Check if directory exists",
		}
	}

	// Format file list simply
	var items []string
	for _, file := range files {
		if file.IsDir() {
			items = append(items, fmt.Sprintf("[DIR] %s", file.Name()))
		} else {
			items = append(items, fmt.Sprintf("%s (%d bytes)", file.Name(), file.Size()))
		}
	}

	return StandardResponse{
		Success: true,
		Result:  strings.Join(items, "\n"),
		Hint:    fmt.Sprintf("Found %d items in %s", len(items), path),
	}
}

// formatResponse converts StandardResponse to MCP format
func formatResponse(resp StandardResponse) map[string]interface{} {
	// Convert to JSON for consistent format
	jsonData, err := json.Marshal(resp)
	if err != nil {
		// Fallback to a simple error message if JSON marshaling fails
		jsonData = []byte(`{"success":false,"error":"Failed to format response"}`)
	}

	// Ensure we always have non-null content
	content := string(jsonData)
	if content == "" {
		content = `{"success":true,"result":"Operation completed"}`
	}

	return map[string]interface{}{
		"content": []map[string]interface{}{
			{
				"type": "text",
				"text": content,
			},
		},
	}
}

// handleRequest processes an MCP request
func (s *PythonMCPServer) handleRequest(req MCPRequest) MCPResponse {
	resp := MCPResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
	}

	switch req.Method {
	case "initialize":
		resp.Result = map[string]interface{}{
			"protocolVersion": "2024-11-05",
			"serverInfo": map[string]interface{}{
				"name":    "python-tools",
				"version": "3.0.0",
			},
			"capabilities": map[string]interface{}{
				"tools": map[string]interface{}{},
			},
		}

	case "tools/list":
		resp.Result = map[string]interface{}{
			"tools": s.getTools(),
		}

	case "tools/call":
		var params struct {
			Name      string                 `json:"name"`
			Arguments map[string]interface{} `json:"arguments"`
		}

		if err := json.Unmarshal(req.Params, &params); err != nil {
			resp.Error = &MCPError{Code: -32602, Message: "Invalid params"}
			return resp
		}

		var result StandardResponse

		switch params.Name {
		case "run":
			result = s.run(params.Arguments)
		case "install":
			result = s.install(params.Arguments)
		case "check":
			result = s.check(params.Arguments)
		case "save":
			result = s.save(params.Arguments)
		case "read":
			result = s.read(params.Arguments)
		case "list":
			result = s.list(params.Arguments)
		default:
			resp.Error = &MCPError{Code: -32603, Message: fmt.Sprintf("Unknown tool: %s", params.Name)}
			return resp
		}

		resp.Result = formatResponse(result)

	default:
		resp.Error = &MCPError{Code: -32601, Message: "Method not found"}
	}

	return resp
}

// runServer starts the MCP server main loop
func (s *PythonMCPServer) runServer() {
	scanner := bufio.NewScanner(os.Stdin)
	encoder := json.NewEncoder(os.Stdout)

	log.Printf("Python Tools MCP Server v3.0")
	log.Printf("Python: %s", s.pythonPath)
	log.Printf("Working directory: %s", s.workingDir)
	log.Printf("OS: %s", runtime.GOOS)
	log.Printf("Tools: run, shell, install, check, save, read, list")

	for scanner.Scan() {
		line := scanner.Text()

		var req MCPRequest
		if err := json.Unmarshal([]byte(line), &req); err != nil {
			log.Printf("Failed to parse request: %v", err)
			continue
		}

		resp := s.handleRequest(req)

		if err := encoder.Encode(resp); err != nil {
			log.Printf("Failed to encode response: %v", err)
		}
	}

	if err := scanner.Err(); err != nil && err != io.EOF {
		log.Printf("Scanner error: %v", err)
	}
}

func main() {
	// Set up logging to stderr
	log.SetOutput(os.Stderr)

	server := NewPythonMCPServer()
	server.runServer()
}
