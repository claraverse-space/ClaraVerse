package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/jung-kurt/gofpdf"
)

// SearXNG and Web Content constants
const (
	SearXNGImage    = "searxng/searxng:latest"
	ContainerName   = "clara-searxng"
	SearXNGPort     = "8080"
	SearXNGURL      = "http://localhost:8080"
	HealthCheckPath = "/healthz"
	SearchPath      = "/search"
	ConfigPath      = "./searxng-config"
)

// Web content and search types
type SearchResult struct {
	URL         string `json:"url"`
	Title       string `json:"title"`
	Content     string `json:"content"`
	PublishedAt string `json:"publishedDate,omitempty"`
	Engine      string `json:"engine"`
}

type SearchResponse struct {
	Query           string         `json:"query"`
	NumberOfResults int            `json:"number_of_results"`
	Results         []SearchResult `json:"results"`
	Infoboxes       []interface{}  `json:"infoboxes"`
	Suggestions     []string       `json:"suggestions"`
	AnswerBox       interface{}    `json:"answer"`
}

type WebContent struct {
	URL         string `json:"url"`
	Title       string `json:"title"`
	Content     string `json:"content"`
	Description string `json:"description"`
	StatusCode  int    `json:"status_code"`
	Error       string `json:"error,omitempty"`
	// Enhanced fields for smart dynamic detection
	IsDynamic        bool          `json:"is_dynamic"`
	LoadingStrategy  string        `json:"loading_strategy"` // "static", "api_simulation", "fallback"
	APIEndpoints     []string      `json:"api_endpoints,omitempty"`
	JavaScriptErrors []string      `json:"js_errors,omitempty"`
	LoadTime         time.Duration `json:"load_time"`
}

type SearXNGManager struct {
	containerID string
	isRunning   bool
}

type WebContentFetcher struct {
	client            *http.Client
	jsEngine          *JSEngine          // Self-contained JavaScript engine
	smartMode         bool               // Enable smart dynamic content detection
	playwrightManager *PlaywrightManager // Progressive Playwright integration
}

// Self-contained JavaScript engine for basic DOM simulation
type JSEngine struct {
	// Will implement lightweight JS execution for basic dynamic content
	apiDetector  *regexp.Regexp
	domSimulator *DOMSimulator
}

type DOMSimulator struct {
	// Lightweight DOM-like structure for content simulation
	virtualDOM map[string]interface{}
}

// Core types
type MCPRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	Method  string          `json:"method"`
	ID      interface{}     `json:"id"`
	Params  json.RawMessage `json:"params"`
}

type MCPResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      interface{} `json:"id"`
	Result  interface{} `json:"result,omitempty"`
	Error   *MCPError   `json:"error,omitempty"`
}

type MCPError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type Tool struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	InputSchema map[string]interface{} `json:"inputSchema"`
}

// PythonMCPServer with virtual environment support
type PythonMCPServer struct {
	systemPython string // System Python for creating venv
	venvPath     string // Path to virtual environment
	pythonPath   string // Python executable in venv
	pipPath      string // Pip executable in venv
	workspaceDir string // Workspace directory
	mu           sync.RWMutex
}

// NewPythonMCPServer creates server with dedicated workspace and venv
func NewPythonMCPServer() *PythonMCPServer {
	// Create workspace directory with absolute path
	cwd, err := os.Getwd()
	if err != nil {
		cwd = "."
	}

	workspace := filepath.Join(cwd, "mcp_workspace")
	if err := os.MkdirAll(workspace, 0755); err != nil {
		log.Printf("Warning: Failed to create workspace: %v", err)
		// Fallback to a safe directory - avoid root directory
		if cwd == "/" || cwd == "" {
			// Use user's home directory as fallback
			if homeDir, err := os.UserHomeDir(); err == nil {
				workspace = filepath.Join(homeDir, "clara_mcp_workspace")
			} else {
				// Last resort: use /tmp
				workspace = filepath.Join("/tmp", "clara_mcp_workspace")
			}
		} else {
			workspace = cwd
		}
		// Try to create the fallback workspace
		if err := os.MkdirAll(workspace, 0755); err != nil {
			log.Printf("ERROR: Failed to create fallback workspace: %v", err)
			// This is a critical error - we can't proceed
			panic(fmt.Sprintf("Cannot create workspace directory: %v", err))
		}
	}

	server := &PythonMCPServer{
		workspaceDir: workspace,
		venvPath:     filepath.Join(workspace, ".venv"),
	}

	// Find system Python first
	server.systemPython = server.findSystemPython()
	log.Printf("Found system Python: %s", server.systemPython)

	// Initialize virtual environment
	if err := server.initVirtualEnv(); err != nil {
		log.Printf("WARNING: Failed to create virtual environment: %v", err)
		log.Printf("Falling back to system Python")
		server.pythonPath = server.systemPython
		server.pipPath = server.systemPython
	}

	log.Printf("Python MCP Server started")
	log.Printf("System Python: %s", server.systemPython)
	log.Printf("Virtual env: %s", server.venvPath)
	log.Printf("Active Python: %s", server.pythonPath)
	log.Printf("Workspace: %s", server.workspaceDir)
	
	// Verify workspace is writable
	if err := os.MkdirAll(filepath.Join(server.workspaceDir, "test"), 0755); err != nil {
		log.Printf("WARNING: Workspace directory is not writable: %v", err)
	} else {
		os.RemoveAll(filepath.Join(server.workspaceDir, "test"))
		log.Printf("Workspace directory is writable")
	}

	// Create README file
	server.createReadme()

	return server
}

// findSystemPython finds the system Python 3
func (s *PythonMCPServer) findSystemPython() string {
	// Try common commands
	for _, cmd := range []string{"python3", "python", "py"} {
		if path, err := exec.LookPath(cmd); err == nil {
			// Verify it's Python 3
			out, err := exec.Command(path, "--version").Output()
			if err == nil && strings.Contains(string(out), "Python 3") {
				return path
			}
		}
	}
	return "python" // fallback
}

// initVirtualEnv creates and activates a virtual environment
func (s *PythonMCPServer) initVirtualEnv() error {
	// Set paths based on OS
	if runtime.GOOS == "windows" {
		s.pythonPath = filepath.Join(s.venvPath, "Scripts", "python.exe")
		s.pipPath = filepath.Join(s.venvPath, "Scripts", "pip.exe")
	} else {
		s.pythonPath = filepath.Join(s.venvPath, "bin", "python")
		s.pipPath = filepath.Join(s.venvPath, "bin", "pip")
	}

	// Check if venv already exists
	if _, err := os.Stat(s.pythonPath); err == nil {
		log.Printf("Virtual environment already exists")
		return nil
	}

	// Create virtual environment
	log.Printf("Creating virtual environment...")
	cmd := exec.Command(s.systemPython, "-m", "venv", s.venvPath)
	cmd.Dir = s.workspaceDir
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to create venv: %v\nOutput: %s", err, output)
	}

	// Verify venv was created
	if _, err := os.Stat(s.pythonPath); err != nil {
		return fmt.Errorf("venv created but Python not found at %s", s.pythonPath)
	}

	// Upgrade pip in the venv
	log.Printf("Upgrading pip in virtual environment...")
	upgradeCmd := exec.Command(s.pythonPath, "-m", "pip", "install", "--upgrade", "pip")
	upgradeCmd.Dir = s.workspaceDir
	if output, err := upgradeCmd.CombinedOutput(); err != nil {
		log.Printf("Warning: Failed to upgrade pip: %v\nOutput: %s", err, output)
	}

	log.Printf("Virtual environment created successfully")
	return nil
}

// createReadme creates a comprehensive README file in workspace
func (s *PythonMCPServer) createReadme() {
	readmePath := filepath.Join(s.workspaceDir, "README.txt")
	if _, err := os.Stat(readmePath); os.IsNotExist(err) {
		shellInfo := "Shell: Unix/Linux (/bin/sh)"
		if runtime.GOOS == "windows" {
			shellInfo = "Shell: Windows PowerShell"
		}

		readme := `MCP Workspace Directory - Python Execution Environment
======================================================

Welcome to your isolated MCP (Model Context Protocol) workspace!

OVERVIEW:
This workspace provides a completely isolated Python environment where you can:
- Execute Python code safely without affecting your system
- Install packages that won't interfere with system Python
- Save and load files in a dedicated workspace
- Run shell commands with automatic Python/pip routing

WORKSPACE FEATURES:
✓ Isolated Python Virtual Environment (.venv/)
✓ Clean workspace for file operations
✓ Cross-platform shell command support
✓ Automatic dependency management
✓ Safe package installation

AVAILABLE TOOLS:

1. py(code="...")
   - Execute Python code in isolated environment
   - Auto-prints last line expressions
   - Supports multi-line code, imports, functions
   - Examples:
     py(code="import math; math.sqrt(16)")
     py(code="[x**2 for x in range(5)]")
     py(code="def greet(name): return f'Hello {name}!'")

2. ` + shellInfo + `
   - powershell(cmd="...") on Windows / sh(cmd="...") on Unix
   - Execute system commands
   - Auto-routes python/pip to virtual environment
   - Examples:
     powershell(cmd="Get-Process python")
     sh(cmd="ps aux | grep python")

3. pip(pkg="...")
   - Install Python packages safely
   - Only affects this workspace environment
   - Examples:
     pip(pkg="requests")
     pip(pkg="numpy pandas matplotlib")
     pip(pkg="beautifulsoup4==4.9.3")

4. save(name="...", text="...")
   - Save content to workspace files
   - Persistent across MCP session
   - Examples:
     save(name="script.py", text="print('Hello World')")
     save(name="data.json", text='{"key": "value"}')

5. load(name="...")
   - Read file content from workspace
   - Access previously saved files
   - Examples:
     load(name="script.py")
     load(name="data.json")

6. ls()
   - List all workspace files and directories
   - Shows file sizes and types
   - Excludes .venv for clarity

7. open()
   - Open workspace in system file manager
   - Direct access to workspace folder
   - Platform-specific file manager

GETTING STARTED:
1. Check Python version: py(code="import sys; print(sys.version)")
2. Install a package: pip(pkg="requests")
3. Test the package: py(code="import requests; print('Requests installed!')")
4. Save a script: save(name="test.py", text="print('Hello from saved file')")
5. List files: ls()
6. Load and run: py(code=load(name="test.py"))

WORKSPACE STRUCTURE:
├── README.txt          (this file)
├── .venv/             (Python virtual environment - hidden from ls())
├── your_files.py      (files you save)
├── data_files.json    (data you create)
└── any_other_files    (content you work with)

TIPS FOR AI MODELS:
- Use py() for Python calculations, data processing, API calls
- Use pip() to install libraries before using them in py()
- Use save()/load() to persist code and data between operations
- Use ls() to see what files are available
- All operations are isolated and safe to experiment with
- Files persist within the same MCP session

VIRTUAL ENVIRONMENT DETAILS:
- Location: .venv/
- Python: Isolated Python 3.x installation
- Packages: Separated from system Python
- Activation: Automatic for all py() and python commands

This workspace is your sandbox - experiment freely!
`
		ioutil.WriteFile(readmePath, []byte(readme), 0644)
	}
}

