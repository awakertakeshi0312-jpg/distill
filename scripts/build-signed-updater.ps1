$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$config = Get-Content -Raw (Join-Path $root "src-tauri\tauri.conf.json") | ConvertFrom-Json
$version = $config.version
$artifactName = "Distill_${version}_x64-setup.exe"
$artifactPath = Join-Path $root "src-tauri\target\release\bundle\nsis\$artifactName"
$keyPath = Join-Path $env:USERPROFILE ".tauri\distill.key"

if (-not (Test-Path $keyPath)) {
  throw "Missing Tauri updater private key: $keyPath"
}

Push-Location $root
try {
  Remove-Item Env:\TAURI_SIGNING_PRIVATE_KEY -ErrorAction SilentlyContinue
  Remove-Item Env:\TAURI_SIGNING_PRIVATE_KEY_PATH -ErrorAction SilentlyContinue
  Remove-Item Env:\TAURI_SIGNING_PRIVATE_KEY_PASSWORD -ErrorAction SilentlyContinue

  cmd /c '"C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\LaunchDevCmd.bat" -arch=x64 -host_arch=x64 && set PATH=%USERPROFILE%\.cargo\bin;%PATH% && npm run tauri:build'
  if ($LASTEXITCODE -ne 0) {
    throw "Tauri build failed with exit code $LASTEXITCODE"
  }

  npm run tauri signer sign -- --private-key-path "$keyPath" --password= "src-tauri\target\release\bundle\nsis\$artifactName"
  if ($LASTEXITCODE -ne 0) {
    throw "Updater signing failed with exit code $LASTEXITCODE"
  }

  npm run release:latest-json
  if ($LASTEXITCODE -ne 0) {
    throw "Latest manifest generation failed with exit code $LASTEXITCODE"
  }
}
finally {
  Pop-Location
}
