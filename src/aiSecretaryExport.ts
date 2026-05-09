import type { DistillStore } from './model';

const AI_SECRETARY_IMPORT_PARAM = 'distillImportB64';

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

export function encodeAiSecretaryImportPayload(store: DistillStore) {
  const payload = JSON.stringify({
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    projects: store.projects,
    blocks: store.blocks,
    sync: store.sync,
  });

  return bytesToBase64Url(new TextEncoder().encode(payload));
}

export function buildAiSecretaryImportUrl(aiSecretaryUrl: string, store: DistillStore) {
  const url = new URL(aiSecretaryUrl);
  url.searchParams.set('tab', 'drafts');
  url.hash = `${AI_SECRETARY_IMPORT_PARAM}=${encodeAiSecretaryImportPayload(store)}`;

  return url.toString();
}
