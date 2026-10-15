# AGENTS.md

- App store links live in `src/lib/appStores.ts` and are the single source of truth for every "Install App" entry point; each entry point routes by device (iOS → App Store, Android → Google Play, anything else → a dialog offering both). Why: the store listing URLs change only when the app is republished, so duplicating them per component lets them drift out of date.
