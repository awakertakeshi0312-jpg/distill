import { createBlock, DistillStore, extractBlockSignals, normalizeSyncMetadata, Project, ThoughtBlock } from './model';

export type StoreUpdater = (current: DistillStore) => DistillStore;

export type RelatedBlock = {
  block: ThoughtBlock;
  reason: 'shared-link' | 'shared-tag' | 'mentions-linked-concept';
};

export type PersonMention = {
  name: string;
  blockIds: string[];
};

export type CreateProjectInput = {
  name: string;
  signal: string;
  status: Project['status'];
};

export function addCapture(content: string): StoreUpdater {
  return (current) => ({
    ...current,
    blocks: [createBlock(content), ...current.blocks],
  });
}

export function createProject(input: CreateProjectInput): StoreUpdater {
  return (current) => ({
    ...current,
    projects: [
      ...current.projects,
      {
        id: crypto.randomUUID(),
        name: input.name.trim(),
        signal: input.signal.trim() || 'New knowledge area',
        status: input.status,
      },
    ],
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

export function archiveBlock(blockId: string): StoreUpdater {
  return (current) => ({
    ...current,
    blocks: current.blocks.map((block) =>
      block.id === blockId
        ? {
            ...block,
            state: 'archived',
            updatedAt: new Date().toISOString(),
          }
        : block,
    ),
  });
}

export function restoreBlock(blockId: string): StoreUpdater {
  return (current) => ({
    ...current,
    blocks: current.blocks.map((block) =>
      block.id === blockId
        ? {
            ...block,
            state: block.links.length > 0 ? 'linked' : 'open',
            updatedAt: new Date().toISOString(),
          }
        : block,
    ),
  });
}

export function permanentlyDeleteBlock(blockId: string, deletedByDeviceId?: string): StoreUpdater {
  return (current) => {
    const timestamp = new Date().toISOString();
    const sync = normalizeSyncMetadata(current.sync);

    return {
      ...current,
      blocks: current.blocks.filter((block) => block.id !== blockId),
      sync: normalizeSyncMetadata({
        ...sync,
        tombstones: [
          ...sync.tombstones,
          {
            kind: 'thought-block',
            id: blockId,
            deletedAt: timestamp,
            deletedByDeviceId,
          },
        ],
      }),
    };
  };
}

export function assignProject(blockId: string, projectId: string): StoreUpdater {
  return (current) => ({
    ...current,
    blocks: current.blocks.map((block) =>
      block.id === blockId
        ? {
            ...block,
            projectId: projectId || undefined,
            state: projectId && block.state === 'open' ? 'linked' : block.state,
            updatedAt: new Date().toISOString(),
          }
        : block,
    ),
  });
}

export function updateBlockContent(blockId: string, content: string): StoreUpdater {
  const trimmedContent = content.trim();
  const { tags, links } = extractBlockSignals(trimmedContent);

  return (current) => ({
    ...current,
    blocks: current.blocks.map((block) =>
      block.id === blockId
        ? {
            ...block,
            content: trimmedContent,
            tags,
            links,
            state: block.state === 'open' && links.length > 0 ? 'linked' : block.state,
            updatedAt: new Date().toISOString(),
          }
        : block,
    ),
  });
}

export function getBlock(store: DistillStore, blockId?: string): ThoughtBlock | undefined {
  return store.blocks.find((block) => block.id === blockId) ?? store.blocks[0];
}

export function extractPeople(block: ThoughtBlock): string[] {
  const contentMentions = Array.from(block.content.matchAll(/@([\p{L}\p{N}_-]+)/gu)).map((match) => match[1]);
  const linkMentions = block.links
    .map((link) => {
      const personPrefix = link.match(/^person:\s*(.+)$/i);
      const peoplePath = link.match(/^people\/(.+)$/i);
      return personPrefix?.[1] ?? peoplePath?.[1] ?? null;
    })
    .filter((person): person is string => person !== null);

  return Array.from(new Set([...contentMentions, ...linkMentions].map((person) => person.trim()).filter(Boolean)));
}

export function getPeopleIndex(store: DistillStore): PersonMention[] {
  const people = new Map<string, Set<string>>();

  for (const block of store.blocks) {
    if (block.state === 'archived') {
      continue;
    }

    for (const person of extractPeople(block)) {
      const current = people.get(person) ?? new Set<string>();
      current.add(block.id);
      people.set(person, current);
    }
  }

  return Array.from(people.entries())
    .map(([name, blockIds]) => ({
      name,
      blockIds: Array.from(blockIds),
    }))
    .sort((a, b) => b.blockIds.length - a.blockIds.length || a.name.localeCompare(b.name));
}

export function getRelatedBlocks(store: DistillStore, blockId?: string): RelatedBlock[] {
  const selectedBlock = getBlock(store, blockId);

  if (!selectedBlock) {
    return [];
  }

  const selectedLinks = new Set(selectedBlock.links.map((link) => link.toLowerCase()));
  const selectedTags = new Set(selectedBlock.tags.map((tag) => tag.toLowerCase()));

  return store.blocks
    .filter((block) => block.id !== selectedBlock.id)
    .map((block) => {
      const blockLinks = block.links.map((link) => link.toLowerCase());
      const blockTags = block.tags.map((tag) => tag.toLowerCase());
      const content = block.content.toLowerCase();

      if (blockLinks.some((link) => selectedLinks.has(link))) {
        return { block, reason: 'shared-link' as const };
      }

      if (blockTags.some((tag) => selectedTags.has(tag))) {
        return { block, reason: 'shared-tag' as const };
      }

      if ([...selectedLinks].some((link) => content.includes(link))) {
        return { block, reason: 'mentions-linked-concept' as const };
      }

      return null;
    })
    .filter((result): result is RelatedBlock => result !== null)
    .slice(0, 5);
}