// getTools returns detailed tool definitions with comprehensive descriptions
func (s *PythonMCPServer) getTools() []Tool {
	// Dynamic shell description based on OS
	shellName := "sh"
	shellDesc := "Execute shell commands in Unix/Linux environment. Runs commands using /bin/sh with full access to system utilities, file operations, and process management. Automatically routes 'python' and 'pip' commands to the isolated virtual environment."
	cmdDesc := "Shell command to execute (e.g., 'ls -la', 'grep pattern file.txt', 'curl https://api.example.com')"

	if runtime.GOOS == "windows" {
		shellName = "powershell"
		shellDesc = "Execute PowerShell commands in Windows environment. Runs commands using PowerShell with full access to Windows utilities, file system operations, registry access, and .NET framework. Automatically routes 'python' and 'pip' commands to the isolated virtual environment. Supports both PowerShell cmdlets and traditional Windows commands."
		cmdDesc = "PowerShell command to execute (e.g., 'Get-ChildItem', 'Test-Path C:\\file.txt', 'Invoke-WebRequest https://api.example.com')"
	}

	return []Tool{
		{
			Name:        "py",
			Description: "Execute Python code in an isolated virtual environment. Runs Python 3.x code with automatic output handling - expressions on the last line are automatically printed for convenience. All code executes in a dedicated workspace directory with an isolated virtual environment, so system Python and packages remain untouched. Perfect for data analysis, calculations, file processing, API calls, and any Python scripting needs. Supports multi-line code blocks, imports, function definitions, and complex operations.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"code": map[string]interface{}{
						"type":        "string",
						"description": "Python code to execute. Can be single expressions (e.g., '2+2'), multi-line scripts, import statements, function definitions, or complex programs. Last line expressions are automatically printed. Examples: 'import requests; requests.get(\"https://api.github.com\").json()', 'def factorial(n): return 1 if n <= 1 else n * factorial(n-1); factorial(5)', '[x**2 for x in range(10)]'",
					},
				},
				"required": []string{"code"},
			},
		},
		{
			Name:        shellName,
			Description: shellDesc,
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"cmd": map[string]interface{}{
						"type":        "string",
						"description": cmdDesc,
					},
				},
				"required": []string{"cmd"},
			},
		},
		{
			Name:        "pip",
			Description: "Install Python packages into the isolated virtual environment. Safely installs Python packages using pip without affecting the system Python installation. All packages are installed only in the dedicated virtual environment created for this MCP session. Supports installing from PyPI, Git repositories, local files, and specific versions. Use this to add any Python libraries you need for your code execution.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"pkg": map[string]interface{}{
						"type":        "string",
						"description": "Package name or specification to install. Examples: 'requests' (latest version), 'numpy==1.21.0' (specific version), 'git+https://github.com/user/repo.git' (from Git), 'package>=1.0,<2.0' (version range), 'requests beautifulsoup4 pandas' (multiple packages)",
					},
				},
				"required": []string{"pkg"},
			},
		},
		{
			Name:        "save",
			Description: "Save text content to a file in the MCP workspace directory. Creates or overwrites files with the specified content. All files are saved to the isolated workspace directory and can be accessed later with the 'load' tool or referenced in Python/shell commands. Perfect for saving code, data, configuration files, logs, or any text-based content. Files persist across tool calls within the same MCP session.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"name": map[string]interface{}{
						"type":        "string",
						"description": "Filename to save (e.g., 'script.py', 'data.json', 'config.txt', 'analysis.csv'). Extension determines file type. File will be saved in the MCP workspace directory.",
					},
					"text": map[string]interface{}{
						"type":        "string",
						"description": "Complete file content to save. Can be Python code, JSON data, CSV content, configuration text, or any text-based format. Use proper formatting and newlines as needed.",
					},
				},
				"required": []string{"name", "text"},
			},
		},
		{
			Name:        "load",
			Description: "Read and return the complete content of a file from the MCP workspace directory. Retrieves text content from files previously saved with the 'save' tool or placed in the workspace directory. Returns the entire file content as text, which can then be processed, analyzed, or modified. Use this to access saved scripts, data files, configuration files, or any text-based content.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"name": map[string]interface{}{
						"type":        "string",
						"description": "Filename to read from the workspace directory (e.g., 'script.py', 'data.json', 'results.txt'). Must be an existing file in the MCP workspace.",
					},
				},
				"required": []string{"name"},
			},
		},
		{
			Name:        "ls",
			Description: "List all files and directories in the MCP workspace directory. Shows file names, sizes (in bytes, KB, or MB), and indicates directories with [DIR] prefix. Excludes the .venv virtual environment directory from the listing for clarity. Use this to see what files are available for loading, understand the workspace structure, or verify that files were saved correctly. Helps you navigate and manage workspace contents.",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
		{
			Name:        "open",
			Description: "Open the MCP workspace directory in the system file manager for direct access. Launches the default file manager (Windows Explorer on Windows, Finder on macOS, or available file manager on Linux) showing the workspace folder. This allows you to manually inspect files, add external files to the workspace, or perform file operations outside the MCP tools. The workspace contains all saved files and the Python virtual environment.",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
		{
			Name:        "search",
			Description: "Search the web using SearXNG private search engine. Performs privacy-focused web searches using a local SearXNG Docker container. Automatically starts the SearXNG service if needed, searches for the specified query, and returns structured results with titles, URLs, content snippets, and source engines. Perfect for research, fact-checking, finding documentation, or gathering information while maintaining privacy. Results include suggestions and can be filtered by various search engines.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"query": map[string]interface{}{
						"type":        "string",
						"description": "Search query to execute (e.g., 'golang web scraping', 'machine learning tutorials', 'docker best practices'). Use natural language or specific keywords.",
					},
					"num_results": map[string]interface{}{
						"type":        "integer",
						"description": "Maximum number of search results to return (default: 10, max: 20). More results provide broader coverage but take longer to process.",
						"default":     10,
						"minimum":     1,
						"maximum":     20,
					},
				},
				"required": []string{"query"},
			},
		},
		{
			Name:        "fetch_content",
			Description: "Fetch and extract content from web pages using Playwright browser automation as the default standard. Always uses real browser rendering with JavaScript execution for accurate dynamic content extraction. Automatically downloads and installs Playwright browsers (~50MB) on first use.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"url": map[string]interface{}{
						"type":        "string",
						"description": "URL to fetch content from (e.g., 'https://example.com/article', 'https://docs.python.org/3/'). All sites including SPAs, React apps, and dynamic content are fully supported through browser automation.",
					},
				},
				"required": []string{"url"},
			},
		},
		{
			Name:        "read_document",
			Description: "Read and extract text content from various document formats including PDF, DOCX, XLSX, CSV, PPT, PPTX, TXT, RTF, and more. Supports both local file paths and remote URLs. Automatically detects document type and uses appropriate extraction methods to provide structured, readable text content. Perfect for document analysis, content extraction, and text processing from office files.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"path": map[string]interface{}{
						"type":        "string",
						"description": "File path to the document or URL to a remote document. Supports local paths (e.g., 'C:\\Documents\\file.pdf', '/home/user/document.docx') and remote URLs (e.g., 'https://example.com/document.pdf'). Automatically detects format from file extension.",
					},
					"extract_metadata": map[string]interface{}{
						"type":        "boolean",
						"description": "Whether to extract document metadata (author, creation date, etc.) along with content. Default: false",
						"default":     false,
					},
					"page_range": map[string]interface{}{
						"type":        "string",
						"description": "For PDFs and presentations: specify page range to extract (e.g., '1-5', '2,4,6', 'all'). Default: 'all'",
						"default":     "all",
					},
					"sheet_name": map[string]interface{}{
						"type":        "string",
						"description": "For Excel files: specify sheet name to extract. If not provided, extracts all sheets.",
					},
				},
				"required": []string{"path"},
			},
		},
		{
			Name:        "create_pdf",
			Description: "Create a PDF document from markdown or plain text content. Converts markdown formatting to styled PDF with proper headers, paragraphs, and basic formatting. Saves the PDF to the workspace directory and provides both a file path and clickable file URL that opens the document in the default PDF viewer. Perfect for generating reports, documentation, notes, or any text-based content in PDF format.",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"filename": map[string]interface{}{
						"type":        "string",
						"description": "Name for the PDF file (e.g., 'report.pdf', 'notes.pdf', 'document.pdf'). Will be saved in the MCP workspace directory. Extension .pdf will be added automatically if not provided.",
					},
					"content": map[string]interface{}{
						"type":        "string",
						"description": "Content to include in the PDF. Supports markdown formatting including headers (# ## ###), paragraphs, bold (**text**), italic (*text*), bullet points (- item), and numbered lists (1. item). Automatically handles line breaks and basic text formatting.",
					},
					"title": map[string]interface{}{
						"type":        "string",
						"description": "Optional title for the PDF document. Will be displayed as the main heading and set as document metadata. If not provided, uses the filename without extension.",
					},
					"author": map[string]interface{}{
						"type":        "string",
						"description": "Optional author name for the PDF metadata. Default: 'Clara MCP'",
						"default":     "Clara MCP",
					},
				},
				"required": []string{"filename", "content"},
			},
		},
	}
}

// Tool implementations

func (s *PythonMCPServer) py(params map[string]interface{}) string {
	code, ok := params["code"].(string)
	if !ok {
		return "ERROR: Need 'code'"
	}

	// Auto-print last expression if it looks like one
	lines := strings.Split(strings.TrimSpace(code), "\n")
	if len(lines) > 0 {
		last := strings.TrimSpace(lines[len(lines)-1])
		// Simple heuristic: if it doesn't look like a statement, print it
		if last != "" && !strings.Contains(last, "=") && !strings.HasPrefix(last, "print") &&
			!strings.HasPrefix(last, "if") && !strings.HasPrefix(last, "for") &&
			!strings.HasPrefix(last, "while") && !strings.HasPrefix(last, "def") &&
			!strings.HasPrefix(last, "class") && !strings.HasPrefix(last, "import") &&
			!strings.HasPrefix(last, "from") && !strings.HasPrefix(last, "return") &&
			!strings.HasPrefix(last, "try") && !strings.HasPrefix(last, "except") {
			lines[len(lines)-1] = fmt.Sprintf("print(%s)", last)
			code = strings.Join(lines, "\n")
		}
	}

	// Execute Python directly with -c flag using venv Python
	cmd := exec.Command(s.pythonPath, "-c", code)
	cmd.Dir = s.workspaceDir

	// Set environment to ensure venv is active
	cmd.Env = os.Environ()
	if runtime.GOOS == "windows" {
		cmd.Env = append(cmd.Env, fmt.Sprintf("VIRTUAL_ENV=%s", s.venvPath))
	}

	output, err := cmd.CombinedOutput()

	result := strings.TrimSpace(string(output))
	if err != nil {
		if result == "" {
			result = err.Error()
		}
		// Clean up common Python error formats
		if strings.Contains(result, "Traceback") {
			lines := strings.Split(result, "\n")
			if len(lines) > 0 {
				lastLine := lines[len(lines)-1]
				if strings.Contains(lastLine, "Error:") {
					result = lastLine
				}
			}
		}
		return fmt.Sprintf("ERROR: %s", result)
	}

	if result == "" {
		result = "OK (no output)"
	}
	return result
}

