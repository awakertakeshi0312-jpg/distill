import type { DistillStore, ThoughtBlock } from './model';

const DEFAULT_PERSONAL_KM_REVIEW_URL = 'http://localhost:3001/api/review';

export type PersonalKmHandoffItem = {
  title: string;
  body: string;
  source_refs: string[];
  tags: string[];
  status: 'new';
};

export type PersonalKmHandoffResult = {
  submitted: number;
  skipped: number;
  endpoint: string;
};

function personalKmReviewUrl() {
  return (import.meta.env.VITE_PERSONAL_KM_REVIEW_URL as string | undefined) || DEFAULT_PERSONAL_KM_REVIEW_URL;
}

function reviewedBlocks(store: DistillStore) {
  return store.blocks
    .filter((block) => block.state === 'processed')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function handoffBody(block: ThoughtBlock, store: DistillStore) {
  const project = store.projects.find((item) => item.id === block.projectId);
  return [
    'Distill reviewed block handoff',
    '',
    `Block ID: ${block.id}`,
    `Note ID: ${block.noteId}`,
    `State: ${block.state}`,
    `Project ID: ${project?.id || 'inbox'}`,
    `Tag count: ${block.tags.length}`,
    `Link count: ${block.links.length}`,
    `Content length: ${block.content.length}`,
    `Captured at: ${block.capturedAt}`,
    `Updated at: ${block.updatedAt}`,
    '',
    'Privacy: summary_only_no_note_body',
  ].join('\n');
}

export function buildPersonalKmHandoffItems(store: DistillStore, limit = 25): PersonalKmHandoffItem[] {
  return reviewedBlocks(store).slice(0, limit).map((block) => ({
    title: `Distill reviewed block ${block.id.slice(0, 8)}`,
    body: handoffBody(block, store),
    source_refs: [
      `distill:block:${block.id}`,
      `distill:note:${block.noteId}`,
      block.projectId ? `distill:project:${block.projectId}` : 'distill:project:inbox',
    ],
    tags: ['distill', 'reviewed', 'summary-only'],
    status: 'new',
  }));
}

export async function sendPersonalKmHandoff(store: DistillStore): Promise<PersonalKmHandoffResult> {
  const endpoint = personalKmReviewUrl();
  const items = buildPersonalKmHandoffItems(store);
  if (items.length === 0) {
    return { submitted: 0, skipped: 0, endpoint };
  }

  let submitted = 0;
  for (const item of items) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(item),
    });

    if (!response.ok) {
      throw new Error(`Personal KM handoff failed: HTTP ${response.status}`);
    }
    submitted += 1;
  }

  return {
    submitted,
    skipped: Math.max(0, reviewedBlocks(store).length - items.length),
    endpoint,
  };
}
