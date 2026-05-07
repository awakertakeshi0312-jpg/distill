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

function Convert-Base64ToBytes {
  param([string] $Value)
  [Convert]::FromBase64String($Value)
}

$vaultPath = Join-Path $env:APPDATA "app.distill.local\backups\distill-encrypted-vault-latest.json"

if (-not (Test-Path $vaultPath)) {
  Write-Host "NG: encrypted vault backup was not found at $vaultPath"
  exit 2
}

$vault = Get-Content -Raw -Encoding UTF8 $vaultPath | ConvertFrom-Json

if (
  $vault.type -ne "distill.encrypted-vault" -or
  $vault.schemaVersion -ne 1 -or
  $vault.kdf.name -ne "PBKDF2" -or
  $vault.kdf.hash -ne "SHA-256" -or
  $vault.cipher.name -ne "AES-GCM"
) {
  Write-Host "NG: unsupported Distill encrypted vault format."
  exit 3
}

$secure = Read-Host "Vault passphrase (input is hidden)" -AsSecureString
$passphrase = Convert-SecureStringToPlainText $secure

try {
  $salt = Convert-Base64ToBytes $vault.kdf.salt
  $iterations = [int] $vault.kdf.iterations
  $iv = Convert-Base64ToBytes $vault.cipher.iv
  $payload = Convert-Base64ToBytes $vault.payload

  $derive = [Security.Cryptography.Rfc2898DeriveBytes]::new(
    $passphrase,
    $salt,
    $iterations,
    [Security.Cryptography.HashAlgorithmName]::SHA256
  )
  $key = $derive.GetBytes(32)

  $tagLength = 16
  if ($payload.Length -le $tagLength) {
    throw "Encrypted payload is too short."
  }

  $ciphertextLength = $payload.Length - $tagLength
  $ciphertext = New-Object byte[] $ciphertextLength
  $tag = New-Object byte[] $tagLength
  [Array]::Copy($payload, 0, $ciphertext, 0, $ciphertextLength)
  [Array]::Copy($payload, $ciphertextLength, $tag, 0, $tagLength)

  $plaintext = New-Object byte[] $ciphertextLength
  $aes = [Security.Cryptography.AesGcm]::new($key, $tagLength)
  $aes.Decrypt($iv, $ciphertext, $tag, $plaintext)

  $json = [Text.Encoding]::UTF8.GetString($plaintext) | ConvertFrom-Json
  $blockCount = if ($json.blocks) { @($json.blocks).Count } else { 0 }
  $projectCount = if ($json.projects) { @($json.projects).Count } else { 0 }

  Write-Host "OK: passphrase decrypted the vault."
  Write-Host "Blocks: $blockCount"
  Write-Host "Projects: $projectCount"
  exit 0
} catch {
  Write-Host "NG: passphrase did not decrypt this vault."
  Write-Host "Reason: AES-GCM authentication failed or the vault payload is invalid."
  exit 1
} finally {
  $passphrase = $null
}
