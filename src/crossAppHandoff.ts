export type CrossAppHandoffSource = 'ai-secretary';

export type CrossAppHandoff = {
  type: 'distill.url-handoff';
  version: 1;
  source: CrossAppHandoffSource;
  kind: 'today' | 'weekly_review' | 'manual';
  id: string;
  title: string;
  markdown: string;
  createdAt: string;
  returnUrl?: string;
};

const HANDOFF_PARAM = 'handoff';
const MAX_HANDOFF_MARKDOWN_CHARS = 80_000;

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}

function normalizeString(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeKind(value: unknown): CrossAppHandoff['kind'] {
  return value === 'weekly_review' || value === 'manual' ? value : 'today';
}

export function encodeCrossAppHandoff(handoff: CrossAppHandoff) {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify(handoff)));
}

export function decodeCrossAppHandoff(encoded: string): CrossAppHandoff | null {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(base64UrlToBytes(encoded)));

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    const value = parsed as Partial<CrossAppHandoff>;
    const markdown = normalizeString(value.markdown, MAX_HANDOFF_MARKDOWN_CHARS);

    if (value.type !== 'distill.url-handoff' || value.version !== 1 || value.source !== 'ai-secretary' || !markdown) {
      return null;
    }

    return {
      type: 'distill.url-handoff',
      version: 1,
      source: 'ai-secretary',
      kind: normalizeKind(value.kind),
      id: normalizeString(value.id, 160) || `handoff-${Date.now()}`,
      title: normalizeString(value.title, 240) || 'AI Secretary handoff',
      markdown,
      createdAt: normalizeString(value.createdAt, 80) || new Date().toISOString(),
      returnUrl: normalizeString(value.returnUrl, 500) || undefined,
    };
  } catch {
    return null;
  }
}

export function readCrossAppHandoffFromLocation(location: Location = window.location) {
  const url = new URL(location.href);
  const fromSearch = url.searchParams.get(HANDOFF_PARAM);

  if (fromSearch) {
    return decodeCrossAppHandoff(fromSearch);
  }

  const hash = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  const hashParams = new URLSearchParams(hash.includes('=') ? hash : '');
  const fromHash = hashParams.get(HANDOFF_PARAM);

  return fromHash ? decodeCrossAppHandoff(fromHash) : null;
}

export function clearCrossAppHandoffFromUrl(nextHash = 'inbox') {
  const url = new URL(window.location.href);
  url.searchParams.delete(HANDOFF_PARAM);

  if (url.hash.includes(`${HANDOFF_PARAM}=`)) {
    url.hash = nextHash;
  }

  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash || `#${nextHash}`}`);
}
