import {
  extractBlockSignals,
  normalizeDistillStore,
  type BlockState,
  type DistillStore,
  type Project,
  type ThoughtBlock,
} from './model';

type ImportEnvelope = Partial<DistillStore> & {
  exportedAt?: string;
  schemaVersion?: number;
};

type ImportedThoughtBlock = Omit<ThoughtBlock, 'projectId'> & {
  projectId?: string | null;
};

const blockStates = new Set<BlockState>(['open', 'linked', 'processed', 'archived']);
const projectStatuses = new Set<Project['status']>(['Active', 'Design', 'Next']);

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isProject(value: unknown): value is Project {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const project = value as Project;
  return (
    typeof project.id === 'string' &&
    typeof project.name === 'string' &&
    typeof project.signal === 'string' &&
    projectStatuses.has(project.status)
  );
}

function isThoughtBlock(value: unknown): value is ImportedThoughtBlock {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const block = value as ImportedThoughtBlock;
  return (
    typeof block.id === 'string' &&
    typeof block.content === 'string' &&
    typeof block.noteId === 'string' &&
    (typeof block.projectId === 'undefined' || block.projectId === null || typeof block.projectId === 'string') &&
    typeof block.capturedAt === 'string' &&
    typeof block.updatedAt === 'string' &&
    isStringArray(block.tags) &&
    isStringArray(block.links) &&
    blockStates.has(block.state)
  );
}

function normalizeImportedBlock(block: ImportedThoughtBlock): ThoughtBlock {
  if (block.projectId === null) {
    const { projectId: _projectId, ...rest } = block;
    return rest;
  }

  return block as ThoughtBlock;
}

export function parseDistillImport(json: string): DistillStore {
  const parsed = JSON.parse(json) as ImportEnvelope;

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.blocks) || !Array.isArray(parsed.projects)) {
    throw new Error('JSON must contain blocks and projects arrays.');
  }

  if (!parsed.blocks.every(isThoughtBlock)) {
    throw new Error('One or more blocks do not match the Distill store schema.');
  }

  if (!parsed.projects.every(isProject)) {
    throw new Error('One or more projects do not match the Distill store schema.');
  }

  const blocks = parsed.blocks.map(normalizeImportedBlock);

  return {
    blocks,
    projects: parsed.projects,
    sync: normalizeDistillStore({ ...parsed, blocks } as DistillStore).sync,
  };
}

export function createMarkdownImport(markdown: string): DistillStore {
  const lines = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const title = lines.find((line) => line.startsWith('# '))?.replace(/^#\s+/, '').trim() || 'Imported Markdown';
  const timestamp = new Date().toISOString();
  const project: Project = {
    id: crypto.randomUUID(),
    name: title,
    signal: 'Imported from Markdown',
    status: 'Active',
  };

  const blocks = lines
    .filter((line) => /^[-*]\s+/.test(line) && !/^[-*]\s+(id|state|tags|links|context):/i.test(line))
    .map((line): ThoughtBlock => {
      const content = line.replace(/^[-*]\s+/, '').trim();
      const { tags, links } = extractBlockSignals(content);

      return {
        id: crypto.randomUUID(),
        content,
        noteId: `daily-${timestamp.slice(0, 10)}`,
        projectId: project.id,
        capturedAt: timestamp,
        updatedAt: timestamp,
        tags,
        links,
        state: links.length > 0 ? 'linked' : 'open',
      };
    });

  if (blocks.length === 0) {
    throw new Error('Markdown import did not contain any bullet blocks.');
  }

  return {
    projects: [project],
    blocks,
    sync: {
      tombstones: [],
      devices: [],
      revokedDevices: [],
    },
  };
}
