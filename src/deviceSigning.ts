import { normalizeSyncMetadata, type DistillStore } from './model';
import {
  getSyncPacketSignaturePayload,
  SYNC_SIGNATURE_ALGORITHM,
  type DistillSyncPacket,
  type SyncPacketSignature,
} from './sync';

export const DEVICE_SIGNING_KEY_KEY = 'distill.deviceSigningKey.v1';

export type DeviceSigningKeyPair = {
  algorithm: typeof SYNC_SIGNATURE_ALGORITHM;
  publicKey: string;
  privateKey: string;
  createdAt: string;
};

export type DeviceVerificationPayload = {
  type: 'distill-device-verification';
  version: 1;
  algorithm: typeof SYNC_SIGNATURE_ALGORITHM;
  deviceId: string;
  deviceName: string;
  fingerprint: string;
  publicKey: string;
};

export type SyncPacketSignatureStatus =
  | 'trusted-valid'
  | 'trusted-missing-signature'
  | 'trusted-key-mismatch'
  | 'trusted-invalid'
  | 'signed-untrusted'
  | 'unsigned-untrusted'
  | 'legacy-trusted'
  | 'unsupported';

export type SyncPacketSignatureReview = {
  status: SyncPacketSignatureStatus;
  blocksApply: boolean;
  requiresTrust: boolean;
  signatureValid: boolean;
  publicKey?: string;
  fingerprint?: string;
  verificationPayload?: string;
};

