const VAULT_SCHEMA_VERSION = 1;
const DEFAULT_PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const MIN_PASSPHRASE_LENGTH = 12;
type EnvelopeType = 'distill.encrypted-vault' | 'distill.encrypted-sync-record';

type VaultCipher = {
  name: 'AES-GCM';
  iv: string;
};

export type VaultKdf = {
  name: 'PBKDF2';
  hash: 'SHA-256';
  iterations: number;
  salt: string;
};

export type DistillVaultEnvelope = {
  type: EnvelopeType;
  schemaVersion: number;
  exportedAt: string;
  kdf: VaultKdf;
  cipher: VaultCipher;
  payload: string;
};

export type DistillVaultSession = {
  type: 'distill.vault-session';
  schemaVersion: typeof VAULT_SCHEMA_VERSION;
  createdAt: string;
  kdf: VaultKdf;
  key: CryptoKey;
};

export type DistillSyncSession = {
  type: 'distill.sync-session';
  schemaVersion: typeof VAULT_SCHEMA_VERSION;
  createdAt: string;
  kdf: VaultKdf;
  key: CryptoKey;
};

export type EncryptOptions = {
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

function createEnvelope(envelopeType: EnvelopeType, kdf: VaultKdf, iv: Uint8Array, encrypted: ArrayBuffer) {
  const envelope: DistillVaultEnvelope = {
    type: envelopeType,
    schemaVersion: VAULT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    kdf,
    cipher: {
      name: 'AES-GCM',
      iv: bytesToBase64(iv),
    },
    payload: bytesToBase64(new Uint8Array(encrypted)),
  };

  return JSON.stringify(envelope, null, 2);
}

function assertEnvelopeKdfMatchesSession(envelope: DistillVaultEnvelope, sessionKdf: VaultKdf) {
  if (
    envelope.kdf.name !== sessionKdf.name ||
    envelope.kdf.hash !== sessionKdf.hash ||
    envelope.kdf.iterations !== sessionKdf.iterations ||
    envelope.kdf.salt !== sessionKdf.salt
  ) {
    throw new Error('Encrypted payload KDF does not match the active crypto session.');
  }
}

async function encryptJsonEnvelopeWithKey(
  plainJson: string,
  key: CryptoKey,
  kdf: VaultKdf,
  envelopeType: EnvelopeType,
) {
  const iv = randomBytes(IV_BYTES);
  const encrypted = await getSubtleCrypto().encrypt(
    {
      name: 'AES-GCM',
      iv: toCryptoBytes(iv),
    },
    key,
    new TextEncoder().encode(plainJson),
  );

  return createEnvelope(envelopeType, kdf, iv, encrypted);
}

async function encryptJsonEnvelope(
  plainJson: string,
  passphrase: string,
  envelopeType: EnvelopeType,
  options: EncryptOptions = {},
) {
  assertPassphrase(passphrase);

  const iterations = options.iterations ?? DEFAULT_PBKDF2_ITERATIONS;
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveVaultKey(passphrase, salt, iterations);
  const kdf: VaultKdf = {
    name: 'PBKDF2',
    hash: 'SHA-256',
    iterations,
    salt: bytesToBase64(salt),
  };

  return encryptJsonEnvelopeWithKey(plainJson, key, kdf, envelopeType);
}

export async function encryptDistillVault(plainJson: string, passphrase: string, options: EncryptOptions = {}) {
  return encryptJsonEnvelope(plainJson, passphrase, 'distill.encrypted-vault', options);
}

export async function encryptDistillSyncRecord(plainJson: string, passphrase: string, options: EncryptOptions = {}) {
  return encryptJsonEnvelope(plainJson, passphrase, 'distill.encrypted-sync-record', options);
}

function parseEncryptedEnvelope(value: string, envelopeType: EnvelopeType): DistillVaultEnvelope {
  const parsed = JSON.parse(value) as Partial<DistillVaultEnvelope>;

  if (
    parsed.type !== envelopeType ||
    parsed.schemaVersion !== VAULT_SCHEMA_VERSION ||
    parsed.kdf?.name !== 'PBKDF2' ||
    parsed.kdf.hash !== 'SHA-256' ||
    parsed.cipher?.name !== 'AES-GCM' ||
    typeof parsed.payload !== 'string' ||
    typeof parsed.kdf.salt !== 'string' ||
    typeof parsed.kdf.iterations !== 'number' ||
    typeof parsed.cipher.iv !== 'string'
  ) {
    throw new Error('File is not a supported Distill encrypted payload.');
  }

  return parsed as DistillVaultEnvelope;
}

async function decryptEnvelopeWithKey(envelope: DistillVaultEnvelope, key: CryptoKey) {
  const iv = base64ToBytes(envelope.cipher.iv);
  const payload = base64ToBytes(envelope.payload);
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

async function createVaultSessionFromKdf(passphrase: string, kdf: VaultKdf): Promise<DistillVaultSession> {
  assertPassphrase(passphrase);

  const salt = base64ToBytes(kdf.salt);
  const key = await deriveVaultKey(passphrase, salt, kdf.iterations);

  return {
    type: 'distill.vault-session',
    schemaVersion: VAULT_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    kdf,
    key,
  };
}

async function decryptJsonEnvelope(encryptedJson: string, passphrase: string, envelopeType: EnvelopeType) {
  const envelope = parseEncryptedEnvelope(encryptedJson, envelopeType);
  const session = await createVaultSessionFromKdf(passphrase, envelope.kdf);

  return decryptEnvelopeWithKey(envelope, session.key);
}

export async function createDistillVaultSession(
  passphrase: string,
  options: EncryptOptions = {},
): Promise<DistillVaultSession> {
  assertPassphrase(passphrase);

  const salt = randomBytes(SALT_BYTES);
  const kdf: VaultKdf = {
    name: 'PBKDF2',
    hash: 'SHA-256',
    iterations: options.iterations ?? DEFAULT_PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
  };
  const key = await deriveVaultKey(passphrase, salt, kdf.iterations);

  return {
    type: 'distill.vault-session',
    schemaVersion: VAULT_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    kdf,
    key,
  };
}

export async function createDistillSyncSession(
  passphrase: string,
  options: EncryptOptions = {},
): Promise<DistillSyncSession> {
  assertPassphrase(passphrase);

  const salt = randomBytes(SALT_BYTES);
  const kdf: VaultKdf = {
    name: 'PBKDF2',
    hash: 'SHA-256',
    iterations: options.iterations ?? DEFAULT_PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
  };
  const key = await deriveVaultKey(passphrase, salt, kdf.iterations);

  return {
    type: 'distill.sync-session',
    schemaVersion: VAULT_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    kdf,
    key,
  };
}

export async function createDistillSyncSessionFromKdf(
  passphrase: string,
  kdf: VaultKdf,
): Promise<DistillSyncSession> {
  assertPassphrase(passphrase);

  const salt = base64ToBytes(kdf.salt);
  const key = await deriveVaultKey(passphrase, salt, kdf.iterations);

  return {
    type: 'distill.sync-session',
    schemaVersion: VAULT_SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    kdf,
    key,
  };
}

export async function unlockDistillVaultSession(encryptedJson: string, passphrase: string) {
  const envelope = parseEncryptedEnvelope(encryptedJson, 'distill.encrypted-vault');
  const session = await createVaultSessionFromKdf(passphrase, envelope.kdf);
  const plainJson = await decryptEnvelopeWithKey(envelope, session.key);

  return {
    plainJson,
    session,
  };
}

export async function encryptDistillVaultWithSession(plainJson: string, session: DistillVaultSession) {
  return encryptJsonEnvelopeWithKey(plainJson, session.key, session.kdf, 'distill.encrypted-vault');
}

export async function encryptDistillSyncRecordWithSession(plainJson: string, session: DistillSyncSession) {
  return encryptJsonEnvelopeWithKey(plainJson, session.key, session.kdf, 'distill.encrypted-sync-record');
}

export async function decryptDistillVault(encryptedJson: string, passphrase: string) {
  return decryptJsonEnvelope(encryptedJson, passphrase, 'distill.encrypted-vault');
}

export async function decryptDistillSyncRecord(encryptedJson: string, passphrase: string) {
  return decryptJsonEnvelope(encryptedJson, passphrase, 'distill.encrypted-sync-record');
}

export async function decryptDistillSyncRecordWithSession(encryptedJson: string, session: DistillSyncSession) {
  const envelope = parseEncryptedEnvelope(encryptedJson, 'distill.encrypted-sync-record');
  assertEnvelopeKdfMatchesSession(envelope, session.kdf);

  return decryptEnvelopeWithKey(envelope, session.key);
}
