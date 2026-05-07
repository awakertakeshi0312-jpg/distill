param(
  [string] $SourcePath = "C:\Users\awake\dev\active\distill\recovery\white-screen-20260506-205309\backups\distill-auto-backup-latest.json",
  [string] $AppDataDir = "$env:APPDATA\app.distill.local",
  [string] $RecoveryRoot = "C:\Users\awake\dev\active\distill\recovery"
)

Add-Type -AssemblyName System.Security

$ErrorActionPreference = "Stop"

function Convert-SecureStringToPlainText {
  param([Security.SecureString] $SecureString)

  $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
  try {
    [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
  }
}

function Convert-BytesToBase64 {
  param([byte[]] $Bytes)
  [Convert]::ToBase64String($Bytes)
}

function New-RandomBytes {
  param([int] $Length)

  $bytes = New-Object byte[] $Length
  [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  $bytes
}

if (-not (Test-Path $SourcePath)) {
  throw "Legacy backup was not found: $SourcePath"
}

$plainJson = Get-Content -Raw -Encoding UTF8 $SourcePath
$parsed = $plainJson | ConvertFrom-Json

if ($null -eq $parsed.blocks -or $null -eq $parsed.projects) {
  throw "Legacy backup is not a Distill store with blocks and projects."
}

$blockCount = @($parsed.blocks).Count
$projectCount = @($parsed.projects).Count

Write-Host "Legacy backup looks usable."
Write-Host "Blocks: $blockCount"
Write-Host "Projects: $projectCount"
Write-Host ""
Write-Host "Create a NEW vault passphrase for the recovered vault."
Write-Host "Use at least 12 characters. This script cannot recover it if forgotten."
Write-Host ""

$securePassphrase = Read-Host "New vault passphrase (hidden)" -AsSecureString
$secureConfirmation = Read-Host "Confirm new vault passphrase (hidden)" -AsSecureString
$passphrase = Convert-SecureStringToPlainText $securePassphrase
$confirmation = Convert-SecureStringToPlainText $secureConfirmation

if ($passphrase -ne $confirmation) {
  throw "Passphrases did not match."
}

if ($passphrase.Length -lt 12) {
  throw "New vault passphrase must be at least 12 characters."
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$recoveryDir = Join-Path $RecoveryRoot "vault-reset-$timestamp"
New-Item -ItemType Directory -Force -Path $recoveryDir | Out-Null

$dbPath = Join-Path $AppDataDir "distill.sqlite3"
$backupDir = Join-Path $AppDataDir "backups"
$encryptedVaultBackupPath = Join-Path $backupDir "distill-encrypted-vault-latest.json"

if (Test-Path $dbPath) {
  Copy-Item -LiteralPath $dbPath -Destination (Join-Path $recoveryDir "distill.sqlite3.before-reset") -Force
}

if (Test-Path $encryptedVaultBackupPath) {
  Copy-Item -LiteralPath $encryptedVaultBackupPath -Destination (Join-Path $recoveryDir "distill-encrypted-vault-latest.before-reset.json") -Force
}

Copy-Item -LiteralPath $SourcePath -Destination (Join-Path $recoveryDir "legacy-source-used.json") -Force

$salt = New-RandomBytes 16
$iv = New-RandomBytes 12
$iterations = 310000
$derive = [Security.Cryptography.Rfc2898DeriveBytes]::new(
  $passphrase,
  $salt,
  $iterations,
  [Security.Cryptography.HashAlgorithmName]::SHA256
)
$key = $derive.GetBytes(32)
$plainBytes = [Text.Encoding]::UTF8.GetBytes($plainJson)
$ciphertext = New-Object byte[] $plainBytes.Length
$tag = New-Object byte[] 16
$aes = [Security.Cryptography.AesGcm]::new($key, 16)
$aes.Encrypt($iv, $plainBytes, $ciphertext, $tag)

$payload = New-Object byte[] ($ciphertext.Length + $tag.Length)
[Array]::Copy($ciphertext, 0, $payload, 0, $ciphertext.Length)
[Array]::Copy($tag, 0, $payload, $ciphertext.Length, $tag.Length)

$envelope = [ordered]@{
  type = "distill.encrypted-vault"
  schemaVersion = 1
  exportedAt = (Get-Date).ToUniversalTime().ToString("o")
  kdf = [ordered]@{
    name = "PBKDF2"
    hash = "SHA-256"
    iterations = $iterations
    salt = Convert-BytesToBase64 $salt
  }
  cipher = [ordered]@{
    name = "AES-GCM"
    iv = Convert-BytesToBase64 $iv
  }
  payload = Convert-BytesToBase64 $payload
}

$encryptedJson = $envelope | ConvertTo-Json -Depth 10
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$tempVaultPath = Join-Path $recoveryDir "distill-encrypted-vault-recovered.json"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($tempVaultPath, $encryptedJson + [Environment]::NewLine, $utf8NoBom)
[System.IO.File]::WriteAllText($encryptedVaultBackupPath, $encryptedJson + [Environment]::NewLine, $utf8NoBom)

$python = @'
import pathlib
import sqlite3
import sys

db_path = pathlib.Path(sys.argv[1])
vault_path = pathlib.Path(sys.argv[2])
value = vault_path.read_text(encoding="utf-8")

db_path.parent.mkdir(parents=True, exist_ok=True)
connection = sqlite3.connect(db_path)
try:
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS app_store (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    connection.execute(
        """
        INSERT INTO app_store (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
        """,
        ("distill.vault.v1", value),
    )
    connection.execute("DELETE FROM app_store WHERE key = ?", ("distill.vaultRecordLog.v1",))
    connection.commit()
finally:
    connection.close()
'@

$python | python - $dbPath $tempVaultPath

Write-Host ""
Write-Host "OK: recovered legacy backup into a new encrypted vault."
Write-Host "Use the NEW passphrase you just entered to unlock Distill."
Write-Host "Previous encrypted vault backup was copied to:"
Write-Host $recoveryDir
