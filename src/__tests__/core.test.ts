import { describe, expect, it } from 'vitest';
import type { DistillStore, ThoughtBlock } from '../model';
import { extractBlockSignals, searchBlocks } from '../model';
import {
  assignProject,
  extractPeople,
  getPeopleIndex,
  getRelatedBlocks,
  permanentlyDeleteBlock,
  restoreBlock,
  updateBlockContent,
} from '../repository';
import {
  getActiveBlocks,
  getArchivedBlocks,
  getDailyNotes,
  getFocusProjects,
  getOpenBlocks,
  getProjectCounts,
  getTodayBlocks,
  getTodayNoteId,
} from '../selectors';
import { buildKnowledgeGraph, filterKnowledgeGraph, getGraphNeighbors, layoutKnowledgeGraph } from '../graph';
import { exportStoreAsJson } from '../export';
import { createMarkdownImport, parseDistillImport } from '../import';
import { decryptDistillVault, encryptDistillVault } from '../vaultCrypto';
import { DEVICE_IDENTITY_KEY, getOrCreateDeviceIdentity, readDeviceIdentity, renameDeviceIdentity } from '../device';
import {
  applyEncryptedSyncPacket,
  applySyncPacket,
  buildEncryptedSyncPacket,
  buildSyncPacket,
  decryptEncryptedSyncPacket,
  parseEncryptedSyncPacket,
  parseSyncPacket,
  registerSyncDevice,
  serializeEncryptedSyncPacket,
  serializeSyncPacket,
} from '../sync';

const now = '2026-05-06T10:00:00.000Z';

function block(overrides: Partial<ThoughtBlock> & Pick<ThoughtBlock, 'id' | 'content'>): ThoughtBlock {
  return {
    noteId: 'daily-2026-05-06',
    capturedAt: now,
    updatedAt: now,
    tags: [],
    links: [],
    state: 'open',
    ...overrides,
  };
}

const store: DistillStore = {
  projects: [
    { id: 'p-active', name: 'Active Project', signal: 'Current work', status: 'Active' },
    { id: 'p-next', name: 'Next Project', signal: 'Later', status: 'Next' },
  ],
  blocks: [
    block({
      id: 'b-1',
      content: 'Discuss semantic trust with @Aki [[Person: Mina]] #search [[Semantic Retrieval]]',
      tags: ['search'],
      links: ['Person: Mina', 'Semantic Retrieval'],
      projectId: 'p-active',
      state: 'linked',
    }),
    block({
      id: 'b-2',
      content: 'Semantic Retrieval should explain resurfaced thoughts',
      tags: ['retrieval'],
      links: ['Semantic Retrieval'],
      noteId: 'daily-2026-05-05',
      state: 'processed',
    }),
    block({
      id: 'b-3',
      content: 'Archived private note mentioning @Aki',
      tags: ['private'],
      links: [],
      state: 'archived',
    }),
  ],
};

describe('model', () => {
  it('extracts unicode hashtags and wiki links from captures', () => {
    expect(extractBlockSignals('日本語 #検索 #AI-メモ [[意味検索]] [[People/Mina]]')).toEqual({
      tags: ['検索', 'AI-メモ'],
      links: ['意味検索', 'People/Mina'],
    });
  });

  it('returns search evidence for matching fields and terms', () => {
    const results = searchBlocks(store.blocks, 'semantic search');

    expect(results[0].block.id).toBe('b-1');
    expect(results[0].matchedFields).toEqual(expect.arrayContaining(['content', 'tags', 'links']));
    expect(results[0].matchedTerms).toEqual(expect.arrayContaining(['semantic', 'search']));
  });

  it('uses local semantic overlap when exact words differ', () => {
    const results = searchBlocks(store.blocks, 'remembering');

    expect(results[0].block.id).toBe('b-2');
    expect(results[0].reason).toContain('Semantic overlap');
    expect(results[0].matchedFields).toContain('semantic');
    expect(results[0].matchedTerms).toContain('resurfaced');
  });
});

