package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

// Config structures for YAML parsing
type Config struct {
	HealthCheckTimeout int              `yaml:"healthCheckTimeout"`
	LogLevel           string           `yaml:"logLevel"`
	Models             map[string]Model `yaml:"models"`
	Groups             map[string]Group `yaml:"groups"`
}

type Model struct {
	Proxy string `yaml:"proxy"`
	Cmd   string `yaml:"cmd"`
	TTL   int    `yaml:"ttl"`
}

type Group struct {
	Swap       bool     `yaml:"swap"`
	Exclusive  bool     `yaml:"exclusive"`
	Persistent bool     `yaml:"persistent"`
	Members    []string `yaml:"members"`
}

// System specifications
type SystemSpecs struct {
	GPUMemoryMB    int
	SystemMemoryMB int
	CPUCores       int
	GPUName        string
	GPUCompute     float64
	HasCUDA        bool
	HasROCm        bool
	HasMetal       bool
	HasVulkan      bool
	OS             string
}

// Model metadata from llama-server
type ModelMetadata struct {
	Name             string
	TotalParams      int64
	Architecture     string
	ContextLength    int
	EmbeddingSize    int
	NumLayers        int
	NumHeads         int
	NumKVHeads       int
	NumExperts       int
	NumActiveExperts int
	IsMoE            bool
	Quantization     string
	FileSize         int64
	RopeScaling      float64
	VocabSize        int
}

// Optimization presets
type Preset string

const (
	PresetHighSpeed   Preset = "high_speed"
	PresetMoreContext Preset = "more_context"
	PresetBalanced    Preset = "balanced"
	PresetSystemSafe  Preset = "system_safe"
	PresetUltra       Preset = "ultra_performance"
	PresetMoE         Preset = "moe_optimized"
)

// OptimizedParams holds the optimized parameters for a model
type OptimizedParams struct {
	NGPULayers      int
	Threads         int
	ContextSize     int
	BatchSize       int
	UBatchSize      int
	Keep            int
	DefragThreshold float64
	Parallel        int
	FlashAttn       bool
	ContBatching    bool
	MLock           bool
	MMProj          string
	TensorSplit     string
	MainGPU         int
	F16KV           bool
	LogitsAll       bool
	UseMMAP         bool
	NumaDistribute  bool
	OffloadKQV      bool // --no-kv-offload (keeps KV on CPU)
	SplitMode       string
	RopeScaling     float64
	RopeFreqBase    float64
	YarnExtFactor   float64
	YarnAttnFactor  float64
	NoKVOffload     bool
	CacheTypeK      string // KV cache quantization for K
	CacheTypeV      string // KV cache quantization for V
	PoolingType     string
	// MoE-specific optimizations
	OverrideTensors []string // For expert offloading
}

// Optimizer is the main optimization engine
type Optimizer struct {
	specs     *SystemSpecs
	config    *Config
	metadata  map[string]*ModelMetadata
	llamaPath string
	backend   string // cuda, vulkan, metal, rocm, cpu
}

// NewOptimizer creates a new optimizer instance
func NewOptimizer(configPath string) (*Optimizer, error) {
	// Read config
	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config: %w", err)
	}

	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse YAML: %w", err)
	}

	// Detect system specs
	specs := detectSystemSpecs()

	// Extract llama-server path and detect backend
	llamaPath := extractLlamaPath(config)
	backend := detectBackend(llamaPath)

	fmt.Printf("Detected backend: %s\n", strings.ToUpper(backend))

	return &Optimizer{
		specs:     specs,
		config:    &config,
		metadata:  make(map[string]*ModelMetadata),
		llamaPath: llamaPath,
		backend:   backend,
	}, nil
}

// detectBackend detects the backend from the llama-server path
func detectBackend(llamaPath string) string {
	llamaPath = strings.ToLower(llamaPath)
	switch {
	case strings.Contains(llamaPath, "cuda"):
		return "cuda"
	case strings.Contains(llamaPath, "vulkan"):
		return "vulkan"
	case strings.Contains(llamaPath, "metal"):
		return "metal"
	case strings.Contains(llamaPath, "rocm"):
		return "rocm"
	case strings.Contains(llamaPath, "cpu"):
		return "cpu"
	default:
		// Try to detect from system
		if runtime.GOOS == "darwin" {
			return "metal"
		}
		// Default to CPU if unknown
		return "cpu"
	}
}

// detectSystemSpecs auto-detects system specifications
func detectSystemSpecs() *SystemSpecs {
	specs := &SystemSpecs{
		CPUCores: runtime.NumCPU(),
		OS:       runtime.GOOS,
	}

	// Detect GPU and memory
	switch runtime.GOOS {
	case "windows":
		specs.detectWindowsGPU()
	case "linux":
		specs.detectLinuxGPU()
	case "darwin":
		specs.detectMacGPU()
	}

	// Detect system memory
	specs.detectSystemMemory()

	return specs
}

func (s *SystemSpecs) detectWindowsGPU() {
	// Try nvidia-smi first
	cmd := exec.Command("nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits")
	output, err := cmd.Output()
	if err == nil {
		lines := strings.Split(strings.TrimSpace(string(output)), "\n")
		if len(lines) > 0 {
			parts := strings.Split(lines[0], ",")
			if len(parts) >= 2 {
				s.GPUName = strings.TrimSpace(parts[0])
				if memMB, err := strconv.Atoi(strings.TrimSpace(parts[1])); err == nil {
					s.GPUMemoryMB = memMB
				}
				s.HasCUDA = true
				s.GPUCompute = getGPUComputeCapability(s.GPUName)
			}
		}
	}

	// Fallback to WMIC for system memory
	if s.SystemMemoryMB == 0 {
		cmd = exec.Command("wmic", "computersystem", "get", "TotalPhysicalMemory", "/value")
		output, err = cmd.Output()
		if err == nil {
			re := regexp.MustCompile(`TotalPhysicalMemory=(\d+)`)
			matches := re.FindStringSubmatch(string(output))
			if len(matches) > 1 {
				if bytes, err := strconv.ParseInt(matches[1], 10, 64); err == nil {
					s.SystemMemoryMB = int(bytes / 1024 / 1024)
				}
			}
		}
	}
}

