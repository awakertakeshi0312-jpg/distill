import { normalizeSyncMetadata, type DeletionTombstone, type DistillStore, type SyncDevice, type ThoughtBlock } from './model';
import {
  decryptDistillSyncRecord,
  encryptDistillSyncRecord,
  type EncryptOptions,
} from './vaultCrypto';

export const SYNC_PACKET_SCHEMA_VERSION = 1;

export type SyncRecordKind = 'thought-block' | 'thought-block-deletion';

export type ThoughtBlockSyncRecord = {
  kind: 'thought-block';
  id: string;
  updatedAt: string;
  hash: string;
  value: ThoughtBlock;
};

export type ThoughtBlockDeletionSyncRecord = {
  kind: 'thought-block-deletion';
  id: string;
  updatedAt: string;
  hash: string;
  value: DeletionTombstone;
};

export type SyncRecord = ThoughtBlockSyncRecord | ThoughtBlockDeletionSyncRecord;

export type DistillSyncPacket = {
  type: 'distill.sync.packet';
  schemaVersion: typeof SYNC_PACKET_SCHEMA_VERSION;
  sourceDeviceId: string;
  sourceDeviceName?: string;
  createdAt: string;
  since?: string;
  devices?: SyncDevice[];
  records: SyncRecord[];
};

export type EncryptedSyncRecord = Omit<SyncRecord, 'value'> & {
  encrypted: {
    type: 'distill.encrypted-sync-record';
    value: string;
  };
};

export type DistillEncryptedSyncPacket = Omit<DistillSyncPacket, 'type' | 'records'> & {
  type: 'distill.encrypted-sync.packet';
  records: EncryptedSyncRecord[];
};

type BuildSyncPacketOptions = {
  sourceDeviceId: string;
  sourceDeviceName?: string;
  since?: string;
  now?: string;
};

type BuildEncryptedSyncPacketOptions = BuildSyncPacketOptions &
  EncryptOptions & {
    passphrase: string;
  };

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = sortObject((value as Record<string, unknown>)[key]);
      return result;
    }, {});
}

export function stableStringify(value: unknown) {
  return JSON.stringify(sortObject(value));
}

export function stableHash(value: unknown) {
  const input = stableStringify(value);
  let hash = 0x811c9dc5;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function cloneBlock(block: ThoughtBlock): ThoughtBlock {
  return {
    ...block,
    tags: [...block.tags],
    links: [...block.links],
  };
}

function cloneTombstone(tombstone: DeletionTombstone): DeletionTombstone {
  return {
    ...tombstone,
  };
}

function cloneDevice(device: SyncDevice): SyncDevice {
  return {
    ...device,
  };
}

function createBlockRecord(block: ThoughtBlock): ThoughtBlockSyncRecord {
  const value = cloneBlock(block);

  return {
    kind: 'thought-block',
    id: block.id,
    updatedAt: block.updatedAt,
    hash: stableHash(value),
    value,
  };
}

function createDeletionRecord(tombstone: DeletionTombstone): ThoughtBlockDeletionSyncRecord {
  const value = cloneTombstone(tombstone);

  return {
    kind: 'thought-block-deletion',
    id: tombstone.id,
    updatedAt: tombstone.deletedAt,
    hash: stableHash(value),
    value,
  };
}

function compareRecordOrder(a: SyncRecord, b: SyncRecord) {
  return a.updatedAt.localeCompare(b.updatedAt) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id);
}

function compareBlockOrder(a: ThoughtBlock, b: ThoughtBlock) {
  return b.capturedAt.localeCompare(a.capturedAt) || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
}

function createSourceDevice(options: BuildSyncPacketOptions, timestamp: string): SyncDevice | null {
  const name = options.sourceDeviceName?.trim();

  if (!name) {
    return null;
  }

  return {
    id: options.sourceDeviceId,
    name,
    firstSeenAt: timestamp,
    lastSeenAt: timestamp,
    lastPacketAt: timestamp,
  };
}

function packetSourceDevice(packet: Pick<DistillSyncPacket, 'sourceDeviceId' | 'sourceDeviceName' | 'createdAt'>) {
  return {
    id: packet.sourceDeviceId,
    name: packet.sourceDeviceName?.trim() || packet.sourceDeviceId,
    firstSeenAt: packet.createdAt,
    lastSeenAt: packet.createdAt,
    lastPacketAt: packet.createdAt,
  } satisfies SyncDevice;
}

