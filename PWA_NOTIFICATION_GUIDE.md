# PWA Timer Notification Guide

## Overview
This guide explains how the timer notification feature works for Android status bar integration in the Goal Calendly PWA.

## Features Added
- **Persistent timer notifications** that appear in Android status bar
- **Real-time updates** every second while timer is running
- **Permission prompt** when timer starts (only asks once)
- **Background support** via service worker
- **Stop timer action** directly from notification

## How It Works

### 1. Permission Request
When a timer starts, users see a prompt: "Keep timer visible in status bar?"
- Click "Allow" to grant notification permission
- Click "No" to skip (can be changed later in browser settings)

### 2. Notification Display
Once permission is granted:
- Persistent notification appears in Android status bar
- Shows goal name and current elapsed time
- Updates every second automatically
- Includes "Stop Timer" action button

### 3. Background Updates
- Uses service worker for reliable background updates
- Continues running even when PWA is in background
- Automatically clears when timer stops

## Testing on Android

### Prerequisites
1. Install as PWA on Android device
2. Ensure notifications are enabled for the app
3. Chrome 50+ or other modern browser

### Test Steps
1. **Start a timer** - should see permission prompt
2. **Grant permission** - notification appears in status bar
3. **Background the app** - notification continues updating
4. **Tap notification** - should open/focus the app
5. **Use "Stop Timer" action** - should stop timer and clear notification
6. **Deny permission** - should work normally without notifications

### Browser Settings
If you denied permission and want to enable:
1. Go to Chrome Settings → Site Settings → Notifications
2. Find your PWA domain
3. Allow notifications
4. Restart timer

## Technical Implementation

### Files Modified
- `src/components/ActiveTimer.tsx` - Added notification integration
- `src/services/notifications.ts` - Notification service
- `public/sw.js` - Service worker for background updates

### Browser Support
- ✅ Chrome 50+ (Android)
- ✅ Firefox 44+ (Android)
- ✅ Safari 16+ (iOS - limited support)
- ❌ Older browsers (graceful fallback)

## Troubleshooting

### Notifications Not Appearing
1. Check browser notification permissions
2. Ensure PWA is installed (not just in browser)
3. Verify service worker is registered
4. Check if notifications are blocked at system level

### Timer Not Updating in Background
1. Ensure battery optimization is disabled for the app
2. Check if background data is restricted
3. Verify service worker is active

### Permission Issues
1. Reset permissions in browser settings
2. Clear site data and reinstall PWA
3. Check if running in private/incognito mode