import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import * as path from 'path';
import { initialize, enable } from '@electron/remote/main';
const DockerSetup = require('./dockerSetup.cjs');

// Initialize remote module
initialize();

let dockerSetup: any = null;

async function initializeDockerServices(win: BrowserWindow) {
  dockerSetup = new DockerSetup();
  
  try {
    await dockerSetup.setup((status: string, type: string = 'info') => {
      // Send status updates to renderer
      win.webContents.send('setup-status', { status, type });
    });
  } catch (error) {
    dialog.showErrorBox('Setup Error', error.message);
  }
}

// IPC Handlers
ipcMain.handle('get-service-ports', async () => {
  return dockerSetup ? dockerSetup.ports : null;
});

ipcMain.handle('check-n8n-health', async () => {
  try {
    return await dockerSetup.checkN8NHealth();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('start-n8n', async () => {
  try {
    return await dockerSetup.startN8N();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('stop-n8n', async () => {
  try {
    return await dockerSetup.stopN8N();
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-python-port', async () => {
  try {
    return dockerSetup ? dockerSetup.ports.python : null;
  } catch (error) {
    return null;
  }
});

ipcMain.handle('check-python-backend', async () => {
  try {
    const port = dockerSetup ? dockerSetup.ports.python : null;
    return { port };
  } catch (error) {
    return { port: null };
  }
});

// Docker Container Management Handlers
ipcMain.handle('get-containers', async () => {
  try {
    if (!dockerSetup) return [];
    
    const docker = dockerSetup.docker;
    const containers = await docker.listContainers({ all: true });
    
    return containers.map((container: any) => {
      const ports = container.Ports.map((p: any) => 
        p.PublicPort ? `${p.PublicPort}:${p.PrivatePort}` : `${p.PrivatePort}`
      );
      
      return {
        id: container.Id,
        name: container.Names[0].replace(/^\//, ''),
        image: container.Image,
        status: container.Status,
        state: container.State === 'running' ? 'running' : 
               container.State === 'exited' ? 'stopped' : container.State,
        ports: ports,
        created: new Date(container.Created * 1000).toLocaleString()
      };
    });
  } catch (error) {
    console.error('Error listing containers:', error);
    return [];
  }
});

ipcMain.handle('container-action', async (_event, { containerId, action }) => {
  try {
    if (!dockerSetup) throw new Error('Docker setup not initialized');
    
    const docker = dockerSetup.docker;
    const container = docker.getContainer(containerId);
    
    switch (action) {
      case 'start':
        await container.start();
        break;
      case 'stop':
        await container.stop();
        break;
      case 'restart':
        await container.restart();
        break;
      case 'remove':
        await container.remove({ force: true });
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    return { success: true };
  } catch (error) {
    console.error(`Error performing action ${action} on container:`, error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('create-container', async (_event, containerConfig) => {
  try {
    if (!dockerSetup) throw new Error('Docker setup not initialized');
    
    const docker = dockerSetup.docker;
    
    // Format ports for Docker API
    const portBindings: any = {};
    const exposedPorts: any = {};
    
    containerConfig.ports.forEach((port: any) => {
      const containerPort = `${port.container}/tcp`;
      exposedPorts[containerPort] = {};
      portBindings[containerPort] = [{ HostPort: port.host.toString() }];
    });
    
    // Format volumes for Docker API
    const binds = containerConfig.volumes.map((volume: any) => 
      `${volume.host}:${volume.container}`
    );
    
    // Format environment variables
    const env = Object.entries(containerConfig.env).map(([key, value]) => `${key}=${value}`);
    
    // Create container
    const container = await docker.createContainer({
      Image: containerConfig.image,
      name: containerConfig.name,
      ExposedPorts: exposedPorts,
      Env: env,
      HostConfig: {
        PortBindings: portBindings,
        Binds: binds,
        NetworkMode: 'clara_network'
      }
    });
    
    // Start the container
    await container.start();
    
    return { success: true, id: container.id };
  } catch (error) {
    console.error('Error creating container:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-container-stats', async (_event, containerId) => {
  try {
    if (!dockerSetup) throw new Error('Docker setup not initialized');
    
    const docker = dockerSetup.docker;
    const container = docker.getContainer(containerId);
    
    const stats = await container.stats({ stream: false });
    
    // Calculate CPU usage percentage
    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemCpuDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuCount = stats.cpu_stats.online_cpus || 1;
    const cpuPercent = (cpuDelta / systemCpuDelta) * cpuCount * 100;
    
    // Calculate memory usage
    const memoryUsage = stats.memory_stats.usage || 0;
    const memoryLimit = stats.memory_stats.limit || 1;
    const memoryPercent = (memoryUsage / memoryLimit) * 100;
    
    // Format network I/O
    let networkRx = 0;
    let networkTx = 0;
    
    if (stats.networks) {
      Object.keys(stats.networks).forEach(iface => {
        networkRx += stats.networks[iface].rx_bytes || 0;
        networkTx += stats.networks[iface].tx_bytes || 0;
      });
    }
    
    return {
      cpu: `${cpuPercent.toFixed(2)}%`,
      memory: `${formatBytes(memoryUsage)} / ${formatBytes(memoryLimit)} (${memoryPercent.toFixed(2)}%)`,
      network: `↓ ${formatBytes(networkRx)} / ↑ ${formatBytes(networkTx)}`
    };
  } catch (error) {
    console.error('Error getting container stats:', error);
    return { cpu: 'N/A', memory: 'N/A', network: 'N/A' };
  }
});

ipcMain.handle('get-container-logs', async (_event, containerId) => {
  try {
    if (!dockerSetup) throw new Error('Docker setup not initialized');
    
    const docker = dockerSetup.docker;
    const container = docker.getContainer(containerId);
    
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: 100,
      follow: false
    });
    
    return logs.toString();
  } catch (error) {
    console.error('Error getting container logs:', error);
    return '';
  }
});

// Helper function to format bytes
function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // Enable remote module for this window
  enable(win.webContents);

  // Initialize Docker services
  initializeDockerServices(win);

  // Load your app
  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  } else {
    win.loadURL('http://localhost:5173'); // Vite dev server default port
  }

  // Open DevTools in development
  if (!app.isPackaged) {
    win.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  // Stop Docker containers when app closes
  if (dockerSetup) {
    await dockerSetup.stop();
  }
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
}); 