export function mergeSyncDevices(...deviceGroups: SyncDevice[][]): SyncDevice[] {
  const devicesById = new Map<string, SyncDevice>();

  for (const device of deviceGroups.flat()) {
    const current = devicesById.get(device.id);

    if (!current) {
      devicesById.set(device.id, cloneDevice(device));
      continue;
    }

    devicesById.set(device.id, {
      id: device.id,
      name: device.lastSeenAt >= current.lastSeenAt ? device.name : current.name,
      firstSeenAt: current.firstSeenAt < device.firstSeenAt ? current.firstSeenAt : device.firstSeenAt,
      lastSeenAt: current.lastSeenAt > device.lastSeenAt ? current.lastSeenAt : device.lastSeenAt,
      lastPacketAt:
        !current.lastPacketAt || (device.lastPacketAt && device.lastPacketAt > current.lastPacketAt)
          ? device.lastPacketAt
          : current.lastPacketAt,
    });
  }

  return Array.from(devicesById.values()).sort(
    (a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
  );
}

export function registerSyncDevice(
  store: DistillStore,
  device: Pick<SyncDevice, 'id' | 'name'>,
  timestamp = new Date().toISOString(),
): DistillStore {
  const sync = normalizeSyncMetadata(store.sync);
  const registered: SyncDevice = {
    id: device.id,
    name: device.name.trim() || device.id,
    firstSeenAt: timestamp,
    lastSeenAt: timestamp,
    lastPacketAt: timestamp,
  };

  return {
    ...store,
    sync: {
      ...sync,
      devices: mergeSyncDevices(sync.devices, [registered]),
    },
  };
}

export function buildSyncPacket(store: DistillStore, options: BuildSyncPacketOptions): DistillSyncPacket {
  const since = options.since;
  const createdAt = options.now ?? new Date().toISOString();
  const sync = normalizeSyncMetadata(store.sync);
  const sourceDevice = createSourceDevice(options, createdAt);
  const records = [
    ...store.blocks.filter((block) => !since || block.updatedAt > since).map(createBlockRecord),
    ...sync.tombstones.filter((tombstone) => !since || tombstone.deletedAt > since).map(createDeletionRecord),
  ].sort(compareRecordOrder);
  const devices = sourceDevice ? mergeSyncDevices(sync.devices, [sourceDevice]) : sync.devices.map(cloneDevice);

  return {
    type: 'distill.sync.packet',
    schemaVersion: SYNC_PACKET_SCHEMA_VERSION,
    sourceDeviceId: options.sourceDeviceId,
    sourceDeviceName: options.sourceDeviceName,
    createdAt,
    since,
    devices,
    records,
  };
}

function isSyncDevice(value: unknown): value is SyncDevice {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const device = value as SyncDevice;

  return (
    typeof device.id === 'string' &&
    typeof device.name === 'string' &&
    typeof device.firstSeenAt === 'string' &&
    typeof device.lastSeenAt === 'string' &&
    (typeof device.lastPacketAt === 'undefined' || typeof device.lastPacketAt === 'string')
  );
}

function isDeletionTombstone(value: unknown): value is DeletionTombstone {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const tombstone = value as DeletionTombstone;

  return (
    tombstone.kind === 'thought-block' &&
    typeof tombstone.id === 'string' &&
    typeof tombstone.deletedAt === 'string' &&
    (typeof tombstone.deletedByDeviceId === 'undefined' || typeof tombstone.deletedByDeviceId === 'string')
  );
}

function isThoughtBlockValue(value: unknown): value is ThoughtBlock {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const block = value as ThoughtBlock;

  return (
    typeof block.id === 'string' &&
    typeof block.content === 'string' &&
    typeof block.noteId === 'string' &&
    typeof block.capturedAt === 'string' &&
    typeof block.updatedAt === 'string' &&
    Array.isArray(block.tags) &&
    block.tags.every((tag) => typeof tag === 'string') &&
    Array.isArray(block.links) &&
    block.links.every((link) => typeof link === 'string') &&
    ['open', 'linked', 'processed', 'archived'].includes(block.state)
  );
}

function isSyncRecord(value: unknown): value is SyncRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as SyncRecord;

  if (typeof record.id !== 'string' || typeof record.updatedAt !== 'string' || typeof record.hash !== 'string') {
    return false;
  }

  if (record.kind === 'thought-block') {
    return (
      isThoughtBlockValue(record.value) &&
      record.id === record.value.id &&
      record.updatedAt === record.value.updatedAt &&
      record.hash === stableHash(record.value)
    );
  }

  if (record.kind === 'thought-block-deletion') {
    return (
      isDeletionTombstone(record.value) &&
      record.id === record.value.id &&
      record.updatedAt === record.value.deletedAt &&
      record.hash === stableHash(record.value)
    );
  }

  return false;
}