func (s *PythonMCPServer) sh(params map[string]interface{}) string {
	command, ok := params["cmd"].(string)
	if !ok {
		return "ERROR: Need 'cmd'"
	}

	var cmd *exec.Cmd

	// Special handling for Python/pip commands to use venv
	lowerCmd := strings.ToLower(command)
	if strings.HasPrefix(lowerCmd, "python ") || lowerCmd == "python" {
		// Replace python with venv python
		args := strings.Split(command, " ")[1:]
		cmd = exec.Command(s.pythonPath, args...)
	} else if strings.HasPrefix(lowerCmd, "pip ") || lowerCmd == "pip" {
		// Replace pip with venv pip
		args := strings.Split(command, " ")[1:]
		cmd = exec.Command(s.pipPath, args...)
	} else {
		// Regular shell command
		switch runtime.GOOS {
		case "windows":
			cmd = exec.Command("powershell", "-Command", command)
		default:
			cmd = exec.Command("sh", "-c", command)
		}
	}

	cmd.Dir = s.workspaceDir

	// Set environment to include venv
	cmd.Env = os.Environ()
	if runtime.GOOS == "windows" {
		cmd.Env = append(cmd.Env, fmt.Sprintf("VIRTUAL_ENV=%s", s.venvPath))
		// Update PATH to include venv Scripts
		for i, env := range cmd.Env {
			if strings.HasPrefix(env, "PATH=") || strings.HasPrefix(env, "Path=") {
				cmd.Env[i] = fmt.Sprintf("%s;%s", env, filepath.Join(s.venvPath, "Scripts"))
				break
			}
		}
	} else {
		cmd.Env = append(cmd.Env, fmt.Sprintf("VIRTUAL_ENV=%s", s.venvPath))
		// Update PATH to include venv bin
		for i, env := range cmd.Env {
			if strings.HasPrefix(env, "PATH=") {
				cmd.Env[i] = fmt.Sprintf("PATH=%s:%s", filepath.Join(s.venvPath, "bin"), strings.TrimPrefix(env, "PATH="))
				break
			}
		}
	}

	output, err := cmd.CombinedOutput()

	result := strings.TrimSpace(string(output))
	if err != nil {
		if result == "" {
			result = err.Error()
		}
		return fmt.Sprintf("ERROR: %s", result)
	}

	if result == "" {
		result = "OK"
	}
	return result
}

func (s *PythonMCPServer) pip(params map[string]interface{}) string {
	pkg, ok := params["pkg"].(string)
	if !ok {
		return "ERROR: Need 'pkg'"
	}

	// Use venv pip
	cmd := exec.Command(s.pipPath, "install", pkg)
	cmd.Dir = s.workspaceDir
	output, err := cmd.CombinedOutput()

	if err != nil {
		return fmt.Sprintf("ERROR: %s", strings.TrimSpace(string(output)))
	}

	return fmt.Sprintf("Installed %s in virtual environment", pkg)
}

func (s *PythonMCPServer) save(params map[string]interface{}) string {
	name, ok := params["name"].(string)
	if !ok {
		return "ERROR: Need 'name'"
	}

	text, ok := params["text"].(string)
	if !ok {
		return "ERROR: Need 'text'"
	}

	// Force save to workspace
	fullPath := filepath.Join(s.workspaceDir, filepath.Base(name))
	
	// Security check: ensure the file is within workspace directory
	workspaceAbs, _ := filepath.Abs(s.workspaceDir)
	fullPathAbs, _ := filepath.Abs(fullPath)
	if !strings.HasPrefix(fullPathAbs, workspaceAbs) {
		return "ERROR: Invalid file path - outside workspace directory"
	}

	if err := ioutil.WriteFile(fullPath, []byte(text), 0644); err != nil {
		return fmt.Sprintf("ERROR: %v", err)
	}

	return fmt.Sprintf("Saved %s (%d bytes)", filepath.Base(name), len(text))
}

func (s *PythonMCPServer) load(params map[string]interface{}) string {
	name, ok := params["name"].(string)
	if !ok {
		return "ERROR: Need 'name'"
	}

	// Look in workspace
	fullPath := filepath.Join(s.workspaceDir, filepath.Base(name))

	content, err := ioutil.ReadFile(fullPath)
	if err != nil {
		return fmt.Sprintf("ERROR: %v", err)
	}

	return string(content)
}

func (s *PythonMCPServer) ls(params map[string]interface{}) string {
	files, err := ioutil.ReadDir(s.workspaceDir)
	if err != nil {
		return fmt.Sprintf("ERROR: %v", err)
	}

	if len(files) == 0 {
		return "No files in workspace"
	}

	var items []string
	for _, f := range files {
		// Skip .venv directory in listing
		if f.Name() == ".venv" {
			continue
		}

		if f.IsDir() {
			items = append(items, fmt.Sprintf("[DIR] %s", f.Name()))
		} else {
			size := f.Size()
			unit := "B"
			if size > 1024*1024 {
				size = size / (1024 * 1024)
				unit = "MB"
			} else if size > 1024 {
				size = size / 1024
				unit = "KB"
			}
			items = append(items, fmt.Sprintf("%s (%d%s)", f.Name(), size, unit))
		}
	}

	if len(items) == 0 {
		return "No files in workspace (excluding .venv)"
	}

	return strings.Join(items, "\n")
}

func (s *PythonMCPServer) open(params map[string]interface{}) string {
	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("explorer", s.workspaceDir)
	case "darwin":
		cmd = exec.Command("open", s.workspaceDir)
	case "linux":
		if _, err := exec.LookPath("xdg-open"); err == nil {
			cmd = exec.Command("xdg-open", s.workspaceDir)
		} else if _, err := exec.LookPath("nautilus"); err == nil {
			cmd = exec.Command("nautilus", s.workspaceDir)
		} else if _, err := exec.LookPath("dolphin"); err == nil {
			cmd = exec.Command("dolphin", s.workspaceDir)
		} else if _, err := exec.LookPath("thunar"); err == nil {
			cmd = exec.Command("thunar", s.workspaceDir)
		} else {
			return "ERROR: No file manager found. Workspace at: " + s.workspaceDir
		}
	default:
		return "ERROR: Unsupported OS. Workspace at: " + s.workspaceDir
	}

	if err := cmd.Start(); err != nil {
		return fmt.Sprintf("ERROR: Failed to open folder: %v\nWorkspace at: %s", err, s.workspaceDir)
	}

	go func() {
		cmd.Wait()
	}()

	return fmt.Sprintf("Opened workspace folder: %s", s.workspaceDir)
}

// Embedded SearXNG and Web Content functionality

// NewSearXNGManager creates a new SearXNG manager
func NewSearXNGManager() *SearXNGManager {
	return &SearXNGManager{}
}

// NewWebContentFetcher creates a new web content fetcher with smart dynamic detection
func NewWebContentFetcher() *WebContentFetcher {
	return &WebContentFetcher{
		client: &http.Client{
			Timeout: 30 * time.Second,
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) >= 10 {
					return fmt.Errorf("too many redirects")
				}
				return nil
			},
		},
		jsEngine: &JSEngine{
			apiDetector: regexp.MustCompile(`(?i)(fetch\(|XMLHttpRequest|axios\.|$.ajax|$.get|$.post|api/|/api/|graphql)`),
			domSimulator: &DOMSimulator{
				virtualDOM: make(map[string]interface{}),
			},
		},
		smartMode:         true,
		playwrightManager: NewPlaywrightManager(),
	}
}

// CheckDockerInstalled checks if Docker is available
func (sm *SearXNGManager) CheckDockerInstalled() error {
	cmd := exec.Command("docker", "--version")
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("Docker is not installed or not running. Please install Docker Desktop and ensure it's running")
	}
	return nil
}

// CheckContainerExists checks if the SearXNG container exists
func (sm *SearXNGManager) CheckContainerExists() bool {
	cmd := exec.Command("docker", "ps", "-a", "--filter", fmt.Sprintf("name=%s", ContainerName), "--format", "{{.Names}}")
	output, err := cmd.Output()
	if err != nil {
		return false
	}
	return strings.TrimSpace(string(output)) == ContainerName
}

// CheckContainerRunning checks if the SearXNG container is running
func (sm *SearXNGManager) CheckContainerRunning() bool {
	cmd := exec.Command("docker", "ps", "--filter", fmt.Sprintf("name=%s", ContainerName), "--format", "{{.Names}}")
	output, err := cmd.Output()
	if err != nil {
		return false
	}
	return strings.TrimSpace(string(output)) == ContainerName
}

