---
title: "LumaUI"
description: "AI-powered web development that adapts to your skill level"
category: "features"
order: 6
lastUpdated: "2025-09-06"
contributors: ["badboysm890"]
---

<img src="https://raw.githubusercontent.com/badboysm890/ClaraVerse/46ba2e0dfab65c898c32f186a59293588fd5e99a/public/mascot/LumaUI.png" alt="Clara developing web applications with LumaUI" width="400" />

# LumaUI

Web development environment with AI assistance, running locally.

## What LumaUI Is

LumaUI provides two ways to build web applications:
1. **LumaUI-lite**: Simple HTML/CSS/JS editor with live preview
2. **Full LumaUI**: Complete development environment with WebContainer (Node.js in browser)

Both integrate with Clara for AI-assisted development.

## System Requirements

- Base ClaraVerse requirements
- Chrome/Edge browser (WebContainer needs Chromium)
- 4GB+ free RAM for Full LumaUI
- Internet for CDN libraries (lite) or npm packages (full)

## LumaUI-lite

### What It Is
Basic web editor for single-page applications. No build tools, no complexity.

### Features
- HTML, CSS, JavaScript files
- Live preview
- CDN library access
- AI code assistance

### Built-in Libraries
```html
<!-- Automatically available via CDN -->
- Tailwind CSS
- Font Awesome
- Google Fonts
- Animate.css
- Alpine.js
```

### Use Cases
- Landing pages
- Prototypes
- Learning web dev
- Simple tools

### Workflow
```
1. Create project
2. Edit HTML/CSS/JS
3. See live preview
4. Ask Clara for help
5. Export when done
```

## Full LumaUI

### What It Is
Full development environment using WebContainer technology. Think VS Code + Node.js in your browser.

### Features
- Full Node.js environment
- NPM package manager
- Terminal access
- Git support
- Hot reloading
- Framework support (React, Vue, Svelte)

### Capabilities
```bash
# In the terminal
npm install any-package
npm run dev
git init
node server.js
```

### Use Cases
- React/Vue applications
- Full-stack development
- Complex projects
- Learning modern frameworks

## AI Integration

### How Clara Helps
```
You: "Add a contact form"
Clara: [Generates form code, adds to project]

You: "Make this responsive"
Clara: [Updates CSS with media queries]

You: "Debug this error"
Clara: [Analyzes code, suggests fix]
```

### Best Models for Coding
- **Cloud**: GPT-4, Claude (best results)
- **Local**: 20B+ models with tool calling
- **Minimum**: 7B models (basic assistance only)

## Choosing Which Version

### Use LumaUI-lite When:
- Building simple sites
- Learning HTML/CSS/JS
- Need quick prototypes
- Limited system resources
- No build process needed

### Use Full LumaUI When:
- Building React/Vue apps
- Need npm packages
- Want real development environment
- Building complex applications
- Need build tools

## Common Workflows

### Creating a Portfolio (Lite)
```
1. New project → Choose template
2. Edit content in HTML
3. Style with Tailwind classes
4. Add interactions with Alpine.js
5. Export and deploy
```

### Building React App (Full)
```
1. Select React template
2. npm install dependencies
3. Edit components
4. Clara helps with logic
5. npm run build
6. Deploy build folder
```

## Performance Expectations

### LumaUI-lite
- Instant preview updates
- No build time
- Lightweight (~10MB memory)

### Full LumaUI
- Initial load: 30-60 seconds
- npm install: Depends on packages
- Build times: Similar to local development
- Memory usage: 500MB-2GB

## Integration with ClaraVerse

### With Clara Assistant
```
"Create a dashboard for my data"
Clara uses LumaUI to build it
```

### With ImageGen
```
Generate images → Use in web project
```

### With Notebooks
```
Build documentation site from notebook content
```

### With Agents
```
Agent generates content → LumaUI displays it
```

### With N8N
```
LumaUI frontend → N8N webhook backend
```

## Limitations

### LumaUI-lite
1. No backend capabilities
2. No build tools
3. Limited to browser APIs
4. Single page only
5. No npm packages

### Full LumaUI
1. WebContainer browser limitations
2. No native modules
3. Chrome/Edge only
4. Memory intensive
5. No direct file system access

## Common Issues

**WebContainer Won't Start**
- Use Chrome or Edge (not Firefox/Safari)
- Check available RAM
- Disable browser extensions
- Clear browser cache

**npm Install Fails**
- Check internet connection
- Try different package registry
- Some packages incompatible with WebContainer

**Preview Not Updating**
- Check for JavaScript errors
- Verify dev server running
- Try manual refresh

## File Management

### LumaUI-lite
- Files stored in IndexedDB
- Export as ZIP
- Import existing projects

### Full LumaUI
- Virtual file system
- Git for version control
- Export entire project

## Deployment

### From LumaUI-lite
```
1. Export project
2. Upload to any static host
3. Works immediately
```

### From Full LumaUI
```
1. Run build command
2. Export dist/build folder
3. Deploy to static host
4. Or use CI/CD pipeline
```

## Pro Tips

1. **Start with Lite** for simple projects
2. **Use Clara** for boilerplate code
3. **Test mobile view** in preview
4. **Save regularly** (browser storage can be cleared)
5. **Use templates** to start faster
6. **Keep projects small** in Full version

## Code Quality with Clara

### Good Prompts
```
"Add form validation using native HTML5"
"Create responsive grid with Tailwind"
"Add error handling to this function"
```

### Avoid
```
"Make it better" (too vague)
"Copy this entire codebase" (copyright)
"Add every possible feature" (scope creep)
```

## Getting Started

### LumaUI-lite
1. Click "New Project"
2. Choose "Blank" or template
3. Edit index.html
4. See instant preview
5. Ask Clara for enhancements

### Full LumaUI
1. Select framework (React/Vue/Vanilla)
2. Wait for environment setup
3. Open terminal: `npm install`
4. Start dev server: `npm run dev`
5. Edit and see hot reload

Remember: LumaUI is for building real projects, not just demos. The AI assistance makes it accessible for beginners while powerful enough for professionals.