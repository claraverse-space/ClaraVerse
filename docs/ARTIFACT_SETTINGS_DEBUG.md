# 🔧 Artifact Settings Debug Guide

## Issue: Can't interact with artifact settings

### Quick Checklist:

1. **✅ Advanced Options Panel**
   - Click the ⚙️ Settings icon in the chat input area
   - Panel should expand above the input
   - Look for multiple collapsible sections

2. **✅ Artifact Generation Section**
   - Scroll down in Advanced Options
   - Find "Artifact Generation" with 🎨 palette icon
   - Badge should show "Auto" or "Manual"
   - Click to expand the section

3. **✅ Interactive Elements**
   - Toggle switch for "Auto-Detect Artifacts"
   - 8 checkboxes for artifact types (Code, Charts, Tables, etc.)
   - Slider for "Max Artifacts per Message"

### Debug Steps:

#### Step 1: Check Browser Console
1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Look for any JavaScript errors
4. Common errors might be:
   - `Cannot read property 'artifacts' of undefined`
   - `onConfigChange is not a function`
   - Import/export errors

#### Step 2: Verify Configuration State
1. In browser console, type:
   ```javascript
   // Check if sessionConfig exists
   console.log('Session Config:', window.sessionConfig);
   
   // Check if artifacts config exists
   console.log('Artifacts Config:', window.sessionConfig?.aiConfig?.artifacts);
   ```

#### Step 3: Test Manual Configuration
1. In browser console, try:
   ```javascript
   // Manually trigger artifact config change
   if (window.onConfigChange) {
     window.onConfigChange({
       artifacts: {
         enableChartArtifacts: false,
         autoDetectArtifacts: true
       }
     });
   }
   ```

### Possible Issues & Solutions:

#### Issue 1: Advanced Options Not Opening
- **Cause**: Settings button not working
- **Solution**: Check if `onAdvancedOptionsToggle` prop is passed correctly

#### Issue 2: Artifact Section Not Visible
- **Cause**: Section collapsed by default
- **Solution**: Click on "Artifact Generation" header to expand

#### Issue 3: Toggles Not Responding
- **Cause**: `onConfigChange` not properly connected
- **Solution**: Check the config change handler in ClaraAssistant.tsx

#### Issue 4: Settings Not Persisting
- **Cause**: Configuration not being saved to localStorage
- **Solution**: Check `saveProviderConfig` function

### Expected Behavior:

1. **Auto-Detect Toggle**: Should immediately enable/disable artifact detection
2. **Artifact Type Toggles**: Should enable/disable specific artifact types
3. **Max Artifacts Slider**: Should limit number of artifacts per message
4. **Settings Persistence**: Should save automatically and persist across sessions

### Test Artifact Generation:

Once settings are working, test with these prompts:

1. **Code Artifact**: "Create a Python function to calculate fibonacci"
2. **Chart Artifact**: "Show me sales data in a bar chart format"
3. **Table Artifact**: "Create a table of top 5 programming languages"
4. **Mermaid Artifact**: "Draw a flowchart for user login process"

### If Still Not Working:

1. **Clear Browser Cache**: Hard refresh (Ctrl+Shift+R)
2. **Check Network Tab**: Look for failed API calls
3. **Restart Dev Server**: `npm run dev`
4. **Check File Permissions**: Ensure all files are readable

### Contact Information:

If the issue persists, provide:
1. Browser console errors
2. Network tab errors
3. Steps you've tried
4. Browser and OS version 