func (s *SystemSpecs) detectLinuxGPU() {
	// Similar implementation for Linux using nvidia-smi or rocm-smi
	cmd := exec.Command("nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader,nounits")
	output, err := cmd.Output()
	if err == nil {
		lines := strings.Split(strings.TrimSpace(string(output)), "\n")
		if len(lines) > 0 {
			parts := strings.Split(lines[0], ",")
			if len(parts) >= 2 {
				s.GPUName = strings.TrimSpace(parts[0])
				if memMB, err := strconv.Atoi(strings.TrimSpace(parts[1])); err == nil {
					s.GPUMemoryMB = memMB
				}
				s.HasCUDA = true
				s.GPUCompute = getGPUComputeCapability(s.GPUName)
			}
		}
	}
}

func (s *SystemSpecs) detectMacGPU() {
	// For Apple Silicon
	s.HasMetal = true
	s.GPUName = "Apple Silicon"
	// Estimate based on system memory (unified memory)
	s.detectSystemMemory()
	s.GPUMemoryMB = s.SystemMemoryMB // Unified memory
}

func (s *SystemSpecs) detectSystemMemory() {
	switch runtime.GOOS {
	case "linux":
		data, _ := os.ReadFile("/proc/meminfo")
		lines := strings.Split(string(data), "\n")
		for _, line := range lines {
			if strings.HasPrefix(line, "MemTotal:") {
				fields := strings.Fields(line)
				if len(fields) >= 2 {
					if kb, err := strconv.Atoi(fields[1]); err == nil {
						s.SystemMemoryMB = kb / 1024
						break
					}
				}
			}
		}
	case "darwin":
		cmd := exec.Command("sysctl", "-n", "hw.memsize")
		output, err := cmd.Output()
		if err == nil {
			if bytes, err := strconv.ParseInt(strings.TrimSpace(string(output)), 10, 64); err == nil {
				s.SystemMemoryMB = int(bytes / 1024 / 1024)
			}
		}
	case "windows":
		// Already handled in detectWindowsGPU
	}
}

func getGPUComputeCapability(gpuName string) float64 {
	gpuName = strings.ToLower(gpuName)
	switch {
	case strings.Contains(gpuName, "4090"), strings.Contains(gpuName, "4080"), strings.Contains(gpuName, "4070"):
		return 8.9
	case strings.Contains(gpuName, "3090"), strings.Contains(gpuName, "3080"), strings.Contains(gpuName, "3070"):
		return 8.6
	case strings.Contains(gpuName, "a100"):
		return 8.0
	case strings.Contains(gpuName, "a6000"):
		return 8.6
	case strings.Contains(gpuName, "h100"):
		return 9.0
	default:
		return 7.5
	}
}

func extractLlamaPath(config Config) string {
	for _, model := range config.Models {
		if match := regexp.MustCompile(`"([^"]*llama-server[^"]*)"`).FindStringSubmatch(model.Cmd); len(match) > 1 {
			return match[1]
		}
	}
	return ""
}

// FetchModelMetadata extracts model metadata from filename and estimates properties
func (o *Optimizer) FetchModelMetadata(modelPath string) (*ModelMetadata, error) {
	metadata := &ModelMetadata{}

	// Extract metadata from filename
	metadata.detectFromFilename(modelPath)

	// Set default values based on model size if not detected
	if metadata.NumLayers == 0 {
		// Estimate layers based on parameter count
		if metadata.TotalParams > 0 {
			switch {
			case metadata.TotalParams < 2_000_000_000:
				metadata.NumLayers = 18
			case metadata.TotalParams < 5_000_000_000:
				metadata.NumLayers = 24
			case metadata.TotalParams < 8_000_000_000:
				metadata.NumLayers = 32
			case metadata.TotalParams < 15_000_000_000:
				metadata.NumLayers = 40
			case metadata.TotalParams < 35_000_000_000:
				metadata.NumLayers = 48
			case metadata.TotalParams < 70_000_000_000:
				metadata.NumLayers = 80
			default:
				metadata.NumLayers = 96
			}
		} else {
			metadata.NumLayers = 32 // Default
		}
	}

	// Set default context length based on model name
	if metadata.ContextLength == 0 {
		filename := strings.ToLower(filepath.Base(modelPath))
		switch {
		case strings.Contains(filename, "128k"):
			metadata.ContextLength = 131072
		case strings.Contains(filename, "64k"):
			metadata.ContextLength = 65536
		case strings.Contains(filename, "32k"):
			metadata.ContextLength = 32768
		case strings.Contains(filename, "16k"):
			metadata.ContextLength = 16384
		case strings.Contains(filename, "8k"):
			metadata.ContextLength = 8192
		case strings.Contains(filename, "1m"):
			metadata.ContextLength = 1048576
		default:
			// Default context based on model generation
			if strings.Contains(filename, "qwen3") || strings.Contains(filename, "gemma-3") {
				metadata.ContextLength = 8192
			} else {
				metadata.ContextLength = 4096
			}
		}
	}

	// Set embedding size based on model size
	if metadata.EmbeddingSize == 0 {
		if metadata.TotalParams > 0 {
			switch {
			case metadata.TotalParams < 2_000_000_000:
				metadata.EmbeddingSize = 2048
			case metadata.TotalParams < 8_000_000_000:
				metadata.EmbeddingSize = 4096
			case metadata.TotalParams < 35_000_000_000:
				metadata.EmbeddingSize = 5120
			default:
				metadata.EmbeddingSize = 8192
			}
		} else {
			metadata.EmbeddingSize = 4096
		}
	}

	return metadata, nil
}

