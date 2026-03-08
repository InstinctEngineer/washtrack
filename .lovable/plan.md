

## Problem

Two issues prevent the "Install App" button from appearing:

1. **Button is conditionally hidden** — `{canInstall && ...}` only renders when `beforeinstallprompt` fires (Android Chrome) or iOS Safari is detected. On iOS Chrome, the `isIOS` check fails because the UA contains "CriOS" (excluded by the Safari filter). The `beforeinstallprompt` event also doesn't fire on iOS at all.

2. **iOS detection is too narrow** — It only detects Safari, missing Chrome/Firefox on iOS. And on Android, the `beforeinstallprompt` event may not fire if the PWA criteria aren't fully met yet (e.g., first visit, no service worker registered yet).

## Fix

**Always show the "Install App" button** for all mobile users (and optionally desktop too), removing the `canInstall` guard. Adjust the click behavior:

- **If `deferredPrompt` exists** (Android Chrome/Edge): trigger the native install prompt as before.
- **If iOS (any browser)**: show the iOS instructions dialog (Share → Add to Home Screen).
- **If neither** (desktop or unsupported): show a generic dialog with browser-specific instructions.

### File: `src/hooks/usePWAInstall.ts`
- Broaden iOS detection: remove the Safari-only filter so it detects all iOS browsers (`/iPad|iPhone|iPod/` or `MacIntel` with touch).
- Export a new `isMobile` boolean for layout use.

### File: `src/components/Layout.tsx`
- Remove the `{canInstall && ...}` conditional guard — always show the button (or at minimum, show it on all mobile devices).
- When clicked on iOS (any browser), show the instructions dialog.
- When clicked with no deferred prompt and not iOS, show a brief "Use your browser menu to install" message.

### Summary of Changes

| File | Change |
|------|--------|
| `src/hooks/usePWAInstall.ts` | Broaden iOS detection to all iOS browsers; add `isMobile` flag |
| `src/components/Layout.tsx` | Always show "Install App" button; adjust click handler for all platforms |

