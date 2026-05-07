!macro NSIS_HOOK_PREINSTALL
  ClearErrors
  RMDir /r "$LOCALAPPDATA\app.distill.local\EBWebView"
  CreateDirectory "$APPDATA\app.distill.local"
  FileOpen $0 "$APPDATA\app.distill.local\distill-webview-cache-cleanup-v3.done" w
  FileWrite $0 "distill webview cache cleanup v3 installer$\r$\n"
  FileClose $0
!macroend