export function parseSyncPacket(json: string): DistillSyncPacket {
  const parsed = JSON.parse(json) as DistillSyncPacket;

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    parsed.type !== 'distill.sync.packet' ||
    parsed.schemaVersion !== SYNC_PACKET_SCHEMA_VERSION ||
    typeof parsed.sourceDeviceId !== 'string' ||
    typeof parsed.createdAt !== 'string' ||
    (typeof parsed.sourceDeviceName !== 'undefined' && typeof parsed.sourceDeviceName !== 'string') ||
    (typeof parsed.devices !== 'undefined' && (!Array.isArray(parsed.devices) || !parsed.devices.every(isSyncDevice))) ||
    !Array.isArray(parsed.records) ||
    !parsed.records.every(isSyncRecord)
  ) {
    throw new Error('File is not a supported Distill sync packet.');
  }

  return parsed;
}

function isEncryptedSyncRecord(value: unknown): value is EncryptedSyncRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as EncryptedSyncRecord;

  return (
    (record.kind === 'thought-block' || record.kind === 'thought-block-deletion') &&
    typeof record.id === 'string' &&
    typeof record.updatedAt === 'string' &&
    typeof record.hash === 'string' &&
    record.encrypted?.type === 'distill.encrypted-sync-record' &&
    typeof record.encrypted.value === 'string'
  );
}

export function parseEncryptedSyncPacket(json: string): DistillEncryptedSyncPacket {
  const parsed = JSON.parse(json) as DistillEncryptedSyncPacket;

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    parsed.type !== 'distill.encrypted-sync.packet' ||
    parsed.schemaVersion !== SYNC_PACKET_SCHEMA_VERSION ||
    typeof parsed.sourceDeviceId !== 'string' ||
    typeof parsed.createdAt !== 'string' ||
    (typeof parsed.sourceDeviceName !== 'undefined' && typeof parsed.sourceDeviceName !== 'string') ||
    (typeof parsed.devices !== 'undefined' && (!Array.isArray(parsed.devices) || !parsed.devices.every(isSyncDevice))) ||
    !Array.isArray(parsed.records) ||
    !parsed.records.every(isEncryptedSyncRecord)
  ) {
    throw new Error('File is not a supported Distill encrypted sync packet.');
  }

  return parsed;
}

function assertRecordMetadataMatches(wrapper: EncryptedSyncRecord, decrypted: SyncRecord) {
  if (
    wrapper.kind !== decrypted.kind ||
    wrapper.id !== decrypted.id ||
    wrapper.updatedAt !== decrypted.updatedAt ||
    wrapper.hash !== decrypted.hash
  ) {
    throw new Error('Encrypted sync record metadata does not match its decrypted payload.');
  }

  if (!isSyncRecord(decrypted)) {
    throw new Error('Encrypted sync record payload is not a supported Distill sync record.');
  }
}

export async function buildEncryptedSyncPacket(
  store: DistillStore,
  options: BuildEncryptedSyncPacketOptions,
): Promise<DistillEncryptedSyncPacket> {
  const plainPacket = buildSyncPacket(store, options);
  const records = await Promise.all(
    plainPacket.records.map(async (record): Promise<EncryptedSyncRecord> => ({
      kind: record.kind,
      id: record.id,
      updatedAt: record.updatedAt,
      hash: record.hash,
      encrypted: {
        type: 'distill.encrypted-sync-record',
        value: await encryptDistillSyncRecord(stableStringify(record), options.passphrase, {
          iterations: options.iterations,
        }),
      },
    })),
  );

  return {
    type: 'distill.encrypted-sync.packet',
    schemaVersion: SYNC_PACKET_SCHEMA_VERSION,
    sourceDeviceId: plainPacket.sourceDeviceId,
    sourceDeviceName: plainPacket.sourceDeviceName,
    createdAt: plainPacket.createdAt,
    since: plainPacket.since,
    devices: plainPacket.devices?.map(cloneDevice),
    records,
  };
}

