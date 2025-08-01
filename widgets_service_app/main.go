package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
	"github.com/rs/cors"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/host"
	"github.com/shirou/gopsutil/v3/mem"
	"github.com/shirou/gopsutil/v3/net"
	"github.com/shirou/gopsutil/v3/process"
)

// SystemStats represents overall system statistics
type SystemStats struct {
	CPU       CPUStats       `json:"cpu"`
	Memory    MemoryStats    `json:"memory"`
	Disk      []DiskStats    `json:"disk"`
	Network   NetworkStats   `json:"network"`
	GPU       []GPUStats     `json:"gpu"`
	Processes []ProcessStats `json:"processes"`
	Uptime    int64          `json:"uptime"`
	Timestamp time.Time      `json:"timestamp"`
}

// CPUStats represents CPU statistics
type CPUStats struct {
	Usage     float64 `json:"usage"`
	Cores     int     `json:"cores"`
	Frequency float64 `json:"frequency"`
	Temp      float64 `json:"temperature"`
}

// MemoryStats represents memory statistics
type MemoryStats struct {
	Total       uint64  `json:"total"`
	Available   uint64  `json:"available"`
	Used        uint64  `json:"used"`
	UsedPercent float64 `json:"usedPercent"`
	Swap        struct {
		Total       uint64  `json:"total"`
		Used        uint64  `json:"used"`
		UsedPercent float64 `json:"usedPercent"`
	} `json:"swap"`
}

// DiskStats represents disk statistics
type DiskStats struct {
	Device      string  `json:"device"`
	Mountpoint  string  `json:"mountpoint"`
	Fstype      string  `json:"fstype"`
	Total       uint64  `json:"total"`
	Free        uint64  `json:"free"`
	Used        uint64  `json:"used"`
	UsedPercent float64 `json:"usedPercent"`
}

// NetworkStats represents network statistics
type NetworkStats struct {
	BytesSent   uint64 `json:"bytesSent"`
	BytesRecv   uint64 `json:"bytesRecv"`
	PacketsSent uint64 `json:"packetsSent"`
	PacketsRecv uint64 `json:"packetsRecv"`
}

// GPUStats represents GPU statistics
type GPUStats struct {
	Name          string  `json:"name"`
	Usage         float64 `json:"usage"`
	MemoryTotal   uint64  `json:"memoryTotal"`
	MemoryUsed    uint64  `json:"memoryUsed"`
	MemoryFree    uint64  `json:"memoryFree"`
	MemoryPercent float64 `json:"memoryPercent"`
	Temperature   float64 `json:"temperature"`
	FanSpeed      int     `json:"fanSpeed"`
	PowerDraw     float64 `json:"powerDraw"`
	ClockCore     int     `json:"clockCore"`
	ClockMemory   int     `json:"clockMemory"`
}

// ProcessStats represents process statistics
type ProcessStats struct {
	PID    int32   `json:"pid"`
	Name   string  `json:"name"`
	CPU    float64 `json:"cpu"`
	Memory float64 `json:"memory"`
	Status string  `json:"status"`
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for development
	},
}

// Global variables to track active connections
var activeConnections = make(map[*websocket.Conn]bool)
var statsInterval = 2 * time.Second

func main() {
	port := "8765"
	if len(os.Args) > 1 {
		port = os.Args[1]
	}

	router := mux.NewRouter()

	// REST API endpoints
	router.HandleFunc("/api/stats", getSystemStats).Methods("GET")
	router.HandleFunc("/api/stats/cpu", getCPUStats).Methods("GET")
	router.HandleFunc("/api/stats/memory", getMemoryStats).Methods("GET")
	router.HandleFunc("/api/stats/gpu", getGPUStats).Methods("GET")
	router.HandleFunc("/api/stats/disk", getDiskStats).Methods("GET")
	router.HandleFunc("/api/stats/network", getNetworkStats).Methods("GET")
	router.HandleFunc("/api/stats/processes", getProcessStats).Methods("GET")
	router.HandleFunc("/api/health", healthCheck).Methods("GET")

	// WebSocket endpoint for real-time updates
	router.HandleFunc("/ws/stats", handleWebSocket)

	// CORS middleware
	c := cors.New(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"*"},
	})

	handler := c.Handler(router)

	fmt.Printf("Widget Service starting on port %s\n", port)
	fmt.Printf("Health check: http://localhost:%s/api/health\n", port)
	fmt.Printf("System stats: http://localhost:%s/api/stats\n", port)
	fmt.Printf("WebSocket: ws://localhost:%s/ws/stats\n", port)

	log.Fatal(http.ListenAndServe(":"+port, handler))
}

func healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":            "healthy",
		"service":           "widgets-service",
		"timestamp":         time.Now(),
		"activeConnections": len(activeConnections),
	})
}

func getSystemStats(w http.ResponseWriter, r *http.Request) {
	stats := collectSystemStats()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

func getCPUStats(w http.ResponseWriter, r *http.Request) {
	cpuStats := collectCPUStats()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cpuStats)
}

func getMemoryStats(w http.ResponseWriter, r *http.Request) {
	memStats := collectMemoryStats()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(memStats)
}

func getGPUStats(w http.ResponseWriter, r *http.Request) {
	gpuStats := collectGPUStats()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(gpuStats)
}

func getDiskStats(w http.ResponseWriter, r *http.Request) {
	diskStats := collectDiskStats()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(diskStats)
}

func getNetworkStats(w http.ResponseWriter, r *http.Request) {
	netStats := collectNetworkStats()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(netStats)
}

func getProcessStats(w http.ResponseWriter, r *http.Request) {
	procStats := collectProcessStats()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(procStats)
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	// Add connection to active connections
	activeConnections[conn] = true
	defer delete(activeConnections, conn)

	log.Printf("WebSocket connection established. Active connections: %d", len(activeConnections))

	// Send initial stats
	stats := collectSystemStats()
	if err := conn.WriteJSON(stats); err != nil {
		log.Printf("Error sending initial stats: %v", err)
		return
	}

	// Start sending periodic updates
	ticker := time.NewTicker(statsInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			stats := collectSystemStats()
			if err := conn.WriteJSON(stats); err != nil {
				log.Printf("Error sending stats update: %v", err)
				return
			}
		}
	}
}

func collectSystemStats() SystemStats {
	hostInfo, _ := host.Info()

	return SystemStats{
		CPU:       collectCPUStats(),
		Memory:    collectMemoryStats(),
		Disk:      collectDiskStats(),
		Network:   collectNetworkStats(),
		GPU:       collectGPUStats(),
		Processes: collectProcessStats(),
		Uptime:    int64(hostInfo.Uptime),
		Timestamp: time.Now(),
	}
}

func collectCPUStats() CPUStats {
	// Get CPU usage percentage
	usage, _ := cpu.Percent(time.Second, false)
	cpuUsage := 0.0
	if len(usage) > 0 {
		cpuUsage = usage[0]
	}

	// Get CPU info
	cpuInfo, _ := cpu.Info()
	cores := runtime.NumCPU()
	frequency := 0.0
	if len(cpuInfo) > 0 {
		frequency = cpuInfo[0].Mhz
	}

	return CPUStats{
		Usage:     cpuUsage,
		Cores:     cores,
		Frequency: frequency,
		Temp:      getCPUTemperature(),
	}
}

func collectMemoryStats() MemoryStats {
	vmem, _ := mem.VirtualMemory()
	swap, _ := mem.SwapMemory()

	memStats := MemoryStats{
		Total:       vmem.Total,
		Available:   vmem.Available,
		Used:        vmem.Used,
		UsedPercent: vmem.UsedPercent,
	}

	memStats.Swap.Total = swap.Total
	memStats.Swap.Used = swap.Used
	memStats.Swap.UsedPercent = swap.UsedPercent

	return memStats
}