// CreateSearXNGConfig creates a proper SearXNG configuration
func (sm *SearXNGManager) CreateSearXNGConfig() error {
	configDir := "searxng-config"
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %v", err)
	}

	settingsContent := `# SearXNG settings for Clara MCP
use_default_settings: true

general:
  debug: false
  instance_name: "Clara SearXNG"
  contact_url: false
  enable_metrics: false

search:
  safe_search: 0
  autocomplete: ""
  default_lang: "en"
  ban_time_on_fail: 5
  max_ban_time_on_fail: 120
  formats:
    - html
    - json

server:
  port: 8080
  bind_address: "0.0.0.0"
  secret_key: "clara-secret-key-for-searxng"
  base_url: false
  image_proxy: true
  static_use_hash: false

ui:
  static_use_hash: false
  default_locale: "en"
  query_in_title: false
  infinite_scroll: false
  center_alignment: false
  cache_url: "https://web.archive.org/web/"
  search_on_category_select: true
  hotkeys: default

# Disable bot detection for local use
botdetection:
  ip_limit:
    filter_link_local: false
    link_token: false
  ip_lists:
    pass_searx_org: false
    pass_ip: []
    block_ip: []

# Enable all default engines
engines:
  - name: google
    engine: google
    use_mobile_ui: false

  - name: bing
    engine: bing

  - name: duckduckgo
    engine: duckduckgo
    
  - name: wikipedia
    engine: wikipedia

  - name: github
    engine: github

enabled_plugins:
  - 'Hash plugin'
  - 'Search on category select'
  - 'Self Information'
  - 'Tracker URL remover'
  - 'Ahmia blacklist'
`

	settingsPath := filepath.Join(configDir, "settings.yml")
	if err := ioutil.WriteFile(settingsPath, []byte(settingsContent), 0644); err != nil {
		return fmt.Errorf("failed to write settings.yml: %v", err)
	}

	// Create limiter.toml to avoid warnings
	limiterContent := `# SearXNG limiter configuration
[botdetection.ip_limit]
# Disable aggressive bot detection for local use
filter_link_local = false

[botdetection.ip_lists]
pass_ip = ["127.0.0.1", "::1", "192.168.0.0/16", "10.0.0.0/8", "172.16.0.0/12"]
`

	limiterPath := filepath.Join(configDir, "limiter.toml")
	if err := ioutil.WriteFile(limiterPath, []byte(limiterContent), 0644); err != nil {
		return fmt.Errorf("failed to write limiter.toml: %v", err)
	}

	fmt.Printf("✅ Created SearXNG configuration in %s\n", configDir)
	return nil
}

// StartContainer starts the SearXNG container
func (sm *SearXNGManager) StartContainer() error {
	if err := sm.CheckDockerInstalled(); err != nil {
		return err
	}

	// Check if container is already running
	if sm.CheckContainerRunning() {
		fmt.Println("✅ SearXNG container is already running")
		sm.isRunning = true
		return nil
	}

	// Create configuration first
	if err := sm.CreateSearXNGConfig(); err != nil {
		return fmt.Errorf("failed to create SearXNG config: %v", err)
	}

	// Pull image if not exists
	fmt.Println("🐳 Pulling SearXNG Docker image...")
	pullCmd := exec.Command("docker", "pull", SearXNGImage)
	if err := pullCmd.Run(); err != nil {
		return fmt.Errorf("failed to pull SearXNG image: %v", err)
	}

	// Get absolute path to config
	cwd, err := os.Getwd()
	if err != nil {
		return fmt.Errorf("failed to get working directory: %v", err)
	}
	configAbsPath := filepath.Join(cwd, "searxng-config")

	// Check if container exists but is stopped
	if sm.CheckContainerExists() {
		fmt.Println("🚀 Starting existing SearXNG container...")
		cmd := exec.Command("docker", "start", ContainerName)
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to start existing container: %v", err)
		}
	} else {
		// Create and start new container with proper configuration and volume mount
		fmt.Println("🚀 Creating and starting SearXNG container...")
		cmd := exec.Command("docker", "run", "-d",
			"--name", ContainerName,
			"-p", fmt.Sprintf("%s:8080", SearXNGPort),
			"-v", fmt.Sprintf("%s:/etc/searxng", configAbsPath),
			"-e", "SEARXNG_BASE_URL=http://localhost:8080/",
			"-e", "SEARXNG_SECRET=clara-secret-key-for-searxng",
			"--add-host=host.docker.internal:host-gateway", // For localhost access
			SearXNGImage)

		output, err := cmd.Output()
		if err != nil {
			return fmt.Errorf("failed to create container: %v", err)
		}
		sm.containerID = strings.TrimSpace(string(output))
	}

	// Wait for container to be healthy
	return sm.WaitForHealthy()
}

// WaitForHealthy waits for the SearXNG container to be ready
func (sm *SearXNGManager) WaitForHealthy() error {
	fmt.Println("⏳ Waiting for SearXNG to be ready...")

	timeout := 60 * time.Second
	start := time.Now()

	for time.Since(start) < timeout {
		if !sm.CheckContainerRunning() {
			time.Sleep(2 * time.Second)
			continue
		}

		client := &http.Client{Timeout: 5 * time.Second}
		resp, err := client.Get(SearXNGURL + "/")
		if err == nil && resp.StatusCode == 200 {
			resp.Body.Close()
			fmt.Println("✅ SearXNG is ready!")
			sm.isRunning = true
			return nil
		}
		if resp != nil {
			resp.Body.Close()
		}

		time.Sleep(2 * time.Second)
	}

	return fmt.Errorf("timeout waiting for SearXNG to be ready")
}

// SearchSearXNG performs a search using SearXNG
func (sm *SearXNGManager) SearchSearXNG(query string, numResults int) (*SearchResponse, error) {
	if !sm.isRunning && !sm.CheckContainerRunning() {
		return nil, fmt.Errorf("SearXNG container is not running")
	}

	if numResults <= 0 {
		numResults = 10
	}

	// Build search URL
	searchURL := fmt.Sprintf("%s%s?q=%s&format=json&pageno=1",
		SearXNGURL, SearchPath,
		strings.ReplaceAll(query, " ", "+"))

	fmt.Printf("🔍 Searching for: %s\n", query)

	// Perform HTTP request with proper headers for SearXNG
	client := &http.Client{Timeout: 30 * time.Second}
	req, err := http.NewRequest("GET", searchURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create search request: %v", err)
	}

	// Add headers to satisfy SearXNG bot detection
	req.Header.Set("User-Agent", "Clara-MCP-Client/1.0")
	req.Header.Set("Accept", "application/json, text/html")
	req.Header.Set("X-Forwarded-For", "127.0.0.1")
	req.Header.Set("X-Real-IP", "127.0.0.1")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("search request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("search failed with status %d: %s", resp.StatusCode, string(body))
	}

	// Parse JSON response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %v", err)
	}

	var searchResp SearchResponse
	if err := json.Unmarshal(body, &searchResp); err != nil {
		return nil, fmt.Errorf("failed to parse search response: %v", err)
	}

	// Limit results
	if len(searchResp.Results) > numResults {
		searchResp.Results = searchResp.Results[:numResults]
	}
	searchResp.NumberOfResults = len(searchResp.Results)

	fmt.Printf("✅ Found %d results\n", searchResp.NumberOfResults)
	return &searchResp, nil
}

// FetchContent fetches and extracts content from a URL using Playwright as the default standard
func (wf *WebContentFetcher) FetchContent(targetURL string) *WebContent {
	result := &WebContent{
		URL:             targetURL,
		LoadingStrategy: "playwright",
	}
	startTime := time.Now()

	// Validate URL
	parsedURL, err := url.Parse(targetURL)
	if err != nil {
		result.Error = fmt.Sprintf("Invalid URL: %v", err)
		return result
	}

	// Ensure URL has scheme
	if parsedURL.Scheme == "" {
		targetURL = "https://" + targetURL
		result.URL = targetURL
	}

	// PLAYWRIGHT-FIRST APPROACH: Always ensure Playwright is available
	log.Printf("Ensuring Playwright is available for %s", targetURL)

	// If Playwright is not available, force synchronous download
	if !wf.playwrightManager.IsAvailable() {
		log.Printf("Playwright not available, forcing synchronous download...")

		// Start download if not already downloading
		if !wf.playwrightManager.IsDownloading() {
			go wf.playwrightManager.EnsureAvailable()
		}

		// Wait for Playwright to become available (up to 120 seconds for reliable installation)
		maxWait := 120 * time.Second
		checkInterval := 1 * time.Second
		waited := time.Duration(0)

		log.Printf("Waiting for Playwright installation to complete...")
		for waited < maxWait && !wf.playwrightManager.IsAvailable() {
			if !wf.playwrightManager.IsDownloading() {
				downloadErr := wf.playwrightManager.GetDownloadError()
				if downloadErr != nil {
					result.Error = fmt.Sprintf("Playwright installation failed: %v", downloadErr)
					return result
				}
				// Download completed but not available - retry
				go wf.playwrightManager.EnsureAvailable()
			}
			time.Sleep(checkInterval)
			waited += checkInterval
			if waited%10*time.Second == 0 { // Log every 10 seconds
				log.Printf("Still waiting for Playwright... (%v/%v)", waited, maxWait)
			}
		}

		if !wf.playwrightManager.IsAvailable() {
			result.Error = "Playwright installation timed out. Please check your internet connection and try again."
			return result
		}

		log.Printf("Playwright installation completed successfully!")
	}

	// Use Playwright to fetch content
	playwrightResult, err := wf.playwrightManager.FetchContent(targetURL, nil)
	if err != nil {
		result.Error = fmt.Sprintf("Playwright content extraction failed: %v", err)
		return result
	}

	if playwrightResult == nil {
		result.Error = "Playwright returned no content"
		return result
	}

	// Update timing and return successful result
	playwrightResult.LoadTime = time.Since(startTime)
	playwrightResult.LoadingStrategy = "playwright"
	log.Printf("Successfully extracted content using Playwright for %s", targetURL)

	return playwrightResult
}

// fetchStatic performs standard static HTML fetching
func (wf *WebContentFetcher) fetchStatic(targetURL string) *WebContent {
	result := &WebContent{URL: targetURL}

	// Create request with proper headers
	req, err := http.NewRequest("GET", targetURL, nil)
	if err != nil {
		result.Error = fmt.Sprintf("Failed to create request: %v", err)
		return result
	}

	// Set realistic browser headers
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.5")
	req.Header.Set("Connection", "keep-alive")

	// Perform request
	resp, err := wf.client.Do(req)
	if err != nil {
		result.Error = fmt.Sprintf("Request failed: %v", err)
		return result
	}
	defer resp.Body.Close()

	result.StatusCode = resp.StatusCode

	// Check if response is successful
	if resp.StatusCode >= 400 {
		result.Error = fmt.Sprintf("HTTP error: %d %s", resp.StatusCode, resp.Status)
		return result
	}

	// Check content type
	contentType := resp.Header.Get("Content-Type")
	if !strings.Contains(strings.ToLower(contentType), "text/html") {
		result.Error = fmt.Sprintf("Content type not supported: %s", contentType)
		return result
	}

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		result.Error = fmt.Sprintf("Failed to read response: %v", err)
		return result
	}

	html := string(body)

	// Extract content
	result.Title = wf.extractTitle(html)
	result.Description = wf.extractDescription(html)
	result.Content = wf.extractTextContent(html)

	return result
}

