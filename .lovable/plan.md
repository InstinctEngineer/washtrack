

## Fix Android Install: Ensure Native Prompt Works

### Problem
The `beforeinstallprompt` event on Android Chrome may not fire immediately (requires service worker registration, HTTPS, manifest validity, and sometimes a second visit). When the user clicks "Install App" before the event fires, the code falls through to `'unsupported'` and shows generic instructions that aren't accurate for Android.

### Plan

**1. Update `src/hooks/usePWAInstall.ts`**
- Add an `isAndroid` state flag (detect via `/Android/i` in user agent)
- Return `isAndroid` alongside existing values
- Add a new return value `'android'` from `promptInstall()` when on Android but `deferredPrompt` is null -- this means the event hasn't fired yet

**2. Update `src/components/Layout.tsx`**
- Add a new `showAndroidDialog` state
- Handle the `'android'` result from `promptInstall()` to show an Android-specific instructions dialog
- Add a new Dialog with accurate Android Chrome instructions:
  1. Tap the browser menu (three dots) at the top right
  2. Tap **"Install app"** or **"Add to Home Screen"**
  3. Tap **"Install"** to confirm
- Remove or update the generic "unsupported" dialog to only show for desktop browsers

### Files Changed
| File | Change |
|------|--------|
| `src/hooks/usePWAInstall.ts` | Add `isAndroid` detection; return `'android'` when on Android without deferred prompt |
| `src/components/Layout.tsx` | Add Android-specific install instructions dialog |

