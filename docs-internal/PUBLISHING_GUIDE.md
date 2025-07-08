# 📦 Publishing Clara Flow SDK to npm

## Prerequisites

1. **npm Account**: Create an account at https://www.npmjs.com/
2. **npm CLI**: Already installed with Node.js
3. **Repository**: Your code should be in a git repository

## Step-by-Step Publishing Process

### 1. 🔐 Authenticate with npm

```bash
# Login to npm (follow the prompts)
npm login

# Verify you're logged in
npm whoami
```

### 2. 🔍 Check Package Name Availability

```bash
# Check if the package name is available
npm view clara-flow-sdk

# If the name is taken, you'll need to either:
# - Choose a different name (e.g., @yourname/clara-flow-sdk)
# - Use a scoped package name
```

### 3. 📝 Update Package Information

Update `sdk/package.json`:

```json
{
  "name": "clara-flow-sdk",
  "version": "1.0.0",
  "description": "Lightweight JavaScript SDK for running Clara Agent Studio flows",
  "author": "Your Name <your.email@example.com>",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/clara-flow-sdk.git"
  },
  "bugs": {
    "url": "https://github.com/yourusername/clara-flow-sdk/issues"
  },
  "homepage": "https://github.com/yourusername/clara-flow-sdk#readme"
}
```

### 4. 🏗️ Build the Package

```bash
cd sdk

# Install dependencies
npm install

# Build the package
npm run build

# Test the build
npm test
```

### 5. 🧪 Test Package Locally

```bash
# Create a test directory
mkdir ../test-clara-sdk
cd ../test-clara-sdk

# Initialize a test project
npm init -y

# Install your local package
npm install ../sdk

# Create a test file
echo "
const { ClaraFlowRunner } = require('clara-flow-sdk');
console.log('Clara Flow SDK loaded successfully!');
const runner = new ClaraFlowRunner();
console.log('Runner created:', runner);
" > test.js

# Run the test
node test.js
```

### 6. 📋 Dry Run Publishing

```bash
cd ../sdk

# Perform a dry run to see what would be published
npm publish --dry-run
```

### 7. 🚀 Publish to npm

```bash
# First publication
npm publish

# For scoped packages (if name is taken)
npm publish --access public
```

### 8. 🏷️ Version Management

```bash
# For future updates, bump the version first:

# Patch version (1.0.0 -> 1.0.1)
npm version patch

# Minor version (1.0.0 -> 1.1.0)
npm version minor

# Major version (1.0.0 -> 2.0.0)
npm version major

# Then publish
npm publish
```

## 🛡️ Alternative: Scoped Package

If `clara-flow-sdk` is taken, use a scoped package:

```json
{
  "name": "@yourusername/clara-flow-sdk",
  "version": "1.0.0"
}
```

```bash
# Publish scoped package
npm publish --access public
```

## 📊 Package Verification

After publishing, verify your package:

```bash
# View your published package
npm view clara-flow-sdk

# Install and test
npm install clara-flow-sdk
```

## 🔄 Automated Publishing (Optional)

Create `.github/workflows/publish.yml`:

```yaml
name: Publish to npm

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://registry.npmjs.org'
      
      - name: Install dependencies
        run: cd sdk && npm ci
      
      - name: Build package
        run: cd sdk && npm run build
      
      - name: Run tests
        run: cd sdk && npm test
      
      - name: Publish to npm
        run: cd sdk && npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## 📈 Post-Publication Steps

1. **Update Documentation**: Add installation instructions to README
2. **Create GitHub Release**: Tag your repository
3. **Update Examples**: Ensure examples use the published package
4. **Monitor Downloads**: Check npm stats

## 🎯 Quick Commands Summary

```bash
# Complete publishing workflow
cd sdk
npm login
npm install
npm run build
npm test
npm publish --dry-run
npm publish

# For updates
npm version patch
npm publish
```

## 🚨 Important Notes

- **Package Name**: Must be unique on npm
- **Version**: Follow semantic versioning (semver)
- **License**: MIT is recommended for open source
- **Files**: Only `dist/`, `src/`, and `README.md` will be published
- **Security**: Never publish with security vulnerabilities

## 📞 Support

If you encounter issues:
1. Check npm documentation: https://docs.npmjs.com/
2. Use `npm help publish` for command help
3. Verify your authentication: `npm whoami` 