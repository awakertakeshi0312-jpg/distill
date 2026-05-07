param(
  [string] $SourcePath = "C:\Users\awake\dev\active\distill\recovery\white-screen-20260506-205309\backups\distill-auto-backup-latest.json",
  [string] $AppDataDir = "$env:APPDATA\app.distill.local",
  [string] $RecoveryRoot = "C:\Users\awake\dev\active\distill\recovery"
)

$ErrorActionPreference = "Stop"

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
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$recoveryDir = Join-Path $RecoveryRoot "vault-reset-generated-$timestamp"
New-Item -ItemType Directory -Force -Path $recoveryDir | Out-Null

$dbPath = Join-Path $AppDataDir "distill.sqlite3"
$backupDir = Join-Path $AppDataDir "backups"
$encryptedVaultBackupPath = Join-Path $backupDir "distill-encrypted-vault-latest.json"
$tempVaultPath = Join-Path $recoveryDir "distill-encrypted-vault-recovered.json"
$passphrasePath = Join-Path $recoveryDir "NEW_VAULT_PASSPHRASE.txt"

if (Test-Path $dbPath) {
  Copy-Item -LiteralPath $dbPath -Destination (Join-Path $recoveryDir "distill.sqlite3.before-reset") -Force
}

if (Test-Path $encryptedVaultBackupPath) {
  Copy-Item -LiteralPath $encryptedVaultBackupPath -Destination (Join-Path $recoveryDir "distill-encrypted-vault-latest.before-reset.json") -Force
}

Copy-Item -LiteralPath $SourcePath -Destination (Join-Path $recoveryDir "legacy-source-used.json") -Force
New-Item -ItemType Directory -Force -Path $backupDir | Out-Null

$passphraseSuffix = node -e "console.log(require('crypto').randomBytes(18).toString('hex'))"
if ($LASTEXITCODE -ne 0 -or -not $passphraseSuffix) {
  throw "Failed to generate a recovery passphrase with Node.js crypto."
}
$passphrase = "Distill-$timestamp-$passphraseSuffix"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($passphrasePath, $passphrase, $utf8NoBom)

$nodeScript = @'
const fs = require('fs');
const crypto = require('crypto');

const input = {
  sourcePath: process.env.DISTILL_RECOVERY_SOURCE_PATH,
  outputPath: process.env.DISTILL_RECOVERY_OUTPUT_PATH,
  passphrase: process.env.DISTILL_RECOVERY_PASSPHRASE,
  expectedBlocks: Number(process.env.DISTILL_RECOVERY_EXPECTED_BLOCKS || '0'),
  expectedProjects: Number(process.env.DISTILL_RECOVERY_EXPECTED_PROJECTS || '0'),
};

if (!input.sourcePath || !input.outputPath || !input.passphrase) {
  throw new Error('Recovery input was not provided.');
}

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

const verifyPayload = Buffer.from(envelope.payload, 'base64');
const verifyTagLength = 16;
const verifyCiphertext = verifyPayload.subarray(0, verifyPayload.length - verifyTagLength);
const verifyTag = verifyPayload.subarray(verifyPayload.length - verifyTagLength);
const verifyKey = crypto.pbkdf2Sync(input.passphrase, Buffer.from(envelope.kdf.salt, 'base64'), envelope.kdf.iterations, 32, 'sha256');
const decipher = crypto.createDecipheriv('aes-256-gcm', verifyKey, Buffer.from(envelope.cipher.iv, 'base64'));
decipher.setAuthTag(verifyTag);
const verifiedPlain = Buffer.concat([decipher.update(verifyCiphertext), decipher.final()]).toString('utf8');
const verifiedStore = JSON.parse(verifiedPlain);

if (!Array.isArray(verifiedStore.blocks) || !Array.isArray(verifiedStore.projects)) {
  throw new Error('Generated vault did not decrypt to a Distill store.');
}
if (verifiedStore.blocks.length !== input.expectedBlocks || verifiedStore.projects.length !== input.expectedProjects) {
  throw new Error('Generated vault verification counts did not match the source backup.');
}

fs.writeFileSync(input.outputPath, `${JSON.stringify(envelope, null, 2)}\n`, 'utf8');
'@

try {
  $env:DISTILL_RECOVERY_SOURCE_PATH = (Resolve-Path $SourcePath).Path
  $env:DISTILL_RECOVERY_OUTPUT_PATH = $tempVaultPath
  $env:DISTILL_RECOVERY_PASSPHRASE = $passphrase
  $env:DISTILL_RECOVERY_EXPECTED_BLOCKS = "$blockCount"
  $env:DISTILL_RECOVERY_EXPECTED_PROJECTS = "$projectCount"

  node -e $nodeScript
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to generate and verify the recovered vault with Node.js crypto."
  }
} finally {
  $env:DISTILL_RECOVERY_SOURCE_PATH = $null
  $env:DISTILL_RECOVERY_OUTPUT_PATH = $null
  $env:DISTILL_RECOVERY_PASSPHRASE = $null
  $env:DISTILL_RECOVERY_EXPECTED_BLOCKS = $null
  $env:DISTILL_RECOVERY_EXPECTED_PROJECTS = $null
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

Write-Host "OK: generated and verified a recovered encrypted vault."
Write-Host "Blocks: $blockCount"
Write-Host "Projects: $projectCount"
Write-Host "Passphrase file:"
Write-Host $passphrasePath
Write-Host "Previous encrypted vault backup was copied to:"
Write-Host $recoveryDir