describe('repository', () => {
  it('updates content and refreshes tags, links, and linked state', () => {
    const next = updateBlockContent('b-2', 'Updated #trust [[Trust Layer]]')(store);
    const updated = next.blocks.find((item) => item.id === 'b-2');

    expect(updated?.content).toBe('Updated #trust [[Trust Layer]]');
    expect(updated?.tags).toEqual(['trust']);
    expect(updated?.links).toEqual(['Trust Layer']);
    expect(updated?.state).toBe('processed');
  });

  it('assigns a project without unprocessing completed blocks', () => {
    const next = assignProject('b-2', 'p-active')(store);
    const assigned = next.blocks.find((item) => item.id === 'b-2');

    expect(assigned?.projectId).toBe('p-active');
    expect(assigned?.state).toBe('processed');
  });

  it('restores archived blocks to linked only when they have links', () => {
    const archivedWithLink = {
      ...store,
      blocks: [block({ id: 'archived', content: 'Archived [[Link]]', links: ['Link'], state: 'archived' })],
    } satisfies DistillStore;
    const restored = restoreBlock('archived')(archivedWithLink).blocks[0];

    expect(restored.state).toBe('linked');
  });

  it('permanently deletes blocks by writing a sync tombstone', () => {
    const next = permanentlyDeleteBlock('b-3', 'windows-dev')(store);

    expect(next.blocks.find((item) => item.id === 'b-3')).toBeUndefined();
    expect(next.sync?.tombstones[0]).toMatchObject({
      kind: 'thought-block',
      id: 'b-3',
      deletedByDeviceId: 'windows-dev',
    });
  });

  it('extracts and indexes people while excluding archived blocks', () => {
    expect(extractPeople(store.blocks[0])).toEqual(['Aki', 'Mina']);

    const people = getPeopleIndex(store);
    expect(people.map((person) => person.name)).toEqual(['Aki', 'Mina']);
    expect(people.find((person) => person.name === 'Aki')?.blockIds).toEqual(['b-1']);
  });

  it('finds related blocks by shared links before other reasons', () => {
    const related = getRelatedBlocks(store, 'b-1');

    expect(related[0]).toMatchObject({ block: { id: 'b-2' }, reason: 'shared-link' });
  });
});

describe('selectors', () => {
  it('separates active, archived, and open blocks', () => {
    const active = getActiveBlocks(store);

    expect(active.map((item) => item.id)).toEqual(['b-1', 'b-2']);
    expect(getArchivedBlocks(store).map((item) => item.id)).toEqual(['b-3']);
    expect(getOpenBlocks(active).map((item) => item.id)).toEqual(['b-1']);
  });

  it('groups daily notes and counts project focus', () => {
    const active = getActiveBlocks(store);
    const projectCounts = getProjectCounts(store, active);

    expect(getTodayNoteId(new Date('2026-05-06T23:00:00.000Z'))).toBe('daily-2026-05-06');
    expect(getTodayBlocks(active, 'daily-2026-05-06').map((item) => item.id)).toEqual(['b-1']);
    expect(getDailyNotes(active).map((note) => note.noteId)).toEqual(['daily-2026-05-06', 'daily-2026-05-05']);
    expect(projectCounts.find((project) => project.id === 'p-active')?.blocks).toBe(1);
    expect(getFocusProjects(projectCounts).map((project) => project.id)).toEqual(['p-active']);
  });
});

