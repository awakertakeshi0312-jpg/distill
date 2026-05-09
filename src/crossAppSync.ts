import type { CrossAppHandoff } from './crossAppHandoff';
import type { DistillStore, ThoughtBlock } from './model';

export const CROSS_APP_SYNC_VERSION = 1;

export type AiSecretarySyncMessage =
  | {
      type: 'ai-secretary.sync.hello';
      version: 1;
      requestId: string;
      sentAt: string;
    }
  | {
      type: 'ai-secretary.sync.handoff';
      version: 1;
      requestId: string;
      sentAt: string;
      autoImport: boolean;
      handoff: CrossAppHandoff;
    }
  | {
      type: 'ai-secretary.sync.snapshot.request';
      version: 1;
      requestId: string;
      sentAt: string;
    }
  | {
      type: 'ai-secretary.sync.unlock';
      version: 1;
      requestId: string;
      sentAt: string;
      passphrase: string;
      sendSnapshotAfterUnlock: boolean;
    }
  | {
      type: 'ai-secretary.sync.vault-export.request';
      version: 1;
      requestId: string;
      sentAt: string;
    };

export type DistillSyncAck = {
  type: 'distill.sync.ack';
  version: 1;
  requestId: string;
  handoffId?: string;
  status: 'ready' | 'imported' | 'duplicate' | 'blocked' | 'error';
  detail: string;
  sentAt: string;
};