// detectDynamicContent analyzes HTML for dynamic content indicators
func (wf *WebContentFetcher) detectDynamicContent(html string) bool {
	// Check for common SPA indicators
	spaIndicators := []string{
		"react", "vue", "angular", "svelte", "ember",
		"ng-app", "data-react", "v-if", "v-for",
		"useEffect", "useState", "componentDidMount",
		"spa-", "_next/", "__nuxt", "@angular",
	}

	htmlLower := strings.ToLower(html)
	for _, indicator := range spaIndicators {
		if strings.Contains(htmlLower, indicator) {
			return true
		}
	}

	// Check for AJAX/API calls
	if wf.jsEngine.apiDetector.MatchString(html) {
		return true
	}

	// Check for empty containers that typically get populated
	emptyContainers := regexp.MustCompile(`<div[^>]*(?:id|class)=['"](?:app|root|main|content|container)['"][^>]*>\s*</div>`)
	if emptyContainers.MatchString(html) {
		return true
	}

	// Check for loading indicators
	loadingIndicators := regexp.MustCompile(`(?i)(loading|spinner|skeleton|placeholder)`)
	if loadingIndicators.MatchString(html) {
		return true
	}

	return false
}

// simulateDynamicContent attempts to extract content by finding and calling APIs
func (wf *WebContentFetcher) simulateDynamicContent(baseURL, html string) *WebContent {
	result := &WebContent{URL: baseURL, IsDynamic: true}

	// Extract potential API endpoints
	apiEndpoints := wf.extractAPIEndpoints(baseURL, html)
	result.APIEndpoints = apiEndpoints

	// Try to fetch content from discovered APIs
	var additionalContent []string

	for _, endpoint := range apiEndpoints {
		if apiContent := wf.fetchAPIContent(endpoint); apiContent != "" {
			additionalContent = append(additionalContent, apiContent)
		}
	}

	// Combine static content with API content
	staticContent := wf.extractTextContent(html)
	if len(additionalContent) > 0 {
		allContent := append([]string{staticContent}, additionalContent...)
		result.Content = strings.Join(allContent, "\n\n--- API Content ---\n\n")
	} else {
		result.Content = staticContent
	}

	result.Title = wf.extractTitle(html)
	result.Description = wf.extractDescription(html)

	return result
}

// extractAPIEndpoints finds potential API endpoints in the HTML/JavaScript
func (wf *WebContentFetcher) extractAPIEndpoints(baseURL string, html string) []string {
	var endpoints []string

	// Parse base URL
	parsedBase, err := url.Parse(baseURL)
	if err != nil {
		return endpoints
	}

	// Common API patterns
	apiPatterns := []*regexp.Regexp{
		regexp.MustCompile(`['"]([^'"]*/?api/[^'"]*?)['"]`),
		regexp.MustCompile(`['"]([^'"]*?/v\d+/[^'"]*?)['"]`),
		regexp.MustCompile(`['"]([^'"]*?\.json[^'"]*?)['"]`),
		regexp.MustCompile(`fetch\(['"]([^'"]+?)['"]`),
		regexp.MustCompile(`axios\.get\(['"]([^'"]+?)['"]`),
	}

	for _, pattern := range apiPatterns {
		matches := pattern.FindAllStringSubmatch(html, -1)
		for _, match := range matches {
			if len(match) > 1 {
				endpoint := match[1]
				// Convert relative URLs to absolute
				if strings.HasPrefix(endpoint, "/") {
					endpoint = parsedBase.Scheme + "://" + parsedBase.Host + endpoint
				} else if !strings.HasPrefix(endpoint, "http") {
					continue // Skip relative paths that aren't root-relative
				}
				endpoints = append(endpoints, endpoint)
			}
		}
	}

	// Remove duplicates
	uniqueEndpoints := make(map[string]bool)
	var result []string
	for _, ep := range endpoints {
		if !uniqueEndpoints[ep] && len(result) < 5 { // Limit to 5 endpoints
			uniqueEndpoints[ep] = true
			result = append(result, ep)
		}
	}

	return result
}

// fetchAPIContent attempts to fetch content from an API endpoint
func (wf *WebContentFetcher) fetchAPIContent(endpoint string) string {
	req, err := http.NewRequest("GET", endpoint, nil)
	if err != nil {
		return ""
	}

	req.Header.Set("Accept", "application/json, text/plain, */*")
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; Clara-MCP)")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return ""
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return ""
	}

	// Try to extract meaningful text from JSON responses
	content := string(body)
	if strings.HasPrefix(strings.TrimSpace(content), "{") || strings.HasPrefix(strings.TrimSpace(content), "[") {
		// Basic JSON content extraction
		content = wf.extractTextFromJSON(content)
	}

	return content
}

// extractTextFromJSON extracts readable text from JSON responses
func (wf *WebContentFetcher) extractTextFromJSON(jsonStr string) string {
	var data interface{}
	if err := json.Unmarshal([]byte(jsonStr), &data); err != nil {
		return ""
	}

	var textParts []string
	wf.extractTextFromInterface(data, &textParts)

	return strings.Join(textParts, " ")
}

// extractTextFromInterface recursively extracts text from JSON interface
func (wf *WebContentFetcher) extractTextFromInterface(data interface{}, textParts *[]string) {
	switch v := data.(type) {
	case string:
		if len(v) > 10 && len(v) < 1000 { // Reasonable text length
			*textParts = append(*textParts, v)
		}
	case map[string]interface{}:
		for _, value := range v {
			wf.extractTextFromInterface(value, textParts)
		}
	case []interface{}:
		for _, item := range v {
			wf.extractTextFromInterface(item, textParts)
		}
	}
}

// enhancedStaticExtraction performs enhanced static content extraction
func (wf *WebContentFetcher) enhancedStaticExtraction(result *WebContent) *WebContent {
	// This could include more sophisticated text extraction,
	// meta tag analysis, structured data extraction, etc.
	return result
}

// extractTitle extracts the page title
func (wf *WebContentFetcher) extractTitle(html string) string {
	titleRegex := regexp.MustCompile(`(?i)<title[^>]*>([^<]*)</title>`)
	matches := titleRegex.FindStringSubmatch(html)
	if len(matches) > 1 {
		return strings.TrimSpace(wf.cleanText(matches[1]))
	}
	return ""
}

// extractDescription extracts meta description
func (wf *WebContentFetcher) extractDescription(html string) string {
	// Try meta description
	descRegex := regexp.MustCompile(`(?i)<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']*)["\']`)
	matches := descRegex.FindStringSubmatch(html)
	if len(matches) > 1 {
		return strings.TrimSpace(wf.cleanText(matches[1]))
	}

	// Try og:description
	ogDescRegex := regexp.MustCompile(`(?i)<meta[^>]*property=["\']og:description["\'][^>]*content=["\']([^"\']*)["\']`)
	matches = ogDescRegex.FindStringSubmatch(html)
	if len(matches) > 1 {
		return strings.TrimSpace(wf.cleanText(matches[1]))
	}

	return ""
}

// extractTextContent extracts main text content
func (wf *WebContentFetcher) extractTextContent(html string) string {
	// Remove script and style tags
	scriptRegex := regexp.MustCompile(`(?i)<script[^>]*>.*?</script>`)
	html = scriptRegex.ReplaceAllString(html, "")

	styleRegex := regexp.MustCompile(`(?i)<style[^>]*>.*?</style>`)
	html = styleRegex.ReplaceAllString(html, "")

	// Try to extract content from common content containers
	contentSelectors := []string{
		`(?i)<article[^>]*>(.*?)</article>`,
		`(?i)<main[^>]*>(.*?)</main>`,
		`(?i)<div[^>]*class=["\'][^"\']*content[^"\']*["\'][^>]*>(.*?)</div>`,
		`(?i)<p[^>]*>(.*?)</p>`,
	}

	var extractedText []string

	for _, selector := range contentSelectors {
		regex := regexp.MustCompile(selector)
		matches := regex.FindAllStringSubmatch(html, -1)
		for _, match := range matches {
			if len(match) > 1 {
				text := wf.cleanText(match[1])
				if len(text) > 50 {
					extractedText = append(extractedText, text)
				}
			}
		}
		if len(extractedText) > 0 {
			break
		}
	}

	// Fallback: extract all text content
	if len(extractedText) == 0 {
		tagRegex := regexp.MustCompile(`<[^>]*>`)
		text := tagRegex.ReplaceAllString(html, " ")
		extractedText = append(extractedText, wf.cleanText(text))
	}

	// Join and limit content
	content := strings.Join(extractedText, "\n\n")
	if len(content) > 2000 {
		content = content[:2000] + "..."
	}

	return content
}

// cleanText cleans extracted text
func (wf *WebContentFetcher) cleanText(text string) string {
	// Decode HTML entities
	text = strings.ReplaceAll(text, "&amp;", "&")
	text = strings.ReplaceAll(text, "&lt;", "<")
	text = strings.ReplaceAll(text, "&gt;", ">")
	text = strings.ReplaceAll(text, "&quot;", "\"")
	text = strings.ReplaceAll(text, "&#39;", "'")
	text = strings.ReplaceAll(text, "&nbsp;", " ")

	// Remove excessive whitespace
	spaceRegex := regexp.MustCompile(`\s+`)
	text = spaceRegex.ReplaceAllString(text, " ")

	return strings.TrimSpace(text)
}

// search performs web search using embedded SearXNG functionality
func (s *PythonMCPServer) search(params map[string]interface{}) string {
	query, ok := params["query"].(string)
	if !ok {
		return "ERROR: Need 'query' parameter"
	}

	// Get optional num_results parameter
	numResults := 10
	if nr, ok := params["num_results"].(float64); ok {
		numResults = int(nr)
		if numResults < 1 {
			numResults = 1
		} else if numResults > 20 {
			numResults = 20
		}
	}

	// Create SearXNG manager
	manager := NewSearXNGManager()

	// Start SearXNG container if not running
	wasRunning := manager.CheckContainerRunning()
	if !wasRunning {
		if err := manager.StartContainer(); err != nil {
			return fmt.Sprintf("ERROR: Failed to start SearXNG: %v", err)
		}
	}

	// Perform search
	results, err := manager.SearchSearXNG(query, numResults)
	if err != nil {
		return fmt.Sprintf("ERROR: Search failed: %v", err)
	}

	// Format results
	var output strings.Builder
	output.WriteString(fmt.Sprintf("🔍 SEARCH RESULTS for: %s\n", query))
	output.WriteString(fmt.Sprintf("📊 Found %d results\n", results.NumberOfResults))
	output.WriteString("⚡ Privacy-focused search via SearXNG\n\n")

	for i, result := range results.Results {
		output.WriteString(fmt.Sprintf("%d. %s\n", i+1, result.Title))
		output.WriteString(fmt.Sprintf("   🔗 %s\n", result.URL))
		if result.Content != "" {
			content := strings.TrimSpace(result.Content)
			if len(content) > 150 {
				content = content[:150] + "..."
			}
			output.WriteString(fmt.Sprintf("   📝 %s\n", content))
		}
		if result.Engine != "" {
			output.WriteString(fmt.Sprintf("   🔍 Source: %s\n", result.Engine))
		}
		output.WriteString("\n")
	}

	if len(results.Suggestions) > 0 {
		output.WriteString(fmt.Sprintf("� Suggestions: %s\n", strings.Join(results.Suggestions, ", ")))
	}

	return output.String()
}

