export type BlockState = 'open' | 'linked' | 'processed' | 'archived';

export type ThoughtBlock = {
  id: string;
  content: string;
  noteId: string;
  projectId?: string;
  capturedAt: string;
  updatedAt: string;
  tags: string[];
  links: string[];
  state: BlockState;
};

export type Project = {
  id: string;
  name: string;
  signal: string;
  status: 'Active' | 'Design' | 'Next';
};

export type DeletionTombstone = {
  kind: 'thought-block';
  id: string;
  deletedAt: string;
  deletedByDeviceId?: string;
};

export type SyncDevice = {
  id: string;
  name: string;
  firstSeenAt: string;
  lastSeenAt: string;
  lastPacketAt?: string;
  lastPacketHash?: string;
};

export type RevokedSyncDevice = {
  id: string;
  name: string;
  revokedAt: string;
  lastPacketHash?: string;
};

export type SyncMetadata = {
  tombstones: DeletionTombstone[];
  devices: SyncDevice[];
  revokedDevices: RevokedSyncDevice[];
};

export type SearchResult = {
  block: ThoughtBlock;
  score: number;
  reason: string;
  matchedFields: string[];
  matchedTerms: string[];
};

export type DistillStore = {
  blocks: ThoughtBlock[];
  projects: Project[];
  sync?: SyncMetadata;
};

export const projectsSeed: Project[] = [
  {
    id: 'project-distill-mvp',
    name: 'Distill MVP',
    signal: 'Inbox, Today, Search, Backlinks',
    status: 'Active',
  },
  {
    id: 'project-local-graph',
    name: 'Local Graph Model',
    signal: 'Blocks, links, entities, exports',
    status: 'Design',
  },
  {
    id: 'project-semantic-retrieval',
    name: 'Semantic Retrieval',
    signal: 'FTS, embeddings, reason strings',
    status: 'Next',
  },
];

const now = new Date().toISOString();

export const blocksSeed: ThoughtBlock[] = [
  {
    id: 'b-104',
    content: 'Search should explain why an old thought resurfaced, not only show a score.',
    noteId: 'daily-2026-05-05',
    projectId: 'project-semantic-retrieval',
    capturedAt: now,
    updatedAt: now,
    tags: ['search', 'trust'],
    links: ['Semantic Retrieval', 'Trust Layer'],
    state: 'open',
  },
  {
    id: 'b-093',
    content: 'A daily note is less a journal and more the operating room for context.',
    noteId: 'daily-2026-05-04',
    projectId: 'project-distill-mvp',
    capturedAt: '2026-05-04T08:12:00.000Z',
    updatedAt: '2026-05-04T08:12:00.000Z',
    tags: ['daily-note', 'context'],
    links: ['Daily Notes', 'Project View'],
    state: 'linked',
  },
  {
    id: 'b-088',
    content: 'Blocks need stable IDs even when the user edits titles, notes, and links.',
    noteId: 'architecture',
    projectId: 'project-local-graph',
    capturedAt: '2026-05-03T13:35:00.000Z',
    updatedAt: '2026-05-03T13:35:00.000Z',
    tags: ['blocks', 'local-first'],
    links: ['Block Model', 'Export'],
    state: 'processed',
  },
];

export const initialStore: DistillStore = {
  blocks: blocksSeed,
  projects: projectsSeed,
  sync: {
    tombstones: [],
    devices: [],
    revokedDevices: [],
  },
};

export function createEmptySyncMetadata(): SyncMetadata {
  return {
    tombstones: [],
    devices: [],
    revokedDevices: [],
  };
}

