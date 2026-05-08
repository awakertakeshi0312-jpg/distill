# Distill Mobile Strategy

## Decision

Use a two-track mobile strategy:

1. **Mobile Web/PWA first** for immediate smartphone access and UX testing.
2. **Tauri Mobile native later** when Android/iOS build, signing, storage, and app-store requirements are worth taking on.

This avoids blocking on Android Studio/Xcode while still making the app usable on a phone.

## Track 1: Mobile Web/PWA

### What Is Implemented

- PWA manifest: `public/manifest.webmanifest`
- Service worker: `public/sw.js`
- SVG app icon: `public/distill-icon.svg`
- Mobile bottom navigation CSS
- Relative Vite build base for GitHub Pages compatibility
- GitHub Pages workflow: `.github/workflows/pages.yml`

### Expected URL

After GitHub Pages is enabled and the workflow deploys:

```text
https://awakertakeshi0312-jpg.github.io/distill/
```

Verified on 2026-05-08: the public Pages URL returns `200`, serves the current built assets, loads `manifest.webmanifest`, loads `sw.js`, and reaches the first-run vault screen from a phone-sized browser smoke test.

The app now surfaces this URL directly in the Mobile access panel so a phone can open Distill without guessing the address.

### Current Constraints

- Data is stored locally in that phone browser.
- Data does not sync with desktop.
- Data content is encrypted by Distill in PWA mode after vault setup, but the encrypted envelope still lives in browser IndexedDB-first storage.
- Encrypted `.distill-vault.json` backup/restore is available for manual transfer.
- Browser storage can be removed by the browser, profile cleanup, or OS storage pressure.

### Recommended Mobile Usage

- Use mobile web for capture, triage, and early UX testing.
- Export encrypted vault backups regularly.
- Do not treat mobile PWA as the only copy of important notes until IndexedDB/native storage and sync are implemented.

## Track 2: Tauri Mobile Native

Tauri 2 supports Android and iOS from the same codebase, but the build environment requirements differ.

### Android Requirements

On Windows, Android is realistic.

Required:

- Android Studio
- `JAVA_HOME`
- Android SDK Platform
- Android SDK Platform-Tools
- NDK Side by side
- Android SDK Build-Tools
- Android SDK Command-line Tools
- `ANDROID_HOME`
- `NDK_HOME`
- Rust Android targets:

```powershell
rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
```

### iOS Requirements

iOS native builds require macOS and Xcode. This cannot be completed from the current Windows machine.

Required:

- macOS
- full Xcode, not only command line tools
- iOS Rust targets
- Homebrew
- Cocoapods
- Apple Developer account for device distribution/TestFlight/App Store

### Tauri Mobile References

- https://v2.tauri.app/
- https://v2.tauri.app/start/prerequisites/
- https://v2.tauri.app/security/capabilities/

## Mobile Product Roadmap

### Phase M1: Phone Usability

- Bottom navigation
- One-hand capture flow
- Larger tap targets
- PWA installability
- Mobile backup/export reminders

### Phase M2: Safer Mobile Storage

- IndexedDB instead of localStorage for web mode
- Import size limits
- IndexedDB-backed encrypted vault envelope
- App-local unlock/passphrase lifecycle

### Phase M3: Native Android

- Initialize Tauri Android project.
- Resolve mobile-only capability file.
- Disable desktop updater/manual installer on mobile.
- Validate SQLite path on Android.
- Build debug APK.
- Test on Android device.

### Phase M4: Native iOS

- Move build to macOS.
- Initialize Tauri iOS project.
- Configure signing.
- Validate storage, export, and import.
- Test with TestFlight.

### Phase M5: Sync

Do not add sync before record-level encrypted data is designed. A thought app sync layer should be end-to-end encrypted or local-network/local-file based by design.

Candidate directions:

- Local encrypted backup file shared through iCloud/Google Drive/OneDrive.
- Optional E2EE sync service.
- Local-first CRDT sync only after stable data model.

## Manual Steps To Enable Web Preview

GitHub Pages is already configured for this repository. For a new deployment:

1. Push `main` or run the `Deploy Web Preview` workflow manually.
2. Open `https://awakertakeshi0312-jpg.github.io/distill/` on a smartphone.
3. Use the browser menu to add it to the home screen.
4. Create or unlock the local encrypted vault on that phone.

## Success Criteria

- The app opens on a smartphone at the Pages URL.
- Capture works from a mobile viewport.
- Search works on mobile.
- Navigation is usable with one thumb.
- Reload keeps data on that phone browser.
- User can export JSON from mobile.
