import { describe, expect, it } from 'vitest';
import type { DistillStore, ThoughtBlock } from '../model';
import { extractBlockSignals, searchBlocks } from '../model';
import {
  assignProject,
  extractPeople,
  getPeopleIndex,
  getRelatedBlocks,
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
