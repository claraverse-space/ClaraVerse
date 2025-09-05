#!/usr/bin/env node

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const platform = os.platform();
const arch = os.arch();

// Check command line arguments
const args = process.argv.slice(2);
const buildAllPlatforms = args.includes('--all') || args.includes('-a');

if (buildAllPlatforms) {
  console.log('🌍 Building for all platforms (--all flag detected)');
} else {
  console.log(`🎯 Building for current platform only: ${platform}-${arch}`);
  console.log('   Use --all flag to build for all platforms');
}

// Find Go executable
function findGoExecutable() {
  const possiblePaths = [
    'go', // Try PATH first
    'C:\\Program Files\\Go\\bin\\go.exe',
    'C:\\Go\\bin\\go.exe',
    '/usr/local/go/bin/go',
    '/usr/bin/go',
    process.env.GOROOT ? path.join(process.env.GOROOT, 'bin', 'go') : null
  ].filter(Boolean);

  for (const goPath of possiblePaths) {
    try {
      execSync(`"${goPath}" version`, { stdio: 'pipe' });
      return goPath;
    } catch (error) {
      continue;
    }
  }
  return null;
}

const goExecutable = findGoExecutable();

// Ensure electron/services directory exists
const servicesDir = path.join(__dirname, '..', 'electron', 'services');
if (!fs.existsSync(servicesDir)) {
  fs.mkdirSync(servicesDir, { recursive: true });
}

console.log('Building all services...');

// Check prerequisites
if (!goExecutable) {
  console.error('\n❌ Go is not found.');
  console.error('Please install Go from https://golang.org/dl/ and ensure it\'s in your PATH.');
  console.error('Or set GOROOT environment variable to your Go installation directory.');
  process.exit(1);
}

console.log(`Using Go at: ${goExecutable}`);