func (m *ModelMetadata) detectFromFilename(path string) {
	// Use both basename and full path for detection
	filename := strings.ToLower(filepath.Base(path))
	fullpath := strings.ToLower(path)

	// Detect quantization - check both filename and full path
	quantPatterns := []string{
		`Q\d+_K_M`, `Q\d+_K_S`, `Q\d+_K`,
		`Q\d+_M`, `Q\d+_0`,
		`IQ\d+_XS`, `IQ\d+_XXS`, `IQ\d+_S`,
		`F16`, `F32`,
	}

	for _, pattern := range quantPatterns {
		re := regexp.MustCompile(`(?i)` + pattern)
		if match := re.FindString(fullpath); match != "" {
			m.Quantization = strings.ToUpper(match)
			break
		}
	}

	// Detect MoE architectures
	if strings.Contains(filename, "mixtral") || strings.Contains(filename, "moe") {
		m.IsMoE = true
		if m.NumExperts == 0 {
			m.NumExperts = 8
		}
	}
	if strings.Contains(fullpath, "a3b") {
		m.IsMoE = true
		m.NumExperts = 3
		m.NumActiveExperts = 2
	}

	// Estimate parameters from filename - check multiple patterns
	patterns := []struct {
		regex      *regexp.Regexp
		multiplier int64
	}{
		{regexp.MustCompile(`(\d+)b[-_\.]`), 1_000_000_000},     // 30b-
		{regexp.MustCompile(`[-_](\d+)b[-_\.]`), 1_000_000_000}, // -30b-
		{regexp.MustCompile(`(\d+\.\d+)b`), 1_000_000_000},      // 3.5b
		{regexp.MustCompile(`(\d+)m[-_\.]`), 1_000_000},         // 350m
	}

	for _, p := range patterns {
		if match := p.regex.FindStringSubmatch(filename); len(match) > 1 {
			if val, err := strconv.ParseFloat(match[1], 64); err == nil {
				m.TotalParams = int64(val * float64(p.multiplier))
				break
			}
		}
	}

	// Special cases for known models
	if strings.Contains(filename, "nano") && m.TotalParams == 0 {
		m.TotalParams = 1_000_000_000 // 1B for nano models
	}
	if strings.Contains(filename, "mxbai") && strings.Contains(filename, "large") {
		m.TotalParams = 335_000_000 // 335M for mxbai-large
	}
}

// Optimize generates optimized parameters for a model based on preset
func (o *Optimizer) Optimize(modelName string, preset Preset) (*OptimizedParams, error) {
	model, exists := o.config.Models[modelName]
	if !exists {
		return nil, fmt.Errorf("model %s not found", modelName)
	}

	// Extract model path from command
	modelPath := extractModelPath(model.Cmd)

	fmt.Printf("\n=== Optimizing %s ===\n", modelName)
	fmt.Printf("Model file: %s\n", filepath.Base(modelPath))

	// Get or fetch metadata
	metadata, exists := o.metadata[modelName]
	if !exists {
		var err error
		metadata, err = o.FetchModelMetadata(modelPath)
		if err != nil {
			// Log the error but continue with fallback
			fmt.Printf("Warning: Could not fetch metadata from server: %v\n", err)
			fmt.Println("Falling back to filename-based detection...")

			// Fallback to parsing from filename
			metadata = &ModelMetadata{}
			metadata.detectFromFilename(modelPath)
		}
		o.metadata[modelName] = metadata

		// Log detected metadata
		fmt.Printf("Model metadata:\n")
		fmt.Printf("  Parameters: %.1fB\n", float64(metadata.TotalParams)/1_000_000_000)
		fmt.Printf("  Layers: %d\n", metadata.NumLayers)
		fmt.Printf("  Context: %d\n", metadata.ContextLength)
		fmt.Printf("  Quantization: %s\n", metadata.Quantization)
		if metadata.Quantization == "" {
			fmt.Printf("  (Warning: Could not detect quantization from: %s)\n", filepath.Base(modelPath))
		}
		fmt.Printf("  MoE: %v (Experts: %d, Active: %d)\n", metadata.IsMoE, metadata.NumExperts, metadata.NumActiveExperts)
	}

	// Generate optimized parameters based on preset
	params := o.generateParams(metadata, preset)

	return params, nil
}

func extractModelPath(cmd string) string {
	re := regexp.MustCompile(`-m\s+"([^"]+)"`)
	if match := re.FindStringSubmatch(cmd); len(match) > 1 {
		return match[1]
	}
	return ""
}

func (o *Optimizer) generateParams(metadata *ModelMetadata, preset Preset) *OptimizedParams {
	params := &OptimizedParams{
		ContBatching: true,
		UseMMAP:      true,
		F16KV:        false,
	}

	// Backend-specific feature detection
	switch o.backend {
	case "cuda":
		params.FlashAttn = o.specs.GPUCompute >= 8.0
		params.MLock = o.specs.SystemMemoryMB > 32000
	case "vulkan":
		params.FlashAttn = false // Vulkan doesn't support flash attention yet
		params.MLock = o.specs.SystemMemoryMB > 32000
	case "metal":
		params.FlashAttn = true // Metal supports flash attention
		params.MLock = false    // macOS handles memory differently
	case "rocm":
		params.FlashAttn = o.specs.GPUCompute >= 8.0
		params.MLock = o.specs.SystemMemoryMB > 32000
	case "cpu":
		params.FlashAttn = false
		params.MLock = o.specs.SystemMemoryMB > 16000
	}

	// Calculate memory requirements
	quantMultiplier := getQuantMultiplier(metadata.Quantization)
	modelSizeGB := estimateModelSize(metadata, quantMultiplier)

	// Adjust available VRAM based on backend
	availableVRAM := float64(o.specs.GPUMemoryMB) * 0.95
	if o.backend == "vulkan" {
		availableVRAM *= 0.85 // Vulkan has more overhead
	} else if o.backend == "cpu" {
		// For CPU, use system RAM instead
		availableVRAM = float64(o.specs.SystemMemoryMB) * 0.5
	}

	// Apply preset optimizations
	switch preset {
	case PresetHighSpeed:
		o.optimizeForSpeed(params, metadata, modelSizeGB, availableVRAM)
	case PresetMoreContext:
		o.optimizeForContext(params, metadata, modelSizeGB, availableVRAM)
	case PresetBalanced:
		o.optimizeBalanced(params, metadata, modelSizeGB, availableVRAM)
	case PresetSystemSafe:
		o.optimizeSystemSafe(params, metadata, modelSizeGB, availableVRAM)
	case PresetUltra:
		o.optimizeUltra(params, metadata, modelSizeGB, availableVRAM)
	case PresetMoE:
		o.optimizeMoESpecific(params, metadata, modelSizeGB, availableVRAM)
	}

	// Backend-specific adjustments
	o.adjustForBackend(params, metadata)

	// MoE specific optimizations (always apply for MoE models)
	if metadata.IsMoE {
		o.optimizeMoE(params, metadata, availableVRAM)
	}

	// Thread optimization
	params.Threads = o.optimizeThreads(metadata, preset)

	return params
}

