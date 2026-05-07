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

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$tempVaultPath = Join-Path $recoveryDir "distill-encrypted-vault-recovered.json"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$nodeScript = @'
const fs = require('fs');
const crypto = require('crypto');

const input = JSON.parse(fs.readFileSync(0, 'utf8'));
const plainJson = fs.readFileSync(input.sourcePath, 'utf8');
const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const iterations = 310000;
const key = crypto.pbkdf2Sync(input.passphrase, salt, iterations, 32, 'sha256');
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const ciphertext = Buffer.concat([cipher.update(Buffer.from(plainJson, 'utf8')), cipher.final()]);
const tag = cipher.getAuthTag();
const payload = Buffer.concat([ciphertext, tag]);
const envelope = {
  type: 'distill.encrypted-vault',
  schemaVersion: 1,
  exportedAt: new Date().toISOString(),
  kdf: {
    name: 'PBKDF2',
    hash: 'SHA-256',
    iterations,
    salt: salt.toString('base64'),
  },
  cipher: {
    name: 'AES-GCM',
    iv: iv.toString('base64'),
  },
  payload: payload.toString('base64'),
};

fs.writeFileSync(input.outputPath, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
'@

$nodeInput = @{
  sourcePath = (Resolve-Path $SourcePath).Path
  outputPath = $tempVaultPath
  passphrase = $passphrase
} | ConvertTo-Json -Compress

$nodeInput | node -e $nodeScript
if ($LASTEXITCODE -ne 0) {
  throw "Failed to encrypt the recovered vault with Node.js crypto."
}

$encryptedJson = [System.IO.File]::ReadAllText($tempVaultPath)
[System.IO.File]::WriteAllText($encryptedVaultBackupPath, $encryptedJson, $utf8NoBom)

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
