# PWA Testing Guide for Goal Calendly

## Overview
This guide helps you test the Progressive Web App (PWA) functionality that has been implemented for Goal Calendly.

## Files Created/Modified

### PWA Configuration Files
- `public/manifest.json` - PWA manifest with app details
- `public/sw.js` - Service worker for offline functionality
- `public/icons/` - Directory containing PWA icons
- `src/components/PWAInstallPrompt.tsx` - PWA installation prompt component
- `vite.config.ts` - Updated with PWA plugin configuration

## Testing Steps

### 1. Install Dependencies
```bash
npm install vite-plugin-pwa --save-dev
```

### 2. Build the Application
```bash
npm run build
```

### 3. Test PWA Functionality

#### Chrome DevTools Testing
1. Open Chrome DevTools (F12)
2. Go to Application tab
3. Check:
   - **Manifest**: Should show "Goal Calendly" with correct icons
   - **Service Workers**: Should show registered service worker
   - **Storage**: Should show cached resources

#### Lighthouse Audit
1. Open Chrome DevTools
2. Go to Lighthouse tab
3. Run PWA audit
4. Should pass all PWA criteria

#### Mobile Testing
1. Open the app on mobile
2. Check if "Add to Home Screen" prompt appears
3. Install the app
4. Verify it opens in standalone mode

### 4. Icon Generation
The SVG icons have been created in `public/icons/`. To generate PNG files:

#### Option 1: Online Converter
1. Visit https://svg2png.com/
2. Upload `icon-192x192.svg` and `icon-512x512.svg`
3. Download PNG files to `public/icons/`

#### Option 2: Command Line
```bash
npm install -g svgexport
svgexport public/icons/icon-192x192.svg public/icons/icon-192x192.png 192:192
svgexport public/icons/icon-512x512.svg public/icons/icon-512x512.png 512:512
```

### 5. PWA Features Verified
- [x] Web App Manifest
- [x] Service Worker
- [x] Offline Functionality
- [x] Install Prompt
- [x] Responsive Design
- [x] HTTPS Ready
- [x] Icons and Splash Screens

## Troubleshooting

### Service Worker Not Registering
- Check browser console for errors
- Ensure HTTPS is used (required for service workers)
- Verify `sw.js` is in the public directory

### Icons Not Showing
- Ensure PNG files are generated from SVG
- Check file paths in manifest.json
- Verify icons are accessible via browser

### Install Prompt Not Appearing
- Check if app is already installed
- Ensure HTTPS is used
- Check browser compatibility

## Production Deployment
When deploying to production:
1. Ensure HTTPS is enabled
2. Verify all PWA assets are served correctly
3. Test on multiple devices and browsers
4. Run Lighthouse audit for final verification