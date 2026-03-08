

## Current Behavior When Detection Fails

On Android, the `beforeinstallprompt` event may **never** fire if:
- The browser isn't Chrome/Edge (e.g., Samsung Internet, Firefox)
- PWA install criteria aren't fully met (missing service worker, not HTTPS, manifest issues)
- The app was previously dismissed for install

When this happens, clicking "Install App" returns `'android'` and shows the Android instructions dialog — which may have inaccurate steps depending on the browser.

## Proposed Fix: Tiered Fallback with Retry

### 1. `src/hooks/usePWAInstall.ts`
- Add a `promptReady` boolean that becomes `true` once `beforeinstallprompt` fires
- Add a `waitForPrompt()` helper that waits up to ~3 seconds for the event before giving up
- Update `promptInstall()`: on Android, if no deferred prompt, wait briefly (3s) for it to arrive. If it arrives, trigger it. If not, return `'android'` as fallback.

### 2. `src/components/Layout.tsx`
- When result is `'android'` (prompt never arrived), show the Android dialog but with **browser-adaptive instructions**:
  - Detect Chrome vs Samsung Internet vs Firefox via user agent
  - Show steps specific to that browser (e.g., Samsung Internet: Menu → "Add page to" → "Home screen")
- Add a small "Try again" button inside the dialog that re-attempts `promptInstall()` in case the event fires late

### Summary

| File | Change |
|------|--------|
| `src/hooks/usePWAInstall.ts` | Add 3-second wait for `beforeinstallprompt` before falling back |
| `src/components/Layout.tsx` | Browser-adaptive Android instructions + "Try again" button in dialog |

This way the button first tries to trigger the native prompt (waiting briefly), and only falls back to manual instructions that are accurate for the user's specific browser.

