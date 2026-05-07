import { describe, expect, it } from 'vitest';
import {
  createSyncKeyMaterial,
  ensureSyncKeyMaterial,
  getSyncKeyMaterial,
  withSyncKeyMaterial,
  type DistillStore,
  type ThoughtBlock,
} from '../model';
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
import { browserVaultPath, getBrowserVaultStorageInfo, isBrowserIndexedDbSupported } from '../browserVaultStore';
import { buildPersonalKmHandoffItems } from '../personalKmHandoff';
import { detectPwaPlatform, getPwaInstallGuidance } from '../pwaInstall';
import {
  createDistillVaultSession,
  decryptDistillVault,
  encryptDistillVault,
  encryptDistillVaultWithSession,
  unlockDistillVaultSession,
} from '../vaultCrypto';
import { isVaultAutoLockExpired, normalizeVaultAutoLockMinutes } from '../vaultSession';
import { DEVICE_IDENTITY_KEY, getOrCreateDeviceIdentity, readDeviceIdentity, renameDeviceIdentity } from '../device';
import {
  buildDeviceVerificationPayload,
  createDeviceSigningKeyPair,
  deviceFingerprintMatches,
  formatDevicePublicKeyFingerprint,
  parseDeviceVerificationPayload,
  reviewSyncPacketSignature,
  resolveDeviceVerificationCodeFromPayload,
  signSyncPacket,
} from '../deviceSigning';
import { buildDeviceLossRunbook } from '../deviceLossRunbook';
import { buildRestorePreview } from '../restorePreview';
import { buildSyncPreview } from '../syncPreview';
import {
  chooseAutoSyncFolderPreview,
  chooseAssistedSyncFolderPreview,
  countSyncFolderPacketReviews,
  createSyncFolderPacketReviewKey,
  type SyncFolderPacketReview,
} from '../syncFolderReview';
import { runMultiDeviceSyncRecoveryDrill, runSyncRecoveryDrill } from '../syncRecoveryDrill';
import { runSyncRollbackDrill } from '../syncRollbackDrill';
import {
  applyEncryptedSyncPacket,
  applySyncPacket,
  buildEncryptedSyncPacket,
  buildSyncPacket,
  computeSyncPacketHash,
  createSyncAutoExportFingerprint,
  decryptEncryptedSyncPacket,
  forgetKnownSyncDevice,
  forgetRevokedSyncDevice,
  getSyncPacketCheckpointStatus,
  isKnownSyncDevice,
  isSyncPacketReplay,
  parseEncryptedSyncPacket,
  parseSyncPacket,
  registerSyncDevice,
  registerSyncPacketCheckpoint,
  revokeSyncDevice,
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

describe('PWA install guidance', () => {
  it('detects mobile platforms from user agents', () => {
    expect(detectPwaPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios');
    expect(detectPwaPlatform('Mozilla/5.0 (Linux; Android 15; Pixel 8)')).toBe('android');
    expect(detectPwaPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop');
  });

  it('prefers desktop and standalone states before browser install prompts', () => {
    expect(
      getPwaInstallGuidance({
        isDesktopRuntime: true,
        canPrompt: true,
        isStandalone: false,
        hasServiceWorker: true,
        isOnline: true,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      }).kind,
    ).toBe('desktop-app');

    expect(
      getPwaInstallGuidance({
        isDesktopRuntime: false,
        canPrompt: true,
        isStandalone: true,
        hasServiceWorker: true,
        isOnline: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 8)',
      }).kind,
    ).toBe('standalone');
  });

  it('shows prompt-ready or manual mobile install guidance', () => {
    expect(
      getPwaInstallGuidance({
        isDesktopRuntime: false,
        canPrompt: true,
        isStandalone: false,
        hasServiceWorker: true,
        isOnline: true,
        userAgent: 'Mozilla/5.0 (Linux; Android 15; Pixel 8)',
      }).kind,
    ).toBe('prompt-ready');

    expect(
      getPwaInstallGuidance({
        isDesktopRuntime: false,
        canPrompt: false,
        isStandalone: false,
        hasServiceWorker: true,
        isOnline: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
      }).kind,
    ).toBe('ios-manual');
  });
});

describe('browser vault storage planning', () => {
  it('uses IndexedDB paths when browser support is available', () => {
    expect(browserVaultPath('distill.vault.v1', 'indexeddb')).toBe(
      'indexedDB:distill-browser-vault/vaults/distill.vault.v1',
    );

    expect(getBrowserVaultStorageInfo('distill.vault.v1', true)).toMatchObject({
      backend: 'indexeddb',
      path: 'indexedDB:distill-browser-vault/vaults/distill.vault.v1',
    });
  });

  it('falls back to localStorage paths when IndexedDB is unavailable', () => {
    expect(getBrowserVaultStorageInfo('distill.vault.v1', false)).toMatchObject({
      backend: 'localStorage',
      path: 'localStorage:distill.vault.v1',
    });

    expect(isBrowserIndexedDbSupported()).toBe(false);
  });
});

describe('vault session policy', () => {
  it('normalizes auto-lock minutes into the supported range', () => {
    expect(normalizeVaultAutoLockMinutes(Number.NaN)).toBe(15);
    expect(normalizeVaultAutoLockMinutes(0)).toBe(0);
    expect(normalizeVaultAutoLockMinutes(0.4)).toBe(1);
    expect(normalizeVaultAutoLockMinutes(12.6)).toBe(13);
    expect(normalizeVaultAutoLockMinutes(999)).toBe(240);
  });

  it('expires only after the configured idle window', () => {
    const lastActivityAt = 1_000;

    expect(isVaultAutoLockExpired(lastActivityAt, 0, lastActivityAt + 999_999)).toBe(false);
    expect(isVaultAutoLockExpired(lastActivityAt, 15, lastActivityAt + 14 * 60 * 1000)).toBe(false);
    expect(isVaultAutoLockExpired(lastActivityAt, 15, lastActivityAt + 15 * 60 * 1000)).toBe(true);
  });
});

describe('device-loss recovery runbook', () => {
  it('requires core setup before device-loss recovery is operational', () => {
    const runbook = buildDeviceLossRunbook({
      knownDeviceCount: 0,
      recoverySnapshotCount: 0,
      syncFolderAutoExportEnabled: false,
      syncFolderMonitorEnabled: false,
      isDesktopRuntime: true,
      hasOpenSyncPreview: false,
    });

    expect(runbook.level).toBe('setup-required');
    expect(runbook.todoCount).toBe(5);
    expect(runbook.steps.find((step) => step.id === 'sync-key')?.status).toBe('todo');
    expect(runbook.steps.find((step) => step.id === 'device-verification')?.status).toBe('todo');
  });

  it('marks a fully prepared desktop sync setup as ready', () => {
    const runbook = buildDeviceLossRunbook({
      syncKeyId: 'sync-key-1',
      deviceSigningFingerprint: 'ABCD-1234',
      knownDeviceCount: 2,
      recoverySnapshotCount: 1,
      syncFolderPath: 'C:\\Users\\awake\\OneDrive\\Distill Sync',
      syncFolderAutoExportEnabled: true,
      syncFolderMonitorEnabled: true,
      isDesktopRuntime: true,
      hasOpenSyncPreview: true,
    });

    expect(runbook.level).toBe('ready');
    expect(runbook.readyCount).toBe(runbook.totalSteps);
    expect(runbook.todoCount).toBe(0);
    expect(runbook.watchCount).toBe(0);
  });
});

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

describe('Personal KM handoff', () => {
  it('builds summary-only handoff items for processed blocks', () => {
    const items = buildPersonalKmHandoffItems(store);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: 'Distill reviewed block b-2',
      status: 'new',
      tags: ['distill', 'reviewed', 'summary-only'],
    });
    expect(items[0].source_refs).toEqual(expect.arrayContaining(['distill:block:b-2', 'distill:note:daily-2026-05-05']));
    expect(items[0].body).toContain('Privacy: summary_only_no_note_body');
    expect(items[0].body).not.toContain('Semantic Retrieval should explain resurfaced thoughts');
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

  it('builds a restore preview diff before replacing the store', () => {
    const incoming: DistillStore = {
      projects: [
        { id: 'p-active', name: 'Active Project Renamed', signal: 'Current work', status: 'Active' },
        { id: 'p-imported', name: 'Imported Project', signal: 'Restore test', status: 'Next' },
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
          content: 'Updated restored thought',
          updatedAt: '2026-05-06T11:00:00.000Z',
        }),
        block({ id: 'b-imported', content: 'Imported restored thought' }),
      ],
      sync: {
        tombstones: [{ kind: 'thought-block', id: 'deleted', deletedAt: now }],
        devices: [{ id: 'phone', name: 'Phone', firstSeenAt: now, lastSeenAt: now }],
        revokedDevices: [],
      },
    };

    const preview = buildRestorePreview(store, incoming, 'json');

    expect(preview.diff).toMatchObject({
      addedBlocks: 1,
      updatedBlocks: 1,
      removedBlocks: 1,
      unchangedBlocks: 1,
      addedProjects: 1,
      updatedProjects: 1,
      removedProjects: 1,
      unchangedProjects: 0,
      tombstones: 1,
      devices: 1,
    });
  });

  it('tracks sync recovery snapshots as a restore preview source', () => {
    const preview = buildRestorePreview(store, store, 'sync-recovery');

    expect(preview.kind).toBe('sync-recovery');
    expect(preview.diff.unchangedBlocks).toBe(store.blocks.length);
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

  it('rejects tampered encrypted vault payloads', async () => {
    const encrypted = await encryptDistillVault(exportStoreAsJson(store), 'correct horse battery staple', {
      iterations: 1_000,
    });
    const envelope = JSON.parse(encrypted) as { payload: string };
    const payload = Uint8Array.from(atob(envelope.payload), (char) => char.charCodeAt(0));
    payload[0] ^= 0xff;
    envelope.payload = btoa(String.fromCharCode(...payload));

    await expect(decryptDistillVault(JSON.stringify(envelope), 'correct horse battery staple')).rejects.toThrow();
  });

  it('rejects unsupported encrypted vault envelopes before decrypting', async () => {
    const encrypted = await encryptDistillVault(exportStoreAsJson(store), 'correct horse battery staple', {
      iterations: 1_000,
    });
    const envelope = JSON.parse(encrypted) as { schemaVersion: number; type: string };

    envelope.schemaVersion = 999;
    await expect(decryptDistillVault(JSON.stringify(envelope), 'correct horse battery staple')).rejects.toThrow(
      /supported Distill encrypted payload/,
    );

    envelope.schemaVersion = 1;
    envelope.type = 'distill.encrypted-sync-record';
    await expect(decryptDistillVault(JSON.stringify(envelope), 'correct horse battery staple')).rejects.toThrow(
      /supported Distill encrypted payload/,
    );
  });

  it('uses a non-exportable session key for unlocked vault saves', async () => {
    const exported = exportStoreAsJson(store);
    const encrypted = await encryptDistillVault(exported, 'correct horse battery staple', { iterations: 1_000 });
    const { plainJson, session } = await unlockDistillVaultSession(encrypted, 'correct horse battery staple');
    const sessionEncrypted = await encryptDistillVaultWithSession(plainJson, session);

    expect(session.key.extractable).toBe(false);
    expect(JSON.parse(sessionEncrypted).kdf.salt).toBe(JSON.parse(encrypted).kdf.salt);
    expect(sessionEncrypted).not.toContain('Discuss semantic trust');
    expect(await decryptDistillVault(sessionEncrypted, 'correct horse battery staple')).toBe(exported);
  });

  it('creates new vault sessions without exposing the derived key', async () => {
    const session = await createDistillVaultSession('correct horse battery staple', { iterations: 1_000 });
    const encrypted = await encryptDistillVaultWithSession(exportStoreAsJson(store), session);

    expect(session.key.extractable).toBe(false);
    expect(JSON.parse(encrypted)).toMatchObject({
      type: 'distill.encrypted-vault',
      kdf: {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations: 1_000,
      },
    });
    await expect(crypto.subtle.exportKey('raw', session.key)).rejects.toThrow();
    await expect(decryptDistillVault(encrypted, 'correct horse battery staple')).resolves.toContain('b-1');
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
          revokedDevices: [],
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

  it('exports revoked devices with sync packets', () => {
    const syncStore = revokeSyncDevice(
      registerSyncDevice(
        {
          projects: [],
          blocks: [],
          sync: {
            tombstones: [],
            devices: [],
            revokedDevices: [],
          },
        },
        { id: 'phone-dev', name: 'Phone' },
        '2026-05-06T05:00:00.000Z',
      ),
      'phone-dev',
      '2026-05-06T06:00:00.000Z',
    );

    const packet = buildSyncPacket(syncStore, {
      sourceDeviceId: 'windows-dev',
      sourceDeviceName: 'Windows desk',
      now: '2026-05-06T07:00:00.000Z',
    });

    expect(packet.revokedDevices).toEqual([
      {
        id: 'phone-dev',
        name: 'Phone',
        revokedAt: '2026-05-06T06:00:00.000Z',
      },
    ]);
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

  it('applies incoming revoked devices and removes them from the active device registry', () => {
    const localStore: DistillStore = {
      projects: [],
      blocks: [],
      sync: {
        tombstones: [],
        devices: [{ id: 'phone-dev', name: 'Phone', firstSeenAt: now, lastSeenAt: now }],
        revokedDevices: [],
      },
    };
    const remoteStore: DistillStore = {
      projects: [],
      blocks: [],
      sync: {
        tombstones: [],
        devices: [{ id: 'tablet-dev', name: 'Tablet', firstSeenAt: now, lastSeenAt: now }],
        revokedDevices: [{ id: 'phone-dev', name: 'Phone', revokedAt: '2026-05-06T11:00:00.000Z' }],
      },
    };

    const packet = buildSyncPacket(remoteStore, {
      sourceDeviceId: 'windows-dev',
      sourceDeviceName: 'Windows desk',
      now: '2026-05-06T12:00:00.000Z',
    });
    const merged = applySyncPacket(localStore, packet);

    expect(merged.sync?.devices.map((device) => device.id).sort()).toEqual(['tablet-dev', 'windows-dev']);
    expect(merged.sync?.revokedDevices).toEqual([
      {
        id: 'phone-dev',
        name: 'Phone',
        revokedAt: '2026-05-06T11:00:00.000Z',
      },
    ]);
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
        revokedDevices: [],
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

  it('blocks packets from locally revoked devices until the revocation record is forgotten', () => {
    const firstPacket = buildSyncPacket(
      {
        projects: [],
        blocks: [block({ id: 'phone-note', content: 'Initial phone note' })],
      },
      { sourceDeviceId: 'phone-dev', sourceDeviceName: 'Phone', now: '2026-05-06T06:00:00.000Z' },
    );
    const imported = applySyncPacket({ projects: [], blocks: [] }, firstPacket);
    const revoked = revokeSyncDevice(imported, 'phone-dev', '2026-05-06T07:00:00.000Z');
    const nextPacket = buildSyncPacket(
      {
        projects: [],
        blocks: [block({ id: 'phone-note-2', content: 'Blocked phone note', updatedAt: '2026-05-06T07:30:00.000Z' })],
      },
      { sourceDeviceId: 'phone-dev', sourceDeviceName: 'Phone', now: '2026-05-06T08:00:00.000Z' },
    );

    expect(() => applySyncPacket(revoked, nextPacket)).toThrow(/revoked device/);

    const forgotten = forgetRevokedSyncDevice(revoked, 'phone-dev');
    const afterForget = applySyncPacket(forgotten, nextPacket);

    expect(afterForget.blocks.find((item) => item.id === 'phone-note-2')?.content).toBe('Blocked phone note');
    expect(afterForget.sync?.revokedDevices).toEqual([]);
  });

  it('forgets known devices without revoking or removing sync safety history', () => {
    const registered = registerSyncDevice(
      {
        projects: [],
        blocks: [],
        sync: {
          tombstones: [
            {
              kind: 'thought-block',
              id: 'deleted-note',
              deletedAt: '2026-05-06T07:00:00.000Z',
              deletedByDeviceId: 'phone-dev',
            },
          ],
          devices: [],
          revokedDevices: [{ id: 'old-tablet', name: 'Old Tablet', revokedAt: '2026-05-06T06:00:00.000Z' }],
        },
      },
      { id: 'phone-dev', name: 'Phone' },
      '2026-05-06T08:00:00.000Z',
    );

    const forgotten = forgetKnownSyncDevice(registered, 'phone-dev');

    expect(forgotten.sync?.devices.some((device) => device.id === 'phone-dev')).toBe(false);
    expect(forgotten.sync?.revokedDevices).toEqual([
      { id: 'old-tablet', name: 'Old Tablet', revokedAt: '2026-05-06T06:00:00.000Z' },
    ]);
    expect(forgotten.sync?.tombstones[0]).toMatchObject({
      id: 'deleted-note',
      deletedByDeviceId: 'phone-dev',
    });
  });

  it('previews sync packet additions, updates, skips, and deletions before applying', () => {
    const localStore: DistillStore = {
      projects: [],
      blocks: [
        block({
          id: 'shared',
          content: 'Local stale text',
          capturedAt: '2026-05-06T01:00:00.000Z',
          updatedAt: '2026-05-06T02:00:00.000Z',
        }),
        block({
          id: 'local-newer',
          content: 'Local newer text',
          capturedAt: '2026-05-06T01:00:00.000Z',
          updatedAt: '2026-05-06T05:00:00.000Z',
        }),
        block({
          id: 'delete-me',
          content: 'Local block deleted by remote tombstone',
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
          content: 'Remote newer text',
          capturedAt: '2026-05-06T01:00:00.000Z',
          updatedAt: '2026-05-06T03:00:00.000Z',
        }),
        block({
          id: 'local-newer',
          content: 'Remote stale text',
          capturedAt: '2026-05-06T01:00:00.000Z',
          updatedAt: '2026-05-06T04:00:00.000Z',
        }),
        block({
          id: 'remote-only',
          content: 'Remote only text',
          capturedAt: '2026-05-06T01:00:00.000Z',
          updatedAt: '2026-05-06T03:30:00.000Z',
        }),
      ],
      sync: {
        tombstones: [
          {
            kind: 'thought-block',
            id: 'delete-me',
            deletedAt: '2026-05-06T04:30:00.000Z',
            deletedByDeviceId: 'mobile-dev',
          },
        ],
        devices: [],
        revokedDevices: [],
      },
    };
    const packet = buildSyncPacket(remoteStore, {
      sourceDeviceId: 'mobile-dev',
      sourceDeviceName: 'Phone',
      now: '2026-05-06T06:00:00.000Z',
    });
    const preview = buildSyncPreview(localStore, packet);

    expect(preview.diff).toMatchObject({
      incomingBlocks: 3,
      incomingDeletions: 1,
      incomingDevices: 1,
      incomingRevokedDevices: 0,
      addedBlocks: 1,
      updatedBlocks: 1,
      skippedBlocks: 1,
      deletedBlocks: 1,
      skippedDeletions: 0,
      remoteWins: 2,
      localWins: 1,
      timestampTies: 0,
      destructiveChanges: 2,
      replay: false,
    });

    const merged = applySyncPacket(localStore, packet);
    expect(merged.blocks.map((item) => item.id).sort()).toEqual(['local-newer', 'remote-only', 'shared']);
    expect(merged.blocks.find((item) => item.id === 'shared')?.content).toBe('Remote newer text');
  });

  it('marks source devices unknown until the local vault trusts them', () => {
    const localStore: DistillStore = {
      projects: [],
      blocks: [],
    };
    const packet = buildSyncPacket(
      {
        projects: [],
        blocks: [block({ id: 'phone-note', content: 'Phone note from a new device' })],
      },
      { sourceDeviceId: 'phone-dev', sourceDeviceName: 'Phone', now: '2026-05-06T06:00:00.000Z' },
    );

    expect(isKnownSyncDevice(localStore, 'phone-dev')).toBe(false);
    expect(buildSyncPreview(localStore, packet).diff.sourceDeviceKnown).toBe(false);

    const trustedStore = registerSyncDevice(localStore, { id: 'phone-dev', name: 'Phone' });

    expect(isKnownSyncDevice(trustedStore, 'phone-dev')).toBe(true);
    expect(buildSyncPreview(trustedStore, packet).diff.sourceDeviceKnown).toBe(true);
  });

  it('ignores replayed or rollback packets from a known device', () => {
    const newerPacket = buildSyncPacket(
      {
        projects: [],
        blocks: [
          block({
            id: 'remote-latest',
            content: 'Latest remote block',
            capturedAt: '2026-05-06T04:00:00.000Z',
            updatedAt: '2026-05-06T05:00:00.000Z',
          }),
        ],
      },
      { sourceDeviceId: 'mobile-dev', sourceDeviceName: 'Phone', now: '2026-05-06T06:00:00.000Z' },
    );
    const afterNewer = applySyncPacket({ projects: [], blocks: [] }, newerPacket);
    const rollbackPacket = buildSyncPacket(
      {
        projects: [],
        blocks: [
          block({
            id: 'remote-rollback',
            content: 'Older packet should not appear',
            capturedAt: '2026-05-06T03:00:00.000Z',
            updatedAt: '2026-05-06T04:00:00.000Z',
          }),
        ],
      },
      { sourceDeviceId: 'mobile-dev', sourceDeviceName: 'Phone', now: '2026-05-06T05:00:00.000Z' },
    );

    expect(isSyncPacketReplay(afterNewer, newerPacket)).toBe(true);
    expect(isSyncPacketReplay(afterNewer, rollbackPacket)).toBe(true);
    const afterRollback = applySyncPacket(afterNewer, rollbackPacket);

    expect(afterRollback.blocks.map((item) => item.id)).toEqual(['remote-latest']);
    expect(afterRollback.sync?.devices.find((device) => device.id === 'mobile-dev')?.lastPacketAt).toBe(
      '2026-05-06T06:00:00.000Z',
    );
  });

  it('chains sync packets with source-device checkpoint hashes', () => {
    const firstPacket = buildSyncPacket(
      {
        projects: [],
        blocks: [
          block({
            id: 'remote-first',
            content: 'First chained packet',
            capturedAt: '2026-05-06T03:00:00.000Z',
            updatedAt: '2026-05-06T04:00:00.000Z',
          }),
        ],
      },
      { sourceDeviceId: 'mobile-dev', sourceDeviceName: 'Phone', now: '2026-05-06T06:00:00.000Z' },
    );
    const afterFirst = applySyncPacket({ projects: [], blocks: [] }, firstPacket);
    const firstDevice = afterFirst.sync?.devices.find((device) => device.id === 'mobile-dev');

    expect(firstPacket.packetHash).toBe(computeSyncPacketHash(firstPacket));
    expect(firstDevice?.lastPacketHash).toBe(firstPacket.packetHash);

    const secondPacket = buildSyncPacket(
      afterFirst,
      { sourceDeviceId: 'mobile-dev', sourceDeviceName: 'Phone', now: '2026-05-06T07:00:00.000Z' },
    );

    expect(secondPacket.previousPacketHash).toBe(firstPacket.packetHash);
    expect(getSyncPacketCheckpointStatus(afterFirst, secondPacket)).toBe('valid');
  });

  it('records exported packet checkpoints for the source device', () => {
    const packet = buildSyncPacket(
      {
        projects: [],
        blocks: [
          block({
            id: 'source-export',
            content: 'Exported local packet',
            capturedAt: '2026-05-06T03:00:00.000Z',
            updatedAt: '2026-05-06T04:00:00.000Z',
          }),
        ],
      },
      { sourceDeviceId: 'windows-dev', sourceDeviceName: 'Windows desk', now: '2026-05-06T06:00:00.000Z' },
    );
    const checkpointed = registerSyncPacketCheckpoint({ projects: [], blocks: [] }, packet);
    const nextPacket = buildSyncPacket(checkpointed, {
      sourceDeviceId: 'windows-dev',
      sourceDeviceName: 'Windows desk',
      now: '2026-05-06T07:00:00.000Z',
    });

    expect(checkpointed.sync?.devices.find((device) => device.id === 'windows-dev')?.lastPacketHash).toBe(
      packet.packetHash,
    );
    expect(nextPacket.previousPacketHash).toBe(packet.packetHash);
  });

  it('fingerprints outbound sync content without looping on source checkpoint metadata', () => {
    const sourceDevice = { id: 'windows-dev', name: 'Windows desk' };
    const baseStore: DistillStore = {
      projects: [],
      blocks: [
        block({
          id: 'source-export',
          content: 'Exported local packet',
          capturedAt: '2026-05-06T03:00:00.000Z',
          updatedAt: '2026-05-06T04:00:00.000Z',
        }),
      ],
    };
    const packet = buildSyncPacket(baseStore, {
      sourceDeviceId: sourceDevice.id,
      sourceDeviceName: sourceDevice.name,
      now: '2026-05-06T06:00:00.000Z',
    });
    const checkpointed = registerSyncPacketCheckpoint(baseStore, packet);

    expect(createSyncAutoExportFingerprint(checkpointed, sourceDevice)).toBe(
      createSyncAutoExportFingerprint(baseStore, sourceDevice),
    );
    expect(
      createSyncAutoExportFingerprint(
        {
          ...baseStore,
          blocks: [{ ...baseStore.blocks[0], content: 'Changed outbound content' }],
        },
        sourceDevice,
      ),
    ).not.toBe(createSyncAutoExportFingerprint(baseStore, sourceDevice));
    expect(
      createSyncAutoExportFingerprint(
        revokeSyncDevice(registerSyncDevice(baseStore, { id: 'phone-dev', name: 'Phone' }), 'phone-dev'),
        sourceDevice,
      ),
    ).not.toBe(createSyncAutoExportFingerprint(baseStore, sourceDevice));
  });

  it('rejects newer packets that do not continue the known checkpoint chain', () => {
    const firstPacket = buildSyncPacket(
      {
        projects: [],
        blocks: [
          block({
            id: 'remote-first',
            content: 'First chained packet',
            capturedAt: '2026-05-06T03:00:00.000Z',
            updatedAt: '2026-05-06T04:00:00.000Z',
          }),
        ],
      },
      { sourceDeviceId: 'mobile-dev', sourceDeviceName: 'Phone', now: '2026-05-06T06:00:00.000Z' },
    );
    const afterFirst = applySyncPacket({ projects: [], blocks: [] }, firstPacket);
    const disconnectedPacket = {
      ...buildSyncPacket(
        {
          projects: [],
          blocks: [
            block({
              id: 'remote-second',
              content: 'Disconnected newer packet',
              capturedAt: '2026-05-06T04:00:00.000Z',
              updatedAt: '2026-05-06T06:30:00.000Z',
            }),
          ],
        },
        { sourceDeviceId: 'mobile-dev', sourceDeviceName: 'Phone', now: '2026-05-06T07:00:00.000Z' },
      ),
      previousPacketHash: 'fnv1a32:00000000',
    };

    expect(getSyncPacketCheckpointStatus(afterFirst, disconnectedPacket)).toBe('packet-hash-mismatch');

    const disconnectedWithValidHash = {
      ...disconnectedPacket,
      packetHash: computeSyncPacketHash(disconnectedPacket),
    };

    expect(getSyncPacketCheckpointStatus(afterFirst, disconnectedWithValidHash)).toBe(
      'previous-packet-hash-mismatch',
    );
    expect(() => applySyncPacket(afterFirst, disconnectedWithValidHash)).toThrow(/checkpoint chain/);
  });

  it('previews replayed sync packets as skipped with no vault changes', () => {
    const packet = buildSyncPacket(
      {
        projects: [],
        blocks: [
          block({
            id: 'remote-latest',
            content: 'Latest remote block',
            capturedAt: '2026-05-06T04:00:00.000Z',
            updatedAt: '2026-05-06T05:00:00.000Z',
          }),
        ],
      },
      { sourceDeviceId: 'mobile-dev', sourceDeviceName: 'Phone', now: '2026-05-06T06:00:00.000Z' },
    );
    const afterImport = applySyncPacket({ projects: [], blocks: [] }, packet);
    const preview = buildSyncPreview(afterImport, packet);

    expect(preview.diff).toMatchObject({
      incomingBlocks: 1,
      incomingDeletions: 0,
      incomingRevokedDevices: 0,
      addedBlocks: 0,
      updatedBlocks: 0,
      skippedBlocks: 1,
      deletedBlocks: 0,
      skippedDeletions: 0,
      remoteWins: 0,
      localWins: 0,
      timestampTies: 0,
      destructiveChanges: 0,
      replay: true,
    });
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
    expect(serialized).toContain('"syncKdf"');
    expect(serialized).not.toContain('Discuss semantic trust');
    expect(serialized).not.toContain('Semantic Retrieval should explain resurfaced thoughts');
    expect(packet.syncKdf).toMatchObject({
      name: 'PBKDF2',
      hash: 'SHA-256',
      iterations: 1_000,
    });
    const recordKdfs = packet.records.map((record) => JSON.parse(record.encrypted.value).kdf);
    expect(recordKdfs.every((kdf) => JSON.stringify(kdf) === JSON.stringify(packet.syncKdf))).toBe(true);

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

  it('decrypts legacy per-record encrypted sync packets without packet-level sync KDF metadata', async () => {
    const packet = await buildEncryptedSyncPacket(store, {
      sourceDeviceId: 'windows-dev',
      now: '2026-05-06T03:00:00.000Z',
      passphrase: 'correct horse battery staple',
      iterations: 1_000,
    });
    const { syncKdf: _syncKdf, ...legacyPacket } = packet;

    const decrypted = await decryptEncryptedSyncPacket(legacyPacket, 'correct horse battery staple');

    expect('syncKdf' in legacyPacket).toBe(false);
    expect(decrypted.records.map((record) => record.id)).toEqual(['b-1', 'b-2', 'b-3']);
  });

  it('creates and rotates dedicated sync key material inside sync metadata', () => {
    const firstStore = ensureSyncKeyMaterial({ projects: [], blocks: [] }, '2026-05-06T02:00:00.000Z');
    const firstKey = getSyncKeyMaterial(firstStore);

    if (!firstKey) {
      throw new Error('Expected sync key material to be created');
    }

    const unchangedStore = ensureSyncKeyMaterial(firstStore, '2026-05-06T03:00:00.000Z');
    const rotatedStore = withSyncKeyMaterial(
      firstStore,
      createSyncKeyMaterial('2026-05-06T04:00:00.000Z'),
    );
    const rotatedKey = getSyncKeyMaterial(rotatedStore);

    expect(getSyncKeyMaterial(unchangedStore)?.id).toBe(firstKey.id);
    expect(rotatedKey?.id).not.toBe(firstKey.id);
    expect(rotatedKey?.secret).not.toBe(firstKey.secret);
    expect(rotatedKey?.createdAt).toBe('2026-05-06T04:00:00.000Z');
  });

  it('encrypts new sync packets with dedicated sync key material and a wrapped key fallback', async () => {
    const keyedStore = ensureSyncKeyMaterial(store, '2026-05-06T02:00:00.000Z');
    const syncKey = getSyncKeyMaterial(keyedStore);

    if (!syncKey) {
      throw new Error('Expected test store to have sync key material');
    }

    const packet = await buildEncryptedSyncPacket(keyedStore, {
      sourceDeviceId: 'windows-dev',
      now: '2026-05-06T03:00:00.000Z',
      passphrase: 'correct horse battery staple',
      syncKey,
      iterations: 1_000,
    });
    const serialized = serializeEncryptedSyncPacket(packet);

    expect(packet.syncKeyId).toBe(syncKey.id);
    expect(packet.wrappedSyncKey).toMatchObject({
      type: 'distill.wrapped-sync-key',
      keyId: syncKey.id,
    });
    expect(serialized).not.toContain(syncKey.secret);

    const decryptedWithLocalKey = await decryptEncryptedSyncPacket(packet, { syncKey });
    let discoveredSyncKey = null as typeof syncKey | null;
    const decryptedWithWrappedKey = await decryptEncryptedSyncPacket(packet, {
      passphrase: 'correct horse battery staple',
      onDiscoveredSyncKey: (key) => {
        discoveredSyncKey = key;
      },
    });

    expect(decryptedWithLocalKey.records.map((record) => record.id)).toEqual(['b-1', 'b-2', 'b-3']);
    expect(decryptedWithWrappedKey.records.map((record) => record.id)).toEqual(['b-1', 'b-2', 'b-3']);
    expect(discoveredSyncKey?.id).toBe(syncKey.id);
  });

  it('runs a sync recovery drill through local key and wrapped-key fallback', async () => {
    const keyedStore = ensureSyncKeyMaterial(store, '2026-05-06T02:00:00.000Z');
    const syncKey = getSyncKeyMaterial(keyedStore);

    if (!syncKey) {
      throw new Error('Expected test store to have sync key material');
    }

    const result = await runSyncRecoveryDrill(keyedStore, {
      sourceDeviceId: 'windows-dev',
      sourceDeviceName: 'Windows desk',
      now: '2026-05-06T03:00:00.000Z',
      passphrase: 'correct horse battery staple',
      syncKey,
      iterations: 1_000,
    });

    expect(result).toMatchObject({
      syncKeyId: syncKey.id,
      discoveredSyncKeyId: syncKey.id,
      records: 3,
      packetCreatedAt: '2026-05-06T03:00:00.000Z',
      sourceDeviceId: 'windows-dev',
    });
  });

  it('runs a multi-device sync recovery drill through wrapped bootstrap and return packet', async () => {
    const keyedStore = ensureSyncKeyMaterial(store, '2026-05-06T02:00:00.000Z');
    const syncKey = getSyncKeyMaterial(keyedStore);

    if (!syncKey) {
      throw new Error('Expected test store to have sync key material');
    }

    const result = await runMultiDeviceSyncRecoveryDrill(keyedStore, {
      sourceDeviceId: 'windows-dev',
      sourceDeviceName: 'Windows desk',
      recoveredDeviceId: 'phone-dev',
      recoveredDeviceName: 'Phone recovery drill',
      now: '2026-05-06T03:00:00.000Z',
      returnNow: '2026-05-06T04:00:00.000Z',
      passphrase: 'correct horse battery staple',
      syncKey,
      iterations: 1_000,
    });

    expect(result).toMatchObject({
      syncKeyId: syncKey.id,
      recoveredSyncKeyId: syncKey.id,
      sourceDeviceId: 'windows-dev',
      recoveredDeviceId: 'phone-dev',
      bootstrapRecords: 3,
      returnRecords: 3,
      bootstrapPacketCreatedAt: '2026-05-06T03:00:00.000Z',
      returnPacketCreatedAt: '2026-05-06T04:00:00.000Z',
    });
  });

  it('runs a sync rollback drill without changing the active store', () => {
    const incomingStore: DistillStore = {
      ...store,
      blocks: [
        ...store.blocks,
        block({
          id: 'remote-added',
          content: 'Remote-only block for rollback drill',
          capturedAt: '2026-05-06T11:00:00.000Z',
          updatedAt: '2026-05-06T11:00:00.000Z',
        }),
      ],
    };
    const packet = buildSyncPacket(incomingStore, {
      sourceDeviceId: 'phone-dev',
      sourceDeviceName: 'Phone',
      now: '2026-05-06T12:00:00.000Z',
    });
    const before = JSON.stringify(store);

    const result = runSyncRollbackDrill(store, packet);

    expect(result).toMatchObject({
      sourceDeviceId: 'phone-dev',
      records: 4,
      beforeBlocks: 3,
      afterApplyBlocks: 4,
      afterRollbackBlocks: 3,
      addedBlocksAfterApply: 1,
      rollbackRemovedBlocks: 1,
      rollbackUnchangedBlocks: 3,
    });
    expect(JSON.stringify(store)).toBe(before);
  });

  it('preserves local sync key material while applying incoming sync packets', () => {
    const keyedStore = ensureSyncKeyMaterial({ projects: [], blocks: [] }, '2026-05-06T02:00:00.000Z');
    const incoming = buildSyncPacket(
      {
        projects: [],
        blocks: [
          block({
            id: 'remote-with-key',
            content: 'Remote block should not remove local sync key',
            capturedAt: '2026-05-06T03:00:00.000Z',
            updatedAt: '2026-05-06T04:00:00.000Z',
          }),
        ],
      },
      { sourceDeviceId: 'mobile-dev', now: '2026-05-06T05:00:00.000Z' },
    );

    const merged = applySyncPacket(keyedStore, incoming);

    expect(getSyncKeyMaterial(merged)?.id).toBe(getSyncKeyMaterial(keyedStore)?.id);
  });

  it('signs encrypted sync packets and verifies trusted device signatures', async () => {
    const signingKeyPair = await createDeviceSigningKeyPair();
    const packet = await buildEncryptedSyncPacket(store, {
      sourceDeviceId: 'windows-dev',
      sourceDeviceName: 'Windows desk',
      sourceDeviceSigningPublicKey: signingKeyPair.publicKey,
      now: '2026-05-06T03:00:00.000Z',
      passphrase: 'correct horse battery staple',
      iterations: 1_000,
      signPacket: (plainPacket) => signSyncPacket(plainPacket, signingKeyPair),
    });
    const decrypted = await decryptEncryptedSyncPacket(packet, 'correct horse battery staple');
    const untrustedReview = await reviewSyncPacketSignature({ projects: [], blocks: [] }, decrypted);
    const trustedStore = registerSyncDevice(
      { projects: [], blocks: [] },
      {
        id: 'windows-dev',
        name: 'Windows desk',
        signingKeyAlgorithm: signingKeyPair.algorithm,
        signingPublicKey: signingKeyPair.publicKey,
      },
      '2026-05-06T02:00:00.000Z',
    );
    const trustedReview = await reviewSyncPacketSignature(trustedStore, decrypted);

    expect(packet.signature).toMatchObject({
      algorithm: signingKeyPair.algorithm,
      publicKey: signingKeyPair.publicKey,
    });
    expect(decrypted.signature?.publicKey).toBe(signingKeyPair.publicKey);
    expect(untrustedReview).toMatchObject({
      status: 'signed-untrusted',
      blocksApply: false,
      requiresTrust: true,
      signatureValid: true,
    });
    expect(trustedReview).toMatchObject({
      status: 'trusted-valid',
      blocksApply: false,
      requiresTrust: false,
      signatureValid: true,
    });
    expect(trustedReview.fingerprint).toMatch(/^[A-F0-9]{4}(?:-[A-F0-9]{4}){7}$/);
    expect(trustedReview.verificationPayload).toContain(trustedReview.fingerprint);
  });

  it('formats device public key fingerprints for out-of-band trust checks', async () => {
    const signingKeyPair = await createDeviceSigningKeyPair();
    const fingerprint = await formatDevicePublicKeyFingerprint(signingKeyPair.publicKey);

    expect(fingerprint).toMatch(/^[A-F0-9]{4}(?:-[A-F0-9]{4}){7}$/);
    expect(deviceFingerprintMatches(fingerprint, fingerprint.toLowerCase().replace(/-/g, ' '))).toBe(true);
    expect(deviceFingerprintMatches(fingerprint, '0000 0000 0000 0000 0000 0000 0000 0000')).toBe(false);
  });

  it('builds parseable device verification payloads for QR pairing', async () => {
    const signingKeyPair = await createDeviceSigningKeyPair();
    const fingerprint = await formatDevicePublicKeyFingerprint(signingKeyPair.publicKey);
    const payload = buildDeviceVerificationPayload({
      deviceId: 'windows-dev',
      deviceName: 'Windows desk',
      publicKey: signingKeyPair.publicKey,
      fingerprint,
    });
    const parsed = JSON.parse(payload);

    expect(parsed).toMatchObject({
      type: 'distill-device-verification',
      version: 1,
      deviceId: 'windows-dev',
      deviceName: 'Windows desk',
      fingerprint,
      publicKey: signingKeyPair.publicKey,
    });
  });

  it('resolves scanned device verification payloads only when they match the incoming source', async () => {
    const signingKeyPair = await createDeviceSigningKeyPair();
    const fingerprint = await formatDevicePublicKeyFingerprint(signingKeyPair.publicKey);
    const payload = buildDeviceVerificationPayload({
      deviceId: 'windows-dev',
      deviceName: 'Windows desk',
      publicKey: signingKeyPair.publicKey,
      fingerprint,
    });

    expect(parseDeviceVerificationPayload(payload)?.fingerprint).toBe(fingerprint);
    expect(
      resolveDeviceVerificationCodeFromPayload(payload, {
        deviceId: 'windows-dev',
        publicKey: signingKeyPair.publicKey,
        fingerprint,
      }),
    ).toBe(fingerprint);
    expect(
      resolveDeviceVerificationCodeFromPayload(payload, {
        deviceId: 'phone-dev',
        publicKey: signingKeyPair.publicKey,
        fingerprint,
      }),
    ).toBeNull();
    expect(resolveDeviceVerificationCodeFromPayload(fingerprint.toLowerCase(), { fingerprint })).toBe(fingerprint);
  });

  it('blocks signed packets that do not match the trusted source-device key', async () => {
    const signingKeyPair = await createDeviceSigningKeyPair();
    const otherSigningKeyPair = await createDeviceSigningKeyPair();
    const packet = await buildEncryptedSyncPacket(store, {
      sourceDeviceId: 'windows-dev',
      sourceDeviceName: 'Windows desk',
      sourceDeviceSigningPublicKey: signingKeyPair.publicKey,
      now: '2026-05-06T03:00:00.000Z',
      passphrase: 'correct horse battery staple',
      iterations: 1_000,
      signPacket: (plainPacket) => signSyncPacket(plainPacket, signingKeyPair),
    });
    const decrypted = await decryptEncryptedSyncPacket(packet, 'correct horse battery staple');
    const trustedStore = registerSyncDevice(
      { projects: [], blocks: [] },
      {
        id: 'windows-dev',
        name: 'Windows desk',
        signingKeyAlgorithm: otherSigningKeyPair.algorithm,
        signingPublicKey: otherSigningKeyPair.publicKey,
      },
      '2026-05-06T02:00:00.000Z',
    );
    const review = await reviewSyncPacketSignature(trustedStore, decrypted);

    expect(review).toMatchObject({
      status: 'trusted-key-mismatch',
      blocksApply: true,
      requiresTrust: false,
      signatureValid: false,
    });
  });

  it('blocks tampered signed packet payloads', async () => {
    const signingKeyPair = await createDeviceSigningKeyPair();
    const packet = await buildEncryptedSyncPacket(store, {
      sourceDeviceId: 'windows-dev',
      sourceDeviceName: 'Windows desk',
      sourceDeviceSigningPublicKey: signingKeyPair.publicKey,
      now: '2026-05-06T03:00:00.000Z',
      passphrase: 'correct horse battery staple',
      iterations: 1_000,
      signPacket: (plainPacket) => signSyncPacket(plainPacket, signingKeyPair),
    });
    const decrypted = await decryptEncryptedSyncPacket(packet, 'correct horse battery staple');
    const trustedStore = registerSyncDevice(
      { projects: [], blocks: [] },
      {
        id: 'windows-dev',
        name: 'Windows desk',
        signingKeyAlgorithm: signingKeyPair.algorithm,
        signingPublicKey: signingKeyPair.publicKey,
      },
      '2026-05-06T02:00:00.000Z',
    );
    const review = await reviewSyncPacketSignature(trustedStore, {
      ...decrypted,
      createdAt: '2026-05-06T03:00:01.000Z',
    });

    expect(review).toMatchObject({
      status: 'trusted-invalid',
      blocksApply: true,
      signatureValid: false,
    });
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

    const tamperedSyncKdf = {
      ...packet,
      syncKdf: {
        ...packet.syncKdf!,
        salt: 'dGFtcGVyZWQtc3luYy1rZGY=',
      },
    };

    await expect(decryptEncryptedSyncPacket(tamperedSyncKdf, 'correct horse battery staple')).rejects.toThrow(/KDF/);

    const tampered = {
      ...packet,
      records: [{ ...packet.records[0], hash: 'fnv1a32:00000000' }, ...packet.records.slice(1)],
    };

    await expect(decryptEncryptedSyncPacket(tampered, 'correct horse battery staple')).rejects.toThrow(/metadata/);
  });
});

describe('sync folder review', () => {
  function review(status: SyncFolderPacketReview['status'], fileName = `distill-sync-${status}.distill-sync.json`) {
    return {
      fileName,
      path: `C:\\Sync\\${fileName}`,
      bytes: 100,
      modifiedAt: now,
      status,
      reason: status,
    } satisfies SyncFolderPacketReview;
  }

  it('counts sync folder safety scan statuses', () => {
    expect(
      countSyncFolderPacketReviews([
        review('ready'),
        review('risk'),
        review('stale'),
        review('blocked'),
        review('checkpoint-risk'),
        review('invalid'),
      ]),
    ).toEqual({
      ready: 1,
      risk: 1,
      stale: 1,
      blocked: 1,
      checkpointRisk: 1,
      invalid: 1,
    });
  });

  it('auto-previews only one unambiguous safe sync folder packet', () => {
    const safe = review('ready', 'distill-sync-safe.distill-sync.json');

    expect(chooseAssistedSyncFolderPreview([safe, review('stale')])).toMatchObject({
      kind: 'auto-preview',
      candidate: safe,
    });
    expect(chooseAssistedSyncFolderPreview([safe, review('ready', 'distill-sync-other.distill-sync.json')])).toMatchObject({
      kind: 'choose',
    });
    expect(chooseAssistedSyncFolderPreview([safe, review('invalid')])).toMatchObject({ kind: 'choose' });
    expect(chooseAssistedSyncFolderPreview([review('stale'), review('blocked')])).toMatchObject({
      kind: 'no-action',
    });
  });

  it('safe auto-preview avoids open previews and already previewed packets', () => {
    const safe = review('ready', 'distill-sync-safe.distill-sync.json');

    expect(chooseAutoSyncFolderPreview([safe, review('stale')])).toMatchObject({
      kind: 'auto-preview',
      candidate: safe,
    });
    expect(chooseAutoSyncFolderPreview([safe], { hasOpenPreview: true })).toMatchObject({
      kind: 'no-action',
      reason: 'preview-open',
    });
    expect(
      chooseAutoSyncFolderPreview([safe], {
        lastPreviewedKey: createSyncFolderPacketReviewKey(safe),
      }),
    ).toMatchObject({
      kind: 'no-action',
      reason: 'already-previewed',
    });
    expect(chooseAutoSyncFolderPreview([safe, review('invalid')])).toMatchObject({
      kind: 'no-action',
      reason: 'not-unambiguous',
    });
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
