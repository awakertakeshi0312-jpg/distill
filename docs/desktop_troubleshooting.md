# Distill Desktop Troubleshooting

## Blank Screen Recovery

If the installed desktop app opens to a blank white window, first assume the encrypted vault is important and avoid deleting app data directly.

Safe recovery order:

1. Close Distill completely.
2. Check Task Manager for `Distill`, `app.exe`, or `msedgewebview2` processes and close only the Distill-related window/process if it is still running.
3. Back up this folder before changing anything:

```text
C:\Users\awake\AppData\Local\app.distill.local
```

4. Rename only the WebView cache folder:

```text
C:\Users\awake\AppData\Local\app.distill.local\EBWebView
```

to:

```text
C:\Users\awake\AppData\Local\app.distill.local\EBWebView.backup
```

5. Start Distill again.
6. If the app opens, keep the backup until you have confirmed your encrypted vault opens and exported a fresh encrypted backup.

Do not delete these folders without a backup:

```text
C:\Users\awake\AppData\Local\app.distill.local
C:\Users\awake\AppData\Local\Distill
```

## Why This Can Happen

Distill desktop uses Tauri plus Microsoft WebView2. A blank screen can be caused by:

- stale WebView cache after an update
- a corrupted WebView profile
- a frontend runtime exception
- an interrupted installer/update

Distill now includes a React render error boundary. If React can catch the failure, the app should show recovery instructions instead of a blank screen. If the WebView itself fails before React starts, use the cache rename procedure above.

## Verification Commands

From the project folder:

```powershell
cd C:\Users\awake\dev\active\distill
npm test
npm run build
npm run test:e2e
```

If those pass but only the installed desktop app is blank, the problem is likely desktop runtime state, not the React app bundle.