describe('graph', () => {
  it('lays out a persisted graph snapshot', () => {
    const graph = layoutKnowledgeGraph({
      nodes: [
        { id: 'b-1', label: 'Block', kind: 'block', blockId: 'b-1' },
        { id: 'person:Aki', label: '@Aki', kind: 'person', blockId: 'b-1' },
      ],
      edges: [{ source: 'b-1', target: 'person:Aki', edgeType: 'person' }],
    });

    expect(graph.positionedNodes).toHaveLength(2);
    expect(graph.positionById.get('person:Aki')).toMatchObject({ id: 'person:Aki', kind: 'person' });
    expect(graph.edges[0]).toEqual({ source: 'b-1', target: 'person:Aki', edgeType: 'person' });
  });

  it('returns graph neighbors for selected nodes', () => {
    const graph = layoutKnowledgeGraph({
      nodes: [
        { id: 'b-1', label: 'Block', kind: 'block', blockId: 'b-1' },
        { id: 'person:Aki', label: '@Aki', kind: 'person', blockId: 'b-1' },
        { id: 'concept:Search', label: 'Search', kind: 'concept' },
      ],
      edges: [
        { source: 'b-1', target: 'person:Aki', edgeType: 'person' },
        { source: 'b-1', target: 'concept:Search', edgeType: 'concept' },
      ],
    });

    expect(getGraphNeighbors(graph, 'b-1').map((neighbor) => neighbor.node.id).sort()).toEqual([
      'concept:Search',
      'person:Aki',
    ]);
    expect(getGraphNeighbors(graph, 'person:Aki')[0]).toMatchObject({
      node: { id: 'b-1' },
      direction: 'source',
    });
  });

  it('filters graph by edge type', () => {
    const graph = layoutKnowledgeGraph({
      nodes: [
        { id: 'b-1', label: 'Block', kind: 'block', blockId: 'b-1' },
        { id: 'person:Aki', label: '@Aki', kind: 'person', blockId: 'b-1' },
        { id: 'concept:Search', label: 'Search', kind: 'concept' },
      ],
      edges: [
        { source: 'b-1', target: 'person:Aki', edgeType: 'person' },
        { source: 'b-1', target: 'concept:Search', edgeType: 'concept' },
      ],
    });

    const filtered = filterKnowledgeGraph(graph, 'person');

    expect(filtered.edges).toEqual([{ source: 'b-1', target: 'person:Aki', edgeType: 'person' }]);
    expect(filtered.nodes.map((node) => node.id).sort()).toEqual(['b-1', 'person:Aki']);
  });

  it('builds block, project, person, and concept nodes with valid edges', () => {
    const active = getActiveBlocks(store);
    const people = getPeopleIndex(store);
    const projectCounts = getProjectCounts(store, active);
    const graph = buildKnowledgeGraph(active, projectCounts, people);

    expect(graph.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(['b-1', 'b-2', 'p-active', 'person:Aki', 'person:Mina', 'concept:Semantic Retrieval']),
    );
    expect(graph.edges).toEqual(expect.arrayContaining([{ source: 'b-1', target: 'p-active', edgeType: 'project' }]));
    expect(graph.edges).toEqual(expect.arrayContaining([{ source: 'b-1', target: 'person:Aki', edgeType: 'person' }]));
    expect(graph.edges).toEqual(expect.arrayContaining([{ source: 'b-2', target: 'concept:Semantic Retrieval', edgeType: 'concept' }]));
    expect(graph.positionById.get('b-1')).toMatchObject({ id: 'b-1', kind: 'block' });
  });
});

describe('portable imports', () => {
  it('restores a Distill JSON export into a store', () => {
    const parsed = parseDistillImport(exportStoreAsJson(store));

    expect(parsed.blocks.map((item) => item.id)).toEqual(['b-1', 'b-2', 'b-3']);
    expect(parsed.projects.map((item) => item.id)).toEqual(['p-active', 'p-next']);
  });

  it('rejects JSON that does not match the Distill schema', () => {
    expect(() => parseDistillImport(JSON.stringify({ blocks: [{ id: 'bad' }], projects: [] }))).toThrow(
      /blocks do not match/,
    );
  });

  it('turns Markdown bullets into imported blocks', () => {
    const imported = createMarkdownImport('# Research Notes\n\n- Follow up with @Aki #meeting [[Roadmap]]\n- Draft release notes');

    expect(imported.projects[0]).toMatchObject({ name: 'Research Notes', status: 'Active' });
    expect(imported.blocks).toHaveLength(2);
    expect(imported.blocks[0]).toMatchObject({
      content: 'Follow up with @Aki #meeting [[Roadmap]]',
      tags: ['meeting'],
      links: ['Roadmap'],
      state: 'linked',
    });
  });
});

