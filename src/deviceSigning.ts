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

  if (!packet.signature) {
    if (trustedPublicKey) {
      return {
        status: 'trusted-missing-signature',
        blocksApply: true,
        requiresTrust: false,
        signatureValid: false,
        publicKey: trustedPublicKey,
      };
    }

    return {
      status: isKnownDevice ? 'legacy-trusted' : 'unsigned-untrusted',
      blocksApply: false,
      requiresTrust: !isKnownDevice,
      signatureValid: false,
      publicKey: trustedPublicKey,
    };
  }

  if (packet.signature.algorithm !== SYNC_SIGNATURE_ALGORITHM) {
    return {
      status: 'unsupported',
      blocksApply: true,
      requiresTrust: false,
      signatureValid: false,
      publicKey: trustedPublicKey ?? packet.signature.publicKey,
    };
  }

  if (trustedPublicKey && packet.signature.publicKey !== trustedPublicKey) {
    return {
      status: 'trusted-key-mismatch',
      blocksApply: true,
      requiresTrust: false,
      signatureValid: false,
      publicKey: trustedPublicKey,
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
        publicKey: verificationKey,
      };
    }

    return {
      status: trustedPublicKey ? 'trusted-valid' : 'signed-untrusted',
      blocksApply: false,
      requiresTrust: !trustedPublicKey,
      signatureValid: true,
      publicKey: verificationKey,
    };
  } catch {
    return {
      status: 'unsupported',
      blocksApply: true,
      requiresTrust: false,
      signatureValid: false,
      publicKey: trustedPublicKey ?? packet.signature.publicKey,
    };
  }
}
