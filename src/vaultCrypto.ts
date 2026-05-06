const VAULT_SCHEMA_VERSION = 1;
const DEFAULT_PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const MIN_PASSPHRASE_LENGTH = 12;

type VaultCipher = {
  name: 'AES-GCM';
  iv: string;
};

type VaultKdf = {
  name: 'PBKDF2';
  hash: 'SHA-256';
  iterations: number;
  salt: string;
};

export type DistillVaultEnvelope = {
  type: 'distill.encrypted-vault';
  schemaVersion: number;
  exportedAt: string;
  kdf: VaultKdf;
  cipher: VaultCipher;
  payload: string;
};

type EncryptOptions = {
  iterations?: number;
};

function getSubtleCrypto() {
  const subtle = globalThis.crypto?.subtle;

  if (!subtle) {
    throw new Error('WebCrypto is not available in this runtime.');
  }

  return subtle;
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function toCryptoBytes(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}

function assertPassphrase(passphrase: string) {
  if (passphrase.length < MIN_PASSPHRASE_LENGTH) {
    throw new Error(`Vault passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters.`);
  }
}

async function deriveVaultKey(passphrase: string, salt: Uint8Array, iterations: number) {
  const subtle = getSubtleCrypto();
  const passphraseKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: toCryptoBytes(salt),
      iterations,
    },
    passphraseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptDistillVault(plainJson: string, passphrase: string, options: EncryptOptions = {}) {
  assertPassphrase(passphrase);

  const iterations = options.iterations ?? DEFAULT_PBKDF2_ITERATIONS;
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = await deriveVaultKey(passphrase, salt, iterations);
  const encrypted = await getSubtleCrypto().encrypt(
    {
      name: 'AES-GCM',
      iv: toCryptoBytes(iv),
    },
    key,
    new TextEncoder().encode(plainJson),
  );

  const envelope: DistillVaultEnvelope = {
    type: 'distill.encrypted-vault',
    schemaVersion: VAULT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    kdf: {
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations,
      salt: bytesToBase64(salt),
    },
    cipher: {
      name: 'AES-GCM',
      iv: bytesToBase64(iv),
    },
    payload: bytesToBase64(new Uint8Array(encrypted)),
  };

  return JSON.stringify(envelope, null, 2);
}

function parseVaultEnvelope(value: string): DistillVaultEnvelope {
  const parsed = JSON.parse(value) as Partial<DistillVaultEnvelope>;

  if (
    parsed.type !== 'distill.encrypted-vault' ||
    parsed.schemaVersion !== VAULT_SCHEMA_VERSION ||
    parsed.kdf?.name !== 'PBKDF2' ||
    parsed.kdf.hash !== 'SHA-256' ||
    parsed.cipher?.name !== 'AES-GCM' ||
    typeof parsed.payload !== 'string' ||
    typeof parsed.kdf.salt !== 'string' ||
    typeof parsed.kdf.iterations !== 'number' ||
    typeof parsed.cipher.iv !== 'string'
  ) {
    throw new Error('File is not a supported Distill encrypted vault.');
  }

  return parsed as DistillVaultEnvelope;
}

export async function decryptDistillVault(encryptedJson: string, passphrase: string) {
  assertPassphrase(passphrase);

  const envelope = parseVaultEnvelope(encryptedJson);
  const salt = base64ToBytes(envelope.kdf.salt);
  const iv = base64ToBytes(envelope.cipher.iv);
  const payload = base64ToBytes(envelope.payload);
  const key = await deriveVaultKey(passphrase, salt, envelope.kdf.iterations);
  const decrypted = await getSubtleCrypto().decrypt(
    {
      name: 'AES-GCM',
      iv: toCryptoBytes(iv),
    },
    key,
    payload,
  );

  return new TextDecoder().decode(decrypted);
}