export type DistillSyncDecision = {
  id: string;
  sourceId: string;
  sourceTitle: string;
  decision: string;
  reason: string;
  goalImpact: number;
  appliedToGoalCompass: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DistillSyncSnapshot = {
  type: 'distill.sync.snapshot';
  version: 1;
  requestId?: string;
  source: 'distill';
  sentAt: string;
  summary: {
    totalBlocks: number;
    openBlocks: number;
    processedBlocks: number;
    archivedBlocks: number;
    projectCount: number;
    latestUpdatedAt: string | null;
  };
  decisions: DistillSyncDecision[];
};

export type DistillSyncVaultExport = {
  type: 'distill.sync.vault-export';
  version: 1;
  requestId: string;
  source: 'distill';
  sentAt: string;
  encryptedVault: string | null;
  summary: DistillSyncSnapshot['summary'];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeKind(value: unknown): CrossAppHandoff['kind'] {
  return value === 'weekly_review' || value === 'manual' ? value : 'today';
}

function normalizeHandoff(value: unknown): CrossAppHandoff | null {
  if (!isObject(value)) return null;
  const markdown = text(value.markdown, 80_000);
  if (value.type !== 'distill.url-handoff' || value.version !== 1 || value.source !== 'ai-secretary' || !markdown) {
    return null;
  }

  return {
    type: 'distill.url-handoff',
    version: 1,
    source: 'ai-secretary',
    kind: normalizeKind(value.kind),
    id: text(value.id, 160) || `handoff-${Date.now()}`,
    title: text(value.title, 240) || 'AI Secretary handoff',
    markdown,
    createdAt: text(value.createdAt, 80) || new Date().toISOString(),
    returnUrl: text(value.returnUrl, 500) || undefined,
  };
}

export function parseAiSecretarySyncMessage(data: unknown): AiSecretarySyncMessage | null {
  if (!isObject(data) || data.version !== CROSS_APP_SYNC_VERSION) return null;
  const requestId = text(data.requestId, 160) || `sync-${Date.now()}`;
  const sentAt = text(data.sentAt, 80) || new Date().toISOString();

  if (data.type === 'ai-secretary.sync.hello') {
    return {
      type: 'ai-secretary.sync.hello',
      version: 1,
      requestId,
      sentAt,
    };
  }

  if (data.type === 'ai-secretary.sync.snapshot.request') {
    return {
      type: 'ai-secretary.sync.snapshot.request',
      version: 1,
      requestId,
      sentAt,
    };
  }

  if (data.type === 'ai-secretary.sync.unlock') {
    const passphrase = text(data.passphrase, 2_000);
    if (!passphrase) return null;
    return {
      type: 'ai-secretary.sync.unlock',
      version: 1,
      requestId,
      sentAt,
      passphrase,
      sendSnapshotAfterUnlock: data.sendSnapshotAfterUnlock !== false,
    };
  }

  if (data.type === 'ai-secretary.sync.vault-export.request') {
    return {
      type: 'ai-secretary.sync.vault-export.request',
      version: 1,
      requestId,
      sentAt,
    };
  }

  if (data.type === 'ai-secretary.sync.handoff') {
    const handoff = normalizeHandoff(data.handoff);
    if (!handoff) return null;
    return {
      type: 'ai-secretary.sync.handoff',
      version: 1,
      requestId,
      sentAt,
      autoImport: data.autoImport !== false,
      handoff,
    };
  }

  return null;
}

export function buildDistillSyncAck(input: Omit<DistillSyncAck, 'type' | 'version' | 'sentAt'>): DistillSyncAck {
  return {
    type: 'distill.sync.ack',
    version: 1,
    sentAt: new Date().toISOString(),
    ...input,
  };
}

function firstMeaningfulLine(content: string) {
  return (
    content
      .split(/\r?\n/)
      .map((line) =>
        line
          .replace(/^#+\s*/, '')
          .replace(/<!--.*?-->/g, '')
          .replace(/#\S+/g, '')
          .replace(/\[\[([^\]]+)\]\]/g, '$1')
          .trim(),
      )
      .find(Boolean)
      ?.slice(0, 500) || 'Distill decision'
  );
}

function isAiSecretaryDecisionBlock(block: ThoughtBlock) {
  if (block.state !== 'processed' && block.state !== 'linked') return false;
  const content = block.content.toLowerCase();
  const links = block.links.map((link) => link.toLowerCase());
  const tags = block.tags.map((tag) => tag.toLowerCase());
  return (
    content.includes('#ai-secretary') ||
    content.includes('ai secretary') ||
    links.includes('ai secretary') ||
    links.includes('distill handoff') ||
    tags.includes('ai-secretary') ||
    tags.includes('decision')
  );
}

function decisionRecord(block: ThoughtBlock): DistillSyncDecision {
  const decision = firstMeaningfulLine(block.content);
  return {
    id: `distill-${block.id}`,
    sourceId: block.id,
    sourceTitle: decision,
    decision,
    reason: 'Distill synced processed block',
    goalImpact: block.tags.includes('goal') || block.links.includes('Goal Compass') ? 5 : 3,
    appliedToGoalCompass: false,
    createdAt: block.capturedAt,
    updatedAt: block.updatedAt || block.capturedAt,
  };
}

export function buildDistillSyncSnapshot(store: DistillStore, requestId?: string): DistillSyncSnapshot {
  const latestUpdatedAt =
    store.blocks
      .map((block) => block.updatedAt || block.capturedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

  return {
    type: 'distill.sync.snapshot',
    version: 1,
    requestId,
    source: 'distill',
    sentAt: new Date().toISOString(),
    summary: {
      totalBlocks: store.blocks.length,
      openBlocks: store.blocks.filter((block) => block.state === 'open').length,
      processedBlocks: store.blocks.filter((block) => block.state === 'processed' || block.state === 'linked').length,
      archivedBlocks: store.blocks.filter((block) => block.state === 'archived').length,
      projectCount: store.projects.length,
      latestUpdatedAt,
    },
    decisions: store.blocks
      .filter(isAiSecretaryDecisionBlock)
      .sort((first, second) => (second.updatedAt || second.capturedAt).localeCompare(first.updatedAt || first.capturedAt))
      .slice(0, 24)
      .map(decisionRecord),
  };
}

export function buildDistillSyncVaultExport(
  store: DistillStore,
  encryptedVault: string | null,
  requestId: string,
): DistillSyncVaultExport {
  const snapshot = buildDistillSyncSnapshot(store, requestId);
  return {
    type: 'distill.sync.vault-export',
    version: 1,
    requestId,
    source: 'distill',
    sentAt: new Date().toISOString(),
    encryptedVault,
    summary: snapshot.summary,
  };
}
