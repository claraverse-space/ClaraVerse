# GPU Layers User Override Fix

## Problem
The system was automatically calculating optimal GPU layers for models but **completely ignoring user-configured settings**. When users manually set GPU layers in the Performance Configuration settings, the system would still use the automatically calculated values instead of respecting the user's choices.

## Root Cause
In `electron/llamaSwapService.cjs`, the `generateConfig()` function had this problematic logic:

```javascript
// OLD CODE - ALWAYS calculated and used automatic values
const optimalGpuLayers = await this.calculateOptimalGPULayers(model.path, model.size);

// Add dynamic GPU layers based on calculation
if (optimalGpuLayers > 0) {
  cmdLine += ` --n-gpu-layers ${optimalGpuLayers}`;
}
```

The system would:
1. ✅ Load user performance settings from `~/.clara/settings/performance-settings.json`
2. ❌ **Ignore the `gpuLayers` setting completely**
3. ❌ Always calculate optimal layers automatically
4. ❌ Always use the calculated value instead of user preference

## Solution Implemented

### 1. User Override Priority System
Updated the logic to **prioritize user settings over automatic calculation**:

```javascript
// NEW CODE - Checks user setting first
let gpuLayersToUse;
if (globalPerfSettings.gpuLayers !== undefined && globalPerfSettings.gpuLayers !== null) {
  // User has explicitly set GPU layers - use their setting
  gpuLayersToUse = globalPerfSettings.gpuLayers;
  log.info(`Model ${model.name}: Using user-configured GPU layers: ${gpuLayersToUse}`);
} else {
  // No user setting - calculate optimal GPU layers for this specific model
  gpuLayersToUse = await this.calculateOptimalGPULayers(model.path, model.size);
  log.info(`Model ${model.name}: Using auto-calculated GPU layers: ${gpuLayersToUse}`);
}
```

### 2. Fixed Additional Settings
Also applied the same fix to other settings that were being auto-calculated:

#### Batch Sizes
- **Before**: Always calculated automatically
- **After**: Uses user's `batchSize` and `ubatchSize` settings when available

#### Memory Lock
- **Before**: Always enabled (`--mlock`)
- **After**: Respects user's `memoryLock` setting

### 3. Updated Default Settings
Enhanced `getDefaultPerformanceSettings()` to include missing fields:

```javascript
return {
  // ... existing settings ...
  gpuLayers: undefined,   // undefined = auto-calculate, number = user override
  batchSize: 256,
  ubatchSize: 256,
  memoryLock: true
};
```

## How It Works Now

### When User Sets Manual Values
1. User adjusts "GPU Layers" slider in Settings → Local Models → Hardware Acceleration
2. Settings are saved to `~/.clara/settings/performance-settings.json`
3. When generating model configs, system checks: "Does user have `gpuLayers` set?"
4. ✅ **Uses user's setting instead of calculating automatically**
5. Logs: `"Model XYZ: Using user-configured GPU layers: 42"`

### When User Doesn't Set Values
1. `gpuLayers` remains `undefined` in settings
2. System detects no user preference
3. Falls back to automatic calculation based on hardware
4. Logs: `"Model XYZ: Using auto-calculated GPU layers: 35"`

### Reset to Auto Behavior
- If user wants to go back to automatic calculation, they can:
  1. Click "Reset to Optimal Defaults" button, OR
  2. Manually delete the setting from the JSON file

## Benefits

✅ **User control**: Manual settings are now properly respected  
✅ **Smart defaults**: Auto-calculation still works when no user preference  
✅ **Clear logging**: System logs which source is being used  
✅ **Consistent behavior**: Same pattern applied to GPU layers, batch sizes, and memory lock  
✅ **No breaking changes**: Existing functionality preserved for users who haven't customized settings

## Test Scenarios

### Scenario 1: Fresh Install
- User hasn't configured anything
- System auto-calculates optimal GPU layers
- ✅ **Result**: Uses calculated value (e.g., 35 layers)

### Scenario 2: User Override
- User sets GPU Layers slider to 50
- User saves settings
- System regenerates config
- ✅ **Result**: Uses user's 50 layers instead of calculated 35

### Scenario 3: User Reset
- User clicks "Reset to Optimal Defaults"
- GPU layers setting becomes undefined again
- ✅ **Result**: Goes back to auto-calculation

This fix ensures that **user preferences always take priority** while maintaining intelligent defaults for users who prefer automatic optimization. 