import type { DistillStore, SyncKeyMaterial } from './model';
import {
  buildEncryptedSyncPacket,
  decryptEncryptedSyncPacket,
  serializeEncryptedSyncPacket,
  type DistillSyncPacket,
  type SyncPacketSignature,
} from './sync';

export type SyncRecoveryDrillResult = {
  syncKeyId: string;
  records: number;
  packetCreatedAt: string;
  discoveredSyncKeyId: string;
  sourceDeviceId: string;
};

type SyncRecoveryDrillOptions = {
  sourceDeviceId: string;
  sourceDeviceName?: string;
  sourceDeviceSigningPublicKey?: string;
  passphrase: string;
  syncKey: SyncKeyMaterial;
  now?: string;
  iterations?: number;
  signPacket?: (packet: DistillSyncPacket) => Promise<SyncPacketSignature>;
};

function assertRecordIdsMatch(left: string[], right: string[]) {
  if (left.length !== right.length || left.some((id, index) => id !== right[index])) {
    throw new Error('Sync recovery drill failed because decrypted record sets did not match.');
  }
}

export async function runSyncRecoveryDrill(
  store: DistillStore,
  options: SyncRecoveryDrillOptions,
): Promise<SyncRecoveryDrillResult> {
  const packet = await buildEncryptedSyncPacket(store, {
    sourceDeviceId: options.sourceDeviceId,
    sourceDeviceName: options.sourceDeviceName,
    sourceDeviceSigningPublicKey: options.sourceDeviceSigningPublicKey,
    passphrase: options.passphrase,
    syncKey: options.syncKey,
    now: options.now,
    iterations: options.iterations,
    signPacket: options.signPacket,
  });

  if (packet.syncKeyId !== options.syncKey.id || packet.wrappedSyncKey?.keyId !== options.syncKey.id) {
    throw new Error('Sync recovery drill failed because the packet did not contain the expected wrapped sync key.');
  }

  const serializedPacket = serializeEncryptedSyncPacket(packet);

  if (serializedPacket.includes(options.syncKey.secret)) {
    throw new Error('Sync recovery drill failed because plaintext sync key material leaked into the packet.');
  }

  const decryptedWithLocalKey = await decryptEncryptedSyncPacket(packet, { syncKey: options.syncKey });
  const discoveredSyncKeys: SyncKeyMaterial[] = [];
  let discoveredSyncKeyId: string | null = null;
  const decryptedWithWrappedKey = await decryptEncryptedSyncPacket(packet, {
    passphrase: options.passphrase,
    onDiscoveredSyncKey: (syncKey) => {
      discoveredSyncKeys.push(syncKey);
      discoveredSyncKeyId = syncKey.id;
    },
  });
  const localRecordIds = decryptedWithLocalKey.records.map((record) => record.id);
  const wrappedRecordIds = decryptedWithWrappedKey.records.map((record) => record.id);

  assertRecordIdsMatch(localRecordIds, wrappedRecordIds);

  if (!discoveredSyncKeys.length || discoveredSyncKeyId !== options.syncKey.id) {
    throw new Error('Sync recovery drill failed because the wrapped sync key could not be rediscovered.');
  }
  const confirmedDiscoveredSyncKeyId = discoveredSyncKeyId;

  return {
    syncKeyId: options.syncKey.id,
    records: localRecordIds.length,
    packetCreatedAt: packet.createdAt,
    discoveredSyncKeyId: confirmedDiscoveredSyncKeyId,
    sourceDeviceId: packet.sourceDeviceId,
  };
}
