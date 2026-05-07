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

$vaultPath = Join-Path $env:APPDATA "app.distill.local\backups\distill-encrypted-vault-latest.json"

if (-not (Test-Path $vaultPath)) {
  Write-Host "NG: encrypted vault backup was not found at $vaultPath"
  exit 2
}

$secure = Read-Host "Vault passphrase (input is hidden)" -AsSecureString
$passphrase = Convert-SecureStringToPlainText $secure
$env:DISTILL_VAULT_PATH = $vaultPath
$env:DISTILL_VAULT_PASSPHRASE = $passphrase

try {
  $nodeScript = @'
const fs = require('fs');
const crypto = require('crypto');

const vaultPath = process.env.DISTILL_VAULT_PATH;
const passphrase = process.env.DISTILL_VAULT_PASSPHRASE;

if (!vaultPath || !passphrase) {
  console.log('NG: vault path or passphrase was not provided.');
  process.exit(2);
}

let vault;
try {
  vault = JSON.parse(fs.readFileSync(vaultPath, 'utf8'));
} catch (error) {
  console.log('NG: encrypted vault JSON could not be read.');
  process.exit(3);
}

if (
  vault.type !== 'distill.encrypted-vault' ||
  vault.schemaVersion !== 1 ||
  vault.kdf?.name !== 'PBKDF2' ||
  vault.kdf?.hash !== 'SHA-256' ||
  vault.cipher?.name !== 'AES-GCM' ||
  typeof vault.kdf?.salt !== 'string' ||
  typeof vault.kdf?.iterations !== 'number' ||
  typeof vault.cipher?.iv !== 'string' ||
  typeof vault.payload !== 'string'
) {
  console.log('NG: unsupported Distill encrypted vault format.');
  process.exit(4);
}

try {
  const salt = Buffer.from(vault.kdf.salt, 'base64');
  const iv = Buffer.from(vault.cipher.iv, 'base64');
  const payload = Buffer.from(vault.payload, 'base64');
  const tagLength = 16;
  const ciphertext = payload.subarray(0, payload.length - tagLength);
  const tag = payload.subarray(payload.length - tagLength);
  const key = crypto.pbkdf2Sync(passphrase, salt, vault.kdf.iterations, 32, 'sha256');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  const store = JSON.parse(plaintext);
  console.log('OK: passphrase decrypted the vault.');
  console.log(`Blocks: ${Array.isArray(store.blocks) ? store.blocks.length : 0}`);
  console.log(`Projects: ${Array.isArray(store.projects) ? store.projects.length : 0}`);
  process.exit(0);
} catch (error) {
  console.log('NG: passphrase did not decrypt this vault.');
  console.log('Reason: AES-GCM authentication failed or the vault payload is invalid.');
  process.exit(1);
}
'@

  node -e $nodeScript
  exit $LASTEXITCODE
} finally {
  $env:DISTILL_VAULT_PATH = $null
  $env:DISTILL_VAULT_PASSPHRASE = $null
  $passphrase = $null
}