describe('encrypted vault backups', () => {
  it('round-trips a Distill export without storing plaintext in the vault file', async () => {
    const exported = exportStoreAsJson(store);
    const encrypted = await encryptDistillVault(exported, 'correct horse battery staple', { iterations: 1_000 });

    expect(encrypted).toContain('distill.encrypted-vault');
    expect(encrypted).not.toContain('Discuss semantic trust');

    const decrypted = await decryptDistillVault(encrypted, 'correct horse battery staple');
    const parsed = parseDistillImport(decrypted);

    expect(parsed.blocks.map((item) => item.id)).toEqual(['b-1', 'b-2', 'b-3']);
  });

  it('rejects the wrong vault passphrase', async () => {
    const encrypted = await encryptDistillVault(exportStoreAsJson(store), 'correct horse battery staple', {
      iterations: 1_000,
    });

    await expect(decryptDistillVault(encrypted, 'incorrect horse battery')).rejects.toThrow();
  });
});

describe('sync packets', () => {
  it('builds a deterministic block sync packet since a checkpoint', () => {
    const syncStore: DistillStore = {
      projects: [],
      blocks: [
        block({
          id: 'old',
          content: 'Already synced',
          capturedAt: '2026-05-05T01:00:00.000Z',
          updatedAt: '2026-05-05T02:00:00.000Z',
        }),
        block({
          id: 'fresh',
          content: 'Needs sync #mobile [[Sync]]',
          capturedAt: '2026-05-06T01:00:00.000Z',
          updatedAt: '2026-05-06T02:00:00.000Z',
          tags: ['mobile'],
          links: ['Sync'],
        }),
      ],
    };

    const packet = buildSyncPacket(syncStore, {
      sourceDeviceId: 'windows-dev',
      since: '2026-05-06T00:00:00.000Z',
      now: '2026-05-06T03:00:00.000Z',
    });

    expect(packet).toMatchObject({
      type: 'distill.sync.packet',
      schemaVersion: 1,
      sourceDeviceId: 'windows-dev',
      createdAt: '2026-05-06T03:00:00.000Z',
      since: '2026-05-06T00:00:00.000Z',
    });
    expect(packet.records.map((record) => record.id)).toEqual(['fresh']);
    expect(packet.records[0].hash).toMatch(/^fnv1a32:/);
  });

  it('includes deletion tombstones and device registry records in sync packets', () => {
    const deletedStore = registerSyncDevice(
      {
        projects: [],
        blocks: [],
        sync: {
          tombstones: [
            {
              kind: 'thought-block',
              id: 'deleted-block',
              deletedAt: '2026-05-06T04:00:00.000Z',
              deletedByDeviceId: 'windows-dev',
            },
          ],
          devices: [],
        },
      },
      { id: 'windows-dev', name: 'Windows desk' },
      '2026-05-06T05:00:00.000Z',
    );

    const packet = buildSyncPacket(deletedStore, {
      sourceDeviceId: 'windows-dev',
      sourceDeviceName: 'Windows desk',
      now: '2026-05-06T06:00:00.000Z',
    });

    expect(packet.records).toHaveLength(1);
    expect(packet.records[0]).toMatchObject({
      kind: 'thought-block-deletion',
      id: 'deleted-block',
      updatedAt: '2026-05-06T04:00:00.000Z',
    });
    expect(packet.devices?.find((device) => device.id === 'windows-dev')).toMatchObject({
      name: 'Windows desk',
      lastPacketAt: '2026-05-06T06:00:00.000Z',
    });
  });

  it('applies newer incoming blocks while keeping newer local edits', () => {
    const localStore: DistillStore = {
      projects: [],
      blocks: [
        block({
          id: 'shared',
          content: 'Local older text',
          capturedAt: '2026-05-06T01:00:00.000Z',
          updatedAt: '2026-05-06T02:00:00.000Z',
        }),
        block({
          id: 'local-newer',
          content: 'Local newer text',
          capturedAt: '2026-05-06T01:30:00.000Z',
          updatedAt: '2026-05-06T05:00:00.000Z',
        }),
      ],
    };
    const remoteStore: DistillStore = {
      projects: [],
      blocks: [
        block({
          id: 'shared',
          content: 'Remote newer text',
          capturedAt: '2026-05-06T01:00:00.000Z',
          updatedAt: '2026-05-06T03:00:00.000Z',
        }),
        block({
          id: 'local-newer',
          content: 'Remote stale text',
          capturedAt: '2026-05-06T01:30:00.000Z',
          updatedAt: '2026-05-06T04:00:00.000Z',
        }),
        block({
          id: 'remote-only',
          content: 'Remote only text',
          capturedAt: '2026-05-06T02:00:00.000Z',
          updatedAt: '2026-05-06T02:30:00.000Z',
        }),
      ],
    };

    const merged = applySyncPacket(
      localStore,
      buildSyncPacket(remoteStore, { sourceDeviceId: 'mobile-dev', now: '2026-05-06T06:00:00.000Z' }),
    );

    expect(merged.blocks.find((item) => item.id === 'shared')?.content).toBe('Remote newer text');
    expect(merged.blocks.find((item) => item.id === 'local-newer')?.content).toBe('Local newer text');
    expect(merged.blocks.find((item) => item.id === 'remote-only')?.content).toBe('Remote only text');
  });

  it('applies tombstones and prevents stale block resurrection', () => {
    const tombstoneStore: DistillStore = {
      projects: [],
      blocks: [],
      sync: {
        tombstones: [
          {
            kind: 'thought-block',
            id: 'deleted-block',
            deletedAt: '2026-05-06T05:00:00.000Z',
            deletedByDeviceId: 'windows-dev',
          },
        ],
        devices: [],
      },
    };
    const staleStore: DistillStore = {
      projects: [],
      blocks: [
        block({
          id: 'deleted-block',
          content: 'Stale remote copy',
          capturedAt: '2026-05-06T01:00:00.000Z',
          updatedAt: '2026-05-06T04:00:00.000Z',
        }),
      ],
    };

    const stalePacket = buildSyncPacket(staleStore, {
      sourceDeviceId: 'mobile-dev',
      sourceDeviceName: 'Phone',
      now: '2026-05-06T06:00:00.000Z',
    });
    const tombstonePacket = buildSyncPacket(tombstoneStore, {
      sourceDeviceId: 'windows-dev',
      sourceDeviceName: 'Windows desk',
      now: '2026-05-06T07:00:00.000Z',
    });

    expect(applySyncPacket(tombstoneStore, stalePacket).blocks).toEqual([]);
    expect(applySyncPacket(staleStore, tombstonePacket).blocks).toEqual([]);
  });

  it('parses serialized sync packets and rejects unsupported files', () => {
    const packet = buildSyncPacket(store, { sourceDeviceId: 'windows-dev', now: '2026-05-06T03:00:00.000Z' });

    expect(parseSyncPacket(serializeSyncPacket(packet)).records.map((record) => record.id)).toEqual([
      'b-1',
      'b-2',
      'b-3',
    ]);
    expect(() => parseSyncPacket(JSON.stringify({ type: 'distill.sync.packet', schemaVersion: 999 }))).toThrow(
      /sync packet/,
    );
  });

  it('encrypts sync records without exposing plaintext note content', async () => {
    const packet = await buildEncryptedSyncPacket(store, {
      sourceDeviceId: 'windows-dev',
      now: '2026-05-06T03:00:00.000Z',
      passphrase: 'correct horse battery staple',
      iterations: 1_000,
    });
    const serialized = serializeEncryptedSyncPacket(packet);

    expect(serialized).toContain('distill.encrypted-sync.packet');
    expect(serialized).toContain('distill.encrypted-sync-record');
    expect(serialized).not.toContain('Discuss semantic trust');
    expect(serialized).not.toContain('Semantic Retrieval should explain resurfaced thoughts');

    const decrypted = await decryptEncryptedSyncPacket(
      parseEncryptedSyncPacket(serialized),
      'correct horse battery staple',
    );

    expect(decrypted.records.map((record) => record.id)).toEqual(['b-1', 'b-2', 'b-3']);
    const firstRecordValue = decrypted.records[0].value;
    if (!('content' in firstRecordValue)) {
      throw new Error('Expected first encrypted sync record to be a thought block');
    }
    expect(firstRecordValue.content).toBe('Discuss semantic trust with @Aki [[Person: Mina]] #search [[Semantic Retrieval]]');
  });

  it('applies encrypted sync packets after decrypting records', async () => {
    const localStore: DistillStore = {
      projects: [],
      blocks: [
        block({
          id: 'shared',
          content: 'Local stale text',
          capturedAt: '2026-05-06T01:00:00.000Z',
          updatedAt: '2026-05-06T02:00:00.000Z',
        }),
      ],
    };
    const remoteStore: DistillStore = {
      projects: [],
      blocks: [
        block({
          id: 'shared',
          content: 'Remote encrypted update',
          capturedAt: '2026-05-06T01:00:00.000Z',
          updatedAt: '2026-05-06T03:00:00.000Z',
        }),
      ],
    };
    const packet = await buildEncryptedSyncPacket(remoteStore, {
      sourceDeviceId: 'mobile-dev',
      now: '2026-05-06T04:00:00.000Z',
      passphrase: 'correct horse battery staple',
      iterations: 1_000,
    });

    const merged = await applyEncryptedSyncPacket(localStore, packet, 'correct horse battery staple');

    expect(merged.blocks[0].content).toBe('Remote encrypted update');
  });

  it('rejects encrypted sync packets with the wrong passphrase or tampered metadata', async () => {
    const packet = await buildEncryptedSyncPacket(store, {
      sourceDeviceId: 'windows-dev',
      now: '2026-05-06T03:00:00.000Z',
      passphrase: 'correct horse battery staple',
      iterations: 1_000,
    });

    await expect(decryptEncryptedSyncPacket(packet, 'incorrect horse battery')).rejects.toThrow();

    const tampered = {
      ...packet,
      records: [{ ...packet.records[0], hash: 'fnv1a32:00000000' }, ...packet.records.slice(1)],
    };

    await expect(decryptEncryptedSyncPacket(tampered, 'correct horse battery staple')).rejects.toThrow(/metadata/);
  });
});

describe('device identity', () => {
  it('creates and renames a stable local device identity', () => {
    const storage = new Map<string, string>();
    const previousLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
        removeItem: (key: string) => storage.delete(key),
      },
    });

    try {
      const created = getOrCreateDeviceIdentity();
      const loaded = getOrCreateDeviceIdentity();
      const renamed = renameDeviceIdentity(created, 'Travel laptop');

      expect(created.id).toBe(loaded.id);
      expect(created.name).toBeTruthy();
      expect(renamed).toMatchObject({ id: created.id, name: 'Travel laptop' });
      expect(readDeviceIdentity()?.name).toBe('Travel laptop');
      expect(storage.get(DEVICE_IDENTITY_KEY)).toContain('Travel laptop');
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: previousLocalStorage,
      });
    }
  });
});