// adjustForBackend makes backend-specific adjustments
func (o *Optimizer) adjustForBackend(params *OptimizedParams, metadata *ModelMetadata) {
	switch o.backend {
	case "vulkan":
		// Vulkan specific limitations - CRITICAL for avoiding OOM
		params.FlashAttn = false      // Not supported
		params.NumaDistribute = false // Not applicable
		params.F16KV = false          // May cause issues

		// Vulkan has significant memory overhead, be very conservative
		// Reduce GPU layers for large models
		if metadata.TotalParams > 20_000_000_000 {
			// For 20B+ models, reduce layers significantly
			params.NGPULayers = int(float64(params.NGPULayers) * 0.6)
		} else if metadata.TotalParams > 10_000_000_000 {
			// For 10B+ models, reduce moderately
			params.NGPULayers = int(float64(params.NGPULayers) * 0.75)
		}

		// Conservative batch sizes for Vulkan
		if params.BatchSize > 256 {
			params.BatchSize = 256
		}
		if params.UBatchSize > 128 {
			params.UBatchSize = 128
		}

		// Limit context for Vulkan to prevent OOM
		maxContext := 8192
		if metadata.TotalParams > 20_000_000_000 {
			maxContext = 4096 // Very conservative for large models
		}
		if params.ContextSize > maxContext {
			params.ContextSize = maxContext
		}

		// Reduce parallel processing
		if params.Parallel > 2 {
			params.Parallel = 2
		}

		// Don't use KV cache quantization on Vulkan
		params.CacheTypeK = ""
		params.CacheTypeV = ""

	case "metal":
		// Metal specific optimizations
		params.NumaDistribute = false // Not applicable for macOS
		params.MLock = false          // macOS handles memory differently
		// Metal handles unified memory well
		if o.specs.OS == "darwin" {
			params.NoKVOffload = true // Keep KV cache in unified memory
		}

	case "rocm":
		// ROCm specific adjustments
		if params.BatchSize > 512 {
			params.BatchSize = 512 // ROCm may have different limits
		}

	case "cpu":
		// CPU-only adjustments
		params.NGPULayers = 0 // No GPU offloading
		params.FlashAttn = false
		params.OffloadKQV = false
		params.NoKVOffload = true
		params.SplitMode = "" // Not applicable
		if params.BatchSize > 256 {
			params.BatchSize = 256 // More conservative for CPU
		}
		if params.Parallel > 4 {
			params.Parallel = 4 // Limit parallelism on CPU
		}
		// Don't use KV cache quantization on CPU
		params.CacheTypeK = ""
		params.CacheTypeV = ""
	}

	// Adjust context size for non-CUDA backends if needed
	if o.backend != "cuda" && o.backend != "metal" {
		maxContext := 16384
		if o.backend == "cpu" {
			maxContext = 8192
		}
		if params.ContextSize > maxContext {
			params.ContextSize = maxContext
		}
	}
}

func (o *Optimizer) optimizeForSpeed(params *OptimizedParams, metadata *ModelMetadata, modelSizeGB float64, availableVRAM float64) {
	// Maximum GPU offloading for speed
	params.NGPULayers = calculateMaxGPULayers(modelSizeGB, availableVRAM, metadata.NumLayers, metadata.IsMoE, false)
	params.ContextSize = min(4096, metadata.ContextLength)
	params.BatchSize = 512
	params.UBatchSize = 256
	params.Keep = 1024
	params.DefragThreshold = 0.1
	params.Parallel = min(8, o.specs.CPUCores/2)
	params.NoKVOffload = false
	// Use KV cache quantization for speed - must use matching K and V types
	params.CacheTypeK = "q8_0"
	params.CacheTypeV = "q8_0" // Must match K type
}

func (o *Optimizer) optimizeForContext(params *OptimizedParams, metadata *ModelMetadata, modelSizeGB float64, availableVRAM float64) {
	// Optimize for maximum context
	maxContext := metadata.ContextLength
	if maxContext == 0 {
		maxContext = 32768 // Default max
	}

	// Use aggressive KV cache quantization for large contexts
	// IMPORTANT: Must use matching K and V types for standard builds
	params.CacheTypeK = "q4_0"
	params.CacheTypeV = "q4_0" // Must match K type

	// Calculate context memory requirement with quantization
	contextMemoryGB := estimateContextMemory(maxContext, metadata.EmbeddingSize, params.CacheTypeK)
	remainingVRAM := availableVRAM - contextMemoryGB*1024

	params.NGPULayers = calculateMaxGPULayers(modelSizeGB, remainingVRAM, metadata.NumLayers, metadata.IsMoE, true)
	params.ContextSize = min(maxContext, int((availableVRAM/1024)*0.3*1024)) // Use 30% VRAM for context
	params.BatchSize = min(256, params.ContextSize/16)
	params.UBatchSize = min(128, params.BatchSize/2)
	params.Keep = min(params.ContextSize/4, 4096)
	params.DefragThreshold = 0.05
	params.Parallel = min(4, o.specs.CPUCores/4)
	params.OffloadKQV = true // Offload KV cache if needed
}

func (o *Optimizer) optimizeBalanced(params *OptimizedParams, metadata *ModelMetadata, modelSizeGB float64, availableVRAM float64) {
	// Balanced approach with smart KV cache quantization
	// IMPORTANT: Must use matching K and V types for standard builds
	params.CacheTypeK = "q8_0" // Good balance
	params.CacheTypeV = "q8_0" // Must match K type

	layerMultiplier := 0.8

	// For very large models, be more conservative
	if metadata.TotalParams > 25_000_000_000 {
		layerMultiplier = 0.6
		params.CacheTypeK = "q4_0" // More aggressive for large models
		params.CacheTypeV = "q4_0" // Must match K type
	}

	if o.backend == "vulkan" {
		layerMultiplier *= 0.6 // Much more conservative for Vulkan
	}

	params.NGPULayers = calculateMaxGPULayers(modelSizeGB*layerMultiplier, availableVRAM, metadata.NumLayers, metadata.IsMoE, false)

	// Conservative context for large models to prevent OOM
	if metadata.TotalParams > 25_000_000_000 {
		params.ContextSize = min(4096, metadata.ContextLength)
	} else if metadata.TotalParams > 10_000_000_000 {
		params.ContextSize = min(8192, metadata.ContextLength)
	} else {
		params.ContextSize = min(16384, metadata.ContextLength)
	}

	params.BatchSize = 256
	params.UBatchSize = 128
	params.Keep = min(2048, params.ContextSize/4)
	params.DefragThreshold = 0.1

	// Reduce parallel for large models to prevent context multiplication
	if metadata.TotalParams > 25_000_000_000 {
		params.Parallel = 2
	} else {
		params.Parallel = min(4, o.specs.CPUCores/3)
	}
}