export async function decryptEncryptedSyncPacket(
  packet: DistillEncryptedSyncPacket,
  passphrase: string,
): Promise<DistillSyncPacket> {
  const records = await Promise.all(
    packet.records.map(async (record) => {
      const decrypted = JSON.parse(await decryptDistillSyncRecord(record.encrypted.value, passphrase)) as SyncRecord;
      assertRecordMetadataMatches(record, decrypted);
      return decrypted;
    }),
  );

  return {
    type: 'distill.sync.packet',
    schemaVersion: packet.schemaVersion,
    sourceDeviceId: packet.sourceDeviceId,
    sourceDeviceName: packet.sourceDeviceName,
    createdAt: packet.createdAt,
    since: packet.since,
    devices: packet.devices?.map(cloneDevice),
    records: records.sort(compareRecordOrder),
  };
}

function shouldAcceptIncomingBlock(localBlock: ThoughtBlock | undefined, incoming: ThoughtBlockSyncRecord) {
  if (!localBlock) {
    return true;
  }

  if (incoming.updatedAt > localBlock.updatedAt) {
    return true;
  }

  if (incoming.updatedAt < localBlock.updatedAt) {
    return false;
  }

  return incoming.hash > stableHash(localBlock);
}

function shouldAcceptIncomingTombstone(
  localTombstone: DeletionTombstone | undefined,
  incoming: ThoughtBlockDeletionSyncRecord,
) {
  if (!localTombstone) {
    return true;
  }

  if (incoming.value.deletedAt > localTombstone.deletedAt) {
    return true;
  }

  if (incoming.value.deletedAt < localTombstone.deletedAt) {
    return false;
  }

  return incoming.hash > stableHash(localTombstone);
}

function blockBeatsTombstone(block: ThoughtBlockSyncRecord, tombstone: DeletionTombstone) {
  if (block.updatedAt > tombstone.deletedAt) {
    return true;
  }

  if (block.updatedAt < tombstone.deletedAt) {
    return false;
  }

  return block.hash > stableHash(tombstone);
}

export function applySyncPacket(store: DistillStore, packet: DistillSyncPacket): DistillStore {
  const blocksById = new Map(store.blocks.map((block) => [block.id, cloneBlock(block)]));
  const sync = normalizeSyncMetadata(store.sync);
  const tombstonesById = new Map(sync.tombstones.map((tombstone) => [tombstone.id, cloneTombstone(tombstone)]));
  const devices = mergeSyncDevices(sync.devices, packet.devices ?? [], [packetSourceDevice(packet)]);

  for (const record of packet.records) {
    if (record.kind === 'thought-block-deletion') {
      if (!shouldAcceptIncomingTombstone(tombstonesById.get(record.id), record)) {
        continue;
      }

      const tombstone = cloneTombstone(record.value);
      const localBlock = blocksById.get(record.id);

      tombstonesById.set(record.id, tombstone);

      if (!localBlock || tombstone.deletedAt >= localBlock.updatedAt) {
        blocksById.delete(record.id);
      }

      continue;
    }

    const tombstone = tombstonesById.get(record.id);

    if (tombstone && !blockBeatsTombstone(record, tombstone)) {
      continue;
    }

    if (shouldAcceptIncomingBlock(blocksById.get(record.id), record)) {
      blocksById.set(record.id, cloneBlock(record.value));
    }
  }

  return {
    ...store,
    blocks: Array.from(blocksById.values()).sort(compareBlockOrder),
    sync: normalizeSyncMetadata({
      tombstones: Array.from(tombstonesById.values()),
      devices,
    }),
  };
}

export function serializeSyncPacket(packet: DistillSyncPacket) {
  return `${JSON.stringify(packet, null, 2)}\n`;
}

export function serializeEncryptedSyncPacket(packet: DistillEncryptedSyncPacket) {
  return `${JSON.stringify(packet, null, 2)}\n`;
}

export async function applyEncryptedSyncPacket(
  store: DistillStore,
  packet: DistillEncryptedSyncPacket,
  passphrase: string,
) {
  return applySyncPacket(store, await decryptEncryptedSyncPacket(packet, passphrase));
}
