import { createBlock, DistillStore, ThoughtBlock } from './model';

export type StoreUpdater = (current: DistillStore) => DistillStore;

export function addCapture(content: string): StoreUpdater {
  return (current) => ({
    ...current,
    blocks: [createBlock(content), ...current.blocks],
  });
}

export function toggleProcessed(blockId: string): StoreUpdater {
  return (current) => ({
    ...current,
    blocks: current.blocks.map((block) =>
      block.id === blockId
        ? {
            ...block,
            state: block.state === 'processed' ? 'open' : 'processed',
            updatedAt: new Date().toISOString(),
          }
        : block,
    ),
  });
}

export function assignProject(blockId: string, projectId: string): StoreUpdater {
  return (current) => ({
    ...current,
    blocks: current.blocks.map((block) =>
      block.id === blockId
        ? {
            ...block,
            projectId: projectId || undefined,
            state: projectId ? 'linked' : block.state,
            updatedAt: new Date().toISOString(),
          }
        : block,
    ),
  });
}

export function getBlock(store: DistillStore, blockId?: string): ThoughtBlock | undefined {
  return store.blocks.find((block) => block.id === blockId) ?? store.blocks[0];
}

