import type { DistillStore, ThoughtBlock } from './model';

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

type BuildSyncPacketOptions = {
  sourceDeviceId: string;
  since?: string;
  now?: string;
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