// fetchContent fetches and extracts content from a web page using Playwright as the default standard
func (s *PythonMCPServer) fetchContent(params map[string]interface{}) string {
	url, ok := params["url"].(string)
	if !ok {
		return "ERROR: Need 'url' parameter"
	}

	// Create web content fetcher (always uses Playwright as default)
	fetcher := NewWebContentFetcher()

	// Fetch content using Playwright
	result := fetcher.FetchContent(url)

	if result.Error != "" {
		return fmt.Sprintf("ERROR: %s", result.Error)
	}

	// Format output
	var output strings.Builder
	output.WriteString(fmt.Sprintf("🌐 WEB CONTENT EXTRACTED from: %s\n", result.URL))
	output.WriteString(fmt.Sprintf("✅ Successfully fetched content (Status: %d)\n", result.StatusCode))

	// Show loading strategy used
	strategyIcon := "📄"
	if result.IsDynamic {
		strategyIcon = "⚡"
	}
	output.WriteString(fmt.Sprintf("%s Strategy: %s (Load time: %v)\n", strategyIcon, result.LoadingStrategy, result.LoadTime))

	if result.IsDynamic {
		output.WriteString("🔍 Dynamic content detected - used intelligent API simulation\n")
		if len(result.APIEndpoints) > 0 {
			output.WriteString(fmt.Sprintf("🔗 Discovered %d API endpoints\n", len(result.APIEndpoints)))
		}
	}
	output.WriteString("\n")

	if result.Title != "" {
		output.WriteString(fmt.Sprintf("📰 Title: %s\n\n", result.Title))
	}

	if result.Description != "" {
		output.WriteString(fmt.Sprintf("📝 Description: %s\n\n", result.Description))
	}

	if result.Content != "" {
		output.WriteString(fmt.Sprintf("📄 Content:\n%s\n", result.Content))
	}

	return output.String()
}

