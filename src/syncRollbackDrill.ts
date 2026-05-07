import { exportStoreAsJson } from './export';
import { parseDistillImport } from './import';
import { normalizeDistillStore, type DistillStore } from './model';
import { buildRestorePreview } from './restorePreview';
import { applySyncPacket, type DistillSyncPacket } from './sync';
import { buildSyncPreview } from './syncPreview';

export type SyncRollbackDrillResult = {
  sourceDeviceId: string;
  records: number;
  beforeBlocks: number;
  afterApplyBlocks: number;
  afterRollbackBlocks: number;
  addedBlocksAfterApply: number;
  updatedBlocksAfterApply: number;
  deletedBlocksAfterApply: number;
  destructiveChangesAfterApply: number;
  rollbackAddedBlocks: number;
  rollbackUpdatedBlocks: number;
  rollbackRemovedBlocks: number;
  rollbackUnchangedBlocks: number;
  tombstonesAfterRollback: number;
  devicesAfterRollback: number;
};

function sortById<T extends { id: string }>(items: T[]) {
  return [...items].sort((a, b) => a.id.localeCompare(b.id));
}

function canonicalStore(store: DistillStore) {
  const normalized = normalizeDistillStore(store);
  const sync = normalized.sync;

  return JSON.stringify({
    projects: sortById(normalized.projects),
    blocks: sortById(normalized.blocks),
    sync: {
      tombstones: sortById(sync?.tombstones ?? []),
      devices: sortById(sync?.devices ?? []),
      revokedDevices: sortById(sync?.revokedDevices ?? []),
      syncKey: sync?.syncKey ?? null,
    },
  });
}

export function runSyncRollbackDrill(store: DistillStore, packet: DistillSyncPacket): SyncRollbackDrillResult {
  const activeStoreBefore = canonicalStore(store);
  const snapshotStore = parseDistillImport(exportStoreAsJson(store));
  const snapshotBeforeApply = canonicalStore(snapshotStore);

  if (activeStoreBefore !== snapshotBeforeApply) {
    throw new Error('Sync rollback drill failed because the pre-sync snapshot does not match the active vault.');
  }

  const applyPreview = buildSyncPreview(snapshotStore, packet);
  const appliedStore = applySyncPacket(snapshotStore, packet);
  const rollbackPreview = buildRestorePreview(appliedStore, snapshotStore, 'sync-recovery');

  if (canonicalStore(rollbackPreview.store) !== snapshotBeforeApply) {
    throw new Error('Sync rollback drill failed because the rollback preview does not restore the pre-sync snapshot.');
  }

  if (canonicalStore(store) !== activeStoreBefore) {
    throw new Error('Sync rollback drill failed because the active vault changed during the dry run.');
  }

  return {
    sourceDeviceId: packet.sourceDeviceId,
    records: packet.records.length,
    beforeBlocks: snapshotStore.blocks.length,
    afterApplyBlocks: appliedStore.blocks.length,
    afterRollbackBlocks: rollbackPreview.store.blocks.length,
    addedBlocksAfterApply: applyPreview.diff.addedBlocks,
    updatedBlocksAfterApply: applyPreview.diff.updatedBlocks,
    deletedBlocksAfterApply: applyPreview.diff.deletedBlocks,
    destructiveChangesAfterApply: applyPreview.diff.destructiveChanges,
    rollbackAddedBlocks: rollbackPreview.diff.addedBlocks,
    rollbackUpdatedBlocks: rollbackPreview.diff.updatedBlocks,
    rollbackRemovedBlocks: rollbackPreview.diff.removedBlocks,
    rollbackUnchangedBlocks: rollbackPreview.diff.unchangedBlocks,
    tombstonesAfterRollback: rollbackPreview.store.sync?.tombstones.length ?? 0,
    devicesAfterRollback: rollbackPreview.store.sync?.devices.length ?? 0,
  };
}