func collectDiskStats() []DiskStats {
	var diskStats []DiskStats

	partitions, _ := disk.Partitions(false)
	for _, partition := range partitions {
		usage, err := disk.Usage(partition.Mountpoint)
		if err != nil {
			continue
		}

		diskStats = append(diskStats, DiskStats{
			Device:      partition.Device,
			Mountpoint:  partition.Mountpoint,
			Fstype:      partition.Fstype,
			Total:       usage.Total,
			Free:        usage.Free,
			Used:        usage.Used,
			UsedPercent: usage.UsedPercent,
		})
	}

	return diskStats
}

func collectNetworkStats() NetworkStats {
	netIO, _ := net.IOCounters(false)

	if len(netIO) > 0 {
		return NetworkStats{
			BytesSent:   netIO[0].BytesSent,
			BytesRecv:   netIO[0].BytesRecv,
			PacketsSent: netIO[0].PacketsSent,
			PacketsRecv: netIO[0].PacketsRecv,
		}
	}

	return NetworkStats{}
}

func collectGPUStats() []GPUStats {
	var gpuStats []GPUStats

	// Try NVIDIA first
	nvidiaGPUs := getNvidiaGPUStats()
	gpuStats = append(gpuStats, nvidiaGPUs...)

	// Try AMD
	amdGPUs := getAMDGPUStats()
	gpuStats = append(gpuStats, amdGPUs...)

	// If no dedicated GPUs found, try to get integrated GPU info
	if len(gpuStats) == 0 {
		integratedGPU := getIntegratedGPUStats()
		if integratedGPU.Name != "" {
			gpuStats = append(gpuStats, integratedGPU)
		}
	}

	return gpuStats
}

func collectProcessStats() []ProcessStats {
	var procStats []ProcessStats

	procs, _ := process.Processes()
	for _, proc := range procs {
		name, err := proc.Name()
		if err != nil {
			continue
		}

		// Filter for relevant processes (AI/ML related)
		if !isRelevantProcess(name) {
			continue
		}

		cpuPercent, _ := proc.CPUPercent()
		memInfo, _ := proc.MemoryInfo()
		status, _ := proc.Status()

		memPercent := 0.0
		if memInfo != nil {
			vmem, _ := mem.VirtualMemory()
			if vmem.Total > 0 {
				memPercent = float64(memInfo.RSS) / float64(vmem.Total) * 100
			}
		}

		procStats = append(procStats, ProcessStats{
			PID:    proc.Pid,
			Name:   name,
			CPU:    cpuPercent,
			Memory: memPercent,
			Status: status[0],
		})
	}

	return procStats
}

func isRelevantProcess(name string) bool {
	relevantProcesses := []string{
		"python", "python3", "ollama", "comfyui", "pytorch", "tensorflow",
		"node", "electron", "clara", "nvidia-smi", "nvtop", "htop",
	}

	nameLower := strings.ToLower(name)
	for _, relevant := range relevantProcesses {
		if strings.Contains(nameLower, relevant) {
			return true
		}
	}
	return false
}

