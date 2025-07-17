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
)

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
		workspace = cwd
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

// createReadme creates a README file in workspace
func (s *PythonMCPServer) createReadme() {
	readmePath := filepath.Join(s.workspaceDir, "README.txt")
	if _, err := os.Stat(readmePath); os.IsNotExist(err) {
		readme := `MCP Workspace Directory
=====================

This is your MCP workspace with an isolated Python environment.

Features:
- Isolated Python virtual environment in .venv/
- All packages are installed in this environment only
- Your system Python remains untouched
- Files saved here can be accessed with 'load' command
- Python scripts run in this isolated environment

You can:
- Place files here to access them with the 'load' command
- Files saved with 'save' command will appear here
- All Python packages are isolated to this workspace

Use the 'open' command to open this folder in your file explorer.

Virtual Environment Location: .venv/
Python Version: Check with py(code="import sys; print(sys.version)")
Installed Packages: Check with sh(cmd="pip list")
`
		ioutil.WriteFile(readmePath, []byte(readme), 0644)
	}
}

// getTools returns simplified tool definitions
func (s *PythonMCPServer) getTools() []Tool {
	return []Tool{
		{
			Name:        "py",
			Description: "Run Python code",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"code": map[string]interface{}{
						"type":        "string",
						"description": "Python code",
					},
				},
				"required": []string{"code"},
			},
		},
		{
			Name:        "sh",
			Description: "Run shell command",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"cmd": map[string]interface{}{
						"type":        "string",
						"description": "Command to run",
					},
				},
				"required": []string{"cmd"},
			},
		},
		{
			Name:        "pip",
			Description: "Install package",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"pkg": map[string]interface{}{
						"type":        "string",
						"description": "Package name",
					},
				},
				"required": []string{"pkg"},
			},
		},
		{
			Name:        "save",
			Description: "Save file",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"name": map[string]interface{}{
						"type":        "string",
						"description": "Filename",
					},
					"text": map[string]interface{}{
						"type":        "string",
						"description": "Content",
					},
				},
				"required": []string{"name", "text"},
			},
		},
		{
			Name:        "load",
			Description: "Read file",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"name": map[string]interface{}{
						"type":        "string",
						"description": "Filename",
					},
				},
				"required": []string{"name"},
			},
		},
		{
			Name:        "ls",
			Description: "List files",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
			},
		},
		{
			Name:        "open",
			Description: "Open workspace folder",
			InputSchema: map[string]interface{}{
				"type":       "object",
				"properties": map[string]interface{}{},
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
				"version": "5.0.0",
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
		case "sh":
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
