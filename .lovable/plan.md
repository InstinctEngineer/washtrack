

## Plan: Add "Install App" PWA Button to Sidebar

### What We're Building
A button in the left sidebar (below Messages) that lets users install WashTrack to their phone's home screen with one tap. This uses the Progressive Web App (PWA) standard — no app store needed, works on iOS Safari, Android Chrome, and desktop browsers.

### Steps

**1. Install `vite-plugin-pwa`** — enables service worker and manifest generation.

**2. Create PWA icon assets in `public/`:**
- `pwa-192x192.png` and `pwa-512x512.png` — generated from the existing WashTrack gradient logo (WT text on blue gradient background)
- We'll create these as simple SVG-to-PNG or inline them via the manifest

**3. Configure `vite.config.ts`:**
- Add `VitePWA` plugin with manifest (name: "WashTrack", theme color `#1e3a5f`, icons)
- Add `navigateFallbackDenylist: [/^\/~oauth/]` to prevent caching auth redirects
- Register service worker in auto mode

**4. Update `index.html`:**
- Add PWA meta tags: `<meta name="apple-mobile-web-app-capable">`, `<meta name="theme-color">`, `<link rel="apple-touch-icon">`

**5. Create `src/hooks/usePWAInstall.ts`:**
- Listen for the `beforeinstallprompt` event (Chrome/Android)
- Expose `canInstall` boolean and `promptInstall()` function
- Track whether app is already installed (via `display-mode: standalone` media query)
- For iOS Safari (which doesn't fire `beforeinstallprompt`), detect via user agent and show manual instructions in a dialog

**6. Update `src/components/Layout.tsx`:**
- Add an "Install App" button at the bottom of the sidebar nav (below all nav sections, pushed to bottom with `mt-auto`)
- Uses `Download` or `Smartphone` icon from lucide
- Only visible when `canInstall` is true or on iOS Safari
- On click: triggers native install prompt (Android/desktop) or shows a dialog with iOS instructions ("Tap Share → Add to Home Screen")
- Hidden once the app is already installed

### Files to Create/Modify

| File | Action |
|------|--------|
| `vite.config.ts` | Add vite-plugin-pwa config |
| `index.html` | Add PWA meta tags + apple-touch-icon |
| `public/pwa-192x192.png` | App icon (will generate) |
| `public/pwa-512x512.png` | App icon (will generate) |
| `src/hooks/usePWAInstall.ts` | Create — install prompt logic |
| `src/components/Layout.tsx` | Add install button to sidebar bottom |

### Technical Notes
- The `beforeinstallprompt` event works on Chrome, Edge, Samsung Internet, Opera (Android + desktop). On iOS Safari, we detect the platform and show manual "Add to Home Screen" instructions since Apple doesn't support the Web App Install API.
- The button auto-hides when the app is already running in standalone mode (installed).
- The service worker enables offline caching so the app loads instantly from the home screen.