func (o *Optimizer) optimizeSystemSafe(params *OptimizedParams, metadata *ModelMetadata, modelSizeGB float64, availableVRAM float64) {
	// Conservative settings for system stability
	layerMultiplier := 0.5 // More conservative
	contextSize := 4096    // Smaller context

	// Extra conservative for Vulkan
	if o.backend == "vulkan" {
		layerMultiplier = 0.3 // Very conservative
		contextSize = 2048    // Small context

		// For large models on Vulkan, be extremely conservative
		if metadata.TotalParams > 20_000_000_000 {
			layerMultiplier = 0.2
			contextSize = 2048
		}
	}

	// For large models, be even more conservative
	if metadata.TotalParams > 25_000_000_000 {
		layerMultiplier = 0.4
		contextSize = 4096

		// For Q8_0 models, need even more conservation
		if metadata.Quantization == "Q8_0" {
			layerMultiplier = 0.3
		}
	}

	// Use conservative KV cache quantization - matching K and V types
	// Start with NO quantization for safety
	params.CacheTypeK = "" // Will use default f16
	params.CacheTypeV = "" // Will use default f16

	// Only enable KV quantization if we have flash attention
	if params.FlashAttn && o.backend == "cuda" {
		params.CacheTypeK = "q4_0"
		params.CacheTypeV = "q4_0" // Must match K type
	}

	params.NGPULayers = calculateMaxGPULayers(modelSizeGB*layerMultiplier, availableVRAM*0.7, metadata.NumLayers, metadata.IsMoE, false)
	params.ContextSize = min(contextSize, metadata.ContextLength)
	params.BatchSize = 128
	params.UBatchSize = 64
	params.Keep = min(1024, params.ContextSize/4)
	params.DefragThreshold = 0.2
	params.Parallel = 2
	params.MLock = false // Don't lock memory
}

func (o *Optimizer) optimizeUltra(params *OptimizedParams, metadata *ModelMetadata, modelSizeGB float64, availableVRAM float64) {
	// Ultra performance - aggressive settings

	// Use moderate KV cache quantization for performance
	// IMPORTANT: Must use matching K and V types for standard builds
	params.CacheTypeK = "q8_0"
	params.CacheTypeV = "q8_0" // Must match K type

	// For ultra-large context models, be more conservative
	maxContext := metadata.ContextLength
	if maxContext > 131072 {
		// For 1M+ context models, limit to reasonable amount
		maxContext = 65536
		params.CacheTypeK = "q4_0" // More aggressive quantization
		params.CacheTypeV = "q4_0" // Must match K type
	} else if maxContext > 32768 {
		// For 128K models, allow up to 64K if VRAM permits
		contextMemGB := estimateContextMemory(maxContext, metadata.EmbeddingSize, params.CacheTypeK)
		if contextMemGB*1024 > availableVRAM*0.4 {
			maxContext = 32768
		}
	}

	params.NGPULayers = min(metadata.NumLayers, calculateMaxGPULayers(modelSizeGB*1.1, availableVRAM, metadata.NumLayers, metadata.IsMoE, false))
	params.ContextSize = min(maxContext, 32768) // Cap at 32K for ultra performance
	params.BatchSize = 1024
	params.UBatchSize = 512
	params.Keep = 4096
	params.DefragThreshold = 0.05
	params.Parallel = min(16, o.specs.CPUCores)
	params.NumaDistribute = o.specs.CPUCores > 16
	params.LogitsAll = false
	params.F16KV = false       // Use quantized KV instead
	params.SplitMode = "layer" // Better for large models
}

func (o *Optimizer) optimizeMoESpecific(params *OptimizedParams, metadata *ModelMetadata, modelSizeGB float64, availableVRAM float64) {
	// Special preset for MoE models
	// IMPORTANT: Must use matching K and V types for standard builds
	params.CacheTypeK = "q8_0"
	params.CacheTypeV = "q8_0" // Must match K type

	// Conservative layer allocation for MoE
	params.NGPULayers = calculateMaxGPULayers(modelSizeGB*0.5, availableVRAM, metadata.NumLayers, true, true)
	params.ContextSize = min(8192, metadata.ContextLength)
	params.BatchSize = 256
	params.UBatchSize = 64 // Small for expert routing
	params.Keep = 2048
	params.DefragThreshold = 0.1
	params.Parallel = 2 // Limited for MoE
	params.SplitMode = "row"

	// Apply MoE optimizations
	o.optimizeMoE(params, metadata, availableVRAM)
}