func getNvidiaGPUStats() []GPUStats {
	var gpuStats []GPUStats

	// Check if nvidia-smi is available
	cmd := exec.Command("nvidia-smi", "--query-gpu=name,utilization.gpu,memory.total,memory.used,memory.free,temperature.gpu,fan.speed,power.draw,clocks.current.graphics,clocks.current.memory", "--format=csv,noheader,nounits")
	output, err := cmd.Output()
	if err != nil {
		return gpuStats
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	for _, line := range lines {
		parts := strings.Split(line, ", ")
		if len(parts) >= 10 {
			name := strings.TrimSpace(parts[0])
			usage, _ := strconv.ParseFloat(strings.TrimSpace(parts[1]), 64)
			memTotal, _ := strconv.ParseUint(strings.TrimSpace(parts[2]), 10, 64)
			memUsed, _ := strconv.ParseUint(strings.TrimSpace(parts[3]), 10, 64)
			memFree, _ := strconv.ParseUint(strings.TrimSpace(parts[4]), 10, 64)
			temp, _ := strconv.ParseFloat(strings.TrimSpace(parts[5]), 64)
			fanSpeed, _ := strconv.Atoi(strings.TrimSpace(parts[6]))
			powerDraw, _ := strconv.ParseFloat(strings.TrimSpace(parts[7]), 64)
			clockCore, _ := strconv.Atoi(strings.TrimSpace(parts[8]))
			clockMemory, _ := strconv.Atoi(strings.TrimSpace(parts[9]))

			// Convert MB to bytes
			memTotalBytes := memTotal * 1024 * 1024
			memUsedBytes := memUsed * 1024 * 1024
			memFreeBytes := memFree * 1024 * 1024

			usedPercent := 0.0
			if memTotalBytes > 0 {
				usedPercent = float64(memUsedBytes) / float64(memTotalBytes) * 100
			}

			gpu := GPUStats{
				Name:          name,
				Usage:         usage,
				MemoryTotal:   memTotalBytes,
				MemoryUsed:    memUsedBytes,
				MemoryFree:    memFreeBytes,
				MemoryPercent: usedPercent,
				Temperature:   temp,
				FanSpeed:      fanSpeed,
				PowerDraw:     powerDraw,
				ClockCore:     clockCore,
				ClockMemory:   clockMemory,
			}

			gpuStats = append(gpuStats, gpu)
		}
	}

	return gpuStats
}

func getAMDGPUStats() []GPUStats {
	var gpuStats []GPUStats

	// Try to get AMD GPU info via rocm-smi or other AMD tools
	cmd := exec.Command("rocm-smi", "--showuse", "--showmemuse", "--showtemp")
	output, err := cmd.Output()
	if err != nil {
		return gpuStats // rocm-smi not available
	}

	// Parse rocm-smi output (this is a simplified version)
	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	for _, line := range lines {
		if strings.Contains(line, "GPU") && !strings.Contains(line, "=") {
			// This is a basic implementation - actual parsing would be more complex
			gpu := GPUStats{
				Name:        "AMD GPU",
				Usage:       0.0,
				Temperature: 0.0,
			}
			gpuStats = append(gpuStats, gpu)
		}
	}

	return gpuStats
}

func getIntegratedGPUStats() GPUStats {
	// Basic integrated GPU detection
	gpu := GPUStats{
		Name:        "Integrated GPU",
		Usage:       0.0,
		Temperature: 0.0,
	}

	// Try to detect Intel integrated graphics
	if runtime.GOOS == "windows" {
		// On Windows, we could use WMI queries or other methods
		gpu.Name = "Intel Integrated Graphics"
	} else if runtime.GOOS == "linux" {
		// On Linux, check for intel_gpu_top or other tools
		cmd := exec.Command("intel_gpu_top", "-s", "1000", "-n", "1")
		if cmd.Run() == nil {
			gpu.Name = "Intel Integrated Graphics"
		}
	}

	return gpu
}

func getCPUTemperature() float64 {
	// Try to get CPU temperature (Linux/macOS)
	if runtime.GOOS == "linux" {
		// Try reading from thermal zones
		cmd := exec.Command("cat", "/sys/class/thermal/thermal_zone0/temp")
		output, err := cmd.Output()
		if err == nil {
			temp, err := strconv.ParseFloat(strings.TrimSpace(string(output)), 64)
			if err == nil {
				return temp / 1000.0 // Convert from millidegrees
			}
		}
	} else if runtime.GOOS == "darwin" {
		// Try using powermetrics on macOS
		cmd := exec.Command("powermetrics", "--samplers", "smc", "-n", "1", "--show-process-cpu")
		output, err := cmd.Output()
		if err == nil {
			// Parse powermetrics output for CPU temperature
			lines := strings.Split(string(output), "\n")
			for _, line := range lines {
				if strings.Contains(line, "CPU die temperature") {
					// Extract temperature value
					parts := strings.Fields(line)
					for i, part := range parts {
						if strings.Contains(part, "°C") && i > 0 {
							tempStr := strings.Replace(parts[i-1], "°C", "", -1)
							temp, err := strconv.ParseFloat(tempStr, 64)
							if err == nil {
								return temp
							}
						}
					}
				}
			}
		}
	}

	return 0.0 // Unable to get temperature
}