export function normalizeSyncMetadata(sync?: Partial<SyncMetadata> | null): SyncMetadata {
  const tombstones = Array.isArray(sync?.tombstones)
    ? sync.tombstones.filter(
        (item): item is DeletionTombstone =>
          item?.kind === 'thought-block' &&
          typeof item.id === 'string' &&
          typeof item.deletedAt === 'string' &&
          (typeof item.deletedByDeviceId === 'undefined' || typeof item.deletedByDeviceId === 'string'),
      )
    : [];
  const devices = Array.isArray(sync?.devices)
    ? sync.devices.filter(
        (item): item is SyncDevice =>
          typeof item?.id === 'string' &&
          typeof item.name === 'string' &&
          typeof item.firstSeenAt === 'string' &&
          typeof item.lastSeenAt === 'string' &&
          (typeof item.lastPacketAt === 'undefined' || typeof item.lastPacketAt === 'string') &&
          (typeof item.lastPacketHash === 'undefined' || typeof item.lastPacketHash === 'string'),
      )
    : [];
  const revokedDevices = Array.isArray(sync?.revokedDevices)
    ? sync.revokedDevices.filter(
        (item): item is RevokedSyncDevice =>
          typeof item?.id === 'string' &&
          typeof item.name === 'string' &&
          typeof item.revokedAt === 'string' &&
          (typeof item.lastPacketHash === 'undefined' || typeof item.lastPacketHash === 'string'),
      )
    : [];
  const tombstonesById = new Map<string, DeletionTombstone>();
  const devicesById = new Map<string, SyncDevice>();
  const revokedDevicesById = new Map<string, RevokedSyncDevice>();

  for (const tombstone of tombstones) {
    const current = tombstonesById.get(tombstone.id);
    if (!current || tombstone.deletedAt > current.deletedAt) {
      tombstonesById.set(tombstone.id, tombstone);
    }
  }

  for (const device of devices) {
    const current = devicesById.get(device.id);
    if (!current || device.lastSeenAt > current.lastSeenAt) {
      devicesById.set(device.id, {
        ...device,
        firstSeenAt: current && current.firstSeenAt < device.firstSeenAt ? current.firstSeenAt : device.firstSeenAt,
      });
    }
  }

  for (const device of revokedDevices) {
    const current = revokedDevicesById.get(device.id);
    if (!current || device.revokedAt > current.revokedAt) {
      revokedDevicesById.set(device.id, device);
    }
  }

  for (const deviceId of revokedDevicesById.keys()) {
    devicesById.delete(deviceId);
  }

  return {
    tombstones: Array.from(tombstonesById.values()).sort(
      (a, b) => b.deletedAt.localeCompare(a.deletedAt) || a.id.localeCompare(b.id),
    ),
    devices: Array.from(devicesById.values()).sort(
      (a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    ),
    revokedDevices: Array.from(revokedDevicesById.values()).sort(
      (a, b) => b.revokedAt.localeCompare(a.revokedAt) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id),
    ),
  };
}

export function normalizeDistillStore(store: DistillStore): DistillStore {
  return {
    ...store,
    sync: normalizeSyncMetadata(store.sync),
  };
}

export function extractBlockSignals(content: string) {
  return {
    tags: Array.from(content.matchAll(/#([\p{L}\p{N}_-]+)/gu)).map((match) => match[1]),
    links: Array.from(content.matchAll(/\[\[([^\]]+)\]\]/g)).map((match) => match[1]),
  };
}

export function createBlock(content: string): ThoughtBlock {
  const timestamp = new Date().toISOString();
  const { tags, links } = extractBlockSignals(content);

  return {
    id: crypto.randomUUID(),
    content: content.trim(),
    noteId: `daily-${timestamp.slice(0, 10)}`,
    capturedAt: timestamp,
    updatedAt: timestamp,
    tags,
    links,
    state: 'open',
  };
}

export function formatBlockMeta(block: ThoughtBlock, projects: Project[], locale: 'en' | 'ja' = 'en') {
  const project = projects.find((item) => item.id === block.projectId);
  const date = new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(block.capturedAt));

  return [date, project?.name ?? (locale === 'ja' ? 'インボックス' : 'Inbox')].join(' - ');
}

export function normalizeSearchTerms(query: string) {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.replace(/[^\p{L}\p{N}_-]/gu, '').trim())
    .filter(Boolean);
}

