$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$config = Get-Content -Raw (Join-Path $root "src-tauri\tauri.conf.json") | ConvertFrom-Json
$version = $config.version
$artifactName = "Distill_${version}_x64-setup.exe"
$artifactPath = Join-Path $root "src-tauri\target\release\bundle\nsis\$artifactName"
$signaturePath = "$artifactPath.sig"

if (-not (Test-Path $artifactPath)) {
  throw "Missing installer: $artifactPath"
}

if (-not (Test-Path $signaturePath)) {
  $keyPath = Join-Path $env:USERPROFILE ".tauri\distill.key"
  npm run tauri signer sign -- --private-key-path "$keyPath" --password= "src-tauri\target\release\bundle\nsis\$artifactName"
  if ($LASTEXITCODE -ne 0) {
    throw "Signing failed with exit code $LASTEXITCODE"
  }
}

$signature = (Get-Content -Raw $signaturePath).Trim()
$repo = if ($env:DISTILL_RELEASE_REPO) { $env:DISTILL_RELEASE_REPO } else { "awakertakeshi0312-jpg/distill" }
$downloadBase = "https://github.com/$repo/releases/latest/download"
$outDir = Join-Path $root "release"
New-Item -ItemType Directory -Force $outDir | Out-Null
Remove-Item -Force (Join-Path $outDir "Distill_*_x64-setup.exe") -ErrorAction SilentlyContinue
Remove-Item -Force (Join-Path $outDir "Distill_*_x64-setup.exe.sig") -ErrorAction SilentlyContinue

$latest = [ordered]@{
  version = $version
  pub_date = (Get-Date).ToUniversalTime().ToString("o")
  notes = "Distill $version signed Windows update."
  platforms = [ordered]@{
    "windows-x86_64" = [ordered]@{
      signature = $signature
      url = "$downloadBase/$artifactName"
    }
  }
}

$latestJson = $latest | ConvertTo-Json -Depth 10
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText((Join-Path $outDir "latest.json"), $latestJson, $utf8NoBom)
Copy-Item -Force $artifactPath (Join-Path $outDir $artifactName)
Copy-Item -Force $signaturePath (Join-Path $outDir "$artifactName.sig")
Get-ChildItem $outDir | Select-Object Name,Length,LastWriteTime