// readDocument reads and extracts content from various document formats
func (s *PythonMCPServer) readDocument(params map[string]interface{}) string {
	path, ok := params["path"].(string)
	if !ok {
		return "ERROR: Need 'path' parameter"
	}

	// Check optional parameters
	extractMetadata := false
	if meta, ok := params["extract_metadata"].(bool); ok {
		extractMetadata = meta
	}

	pageRange := "all"
	if pr, ok := params["page_range"].(string); ok {
		pageRange = pr
	}

	sheetName := ""
	if sn, ok := params["sheet_name"].(string); ok {
		sheetName = sn
	}

	// Prepare Python script for document reading
	scriptTemplate := `
import sys
import os
import json
import traceback
from pathlib import Path
import urllib.request
import tempfile

# Document processing libraries will be imported as needed
def safe_import(module_name, pip_name=None):
    try:
        return __import__(module_name)
    except ImportError:
        if pip_name:
            import subprocess
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', pip_name])
            return __import__(module_name)
        return None

def read_document(file_path, extract_metadata=False, page_range="all", sheet_name=None):
    result = {
        "content": "",
        "metadata": {},
        "format": "",
        "pages": 0,
        "error": None
    }
    
    try:
        # Handle URLs by downloading to temp file
        temp_file = None
        if file_path.startswith(('http://', 'https://')):
            print(f"Downloading document from URL: {file_path}")
            # Create temp file in current working directory (workspace)
            temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=Path(file_path).suffix, dir=os.getcwd())
            urllib.request.urlretrieve(file_path, temp_file.name)
            file_path = temp_file.name
        
        # Check if file exists
        if not os.path.exists(file_path):
            result["error"] = f"File not found: {file_path}"
            return result
        
        # Detect file format
        file_ext = Path(file_path).suffix.lower()
        result["format"] = file_ext
        
        print(f"Processing {file_ext} document: {os.path.basename(file_path)}")
        
        # Process based on file type
        if file_ext == '.pdf':
            result = read_pdf(file_path, extract_metadata, page_range, result)
        elif file_ext in ['.docx', '.doc']:
            result = read_word(file_path, extract_metadata, result)
        elif file_ext in ['.xlsx', '.xls']:
            result = read_excel(file_path, extract_metadata, sheet_name, result)
        elif file_ext == '.csv':
            result = read_csv(file_path, result)
        elif file_ext in ['.pptx', '.ppt']:
            result = read_powerpoint(file_path, extract_metadata, page_range, result)
        elif file_ext == '.txt':
            result = read_text(file_path, result)
        elif file_ext == '.rtf':
            result = read_rtf(file_path, result)
        elif file_ext in ['.odt', '.ods', '.odp']:
            result = read_libreoffice(file_path, extract_metadata, result)
        elif file_ext == '.json':
            result = read_json(file_path, result)
        elif file_ext in ['.xml', '.html', '.htm']:
            result = read_markup(file_path, result)
        else:
            result["error"] = f"Unsupported file format: {file_ext}. Supported formats: PDF, DOCX, DOC, XLSX, XLS, CSV, PPTX, PPT, TXT, RTF, ODT, ODS, ODP, JSON, XML, HTML"
        
        # Cleanup temp file
        if temp_file:
            os.unlink(temp_file.name)
            
    except Exception as e:
        result["error"] = f"Error processing document: {str(e)}\n{traceback.format_exc()}"
    
    return result

def read_pdf(file_path, extract_metadata, page_range, result):
    try:
        # Try PyPDF2 first, fallback to pdfplumber
        PyPDF2 = safe_import('PyPDF2', 'PyPDF2')
        if not PyPDF2:
            pdfplumber = safe_import('pdfplumber', 'pdfplumber')
            if pdfplumber:
                return read_pdf_pdfplumber(file_path, extract_metadata, page_range, result)
            else:
                result["error"] = "Could not import PDF processing libraries"
                return result
        
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            result["pages"] = len(pdf_reader.pages)
            
            if extract_metadata and pdf_reader.metadata:
                result["metadata"] = {
                    "title": pdf_reader.metadata.get('/Title', ''),
                    "author": pdf_reader.metadata.get('/Author', ''),
                    "subject": pdf_reader.metadata.get('/Subject', ''),
                    "creator": pdf_reader.metadata.get('/Creator', ''),
                    "creation_date": str(pdf_reader.metadata.get('/CreationDate', '')),
                    "modification_date": str(pdf_reader.metadata.get('/ModDate', ''))
                }
            
            # Parse page range
            pages_to_extract = parse_page_range(page_range, result["pages"])
            
            content_parts = []
            for page_num in pages_to_extract:
                if 0 <= page_num < len(pdf_reader.pages):
                    page = pdf_reader.pages[page_num]
                    text = page.extract_text()
                    if text.strip():
                        content_parts.append(f"--- Page {page_num + 1} ---\n{text}")
            
            result["content"] = "\n\n".join(content_parts)
            
    except Exception as e:
        result["error"] = f"PDF processing error: {str(e)}"
    
    return result

def read_pdf_pdfplumber(file_path, extract_metadata, page_range, result):
    try:
        pdfplumber = safe_import('pdfplumber', 'pdfplumber')
        
        with pdfplumber.open(file_path) as pdf:
            result["pages"] = len(pdf.pages)
            
            if extract_metadata and pdf.metadata:
                result["metadata"] = dict(pdf.metadata)
            
            pages_to_extract = parse_page_range(page_range, result["pages"])
            
            content_parts = []
            for page_num in pages_to_extract:
                if 0 <= page_num < len(pdf.pages):
                    page = pdf.pages[page_num]
                    text = page.extract_text()
                    if text and text.strip():
                        content_parts.append(f"--- Page {page_num + 1} ---\n{text}")
            
            result["content"] = "\n\n".join(content_parts)
            
    except Exception as e:
        result["error"] = f"PDF processing error: {str(e)}"
    
    return result

def read_word(file_path, extract_metadata, result):
    try:
        python_docx = safe_import('docx', 'python-docx')
        if not python_docx:
            result["error"] = "Could not import python-docx library"
            return result
        
        doc = python_docx.Document(file_path)
        
        if extract_metadata:
            props = doc.core_properties
            result["metadata"] = {
                "title": props.title or '',
                "author": props.author or '',
                "subject": props.subject or '',
                "created": str(props.created) if props.created else '',
                "modified": str(props.modified) if props.modified else '',
                "keywords": props.keywords or ''
            }
        
        content_parts = []
        for para in doc.paragraphs:
            text = para.text.strip()
            if text:
                content_parts.append(text)
        
        result["content"] = "\n\n".join(content_parts)
        result["pages"] = len(doc.paragraphs)
        
    except Exception as e:
        result["error"] = f"Word document processing error: {str(e)}"
    
    return result

def read_excel(file_path, extract_metadata, sheet_name, result):
    try:
        pandas = safe_import('pandas', 'pandas openpyxl xlrd')
        if not pandas:
            result["error"] = "Could not import pandas library"
            return result
        
        # Read Excel file
        if sheet_name:
            df = pandas.read_excel(file_path, sheet_name=sheet_name)
            content_parts = [f"Sheet: {sheet_name}\n{df.to_string(index=False)}"]
        else:
            excel_file = pandas.ExcelFile(file_path)
            content_parts = []
            for sheet in excel_file.sheet_names:
                df = pandas.read_excel(file_path, sheet_name=sheet)
                content_parts.append(f"Sheet: {sheet}\n{df.to_string(index=False)}")
        
        result["content"] = "\n\n" + "="*50 + "\n\n".join(content_parts)
        result["pages"] = len(content_parts)
        
        if extract_metadata:
            result["metadata"] = {
                "sheets": excel_file.sheet_names if not sheet_name else [sheet_name],
                "total_sheets": len(excel_file.sheet_names)
            }
        
    except Exception as e:
        result["error"] = f"Excel processing error: {str(e)}"
    
    return result

def read_csv(file_path, result):
    try:
        pandas = safe_import('pandas', 'pandas')
        if not pandas:
            # Fallback to built-in csv
            import csv
            content_parts = []
            with open(file_path, 'r', encoding='utf-8', newline='') as file:
                csv_reader = csv.reader(file)
                for i, row in enumerate(csv_reader):
                    content_parts.append(" | ".join(row))
            result["content"] = "\n".join(content_parts)
        else:
            df = pandas.read_csv(file_path)
            result["content"] = df.to_string(index=False)
        
        result["pages"] = 1
        
    except Exception as e:
        result["error"] = f"CSV processing error: {str(e)}"
    
    return result

def read_powerpoint(file_path, extract_metadata, page_range, result):
    try:
        python_pptx = safe_import('pptx', 'python-pptx')
        if not python_pptx:
            result["error"] = "Could not import python-pptx library"
            return result
        
        from pptx import Presentation
        
        prs = Presentation(file_path)
        result["pages"] = len(prs.slides)
        
        if extract_metadata:
            props = prs.core_properties
            result["metadata"] = {
                "title": props.title or '',
                "author": props.author or '',
                "subject": props.subject or '',
                "created": str(props.created) if props.created else '',
                "modified": str(props.modified) if props.modified else ''
            }
        
        pages_to_extract = parse_page_range(page_range, result["pages"])
        
        content_parts = []
        for slide_num in pages_to_extract:
            if 0 <= slide_num < len(prs.slides):
                slide = prs.slides[slide_num]
                slide_text = []
                
                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text.strip():
                        slide_text.append(shape.text)
                
                if slide_text:
                    content_parts.append(f"--- Slide {slide_num + 1} ---\n" + "\n".join(slide_text))
        
        result["content"] = "\n\n".join(content_parts)
        
    except Exception as e:
        result["error"] = f"PowerPoint processing error: {str(e)}"
    
    return result

def read_text(file_path, result):
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            result["content"] = file.read()
        result["pages"] = 1
    except UnicodeDecodeError:
        try:
            with open(file_path, 'r', encoding='latin-1') as file:
                result["content"] = file.read()
            result["pages"] = 1
        except Exception as e:
            result["error"] = f"Text file processing error: {str(e)}"
    except Exception as e:
        result["error"] = f"Text file processing error: {str(e)}"
    
    return result

def read_rtf(file_path, result):
    try:
        striprtf = safe_import('striprtf', 'striprtf')
        if not striprtf:
            result["error"] = "Could not import striprtf library"
            return result
        
        from striprtf.striprtf import rtf_to_text
        
        with open(file_path, 'r', encoding='utf-8') as file:
            rtf_content = file.read()
        
        result["content"] = rtf_to_text(rtf_content)
        result["pages"] = 1
        
    except Exception as e:
        result["error"] = f"RTF processing error: {str(e)}"
    
    return result

def read_libreoffice(file_path, extract_metadata, result):
    try:
        # Try to use python-uno for LibreOffice files
        result["error"] = "LibreOffice document support requires additional setup. Please convert to DOCX/PDF format."
        return result
    except Exception as e:
        result["error"] = f"LibreOffice processing error: {str(e)}"
    
    return result

def read_json(file_path, result):
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            data = json.load(file)
        
        # Pretty print JSON content
        result["content"] = json.dumps(data, indent=2, ensure_ascii=False)
        result["pages"] = 1
        
    except Exception as e:
        result["error"] = f"JSON processing error: {str(e)}"
    
    return result

def read_markup(file_path, result):
    try:
        BeautifulSoup = safe_import('bs4', 'beautifulsoup4').BeautifulSoup
        
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        if file_path.lower().endswith(('.html', '.htm')):
            soup = BeautifulSoup(content, 'html.parser')
            # Extract text content
            result["content"] = soup.get_text(separator='\n', strip=True)
        else:
            # For XML, just return pretty-printed content
            soup = BeautifulSoup(content, 'xml')
            result["content"] = soup.prettify()
        
        result["pages"] = 1
        
    except Exception as e:
        # Fallback to raw text
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                result["content"] = file.read()
            result["pages"] = 1
        except Exception as e2:
            result["error"] = f"Markup processing error: {str(e2)}"
    
    return result

def parse_page_range(page_range, total_pages):
    if page_range == "all" or not page_range:
        return list(range(total_pages))
    
    pages = []
    for part in page_range.split(','):
        part = part.strip()
        if '-' in part:
            start, end = map(int, part.split('-'))
            pages.extend(range(start - 1, min(end, total_pages)))
        else:
            page_num = int(part) - 1
            if 0 <= page_num < total_pages:
                pages.append(page_num)
    
    return sorted(set(pages))

# Main execution
try:
    result = read_document("%s", %s, "%s", %s)
    print("RESULT_START")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    print("RESULT_END")
except Exception as e:
    error_result = {"error": f"Script execution error: {str(e)}", "content": "", "metadata": {}, "format": "", "pages": 0}
    print("RESULT_START")
    print(json.dumps(error_result, indent=2, ensure_ascii=False))
    print("RESULT_END")
`

	// Format the script with parameters
	metadataStr := "False"
	if extractMetadata {
		metadataStr = "True"
	}

	sheetNameParam := "None"
	if sheetName != "" {
		sheetNameParam = fmt.Sprintf(`"%s"`, sheetName)
	}

	// Escape the path for Python string literal (handle Windows backslashes)
	escapedPath := strings.ReplaceAll(path, `\`, `\\`)

	script := fmt.Sprintf(scriptTemplate, escapedPath, metadataStr, pageRange, sheetNameParam)

	// Execute the Python script
	cmd := exec.Command(s.pythonPath, "-c", script)
	cmd.Dir = s.workspaceDir
	cmd.Env = os.Environ()
	if runtime.GOOS == "windows" {
		cmd.Env = append(cmd.Env, fmt.Sprintf("VIRTUAL_ENV=%s", s.venvPath))
	}
	
	// Ensure working directory is set correctly
	if cmd.Dir == "" || cmd.Dir == "/" {
		cmd.Dir = s.workspaceDir
	}

	output, err := cmd.CombinedOutput()
	outputStr := string(output)

	if err != nil {
		// Try to extract any error information from the output
		if strings.Contains(outputStr, "RESULT_START") {
			// Script ran but had an error in document processing
			start := strings.Index(outputStr, "RESULT_START") + len("RESULT_START")
			end := strings.Index(outputStr, "RESULT_END")
			if end > start {
				jsonStr := strings.TrimSpace(outputStr[start:end])
				var result map[string]interface{}
				if json.Unmarshal([]byte(jsonStr), &result) == nil {
					if errorMsg, ok := result["error"].(string); ok && errorMsg != "" {
						return fmt.Sprintf("ERROR: %s", errorMsg)
					}
				}
			}
		}
		return fmt.Sprintf("ERROR: Script execution failed: %v\nOutput: %s", err, outputStr)
	}

	// Parse the result from the script output
	start := strings.Index(outputStr, "RESULT_START")
	end := strings.Index(outputStr, "RESULT_END")

	if start == -1 || end == -1 {
		return fmt.Sprintf("ERROR: Could not parse script output\nOutput: %s", outputStr)
	}

	start += len("RESULT_START")
	jsonStr := strings.TrimSpace(outputStr[start:end])

	var result map[string]interface{}
	if err := json.Unmarshal([]byte(jsonStr), &result); err != nil {
		return fmt.Sprintf("ERROR: Could not parse JSON result: %v\nJSON: %s", err, jsonStr)
	}

	// Check for errors in the result
	if errorMsg, ok := result["error"].(string); ok && errorMsg != "" {
		return fmt.Sprintf("ERROR: %s", errorMsg)
	}

	// Format the successful result
	var output_builder strings.Builder

	format, _ := result["format"].(string)
	pages := int(result["pages"].(float64))
	content, _ := result["content"].(string)
	metadata, _ := result["metadata"].(map[string]interface{})

	output_builder.WriteString("📄 DOCUMENT READER RESULTS\n")
	output_builder.WriteString("==========================\n\n")
	output_builder.WriteString(fmt.Sprintf("📂 File: %s\n", filepath.Base(path)))
	output_builder.WriteString(fmt.Sprintf("📋 Format: %s\n", strings.ToUpper(strings.TrimPrefix(format, "."))))
	output_builder.WriteString(fmt.Sprintf("📊 Pages/Sections: %d\n", pages))
	output_builder.WriteString(fmt.Sprintf("📝 Content Length: %d characters\n", len(content)))

	if extractMetadata && len(metadata) > 0 {
		output_builder.WriteString("\n📋 METADATA\n")
		output_builder.WriteString("===========\n")
		for key, value := range metadata {
			if valueStr, ok := value.(string); ok && valueStr != "" {
				output_builder.WriteString(fmt.Sprintf("%s: %s\n", strings.Title(key), valueStr))
			}
		}
	}

	output_builder.WriteString("\n📄 CONTENT\n")
	output_builder.WriteString("==========\n")

	if len(content) > 0 {
		// Limit content display if too long
		if len(content) > 10000 {
			output_builder.WriteString(content[:10000])
			output_builder.WriteString(fmt.Sprintf("\n\n... [Content truncated - showing first 10,000 characters of %d total]", len(content)))
		} else {
			output_builder.WriteString(content)
		}
	} else {
		output_builder.WriteString("No readable content found in the document.")
	}

	return output_builder.String()
}

// createPDF creates a PDF document from markdown content using Go PDF library
func (s *PythonMCPServer) createPDF(params map[string]interface{}) string {
	filename, ok := params["filename"].(string)
	if !ok {
		return "ERROR: Need 'filename' parameter"
	}

	content, ok := params["content"].(string)
	if !ok {
		return "ERROR: Need 'content' parameter"
	}

	// Get optional parameters
	title := ""
	if t, ok := params["title"].(string); ok {
		title = t
	}
	if title == "" {
		// Use filename without extension as title
		title = strings.TrimSuffix(filepath.Base(filename), filepath.Ext(filename))
	}

	author := "Clara MCP"
	if a, ok := params["author"].(string); ok && a != "" {
		author = a
	}

	// Ensure filename has .pdf extension
	if !strings.HasSuffix(strings.ToLower(filename), ".pdf") {
		filename = filename + ".pdf"
	}

	// Create full path in workspace - ensure it's within workspace
	fullPath := filepath.Join(s.workspaceDir, filepath.Base(filename))
	
	// Security check: ensure the file is within workspace directory
	workspaceAbs, _ := filepath.Abs(s.workspaceDir)
	fullPathAbs, _ := filepath.Abs(fullPath)
	if !strings.HasPrefix(fullPathAbs, workspaceAbs) {
		return "ERROR: Invalid file path - outside workspace directory"
	}

	// Create PDF
	pdf := gofpdf.New("P", "mm", "A4", "")
	pdf.SetCreator("Clara MCP", true)
	pdf.SetAuthor(author, true)
	pdf.SetTitle(title, true)
	pdf.SetSubject("Document created by Clara MCP", true)

	// Add page
	pdf.AddPage()

	// Set font
	pdf.SetFont("Arial", "", 12)

	// Add title if provided
	if title != "" {
		pdf.SetFont("Arial", "B", 16)
		pdf.Cell(0, 10, title)
		pdf.Ln(15)
		pdf.SetFont("Arial", "", 12)
	}

	// Process content - convert markdown-like formatting to PDF
	lines := strings.Split(content, "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)

		if line == "" {
			pdf.Ln(5) // Empty line spacing
			continue
		}

		// Handle markdown headers
		if strings.HasPrefix(line, "# ") {
			pdf.Ln(5)
			pdf.SetFont("Arial", "B", 14)
			pdf.Cell(0, 8, strings.TrimPrefix(line, "# "))
			pdf.Ln(10)
			pdf.SetFont("Arial", "", 12)
		} else if strings.HasPrefix(line, "## ") {
			pdf.Ln(3)
			pdf.SetFont("Arial", "B", 13)
			pdf.Cell(0, 8, strings.TrimPrefix(line, "## "))
			pdf.Ln(8)
			pdf.SetFont("Arial", "", 12)
		} else if strings.HasPrefix(line, "### ") {
			pdf.Ln(2)
			pdf.SetFont("Arial", "B", 12)
			pdf.Cell(0, 7, strings.TrimPrefix(line, "### "))
			pdf.Ln(7)
			pdf.SetFont("Arial", "", 12)
		} else if strings.HasPrefix(line, "- ") || strings.HasPrefix(line, "* ") {
			// Bullet points
			pdf.Cell(10, 6, "•")
			s.addTextWithFormatting(pdf, strings.TrimPrefix(strings.TrimPrefix(line, "- "), "* "))
			pdf.Ln(6)
		} else if regexp.MustCompile(`^\d+\.\s`).MatchString(line) {
			// Numbered lists
			parts := regexp.MustCompile(`^(\d+\.\s)(.*)`).FindStringSubmatch(line)
			if len(parts) == 3 {
				pdf.Cell(10, 6, parts[1])
				s.addTextWithFormatting(pdf, parts[2])
				pdf.Ln(6)
			}
		} else {
			// Regular paragraph
			s.addTextWithFormatting(pdf, line)
			pdf.Ln(6)
		}
	}

	// Save PDF
	err := pdf.OutputFileAndClose(fullPath)
	if err != nil {
		return fmt.Sprintf("ERROR: Failed to save PDF: %v", err)
	}

	// Get file info
	fileInfo, err := os.Stat(fullPath)
	if err != nil {
		return fmt.Sprintf("ERROR: Failed to get file info: %v", err)
	}

	// Create file URL for different operating systems
	var fileURL string
	switch runtime.GOOS {
	case "windows":
		fileURL = "file:///" + strings.ReplaceAll(fullPath, "\\", "/")
	default:
		fileURL = "file://" + fullPath
	}

	// Format result
	var output strings.Builder
	output.WriteString("📄 PDF CREATED SUCCESSFULLY\n")
	output.WriteString("==========================\n\n")
	output.WriteString(fmt.Sprintf("📁 File: %s\n", filepath.Base(fullPath)))
	output.WriteString(fmt.Sprintf("📍 Location: %s\n", fullPath))
	output.WriteString(fmt.Sprintf("🔗 Click to open: %s\n", fileURL))
	output.WriteString(fmt.Sprintf("📊 Size: %.2f KB\n", float64(fileInfo.Size())/1024))
	output.WriteString(fmt.Sprintf("📝 Title: %s\n", title))
	output.WriteString(fmt.Sprintf("👤 Author: %s\n", author))
	output.WriteString(fmt.Sprintf("📅 Created: %s\n", fileInfo.ModTime().Format("2006-01-02 15:04:05")))
	output.WriteString("\nThe PDF has been saved to your workspace and can be opened by clicking the file URL above.")

	return output.String()
}

// addTextWithFormatting adds text to PDF with basic markdown formatting
func (s *PythonMCPServer) addTextWithFormatting(pdf *gofpdf.Fpdf, text string) {
	// Handle bold **text**
	boldRegex := regexp.MustCompile(`\*\*(.*?)\*\*`)
	// Handle italic *text*
	italicRegex := regexp.MustCompile(`\*(.*?)\*`)

	// Simple approach: for now, just remove formatting markers
	// A more sophisticated implementation would properly handle formatting
	text = boldRegex.ReplaceAllString(text, "$1")
	text = italicRegex.ReplaceAllString(text, "$1")

	// Split long lines to fit page width
	maxWidth := 180.0 // mm
	words := strings.Fields(text)

	currentLine := ""
	for _, word := range words {
		testLine := currentLine
		if testLine != "" {
			testLine += " "
		}
		testLine += word

		// Check if line fits
		lineWidth := pdf.GetStringWidth(testLine)
		if lineWidth > maxWidth && currentLine != "" {
			// Output current line and start new one
			pdf.Cell(0, 6, currentLine)
			pdf.Ln(6)
			currentLine = word
		} else {
			currentLine = testLine
		}
	}

	// Output remaining text
	if currentLine != "" {
		pdf.Cell(0, 6, currentLine)
	}
}

// playwrightStatus shows the current status of Playwright integration
func (s *PythonMCPServer) playwrightStatus(params map[string]interface{}) string {
	// Create web content fetcher to access Playwright manager
	fetcher := NewWebContentFetcher()

	var output strings.Builder
	output.WriteString("🎭 PLAYWRIGHT STATUS\n")
	output.WriteString("==================\n\n")

	// Get Playwright capabilities
	capabilities := fetcher.playwrightManager.GetCapabilities()

	// Parse capabilities
	isAvailable, _ := capabilities["is_available"].(bool)
	isDownloading, _ := capabilities["is_downloading"].(bool)
	hasLibrary, _ := capabilities["has_playwright_lib"].(bool)
	downloadStatus, _ := capabilities["download_status"].(string)
	estimatedSize, _ := capabilities["estimated_size"].(string)

	// Status overview
	statusIcon := "❌"
	if isAvailable {
		statusIcon = "✅"
	} else if isDownloading {
		statusIcon = "⬇️"
	}

	output.WriteString(fmt.Sprintf("%s Overall Status: %s\n", statusIcon, downloadStatus))
	output.WriteString(fmt.Sprintf("📚 Playwright Library: %s\n", map[bool]string{true: "Available", false: "Not Available"}[hasLibrary]))

	if estimatedSize != "" {
		output.WriteString(fmt.Sprintf("💾 Download Size: %s\n", estimatedSize))
	}

	output.WriteString("\n🔧 CAPABILITIES\n")
	output.WriteString("===============\n")

	jsExecution, _ := capabilities["javascript_execution"].(bool)
	networkInterception, _ := capabilities["network_interception"].(bool)
	screenshotCapture, _ := capabilities["screenshot_capture"].(bool)

	output.WriteString(fmt.Sprintf("⚡ JavaScript Execution: %s\n", map[bool]string{true: "✅ Available", false: "❌ Not Available"}[jsExecution]))
	output.WriteString(fmt.Sprintf("🌐 Network Interception: %s\n", map[bool]string{true: "✅ Available", false: "❌ Not Available"}[networkInterception]))
	output.WriteString(fmt.Sprintf("📸 Screenshot Capture: %s\n", map[bool]string{true: "✅ Available", false: "❌ Not Available"}[screenshotCapture]))

	output.WriteString("\n🎯 PLAYWRIGHT STANDARD\n")
	output.WriteString("=========================\n")

	if isAvailable {
		output.WriteString("✅ Playwright is ready and active\n")
		output.WriteString("✅ All web content uses full browser automation\n")
		output.WriteString("✅ JavaScript execution and dynamic content fully supported\n")
	} else if isDownloading {
		output.WriteString("⬇️ Playwright is installing automatically...\n")
		output.WriteString("⏳ Content requests will wait for installation to complete\n")
		output.WriteString("� Once ready, all content will use browser automation\n")
	} else {
		output.WriteString("� Playwright installation required for content fetching\n")
		output.WriteString("� Will auto-install on first content request (~50MB)\n")
		output.WriteString("� No fallback modes - Playwright is the standard\n")
		if !hasLibrary {
			output.WriteString("📦 Playwright library needs to be installed\n")
		}
	}

	// Error information
	if downloadErrorRaw := capabilities["download_error"]; downloadErrorRaw != nil {
		output.WriteString(fmt.Sprintf("\n⚠️ NOTICE\n========\n%v\n", downloadErrorRaw))
	}

	// Installation information
	installStatus := fetcher.playwrightManager.GetInstallationStatus()
	version := fetcher.playwrightManager.Version()

	output.WriteString("\n📋 TECHNICAL DETAILS\n")
	output.WriteString("==================\n")

	managerVersion, _ := version["manager_version"].(string)
	implementation, _ := version["implementation"].(string)

	output.WriteString(fmt.Sprintf("Manager Version: %s\n", managerVersion))
	output.WriteString(fmt.Sprintf("Implementation: %s\n", implementation))

	currentlyDownloading, _ := installStatus["currently_downloading"].(bool)
	browsersInstalled, _ := installStatus["browsers_installed"].(bool)

	output.WriteString(fmt.Sprintf("Browsers Installed: %s\n", map[bool]string{true: "Yes", false: "No"}[browsersInstalled]))
	output.WriteString(fmt.Sprintf("Currently Downloading: %s\n", map[bool]string{true: "Yes", false: "No"}[currentlyDownloading]))

	return output.String()
}

// handleRequest processes requests
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
				"name":    "python-mcp",
				"version": "5.1.0",
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

		var result string
		switch params.Name {
		case "py":
			result = s.py(params.Arguments)
		case "sh", "powershell": // Support both for compatibility
			result = s.sh(params.Arguments)
		case "pip":
			result = s.pip(params.Arguments)
		case "save":
			result = s.save(params.Arguments)
		case "load":
			result = s.load(params.Arguments)
		case "ls":
			result = s.ls(params.Arguments)
		case "open":
			result = s.open(params.Arguments)
		case "search":
			result = s.search(params.Arguments)
		case "fetch_content":
			result = s.fetchContent(params.Arguments)
		case "read_document":
			result = s.readDocument(params.Arguments)
		case "create_pdf":
			result = s.createPDF(params.Arguments)
		default:
			resp.Error = &MCPError{Code: -32603, Message: "Unknown tool"}
			return resp
		}

		resp.Result = map[string]interface{}{
			"content": []map[string]interface{}{
				{
					"type": "text",
					"text": result,
				},
			},
		}

	default:
		resp.Error = &MCPError{Code: -32601, Message: "Method not found"}
	}

	return resp
}

// runServer main loop
func (s *PythonMCPServer) runServer() {
	scanner := bufio.NewScanner(os.Stdin)
	encoder := json.NewEncoder(os.Stdout)

	for scanner.Scan() {
		var req MCPRequest
		if err := json.Unmarshal(scanner.Bytes(), &req); err != nil {
			log.Printf("Parse error: %v", err)
			continue
		}

		resp := s.handleRequest(req)
		if err := encoder.Encode(resp); err != nil {
			log.Printf("Encode error: %v", err)
		}
	}

	if err := scanner.Err(); err != nil && err != io.EOF {
		log.Printf("Scanner error: %v", err)
	}
}

func main() {
	log.SetOutput(os.Stderr)
	server := NewPythonMCPServer()
	server.runServer()
}