function getSubtleCrypto() {
  const subtle = globalThis.crypto?.subtle;

  if (!subtle) {
    throw new Error('WebCrypto is not available in this runtime.');
  }

  return subtle;
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

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function groupFingerprint(value: string) {
  return value.match(/.{1,4}/g)?.join('-') ?? value;
}

export async function formatDevicePublicKeyFingerprint(publicKey: string) {
  const digest = await getSubtleCrypto().digest('SHA-256', base64ToBytes(publicKey));
  return groupFingerprint(bytesToHex(new Uint8Array(digest)).slice(0, 32));
}

async function createDeviceSignaturePublicKeyReviewFields(
  publicKey: string | undefined,
  deviceId: string,
  deviceName: string,
) {
  if (!publicKey) {
    return {};
  }

  let fingerprint = '';

  try {
    fingerprint = await formatDevicePublicKeyFingerprint(publicKey);
  } catch {
    return { publicKey };
  }

  return {
    publicKey,
    fingerprint,
    verificationPayload: buildDeviceVerificationPayload({
      deviceId,
      deviceName,
      publicKey,
      fingerprint,
    }),
  };
}

export function normalizeDeviceFingerprintInput(value: string) {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function deviceFingerprintMatches(expectedFingerprint: string | undefined, userInput: string) {
  if (!expectedFingerprint) {
    return false;
  }

  return normalizeDeviceFingerprintInput(expectedFingerprint) === normalizeDeviceFingerprintInput(userInput);
}

export function buildDeviceVerificationPayload(input: {
  deviceId: string;
  deviceName: string;
  publicKey: string;
  fingerprint: string;
}): string {
  return JSON.stringify({
    type: 'distill-device-verification',
    version: 1,
    algorithm: SYNC_SIGNATURE_ALGORITHM,
    deviceId: input.deviceId,
    deviceName: input.deviceName,
    fingerprint: input.fingerprint,
    publicKey: input.publicKey,
  } satisfies DeviceVerificationPayload);
}

export function parseDeviceVerificationPayload(value: string): DeviceVerificationPayload | null {
  try {
    const parsed = JSON.parse(value.trim()) as DeviceVerificationPayload;

    if (
      parsed?.type !== 'distill-device-verification' ||
      parsed.version !== 1 ||
      parsed.algorithm !== SYNC_SIGNATURE_ALGORITHM ||
      typeof parsed.deviceId !== 'string' ||
      typeof parsed.deviceName !== 'string' ||
      typeof parsed.fingerprint !== 'string' ||
      typeof parsed.publicKey !== 'string'
    ) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function resolveDeviceVerificationCodeFromPayload(
  value: string,
  expected: {
    fingerprint?: string;
    publicKey?: string;
    deviceId?: string;
  },
) {
  const parsed = parseDeviceVerificationPayload(value);

  if (!parsed) {
    return deviceFingerprintMatches(expected.fingerprint, value) ? expected.fingerprint : null;
  }

  if (expected.deviceId && parsed.deviceId !== expected.deviceId) {
    return null;
  }

  if (expected.publicKey && parsed.publicKey !== expected.publicKey) {
    return null;
  }

  return deviceFingerprintMatches(expected.fingerprint, parsed.fingerprint) ? parsed.fingerprint : null;
}

function isDeviceSigningKeyPair(value: unknown): value is DeviceSigningKeyPair {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const keyPair = value as DeviceSigningKeyPair;

  return (
    keyPair.algorithm === SYNC_SIGNATURE_ALGORITHM &&
    typeof keyPair.publicKey === 'string' &&
    keyPair.publicKey.length > 0 &&
    typeof keyPair.privateKey === 'string' &&
    keyPair.privateKey.length > 0 &&
    typeof keyPair.createdAt === 'string'
  );
}

export function readDeviceSigningKeyPair(): DeviceSigningKeyPair | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(DEVICE_SIGNING_KEY_KEY) ?? 'null');
    return isDeviceSigningKeyPair(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDeviceSigningKeyPair(keyPair: DeviceSigningKeyPair) {
  localStorage.setItem(DEVICE_SIGNING_KEY_KEY, JSON.stringify(keyPair));
}

async function importPrivateSigningKey(privateKey: string) {
  return getSubtleCrypto().importKey(
    'pkcs8',
    base64ToBytes(privateKey),
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    false,
    ['sign'],
  );
}

async function importPublicSigningKey(publicKey: string) {
  return getSubtleCrypto().importKey(
    'spki',
    base64ToBytes(publicKey),
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    false,
    ['verify'],
  );
}

export async function createDeviceSigningKeyPair(): Promise<DeviceSigningKeyPair> {
  const generated = await getSubtleCrypto().generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['sign', 'verify'],
  );
  const [publicKey, privateKey] = await Promise.all([
    getSubtleCrypto().exportKey('spki', generated.publicKey),
    getSubtleCrypto().exportKey('pkcs8', generated.privateKey),
  ]);

  return {
    algorithm: SYNC_SIGNATURE_ALGORITHM,
    publicKey: bytesToBase64(new Uint8Array(publicKey)),
    privateKey: bytesToBase64(new Uint8Array(privateKey)),
    createdAt: new Date().toISOString(),
  };
}

export async function getOrCreateDeviceSigningKeyPair() {
  const existing = readDeviceSigningKeyPair();

  if (existing) {
    return existing;
  }

  const created = await createDeviceSigningKeyPair();
  saveDeviceSigningKeyPair(created);
  return created;
}

async function signText(value: string, keyPair: DeviceSigningKeyPair) {
  const privateKey = await importPrivateSigningKey(keyPair.privateKey);
  const signature = await getSubtleCrypto().sign(
    {
      name: 'ECDSA',
      hash: 'SHA-256',
    },
    privateKey,
    new TextEncoder().encode(value),
  );

  return bytesToBase64(new Uint8Array(signature));
}

async function verifyText(value: string, publicKey: string, signature: string) {
  const importedPublicKey = await importPublicSigningKey(publicKey);
  return getSubtleCrypto().verify(
    {
      name: 'ECDSA',
      hash: 'SHA-256',
    },
    importedPublicKey,
    base64ToBytes(signature),
    new TextEncoder().encode(value),
  );
}

export async function signSyncPacket(packet: DistillSyncPacket, keyPair: DeviceSigningKeyPair): Promise<SyncPacketSignature> {
  return {
    algorithm: SYNC_SIGNATURE_ALGORITHM,
    publicKey: keyPair.publicKey,
    value: await signText(getSyncPacketSignaturePayload(packet), keyPair),
  };
}

export function getTrustedSyncDevicePublicKey(store: DistillStore, deviceId: string) {
  const sync = normalizeSyncMetadata(store.sync);
  return sync.devices.find((device) => device.id === deviceId)?.signingPublicKey;
}

export async function reviewSyncPacketSignature(
  store: DistillStore,
  packet: DistillSyncPacket,
): Promise<SyncPacketSignatureReview> {
  const trustedPublicKey = getTrustedSyncDevicePublicKey(store, packet.sourceDeviceId);
  const isKnownDevice = normalizeSyncMetadata(store.sync).devices.some((device) => device.id === packet.sourceDeviceId);
  const sourceDeviceName = packet.sourceDeviceName || packet.sourceDeviceId;

  if (!packet.signature) {
    if (trustedPublicKey) {
      return {
        status: 'trusted-missing-signature',
        blocksApply: true,
        requiresTrust: false,
        signatureValid: false,
        ...(await createDeviceSignaturePublicKeyReviewFields(trustedPublicKey, packet.sourceDeviceId, sourceDeviceName)),
      };
    }

    return {
      status: isKnownDevice ? 'legacy-trusted' : 'unsigned-untrusted',
      blocksApply: false,
      requiresTrust: !isKnownDevice,
      signatureValid: false,
      ...(await createDeviceSignaturePublicKeyReviewFields(trustedPublicKey, packet.sourceDeviceId, sourceDeviceName)),
    };
  }

  if (packet.signature.algorithm !== SYNC_SIGNATURE_ALGORITHM) {
    return {
      status: 'unsupported',
      blocksApply: true,
      requiresTrust: false,
      signatureValid: false,
      ...(await createDeviceSignaturePublicKeyReviewFields(
        trustedPublicKey ?? packet.signature.publicKey,
        packet.sourceDeviceId,
        sourceDeviceName,
      )),
    };
  }

  if (trustedPublicKey && packet.signature.publicKey !== trustedPublicKey) {
    return {
      status: 'trusted-key-mismatch',
      blocksApply: true,
      requiresTrust: false,
      signatureValid: false,
      ...(await createDeviceSignaturePublicKeyReviewFields(trustedPublicKey, packet.sourceDeviceId, sourceDeviceName)),
    };
  }

  try {
    const verificationKey = trustedPublicKey ?? packet.signature.publicKey;
    const signatureValid = await verifyText(
      getSyncPacketSignaturePayload(packet),
      verificationKey,
      packet.signature.value,
    );

    if (!signatureValid) {
      return {
        status: 'trusted-invalid',
        blocksApply: true,
        requiresTrust: false,
        signatureValid: false,
        ...(await createDeviceSignaturePublicKeyReviewFields(verificationKey, packet.sourceDeviceId, sourceDeviceName)),
      };
    }

    return {
      status: trustedPublicKey ? 'trusted-valid' : 'signed-untrusted',
      blocksApply: false,
      requiresTrust: !trustedPublicKey,
      signatureValid: true,
      ...(await createDeviceSignaturePublicKeyReviewFields(verificationKey, packet.sourceDeviceId, sourceDeviceName)),
    };
  } catch {
    return {
      status: 'unsupported',
      blocksApply: true,
      requiresTrust: false,
      signatureValid: false,
      ...(await createDeviceSignaturePublicKeyReviewFields(
        trustedPublicKey ?? packet.signature.publicKey,
        packet.sourceDeviceId,
        sourceDeviceName,
      )),
    };
  }
}