// Function to run command and handle errors
function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Running: ${command} ${args.join(' ')}`);
    
    // If command has spaces, we need to handle it properly
    const hasSpaces = command.includes(' ');
    const actualCommand = hasSpaces ? `"${command}"` : command;
    
    const child = spawn(actualCommand, args, {
      stdio: 'inherit',
      shell: true,
      ...options
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

// Helper function to get platform-specific build configuration
function getPlatformConfig() {
  const configs = {
    win32: {
      GOOS: 'windows',
      GOARCH: 'amd64',
      suffix: '.exe',
      name: 'windows'
    },
    darwin: {
      GOOS: 'darwin',
      GOARCH: arch === 'arm64' ? 'arm64' : 'amd64',
      suffix: '',
      name: arch === 'arm64' ? 'darwin-arm64' : 'darwin-amd64'
    },
    linux: {
      GOOS: 'linux',
      GOARCH: 'amd64',
      suffix: '',
      name: 'linux'
    }
  };

  const config = configs[platform];
  if (!config) {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  
  return config;
}

async function buildServices() {
  try {
    if (buildAllPlatforms) {
      await buildAllPlatformsServices();
    } else {
      await buildCurrentPlatformServices();
    }
  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    process.exit(1);
  }
}

async function buildCurrentPlatformServices() {
  const platformConfig = getPlatformConfig();
  console.log(`\n🔧 Building services for ${platformConfig.name} (${platformConfig.GOARCH})`);
  
  // Step 1: Build llama optimizer for current platform only
  console.log('\n=== Building llama optimizer ===');
  process.chdir(path.join(__dirname, '..', 'clara-core-optimiser'));
  
  const optimizerOutput = `../electron/services/llama-optimizer-${platformConfig.name}${platformConfig.suffix}`;
  await runCommand(goExecutable, ['build', '-ldflags="-s -w"', '-o', optimizerOutput, 'llama_optimizer.go'], {
    env: { 
      ...process.env, 
      GOOS: platformConfig.GOOS, 
      GOARCH: platformConfig.GOARCH 
    }
  });

  // Step 2: Build widgets service for current platform only
  console.log('\n=== Building widgets service ===');
  process.chdir(path.join(__dirname, '..', 'widgets_service_app'));
  
  const widgetsOutput = `../electron/services/widgets-service-${platformConfig.name}${platformConfig.suffix}`;
  await runCommand(goExecutable, ['build', '-ldflags="-s -w"', '-o', widgetsOutput, 'main.go', 'enhanced_pdf_processor.go'], {
    env: { 
      ...process.env, 
      CGO_ENABLED: '0', 
      GOOS: platformConfig.GOOS, 
      GOARCH: platformConfig.GOARCH 
    }
  });

  // Step 3: Build MCP server for current platform only
  console.log('\n=== Building MCP server ===');
  process.chdir(path.join(__dirname, '..', 'clara-mcp'));
  
  const mcpOutput = `../electron/services/python-mcp-server-${platformConfig.name}${platformConfig.suffix}`;
  await runCommand(goExecutable, ['build', '-ldflags="-s -w"', '-o', mcpOutput, '.'], {
    env: { 
      ...process.env, 
      CGO_ENABLED: '0', 
      GOOS: platformConfig.GOOS, 
      GOARCH: platformConfig.GOARCH 
    }
  });
  
  // Build alternative naming for macOS compatibility
  if (platform === 'darwin') {
    const altMcpOutput = `../electron/services/python-mcp-server-mac-${platformConfig.GOARCH}`;
    await runCommand(goExecutable, ['build', '-ldflags="-s -w"', '-o', altMcpOutput, '.'], {
      env: { 
        ...process.env, 
        CGO_ENABLED: '0', 
        GOOS: platformConfig.GOOS, 
        GOARCH: platformConfig.GOARCH 
      }
    });
  }

  console.log(`\n✅ All services built successfully for ${platformConfig.name}!`);
}

async function buildAllPlatformsServices() {
  console.log('\n🌍 Building services for all platforms...');
  
  // Step 1: Build llama optimizer for all platforms
  console.log('\n=== Building llama optimizer ===');
  process.chdir(path.join(__dirname, '..', 'clara-core-optimiser'));
  
  // Windows
  await runCommand(goExecutable, ['build', '-ldflags="-s -w"', '-o', '../electron/services/llama-optimizer-windows.exe', 'llama_optimizer.go']);
  
  // macOS AMD64
  await runCommand(goExecutable, ['build', '-ldflags="-s -w"', '-o', '../electron/services/llama-optimizer-darwin-amd64', 'llama_optimizer.go'], {
    env: { ...process.env, GOOS: 'darwin', GOARCH: 'amd64' }
  });
  
  // macOS ARM64
  await runCommand(goExecutable, ['build', '-ldflags="-s -w"', '-o', '../electron/services/llama-optimizer-darwin-arm64', 'llama_optimizer.go'], {
    env: { ...process.env, GOOS: 'darwin', GOARCH: 'arm64' }
  });
  
  // Linux
  await runCommand(goExecutable, ['build', '-ldflags="-s -w"', '-o', '../electron/services/llama-optimizer-linux', 'llama_optimizer.go'], {
    env: { ...process.env, GOOS: 'linux', GOARCH: 'amd64' }
  });

  // Step 2: Build widgets service for all platforms
  console.log('\n=== Building widgets service ===');
  process.chdir(path.join(__dirname, '..', 'widgets_service_app'));
  
  // Windows
  await runCommand(goExecutable, ['build', '-ldflags="-s -w"', '-o', '../electron/services/widgets-service-windows.exe', 'main.go', 'enhanced_pdf_processor.go'], {
    env: { ...process.env, CGO_ENABLED: '0', GOOS: 'windows', GOARCH: 'amd64' }
  });
  
  // Linux
  await runCommand(goExecutable, ['build', '-ldflags="-s -w"', '-o', '../electron/services/widgets-service-linux', 'main.go', 'enhanced_pdf_processor.go'], {
    env: { ...process.env, CGO_ENABLED: '0', GOOS: 'linux', GOARCH: 'amd64' }
  });
  
  // macOS AMD64
  await runCommand(goExecutable, ['build', '-ldflags="-s -w"', '-o', '../electron/services/widgets-service-darwin-amd64', 'main.go', 'enhanced_pdf_processor.go'], {
    env: { ...process.env, CGO_ENABLED: '0', GOOS: 'darwin', GOARCH: 'amd64' }
  });
  
  // macOS ARM64
  await runCommand(goExecutable, ['build', '-ldflags="-s -w"', '-o', '../electron/services/widgets-service-darwin-arm64', 'main.go', 'enhanced_pdf_processor.go'], {
    env: { ...process.env, CGO_ENABLED: '0', GOOS: 'darwin', GOARCH: 'arm64' }
  });

  // Step 3: Build MCP server for all platforms
  console.log('\n=== Building MCP server ===');
  process.chdir(path.join(__dirname, '..', 'clara-mcp'));
  
  // Windows
  await runCommand(goExecutable, ['build', '-ldflags="-s -w"', '-o', '../electron/services/python-mcp-server-windows.exe', '.'], {
    env: { ...process.env, CGO_ENABLED: '0', GOOS: 'windows', GOARCH: 'amd64' }
  });
  
  // Linux
  await runCommand(goExecutable, ['build', '-ldflags="-s -w"', '-o', '../electron/services/python-mcp-server-linux', '.'], {
    env: { ...process.env, CGO_ENABLED: '0', GOOS: 'linux', GOARCH: 'amd64' }
  });
  
  // macOS AMD64
  await runCommand(goExecutable, ['build', '-ldflags="-s -w"', '-o', '../electron/services/python-mcp-server-darwin-amd64', '.'], {
    env: { ...process.env, CGO_ENABLED: '0', GOOS: 'darwin', GOARCH: 'amd64' }
  });
  
  // macOS ARM64
  await runCommand(goExecutable, ['build', '-ldflags="-s -w"', '-o', '../electron/services/python-mcp-server-darwin-arm64', '.'], {
    env: { ...process.env, CGO_ENABLED: '0', GOOS: 'darwin', GOARCH: 'arm64' }
  });
  
  // macOS AMD64 (alternative naming)
  await runCommand(goExecutable, ['build', '-ldflags="-s -w"', '-o', '../electron/services/python-mcp-server-mac-amd64', '.'], {
    env: { ...process.env, CGO_ENABLED: '0', GOOS: 'darwin', GOARCH: 'amd64' }
  });
  
  // macOS ARM64 (alternative naming)
  await runCommand(goExecutable, ['build', '-ldflags="-s -w"', '-o', '../electron/services/python-mcp-server-mac-arm64', '.'], {
    env: { ...process.env, CGO_ENABLED: '0', GOOS: 'darwin', GOARCH: 'arm64' }
  });

  console.log('\n✅ All services built successfully for all platforms!');
}

buildServices();