const semanticAliases: Record<string, string[]> = {
  remember: ['resurfaced', 'recall', 'revisit', 'memory'],
  remembering: ['resurfaced', 'recall', 'revisit', 'memory'],
  trust: ['explain', 'reason', 'evidence', 'confidence'],
  reliable: ['trust', 'evidence', 'confidence'],
  context: ['daily', 'note', 'project', 'meeting'],
  ownership: ['local', 'export', 'portable', 'backup'],
  backup: ['export', 'restore', 'portable', 'json'],
  meaning: ['semantic', 'retrieval', 'context'],
  semantic: ['meaning', 'retrieval', 'context'],
  retrieval: ['search', 'semantic', 'resurfaced'],
  思い出す: ['検索', '意味', '再発見'],
  信頼: ['説明', '理由', '根拠'],
  文脈: ['日次', 'ノート', 'プロジェクト'],
};

function expandSearchTerms(terms: string[]) {
  return Array.from(new Set(terms.flatMap((term) => [term, ...(semanticAliases[term] ?? [])])));
}

function semanticProfile(block: ThoughtBlock) {
  return normalizeSearchTerms([block.content, ...block.tags, ...block.links].join(' '));
}

export function analyzeSearchMatch(block: ThoughtBlock, terms: string[]) {
  const content = block.content.toLowerCase();
  const tags = block.tags.map((tag) => tag.toLowerCase());
  const links = block.links.map((link) => link.toLowerCase());

  const matchedFields = [
    terms.some((term) => content.includes(term)) ? 'content' : null,
    terms.some((term) => tags.some((tag) => tag.includes(term))) ? 'tags' : null,
    terms.some((term) => links.some((link) => link.includes(term))) ? 'links' : null,
  ].filter((field): field is string => field !== null);

  const matchedTerms = terms.filter(
    (term) =>
      content.includes(term) ||
      tags.some((tag) => tag.includes(term)) ||
      links.some((link) => link.includes(term)),
  );

  return {
    matchedFields,
    matchedTerms: Array.from(new Set(matchedTerms)),
  };
}

export function searchBlocks(blocks: ThoughtBlock[], query: string): SearchResult[] {
  const terms = normalizeSearchTerms(query);

  if (terms.length === 0) {
    return blocks.slice(0, 5).map((block) => ({
      block,
      score: 1,
      reason: 'Recent capture',
      matchedFields: [],
      matchedTerms: [],
    }));
  }

  const expandedTerms = expandSearchTerms(terms);

  return blocks
    .map((block) => {
      const { matchedFields, matchedTerms } = analyzeSearchMatch(block, terms);
      const exactHits = matchedFields.includes('content') ? matchedTerms.length : 0;
      const tagHits = matchedFields.includes('tags') ? matchedTerms.length : 0;
      const linkHits = matchedFields.includes('links') ? matchedTerms.length : 0;
      const profile = semanticProfile(block);
      const semanticTerms = expandedTerms.filter((term) => profile.some((profileTerm) => profileTerm.includes(term)));
      const semanticHits = semanticTerms.filter((term) => !matchedTerms.includes(term));
      const score = exactHits * 3 + tagHits * 2 + linkHits * 2 + semanticHits.length;

      if (score === 0) {
        return null;
      }

      const reason = [
        exactHits > 0 ? 'Text match' : null,
        tagHits > 0 ? 'Tag match' : null,
        linkHits > 0 ? 'Linked context' : null,
        semanticHits.length > 0 ? 'Semantic overlap' : null,
      ]
        .filter(Boolean)
        .join(' - ');

      return {
        block,
        score,
        reason,
        matchedFields: semanticHits.length > 0 ? Array.from(new Set([...matchedFields, 'semantic'])) : matchedFields,
        matchedTerms: Array.from(new Set([...matchedTerms, ...semanticTerms])),
      };
    })
    .filter((result): result is SearchResult => result !== null)
    .sort((a, b) => b.score - a.score);
}
