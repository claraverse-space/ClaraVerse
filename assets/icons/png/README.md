# Icon Requirements for Linux

For proper icon display in Linux distributions, the following icon sizes are required:

- 16x16.png
- 24x24.png
- 32x32.png
- 48x48.png
- 64x64.png
- 128x128.png
- 256x256.png
- 512x512.png

Please ensure all PNG icons are properly optimized and follow these standard sizes.

You can create these from your original logo.png using tools like ImageMagick:

```bash
convert logo.png -resize 16x16 16x16.png
convert logo.png -resize 24x24 24x24.png
convert logo.png -resize 32x32 32x32.png
convert logo.png -resize 48x48 48x48.png
convert logo.png -resize 64x64 64x64.png
convert logo.png -resize 128x128 128x128.png
convert logo.png -resize 256x256 256x256.png
convert logo.png -resize 512x512 512x512.png
```

This directory structure is specifically referenced in the electron-builder configuration for Linux builds.
