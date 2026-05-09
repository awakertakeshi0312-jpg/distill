import packageInfo from '../package.json';

export const APP_VERSION = packageInfo.version;
export const PUBLIC_WEB_URL = 'https://awakertakeshi0312-jpg.github.io/distill/';
const DEFAULT_AI_SECRETARY_URL = 'https://ai-secretary.takeshi-notes.com/';

function normalizePublicRootUrl(value: string) {
  const trimmed = value.trim();
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

export const PUBLIC_AI_SECRETARY_URL = DEFAULT_AI_SECRETARY_URL;
export const AI_SECRETARY_URL = normalizePublicRootUrl(
  (import.meta.env.VITE_AI_SECRETARY_URL as string | undefined)?.trim() || DEFAULT_AI_SECRETARY_URL,
);
export const UPDATE_FEED_URL = 'https://github.com/awakertakeshi0312-jpg/distill/releases/latest/download/latest.json';
export const LATEST_RELEASE_URL = 'https://github.com/awakertakeshi0312-jpg/distill/releases/latest';
