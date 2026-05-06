import type { DistillStore, ThoughtBlock } from './model';
import {
  decryptDistillSyncRecord,
  encryptDistillSyncRecord,
  type EncryptOptions,
} from './vaultCrypto';

export const SYNC_PACKET_SCHEMA_VERSION = 1;

export type SyncRecordKind = 'thought-block';

export type SyncRecord = {
  kind: SyncRecordKind;
  id: string;
  updatedAt: string;
  hash: string;
  value: ThoughtBlock;
};

export type DistillSyncPacket = {
  type: 'distill.sync.packet';
  schemaVersion: typeof SYNC_PACKET_SCHEMA_VERSION;
  sourceDeviceId: string;
  createdAt: string;
  since?: string;
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

function createBlockRecord(block: ThoughtBlock): SyncRecord {
  const value = cloneBlock(block);

  return {
    kind: 'thought-block',
    id: block.id,
    updatedAt: block.updatedAt,
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

export function buildSyncPacket(store: DistillStore, options: BuildSyncPacketOptions): DistillSyncPacket {
  const since = options.since;
  const records = store.blocks
    .filter((block) => !since || block.updatedAt > since)
    .map(createBlockRecord)
    .sort(compareRecordOrder);

  return {
    type: 'distill.sync.packet',
    schemaVersion: SYNC_PACKET_SCHEMA_VERSION,
    sourceDeviceId: options.sourceDeviceId,
    createdAt: options.now ?? new Date().toISOString(),
    since,
    records,
  };
}

function isSyncRecord(value: unknown): value is SyncRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as SyncRecord;
  const block = record.value;

  return (
    record.kind === 'thought-block' &&
    typeof record.id === 'string' &&
    typeof record.updatedAt === 'string' &&
    typeof record.hash === 'string' &&
    !!block &&
    typeof block === 'object' &&
    record.id === block.id &&
    record.updatedAt === block.updatedAt &&
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

export function parseSyncPacket(json: string): DistillSyncPacket {
  const parsed = JSON.parse(json) as DistillSyncPacket;

  if (
    !parsed ||
    typeof parsed !== 'object' ||
    parsed.type !== 'distill.sync.packet' ||
    parsed.schemaVersion !== SYNC_PACKET_SCHEMA_VERSION ||
    typeof parsed.sourceDeviceId !== 'string' ||
    typeof parsed.createdAt !== 'string' ||
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
    record.kind === 'thought-block' &&
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
    createdAt: plainPacket.createdAt,
    since: plainPacket.since,
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
    createdAt: packet.createdAt,
    since: packet.since,
    records: records.sort(compareRecordOrder),
  };
}

function shouldAcceptIncoming(localBlock: ThoughtBlock | undefined, incoming: SyncRecord) {
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

export function applySyncPacket(store: DistillStore, packet: DistillSyncPacket): DistillStore {
  const blocksById = new Map(store.blocks.map((block) => [block.id, cloneBlock(block)]));

  for (const record of packet.records) {
    if (shouldAcceptIncoming(blocksById.get(record.id), record)) {
      blocksById.set(record.id, cloneBlock(record.value));
    }
  }

  return {
    ...store,
    blocks: Array.from(blocksById.values()).sort(compareBlockOrder),
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
