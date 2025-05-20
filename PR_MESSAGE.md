# Fix security issues in ClaraVerse

## Changes Made

### Supabase API Keys Security (Issue #61)
- Updated `supabaseClient.ts` to use environment variables instead of hardcoded API keys
- Removed `supabaseClient.ts.bak` backup file containing exposed credentials
- Enhanced `.gitignore` to explicitly exclude security-related files
- Added `.env.example` file to provide guidance on setting up environment variables
- Added documentation in README.md for setting up environment variables
- Added safety check for admin client to prevent it from running in browser context

### Dependency Vulnerabilities (Issue #60)
- Updated `pdfjs-dist` to version 5.2.133 to fix high severity vulnerability
- Updated direct `prismjs` dependency to version 1.30.0

### Documentation
- Created SECURITY_FIXES.md with details of fixes and recommendations
- Added section to README.md about environment variables and security
- Documented remaining moderate severity issues for future fixes

## Security Improvements

The changes address the security issues by:
1. Removing all hardcoded API keys from the codebase
2. Using environment variables for sensitive credentials
3. Ensuring sensitive files are excluded from git
4. Updating dependencies with high severity vulnerabilities
5. Documenting security best practices for future development

The admin client with service key is now protected with a check to prevent it from being used in browser environments, as it should only be used in secure server-side environments.

## Development Setup

Developers should now:
1. Copy `.env.example` to `.env`
2. Fill in their own Supabase credentials in the `.env` file
3. Keep their `.env` file private (it's excluded from git)

This follows security best practices for handling sensitive credentials in web applications. 