func (o *Optimizer) optimizeMoE(params *OptimizedParams, metadata *ModelMetadata, availableVRAM float64) {
	if metadata.NumExperts > 0 {
		// For MoE models, use row split mode for better expert distribution
		params.SplitMode = "row"

		// Calculate actual model size with quantization
		quantMultiplier := getQuantMultiplier(metadata.Quantization)
		actualModelSizeGB := float64(metadata.TotalParams) / 1_000_000_000 * quantMultiplier * 1.1

		// Calculate how much VRAM we actually have vs need
		vramGB := availableVRAM / 1024

		// With KV cache quantization, we need much less reserved space
		kvReserveGB := 0.5
		if params.CacheTypeK == "q4_0" {
			kvReserveGB = 0.3
		}

		usableVRAMForModel := vramGB - kvReserveGB - 0.3 // 0.3GB overhead

		// Only offload experts if we REALLY can't fit the model
		if actualModelSizeGB > usableVRAMForModel*1.5 { // Only if significantly over
			// Calculate how much we need to offload
			excessGB := actualModelSizeGB - usableVRAMForModel
			percentToOffload := excessGB / actualModelSizeGB

			if percentToOffload > 0.3 { // Only if we need to offload more than 30%
				// Use more targeted expert offloading - only specific layers
				// This offloads only the last few expert layers, not all
				lastLayers := int(float64(metadata.NumLayers) * percentToOffload)
				for i := metadata.NumLayers - lastLayers; i < metadata.NumLayers; i++ {
					params.OverrideTensors = append(params.OverrideTensors,
						fmt.Sprintf(`blk\.%d\.ffn_.*_exps\.weight=CPU`, i))
				}

				fmt.Printf("  Note: Offloading last %d expert layers to CPU\n", lastLayers)
			} else {
				// Try to fit everything on GPU
				params.NGPULayers = metadata.NumLayers
			}
		} else {
			// Model fits! Don't offload anything
			params.OverrideTensors = nil
			// Try to fit all layers on GPU
			params.NGPULayers = metadata.NumLayers
		}

		// Optimize batching for MoE - smaller ubatch for expert routing
		if params.UBatchSize > 128 {
			params.UBatchSize = 128
		}

		// Limit parallel based on active experts
		if metadata.NumActiveExperts > 0 {
			params.Parallel = min(params.Parallel, metadata.NumActiveExperts)
		} else {
			params.Parallel = min(params.Parallel, 2)
		}

		// Use KV cache quantization for MoE to save memory
		// IMPORTANT: Must use matching K and V types for standard builds
		if params.CacheTypeK == "" {
			params.CacheTypeK = "q8_0"
			params.CacheTypeV = "q8_0" // Must match K type
		}
	}
}

func (o *Optimizer) optimizeThreads(metadata *ModelMetadata, preset Preset) int {
	threads := o.specs.CPUCores

	switch preset {
	case PresetHighSpeed:
		threads = o.specs.CPUCores / 2 // Leave room for system
	case PresetSystemSafe:
		threads = min(4, o.specs.CPUCores/2)
	case PresetUltra:
		threads = o.specs.CPUCores - 1 // Use almost all
	case PresetMoE:
		threads = o.specs.CPUCores / 3 // Conservative for MoE
	default:
		threads = o.specs.CPUCores * 2 / 3
	}

	// Adjust for MoE models
	if metadata.IsMoE && metadata.NumActiveExperts > 0 {
		threads = max(threads, metadata.NumActiveExperts*2)
	}

	return threads
}

// Helper functions
func getQuantMultiplier(quantization string) float64 {
	quantMap := map[string]float64{
		"F32":     4.0,
		"F16":     2.0,
		"Q8_0":    1.0,
		"Q6_K":    0.75,
		"Q5_K_M":  0.625,
		"Q5_K_S":  0.625,
		"Q4_K_M":  0.5,
		"Q4_K_S":  0.5,
		"Q4_0":    0.5,
		"Q3_K_M":  0.375,
		"Q3_K_S":  0.375,
		"Q2_K":    0.25,
		"IQ4_XS":  0.45,
		"IQ3_XXS": 0.3125,
		"IQ2_XXS": 0.25,
		"IQ1_S":   0.125,
	}

	if mult, exists := quantMap[quantization]; exists {
		return mult
	}
	return 0.5 // Default
}

func estimateModelSize(metadata *ModelMetadata, quantMultiplier float64) float64 {
	if metadata.TotalParams > 0 {
		// Estimate based on parameters
		// Base calculation: params in billions × quantization multiplier
		baseSize := float64(metadata.TotalParams) / 1_000_000_000 * quantMultiplier

		if metadata.IsMoE {
			// MoE models are larger due to expert layers
			baseSize *= 1.3
		}

		// Add overhead for model structure
		return baseSize * 1.1
	}

	// Fallback estimation
	if metadata.NumLayers > 0 && metadata.EmbeddingSize > 0 {
		layerSize := float64(metadata.EmbeddingSize*metadata.EmbeddingSize*4) / 1_000_000_000
		return float64(metadata.NumLayers) * layerSize * quantMultiplier
	}

	return 10.0 // Default 10GB
}

func estimateContextMemory(contextSize int, embeddingSize int, kvCacheType string) float64 {
	if embeddingSize == 0 {
		embeddingSize = 4096 // Default
	}

	// Base calculation: context * embedding * 2 (K+V) * precision bytes
	bytesPerElement := 2.0 // f16 default

	// Adjust for KV cache quantization
	switch kvCacheType {
	case "q8_0":
		bytesPerElement = 1.0 // 8-bit
	case "q4_0", "q4_1":
		bytesPerElement = 0.5 // 4-bit
	case "q2_k":
		bytesPerElement = 0.25 // 2-bit
	}

	return float64(contextSize*embeddingSize*2) * bytesPerElement / 1_000_000_000
}

