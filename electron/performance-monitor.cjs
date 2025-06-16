const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');

const execAsync = promisify(exec);

class PerformanceMonitor {
  constructor() {
    this.logPath = path.join(os.homedir(), '.clara', 'performance.log');
    this.isMonitoring = false;
    this.monitoringInterval = null;
  }

  /**
   * Start monitoring ComfyUI performance
   */
  async startMonitoring() {
    if (this.isMonitoring) {
      console.log('Performance monitoring already running');
      return;
    }

    console.log('🚀 Starting ComfyUI performance monitoring...');
    this.isMonitoring = true;

    // Monitor every 5 seconds
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectMetrics();
      } catch (error) {
        console.error('Error collecting metrics:', error.message);
      }
    }, 5000);

    // Initial metrics collection
    await this.collectMetrics();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('Performance monitoring stopped');
  }

  /**
   * Collect comprehensive performance metrics
   */
  async collectMetrics() {
    const timestamp = new Date().toISOString();
    const metrics = {
      timestamp,
      gpu: await this.getGPUMetrics(),
      docker: await this.getDockerMetrics(),
      system: await this.getSystemMetrics(),
      comfyui: await this.getComfyUIMetrics()
    };

    // Log to file
    this.logMetrics(metrics);

    // Print summary to console
    this.printSummary(metrics);

    return metrics;
  }

  /**
   * Get GPU performance metrics
   */
  async getGPUMetrics() {
    try {
      const { stdout } = await execAsync('nvidia-smi --query-gpu=name,temperature.gpu,utilization.gpu,utilization.memory,memory.used,memory.total,power.draw,clocks.gr,clocks.mem --format=csv,noheader,nounits');
      
      const lines = stdout.trim().split('\n');
      const gpus = lines.map(line => {
        const [name, temp, gpuUtil, memUtil, memUsed, memTotal, power, gpuClock, memClock] = line.split(', ');
        return {
          name: name.trim(),
          temperature: parseInt(temp) || 0,
          gpuUtilization: parseInt(gpuUtil) || 0,
          memoryUtilization: parseInt(memUtil) || 0,
          memoryUsed: parseInt(memUsed) || 0,
          memoryTotal: parseInt(memTotal) || 0,
          powerDraw: parseInt(power) || 0,
          gpuClock: parseInt(gpuClock) || 0,
          memoryClock: parseInt(memClock) || 0
        };
      });

      return gpus[0] || null; // Return first GPU
    } catch (error) {
      console.warn('Could not get GPU metrics:', error.message);
      return null;
    }
  }

  /**
   * Get Docker container metrics
   */
  async getDockerMetrics() {
    try {
      const { stdout } = await execAsync('docker stats clara_comfyui --no-stream --format "table {{.CPUPerc}},{{.MemUsage}},{{.NetIO}},{{.BlockIO}}"');
      
      const lines = stdout.trim().split('\n');
      if (lines.length < 2) return null;

      const data = lines[1].split(',');
      const [cpuPerc, memUsage, netIO, blockIO] = data;

      return {
        cpuPercent: parseFloat(cpuPerc.replace('%', '')) || 0,
        memoryUsage: memUsage.trim(),
        networkIO: netIO.trim(),
        blockIO: blockIO.trim()
      };
    } catch (error) {
      console.warn('Could not get Docker metrics:', error.message);
      return null;
    }
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics() {
    try {
      const cpus = os.cpus();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;

      return {
        cpuCount: cpus.length,
        cpuModel: cpus[0].model,
        memoryTotal: Math.round(totalMem / 1024 / 1024 / 1024), // GB
        memoryUsed: Math.round(usedMem / 1024 / 1024 / 1024), // GB
        memoryFree: Math.round(freeMem / 1024 / 1024 / 1024), // GB
        memoryPercent: Math.round((usedMem / totalMem) * 100),
        loadAverage: os.loadavg(),
        uptime: os.uptime()
      };
    } catch (error) {
      console.warn('Could not get system metrics:', error.message);
      return null;
    }
  }

  /**
   * Get ComfyUI specific metrics
   */
  async getComfyUIMetrics() {
    try {
      // Check if ComfyUI is responding
      const startTime = Date.now();
      const response = await fetch('http://localhost:8188/system_stats');
      const responseTime = Date.now() - startTime;

      if (response.ok) {
        const stats = await response.json();
        return {
          responseTime,
          isResponding: true,
          systemStats: stats
        };
      } else {
        return {
          responseTime,
          isResponding: false,
          error: `HTTP ${response.status}`
        };
      }
    } catch (error) {
      return {
        responseTime: null,
        isResponding: false,
        error: error.message
      };
    }
  }

  /**
   * Log metrics to file
   */
  logMetrics(metrics) {
    try {
      const logEntry = JSON.stringify(metrics) + '\n';
      fs.appendFileSync(this.logPath, logEntry);
    } catch (error) {
      console.error('Error logging metrics:', error.message);
    }
  }

  /**
   * Print performance summary
   */
  printSummary(metrics) {
    console.log('\n📊 Performance Summary:');
    console.log('========================');

    if (metrics.gpu) {
      const gpu = metrics.gpu;
      console.log(`🎮 GPU: ${gpu.name}`);
      console.log(`   Utilization: ${gpu.gpuUtilization}% | Memory: ${gpu.memoryUtilization}% (${gpu.memoryUsed}MB/${gpu.memoryTotal}MB)`);
      console.log(`   Temperature: ${gpu.temperature}°C | Power: ${gpu.powerDraw}W`);
      console.log(`   Clocks: GPU ${gpu.gpuClock}MHz | Memory ${gpu.memoryClock}MHz`);
    }

    if (metrics.docker) {
      const docker = metrics.docker;
      console.log(`🐳 Docker: CPU ${docker.cpuPercent}% | Memory: ${docker.memoryUsage}`);
    }

    if (metrics.system) {
      const sys = metrics.system;
      console.log(`💻 System: RAM ${sys.memoryPercent}% (${sys.memoryUsed}GB/${sys.memoryTotal}GB)`);
    }

    if (metrics.comfyui) {
      const comfy = metrics.comfyui;
      if (comfy.isResponding) {
        console.log(`🎨 ComfyUI: Responding (${comfy.responseTime}ms)`);
      } else {
        console.log(`❌ ComfyUI: Not responding (${comfy.error})`);
      }
    }

    console.log('========================\n');
  }

  /**
   * Generate performance report
   */
  async generateReport() {
    try {
      if (!fs.existsSync(this.logPath)) {
        console.log('No performance data available');
        return;
      }

      const data = fs.readFileSync(this.logPath, 'utf8');
      const lines = data.trim().split('\n');
      const metrics = lines.map(line => JSON.parse(line));

      console.log('\n📈 Performance Report:');
      console.log('======================');

      if (metrics.length === 0) {
        console.log('No data available');
        return;
      }

      // Calculate averages
      const gpuMetrics = metrics.filter(m => m.gpu).map(m => m.gpu);
      const dockerMetrics = metrics.filter(m => m.docker).map(m => m.docker);
      const comfyuiMetrics = metrics.filter(m => m.comfyui).map(m => m.comfyui);

      if (gpuMetrics.length > 0) {
        const avgGpuUtil = gpuMetrics.reduce((sum, m) => sum + m.gpuUtilization, 0) / gpuMetrics.length;
        const avgMemUtil = gpuMetrics.reduce((sum, m) => sum + m.memoryUtilization, 0) / gpuMetrics.length;
        const avgTemp = gpuMetrics.reduce((sum, m) => sum + m.temperature, 0) / gpuMetrics.length;
        const avgPower = gpuMetrics.reduce((sum, m) => sum + m.powerDraw, 0) / gpuMetrics.length;

        console.log(`🎮 GPU Averages:`);
        console.log(`   Utilization: ${avgGpuUtil.toFixed(1)}%`);
        console.log(`   Memory: ${avgMemUtil.toFixed(1)}%`);
        console.log(`   Temperature: ${avgTemp.toFixed(1)}°C`);
        console.log(`   Power: ${avgPower.toFixed(1)}W`);
      }

      if (dockerMetrics.length > 0) {
        const avgCpuUtil = dockerMetrics.reduce((sum, m) => sum + m.cpuPercent, 0) / dockerMetrics.length;
        console.log(`🐳 Docker Average CPU: ${avgCpuUtil.toFixed(1)}%`);
      }

      if (comfyuiMetrics.length > 0) {
        const respondingCount = comfyuiMetrics.filter(m => m.isResponding).length;
        const avgResponseTime = comfyuiMetrics
          .filter(m => m.responseTime)
          .reduce((sum, m) => sum + m.responseTime, 0) / comfyuiMetrics.filter(m => m.responseTime).length;

        console.log(`🎨 ComfyUI:`);
        console.log(`   Uptime: ${((respondingCount / comfyuiMetrics.length) * 100).toFixed(1)}%`);
        if (avgResponseTime) {
          console.log(`   Avg Response Time: ${avgResponseTime.toFixed(0)}ms`);
        }
      }

      console.log(`\n📊 Total samples: ${metrics.length}`);
      console.log(`⏱️  Duration: ${((metrics.length * 5) / 60).toFixed(1)} minutes`);
      console.log('======================\n');

    } catch (error) {
      console.error('Error generating report:', error.message);
    }
  }

  /**
   * Clear performance logs
   */
  clearLogs() {
    try {
      if (fs.existsSync(this.logPath)) {
        fs.unlinkSync(this.logPath);
        console.log('Performance logs cleared');
      }
    } catch (error) {
      console.error('Error clearing logs:', error.message);
    }
  }

  /**
   * Run a quick performance test
   */
  async runPerformanceTest() {
    console.log('🧪 Running ComfyUI performance test...');
    
    try {
      // Test basic API response
      const startTime = Date.now();
      const response = await fetch('http://localhost:8188/system_stats');
      const apiTime = Date.now() - startTime;

      if (response.ok) {
        console.log(`✅ API Response: ${apiTime}ms`);
      } else {
        console.log(`❌ API Error: HTTP ${response.status}`);
        return;
      }

      // Get current metrics
      const metrics = await this.collectMetrics();

      // Performance recommendations
      console.log('\n💡 Performance Recommendations:');
      console.log('================================');

      if (metrics.gpu) {
        const gpu = metrics.gpu;
        
        if (gpu.gpuUtilization < 80) {
          console.log('⚠️  GPU utilization is low - consider increasing batch size or using more complex models');
        }
        
        if (gpu.memoryUtilization < 50) {
          console.log('💡 GPU memory usage is low - you can handle larger models or higher resolutions');
        }
        
        if (gpu.temperature > 80) {
          console.log('🌡️  GPU temperature is high - consider improving cooling');
        }
        
        if (gpu.powerDraw < 300) {
          console.log('⚡ GPU power draw is low - performance may be limited by power or thermal throttling');
        }
      }

      if (metrics.docker) {
        const docker = metrics.docker;
        
        if (docker.cpuPercent > 80) {
          console.log('🔥 Docker CPU usage is high - consider allocating more CPU cores');
        }
      }

      if (apiTime > 1000) {
        console.log('🐌 API response time is slow - check network and container health');
      }

      console.log('================================\n');

    } catch (error) {
      console.error('Performance test failed:', error.message);
    }
  }
}

module.exports = PerformanceMonitor; 