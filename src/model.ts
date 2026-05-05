export type BlockState = 'open' | 'linked' | 'processed';

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

export type SearchResult = {
  block: ThoughtBlock;
  score: number;
  reason: string;
};

export type DistillStore = {
  blocks: ThoughtBlock[];
  projects: Project[];
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
};

export function createBlock(content: string): ThoughtBlock {
  const timestamp = new Date().toISOString();
  const tags = Array.from(content.matchAll(/#([a-zA-Z0-9-]+)/g)).map((match) => match[1]);
  const links = Array.from(content.matchAll(/\[\[([^\]]+)\]\]/g)).map((match) => match[1]);

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

export function formatBlockMeta(block: ThoughtBlock, projects: Project[]) {
  const project = projects.find((item) => item.id === block.projectId);
  const date = new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(block.capturedAt));

  return [date, project?.name ?? 'Inbox'].join(' - ');
}

export function searchBlocks(blocks: ThoughtBlock[], query: string): SearchResult[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter(Boolean);

  if (terms.length === 0) {
    return blocks.slice(0, 5).map((block) => ({
      block,
      score: 1,
      reason: 'Recent capture',
    }));
  }

  return blocks
    .map((block) => {
      const haystack = [block.content, ...block.tags, ...block.links].join(' ').toLowerCase();
      const exactHits = terms.filter((term) => haystack.includes(term)).length;
      const tagHits = terms.filter((term) => block.tags.some((tag) => tag.includes(term))).length;
      const linkHits = terms.filter((term) => block.links.some((link) => link.toLowerCase().includes(term))).length;
      const score = exactHits * 3 + tagHits * 2 + linkHits * 2;

      if (score === 0) {
        return null;
      }

      const reason = [
        exactHits > 0 ? 'Text match' : null,
        tagHits > 0 ? 'Tag match' : null,
        linkHits > 0 ? 'Linked context' : null,
      ]
        .filter(Boolean)
        .join(' - ');

      return { block, score, reason };
    })
    .filter((result): result is SearchResult => result !== null)
    .sort((a, b) => b.score - a.score);
}