func calculateMaxGPULayers(modelSizeGB float64, availableVRAM float64, totalLayers int, isMoE bool, aggressiveContext bool) int {
	if totalLayers == 0 {
		totalLayers = 32 // Default
	}

	vramGB := availableVRAM / 1024
	if modelSizeGB <= 0 || vramGB <= 0 {
		return 0
	}

	// More accurate VRAM calculation
	// Reserve less for KV cache since we're using quantization
	kvCacheReserveGB := 0.5 // With KV quantization, we need much less
	if aggressiveContext {
		kvCacheReserveGB = 0.3 // Even less with aggressive quantization
	}

	overheadGB := 0.3 // Minimal overhead for operations

	// MoE models need slightly more overhead for routing
	if isMoE {
		overheadGB = 0.5
	}

	usableVRAMForModel := vramGB - kvCacheReserveGB - overheadGB
	if usableVRAMForModel <= 0 {
		return 0 // Not enough VRAM
	}

	// Calculate how many layers fit in remaining VRAM
	layerRatio := usableVRAMForModel / modelSizeGB

	// For MoE models, we can fit more layers because not all experts are active
	if isMoE {
		layerRatio *= 1.2 // MoE models can fit more due to sparse activation
	}

	gpuLayers := int(float64(totalLayers) * layerRatio)

	// Try to maximize GPU usage - only reserve CPU layers if absolutely necessary
	if gpuLayers > totalLayers {
		gpuLayers = totalLayers
	} else if gpuLayers > totalLayers-2 && totalLayers > 20 {
		// Only keep 1-2 layers on CPU for very large models
		gpuLayers = totalLayers - 1
	}

	// Ensure at least some layers on GPU
	if gpuLayers < 1 && totalLayers > 0 {
		gpuLayers = 1
	}

	return gpuLayers
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// GenerateCommand creates the optimized llama-server command
func (o *Optimizer) GenerateCommand(modelName string, params *OptimizedParams) string {
	model := o.config.Models[modelName]
	modelPath := extractModelPath(model.Cmd)

	var cmd strings.Builder
	cmd.WriteString(fmt.Sprintf(`"%s"`, o.llamaPath))
	cmd.WriteString(fmt.Sprintf(` -m "%s"`, modelPath))

	// Extract port from original command
	port := "9999"
	if match := regexp.MustCompile(`--port\s+(\d+)`).FindStringSubmatch(model.Cmd); len(match) > 1 {
		port = match[1]
	}
	cmd.WriteString(fmt.Sprintf(" --port %s", port))

	// Core parameters
	cmd.WriteString(fmt.Sprintf(" --n-gpu-layers %d", params.NGPULayers))
	cmd.WriteString(fmt.Sprintf(" --threads %d", params.Threads))
	cmd.WriteString(fmt.Sprintf(" --ctx-size %d", params.ContextSize))
	cmd.WriteString(fmt.Sprintf(" --batch-size %d", params.BatchSize))
	cmd.WriteString(fmt.Sprintf(" --ubatch-size %d", params.UBatchSize))
	cmd.WriteString(fmt.Sprintf(" --keep %d", params.Keep))
	cmd.WriteString(fmt.Sprintf(" --defrag-thold %.2f", params.DefragThreshold))
	cmd.WriteString(fmt.Sprintf(" --parallel %d", params.Parallel))

	// KV cache quantization (critical for memory optimization)
	if params.CacheTypeK != "" && params.CacheTypeK != "f16" {
		cmd.WriteString(fmt.Sprintf(" --cache-type-k %s", params.CacheTypeK))
	}
	if params.CacheTypeV != "" && params.CacheTypeV != "f16" {
		cmd.WriteString(fmt.Sprintf(" --cache-type-v %s", params.CacheTypeV))
	}

	// Check for embedding model
	if strings.Contains(strings.ToLower(modelName), "embed") || strings.Contains(model.Cmd, "--embeddings") {
		cmd.WriteString(" --embeddings")
		if params.PoolingType != "" {
			cmd.WriteString(fmt.Sprintf(" --pooling %s", params.PoolingType))
		} else {
			cmd.WriteString(" --pooling mean")
		}
	}

	// Conditional flags
	if params.FlashAttn {
		cmd.WriteString(" --flash-attn")
	}
	if params.ContBatching {
		cmd.WriteString(" --cont-batching")
	}
	if params.MLock {
		cmd.WriteString(" --mlock")
	}
	if !params.UseMMAP {
		cmd.WriteString(" --no-mmap")
	}
	if params.NumaDistribute {
		cmd.WriteString(" --numa distribute")
	}
	if params.OffloadKQV {
		cmd.WriteString(" --no-kv-offload") // Note: this keeps KV on CPU
	}
	if params.NoKVOffload {
		cmd.WriteString(" --no-kv-offload")
	}
	if params.LogitsAll {
		cmd.WriteString(" --logits-all")
	}
	if params.F16KV {
		cmd.WriteString(" --memory-f16")
	}

	// Advanced parameters
	if params.SplitMode != "" {
		cmd.WriteString(fmt.Sprintf(" --split-mode %s", params.SplitMode))
	}
	if params.TensorSplit != "" {
		cmd.WriteString(fmt.Sprintf(" --tensor-split %s", params.TensorSplit))
	}
	if params.MainGPU > 0 {
		cmd.WriteString(fmt.Sprintf(" --main-gpu %d", params.MainGPU))
	}
	if params.RopeScaling > 0 && params.RopeScaling != 1.0 {
		cmd.WriteString(fmt.Sprintf(" --rope-scaling %.2f", params.RopeScaling))
	}
	if params.RopeFreqBase > 0 {
		cmd.WriteString(fmt.Sprintf(" --rope-freq-base %.0f", params.RopeFreqBase))
	}

	// MoE-specific: Expert tensor offloading
	for _, override := range params.OverrideTensors {
		cmd.WriteString(fmt.Sprintf(` --override-tensor "%s"`, override))
	}

	// Always include jinja for compatibility
	cmd.WriteString(" --jinja")

	return cmd.String()
}

// OptimizeAll optimizes all models in the config
func (o *Optimizer) OptimizeAll(preset Preset) (map[string]string, error) {
	optimized := make(map[string]string)

	fmt.Println("\n=== Starting Optimization Process ===")
	fmt.Printf("Preset: %s\n", preset)
	fmt.Printf("Models to optimize: %d\n\n", len(o.config.Models))

	for modelName := range o.config.Models {
		params, err := o.Optimize(modelName, preset)
		if err != nil {
			log.Printf("Warning: Failed to optimize %s: %v", modelName, err)
			continue
		}

		optimized[modelName] = o.GenerateCommand(modelName, params)
	}

	return optimized, nil
}

// ExportConfig exports the optimized configuration
func (o *Optimizer) ExportConfig(optimized map[string]string, outputPath string) error {
	// Create new config with optimized commands
	newConfig := *o.config
	for modelName, cmd := range optimized {
		if model, exists := newConfig.Models[modelName]; exists {
			// Just use the command directly, YAML marshaller will handle formatting
			model.Cmd = cmd
			newConfig.Models[modelName] = model
		}
	}

	// Marshal to YAML
	data, err := yaml.Marshal(&newConfig)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	// Write to file
	if err := os.WriteFile(outputPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write config: %w", err)
	}

	return nil
}

func main() {
	var (
		configPath = flag.String("config", "llama-swap.yaml", "Path to YAML config file")
		preset     = flag.String("preset", "balanced", "Optimization preset: high_speed, more_context, balanced, system_safe, ultra_performance, moe_optimized")
		output     = flag.String("output", "", "Output path for optimized config (default: overwrites input file)")
		modelName  = flag.String("model", "", "Optimize specific model only")
		showSpecs  = flag.Bool("specs", false, "Show detected system specifications")
		verbose    = flag.Bool("verbose", false, "Show detailed optimization process")
		backup     = flag.Bool("backup", true, "Create backup of original config before overwriting")
	)
	flag.Parse()

	// Create optimizer
	fmt.Println("Creating optimizer...")
	optimizer, err := NewOptimizer(*configPath)
	if err != nil {
		log.Fatalf("Failed to create optimizer: %v", err)
	}

	fmt.Printf("Found llama-server at: %s\n", optimizer.llamaPath)
	fmt.Printf("Detected backend: %s\n", strings.ToUpper(optimizer.backend))

	// Show system specs if requested or in verbose mode
	if *showSpecs || *verbose {
		fmt.Println("\n=== System Specifications ===")
		fmt.Printf("OS: %s\n", optimizer.specs.OS)
		fmt.Printf("Backend: %s\n", strings.ToUpper(optimizer.backend))
		fmt.Printf("CPU Cores: %d\n", optimizer.specs.CPUCores)
		fmt.Printf("System Memory: %d MB (%.1f GB)\n", optimizer.specs.SystemMemoryMB, float64(optimizer.specs.SystemMemoryMB)/1024)
		fmt.Printf("GPU: %s\n", optimizer.specs.GPUName)
		fmt.Printf("GPU Memory: %d MB (%.1f GB)\n", optimizer.specs.GPUMemoryMB, float64(optimizer.specs.GPUMemoryMB)/1024)
		fmt.Printf("GPU Compute: %.1f\n", optimizer.specs.GPUCompute)
		fmt.Printf("CUDA: %v\n", optimizer.specs.HasCUDA)
		fmt.Printf("ROCm: %v\n", optimizer.specs.HasROCm)
		fmt.Printf("Metal: %v\n", optimizer.specs.HasMetal)
		fmt.Println()
	}

	// Parse preset
	presetEnum := Preset(*preset)

	// Optimize
	if *modelName != "" {
		// Single model optimization
		params, err := optimizer.Optimize(*modelName, presetEnum)
		if err != nil {
			log.Fatalf("Failed to optimize %s: %v", *modelName, err)
		}

		cmd := optimizer.GenerateCommand(*modelName, params)
		fmt.Printf("\n=== Optimized Command for %s ===\n", *modelName)
		fmt.Println(cmd)

		// Show KV cache settings
		if params.CacheTypeK != "" || params.CacheTypeV != "" {
			fmt.Println("\n=== KV Cache Optimization ===")
			fmt.Printf("K Cache: %s\n", params.CacheTypeK)
			fmt.Printf("V Cache: %s\n", params.CacheTypeV)
		}
	} else {
		// Optimize all models
		optimized, err := optimizer.OptimizeAll(presetEnum)
		if err != nil {
			log.Fatalf("Failed to optimize models: %v", err)
		}

		// Determine output path
		outputPath := *output
		if outputPath == "" {
			// Default: overwrite the input file
			outputPath = *configPath

			// Create backup if requested
			if *backup {
				backupPath := fmt.Sprintf("%s.backup_%s", *configPath, time.Now().Format("20060102_150405"))

				// Read original file
				originalData, err := os.ReadFile(*configPath)
				if err != nil {
					log.Printf("Warning: Could not create backup: %v", err)
				} else {
					// Write backup
					if err := os.WriteFile(backupPath, originalData, 0644); err != nil {
						log.Printf("Warning: Could not write backup to %s: %v", backupPath, err)
					} else {
						fmt.Printf("📁 Backup created: %s\n", backupPath)
					}
				}
			}
		}

		// Export config
		if err := optimizer.ExportConfig(optimized, outputPath); err != nil {
			log.Fatalf("Failed to export config: %v", err)
		}

		if outputPath == *configPath {
			fmt.Printf("\n✅ Configuration optimized and updated in place: %s\n", outputPath)
		} else {
			fmt.Printf("\n✅ Optimized configuration saved to: %s\n", outputPath)
		}
		fmt.Printf("📊 Preset: %s\n", *preset)
		fmt.Printf("🚀 Models optimized: %d\n", len(optimized))

		// Show summary
		fmt.Println("\n=== Optimization Summary ===")
		for modelName, cmd := range optimized {
			fmt.Printf("\n📦 %s:\n", modelName)

			// Extract key params from command
			if match := regexp.MustCompile(`--n-gpu-layers\s+(\d+)`).FindStringSubmatch(cmd); len(match) > 1 {
				fmt.Printf("  GPU Layers: %s\n", match[1])
			}
			if match := regexp.MustCompile(`--ctx-size\s+(\d+)`).FindStringSubmatch(cmd); len(match) > 1 {
				fmt.Printf("  Context: %s\n", match[1])
			}
			if match := regexp.MustCompile(`--batch-size\s+(\d+)`).FindStringSubmatch(cmd); len(match) > 1 {
				fmt.Printf("  Batch: %s\n", match[1])
			}
			if match := regexp.MustCompile(`--threads\s+(\d+)`).FindStringSubmatch(cmd); len(match) > 1 {
				fmt.Printf("  Threads: %s\n", match[1])
			}
			if match := regexp.MustCompile(`--cache-type-k\s+(\w+)`).FindStringSubmatch(cmd); len(match) > 1 {
				fmt.Printf("  KV Cache K: %s\n", match[1])
			}
			if match := regexp.MustCompile(`--cache-type-v\s+(\w+)`).FindStringSubmatch(cmd); len(match) > 1 {
				fmt.Printf("  KV Cache V: %s\n", match[1])
			}
		}

		// Add note about backup
		if outputPath == *configPath && *backup {
			fmt.Println("\n💡 Tip: Original config backed up with timestamp. Use -backup=false to skip backup creation.")
		}

		// Add note about MoE optimization
		fmt.Println("\n🎯 MoE Optimization Note:")
		fmt.Println("For MoE models, try the 'moe_optimized' preset for best results.")
		fmt.Println("KV cache quantization is automatically applied to save memory.")
	}
}
