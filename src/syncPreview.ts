import { normalizeSyncMetadata, type DeletionTombstone, type DistillStore } from './model';
import {
  isKnownSyncDevice,
  isSyncPacketReplay,
  stableHash,
  type DistillSyncPacket,
  type ThoughtBlockDeletionSyncRecord,
  type ThoughtBlockSyncRecord,
} from './sync';

export type SyncPreviewDiff = {
  incomingBlocks: number;
  incomingDeletions: number;
  incomingDevices: number;
  incomingRevokedDevices: number;
  addedBlocks: number;
  updatedBlocks: number;
  skippedBlocks: number;
  deletedBlocks: number;
  skippedDeletions: number;
  remoteWins: number;
  localWins: number;
  timestampTies: number;
  destructiveChanges: number;
  sourceDeviceKnown: boolean;
  replay: boolean;
};

export type SyncPreview = {
  packet: DistillSyncPacket;
  diff: SyncPreviewDiff;
};

function acceptsIncomingBlock(
  localBlock: DistillStore['blocks'][number] | undefined,
  incoming: ThoughtBlockSyncRecord,
) {
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

function acceptsIncomingTombstone(
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

export function buildSyncPreview(store: DistillStore, packet: DistillSyncPacket): SyncPreview {
  const replay = isSyncPacketReplay(store, packet);
  const diff: SyncPreviewDiff = {
    incomingBlocks: packet.records.filter((record) => record.kind === 'thought-block').length,
    incomingDeletions: packet.records.filter((record) => record.kind === 'thought-block-deletion').length,
    incomingDevices: packet.devices?.length ?? 0,
    incomingRevokedDevices: packet.revokedDevices?.length ?? 0,
    addedBlocks: 0,
    updatedBlocks: 0,
    skippedBlocks: 0,
    deletedBlocks: 0,
    skippedDeletions: 0,
    remoteWins: 0,
    localWins: 0,
    timestampTies: 0,
    destructiveChanges: 0,
    sourceDeviceKnown: isKnownSyncDevice(store, packet.sourceDeviceId),
    replay,
  };

  if (replay) {
    diff.skippedBlocks = diff.incomingBlocks;
    diff.skippedDeletions = diff.incomingDeletions;
    return { packet, diff };
  }

  const blocksById = new Map(store.blocks.map((block) => [block.id, block]));
  const sync = normalizeSyncMetadata(store.sync);
  const tombstonesById = new Map(sync.tombstones.map((tombstone) => [tombstone.id, tombstone]));

  for (const record of packet.records) {
    if (record.kind === 'thought-block-deletion') {
      if (!acceptsIncomingTombstone(tombstonesById.get(record.id), record)) {
        diff.skippedDeletions += 1;
        diff.localWins += 1;
        continue;
      }

      tombstonesById.set(record.id, record.value);

      const localBlock = blocksById.get(record.id);
      if (!localBlock || record.value.deletedAt >= localBlock.updatedAt) {
        if (localBlock) {
          if (record.value.deletedAt === localBlock.updatedAt) {
            diff.timestampTies += 1;
          }
          diff.deletedBlocks += 1;
          diff.remoteWins += 1;
          diff.destructiveChanges += 1;
        } else {
          diff.skippedDeletions += 1;
        }
        blocksById.delete(record.id);
      } else {
        diff.skippedDeletions += 1;
        diff.localWins += 1;
      }

      continue;
    }

    const tombstone = tombstonesById.get(record.id);

    if (tombstone && !blockBeatsTombstone(record, tombstone)) {
      diff.skippedBlocks += 1;
      diff.localWins += 1;
      if (record.updatedAt === tombstone.deletedAt) {
        diff.timestampTies += 1;
      }
      continue;
    }

    const localBlock = blocksById.get(record.id);

    if (!acceptsIncomingBlock(localBlock, record)) {
      diff.skippedBlocks += 1;
      diff.localWins += 1;
      if (localBlock && record.updatedAt === localBlock.updatedAt) {
        diff.timestampTies += 1;
      }
      continue;
    }

    if (localBlock) {
      diff.updatedBlocks += 1;
      if (record.hash !== stableHash(localBlock)) {
        diff.remoteWins += 1;
        diff.destructiveChanges += 1;
      }
      if (record.updatedAt === localBlock.updatedAt) {
        diff.timestampTies += 1;
      }
    } else {
      diff.addedBlocks += 1;
    }

    blocksById.set(record.id, record.value);
  }

  return { packet, diff };
}
