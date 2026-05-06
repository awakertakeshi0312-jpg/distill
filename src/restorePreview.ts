import type { DistillStore, Project, ThoughtBlock } from './model';

export type RestorePreviewKind = 'json' | 'encrypted-vault' | 'sync-recovery';

export type RestoreDiff = {
  addedBlocks: number;
  updatedBlocks: number;
  removedBlocks: number;
  unchangedBlocks: number;
  addedProjects: number;
  updatedProjects: number;
  removedProjects: number;
  unchangedProjects: number;
  tombstones: number;
  devices: number;
};

export type RestorePreview = {
  kind: RestorePreviewKind;
  store: DistillStore;
  diff: RestoreDiff;
};

function blockSignature(block: ThoughtBlock) {
  return JSON.stringify({
    id: block.id,
    content: block.content,
    noteId: block.noteId,
    projectId: block.projectId ?? null,
    capturedAt: block.capturedAt,
    updatedAt: block.updatedAt,
    tags: block.tags,
    links: block.links,
    state: block.state,
  });
}

function projectSignature(project: Project) {
  return JSON.stringify({
    id: project.id,
    name: project.name,
    signal: project.signal,
    status: project.status,
  });
}

function countDiff<T extends { id: string }>(currentItems: T[], incomingItems: T[], signature: (item: T) => string) {
  const currentById = new Map(currentItems.map((item) => [item.id, item]));
  const incomingById = new Map(incomingItems.map((item) => [item.id, item]));
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let removed = 0;

  for (const incoming of incomingItems) {
    const current = currentById.get(incoming.id);

    if (!current) {
      added += 1;
    } else if (signature(current) === signature(incoming)) {
      unchanged += 1;
    } else {
      updated += 1;
    }
  }

  for (const current of currentItems) {
    if (!incomingById.has(current.id)) {
      removed += 1;
    }
  }

  return { added, updated, unchanged, removed };
}

export function buildRestorePreview(
  currentStore: DistillStore,
  incomingStore: DistillStore,
  kind: RestorePreviewKind,
): RestorePreview {
  const blockDiff = countDiff(currentStore.blocks, incomingStore.blocks, blockSignature);
  const projectDiff = countDiff(currentStore.projects, incomingStore.projects, projectSignature);

  return {
    kind,
    store: incomingStore,
    diff: {
      addedBlocks: blockDiff.added,
      updatedBlocks: blockDiff.updated,
      removedBlocks: blockDiff.removed,
      unchangedBlocks: blockDiff.unchanged,
      addedProjects: projectDiff.added,
      updatedProjects: projectDiff.updated,
      removedProjects: projectDiff.removed,
      unchangedProjects: projectDiff.unchanged,
      tombstones: incomingStore.sync?.tombstones.length ?? 0,
      devices: incomingStore.sync?.devices.length ?? 0,
    },
  };
}
