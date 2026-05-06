import { invoke } from '@tauri-apps/api/core';
import type { DistillStore, ThoughtBlock } from './model';
import { isDesktopRuntime } from './storage';

const WORK_PACKET_ID = 'wp_20260506_wire-distill-real-app-events_93d72238';

type OrgEventType = 'memory.save_requested' | 'decision.created' | 'artifact.ready';

type OrgEventInput = {
  eventType: OrgEventType;
  summary: string;
  payload?: Record<string, unknown>;
  workPacketId?: string;
};

function summarizeBlock(block: ThoughtBlock) {
  return {
    block_id: block.id,
    note_id: block.noteId,
    state: block.state,
    project_id: block.projectId ?? null,
    tag_count: block.tags.length,
    link_count: block.links.length,
    content_length: block.content.length,
    captured_at: block.capturedAt,
    updated_at: block.updatedAt,
  };
}

async function emitAiOrgEvent(input: OrgEventInput) {
  if (!isDesktopRuntime()) {
    return { ok: false, skipped: 'browser-runtime' };
  }

  const payload = {
    ...(input.payload ?? {}),
    privacy: 'summary_only_no_note_body',
  };

  try {
    await invoke('emit_ai_org_event', {
      event: {
        eventType: input.eventType,
        summary: input.summary,
        payload,
        workPacketId: input.workPacketId ?? WORK_PACKET_ID,
        timestamp: new Date().toISOString(),
      },
    });
    return { ok: true };
  } catch (error) {
    console.warn('Failed to emit Distill AI Org event.', error);
    return { ok: false, error };
  }
}

export function emitCaptureSaved(block: ThoughtBlock, store: DistillStore) {
  return emitAiOrgEvent({
    eventType: 'memory.save_requested',
    summary: 'Distill capture saved',
    payload: {
      block: summarizeBlock(block),
      block_count: store.blocks.length,
      project_count: store.projects.length,
    },
  });
}

export function emitReviewDecision(block: ThoughtBlock, store: DistillStore) {
  return emitAiOrgEvent({
    eventType: 'decision.created',
    summary: 'Distill review item marked processed',
    payload: {
      decision_kind: 'review_processed',
      block: summarizeBlock(block),
      block_count: store.blocks.length,
      project_count: store.projects.length,
    },
  });
}

export function emitExportArtifact(kind: 'markdown' | 'json' | 'backup-json', store: DistillStore) {
  return emitAiOrgEvent({
    eventType: 'artifact.ready',
    summary: `Distill ${kind} export generated`,
    payload: {
      artifact_kind: kind,
      block_count: store.blocks.length,
      project_count: store.projects.length,
      export_channel: 'user_download',
    },
  });
}
