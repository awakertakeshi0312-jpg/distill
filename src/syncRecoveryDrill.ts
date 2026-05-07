import { withSyncKeyMaterial, type DistillStore, type SyncKeyMaterial } from './model';
import {
  applySyncPacket,
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

export type MultiDeviceSyncRecoveryDrillResult = {
  syncKeyId: string;
  recoveredSyncKeyId: string;
  sourceDeviceId: string;
  recoveredDeviceId: string;
  bootstrapRecords: number;
  returnRecords: number;
  bootstrapPacketCreatedAt: string;
  returnPacketCreatedAt: string;
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

type MultiDeviceSyncRecoveryDrillOptions = SyncRecoveryDrillOptions & {
  recoveredDeviceId: string;
  recoveredDeviceName?: string;
  returnNow?: string;
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

export async function runMultiDeviceSyncRecoveryDrill(
  store: DistillStore,
  options: MultiDeviceSyncRecoveryDrillOptions,
): Promise<MultiDeviceSyncRecoveryDrillResult> {
  const bootstrapPacket = await buildEncryptedSyncPacket(store, {
    sourceDeviceId: options.sourceDeviceId,
    sourceDeviceName: options.sourceDeviceName,
    sourceDeviceSigningPublicKey: options.sourceDeviceSigningPublicKey,
    passphrase: options.passphrase,
    syncKey: options.syncKey,
    now: options.now,
    iterations: options.iterations,
    signPacket: options.signPacket,
  });
  const serializedBootstrapPacket = serializeEncryptedSyncPacket(bootstrapPacket);

  if (
    bootstrapPacket.syncKeyId !== options.syncKey.id ||
    bootstrapPacket.wrappedSyncKey?.keyId !== options.syncKey.id ||
    serializedBootstrapPacket.includes(options.syncKey.secret)
  ) {
    throw new Error('Multi-device recovery drill failed because the bootstrap packet was not recoverable.');
  }

  const recoveredSyncKeys: SyncKeyMaterial[] = [];
  const bootstrapPlainPacket = await decryptEncryptedSyncPacket(bootstrapPacket, {
    passphrase: options.passphrase,
    onDiscoveredSyncKey: (syncKey) => {
      recoveredSyncKeys.push(syncKey);
    },
  });
  const recoveredSyncKey = recoveredSyncKeys[0];

  if (!recoveredSyncKey || recoveredSyncKey.id !== options.syncKey.id) {
    throw new Error('Multi-device recovery drill failed because the receiving device could not recover the sync key.');
  }

  const recoveredDeviceStore = applySyncPacket(
    withSyncKeyMaterial(
      {
        projects: store.projects.map((project) => ({ ...project })),
        blocks: [],
      },
      recoveredSyncKey,
    ),
    bootstrapPlainPacket,
  );
  const returnPacket = await buildEncryptedSyncPacket(recoveredDeviceStore, {
    sourceDeviceId: options.recoveredDeviceId,
    sourceDeviceName: options.recoveredDeviceName,
    passphrase: options.passphrase,
    syncKey: recoveredSyncKey,
    now: options.returnNow,
    iterations: options.iterations,
  });
  const serializedReturnPacket = serializeEncryptedSyncPacket(returnPacket);

  if (
    returnPacket.syncKeyId !== options.syncKey.id ||
    returnPacket.wrappedSyncKey?.keyId !== options.syncKey.id ||
    serializedReturnPacket.includes(options.syncKey.secret)
  ) {
    throw new Error('Multi-device recovery drill failed because the return packet was not recoverable.');
  }

  const returnPlainPacket = await decryptEncryptedSyncPacket(returnPacket, { syncKey: options.syncKey });
  const bootstrapRecordIds = bootstrapPlainPacket.records.map((record) => record.id);
  const returnRecordIds = returnPlainPacket.records.map((record) => record.id);

  assertRecordIdsMatch(bootstrapRecordIds, returnRecordIds);

  return {
    syncKeyId: options.syncKey.id,
    recoveredSyncKeyId: recoveredSyncKey.id,
    sourceDeviceId: bootstrapPacket.sourceDeviceId,
    recoveredDeviceId: returnPacket.sourceDeviceId,
    bootstrapRecords: bootstrapRecordIds.length,
    returnRecords: returnRecordIds.length,
    bootstrapPacketCreatedAt: bootstrapPacket.createdAt,
    returnPacketCreatedAt: returnPacket.createdAt,
  };
}
