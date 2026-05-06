import { invoke } from '@tauri-apps/api/core';
import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater';
import type { GraphSnapshot } from './graph';
import { DistillStore, initialStore, SearchResult, searchBlocks } from './model';

const STORE_KEY = 'distill.store.v1';
const AUTO_BACKUP_KEY = 'distill.backup.latest.v1';

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

export type StorageInfo = {
  mode: 'sqlite' | 'browser';
  path: string;
  backupPath?: string;
};

export type AppUpdateInfo = {
  version: string;
  date?: string;
  body?: string;
};

let pendingUpdate: Update | null = null;

function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean((window as TauriWindow).__TAURI_INTERNALS__);
}

export function isDesktopRuntime() {
  return isTauriRuntime();
}

function parseStore(value: string | null): DistillStore {
  if (!value) {
    return initialStore;
  }

  try {
    return JSON.parse(value) as DistillStore;
  } catch {
    return initialStore;
  }
}

function loadLocalStore(): DistillStore {
  const stored = localStorage.getItem(STORE_KEY);
  return parseStore(stored);
}

export async function loadStore(): Promise<DistillStore> {
  if (isTauriRuntime()) {
    try {
      const stored = await invoke<string | null>('load_store_json');
      return parseStore(stored);
    } catch (error) {
      console.warn('Falling back to local store after Tauri load failed.', error);
    }
  }

  return loadLocalStore();
}

export async function saveStore(store: DistillStore) {
  const value = JSON.stringify(store);

  if (isTauriRuntime()) {
    try {
      await invoke('save_store_json', { value });
      return;
    } catch (error) {
      console.warn('Falling back to local store after Tauri save failed.', error);
    }
  }

  localStorage.setItem(STORE_KEY, value);
  localStorage.setItem(AUTO_BACKUP_KEY, value);
}

export async function searchStore(store: DistillStore, query: string): Promise<SearchResult[]> {
  if (isTauriRuntime()) {
    try {
      const results = await invoke<string>('search_blocks_json', { query });
      return JSON.parse(results) as SearchResult[];
    } catch (error) {
      console.warn('Falling back to in-memory search after Tauri search failed.', error);
    }
  }

  return searchBlocks(store.blocks, query);
}

export async function loadGraph(): Promise<GraphSnapshot | null> {
  if (!isTauriRuntime()) {
    return null;
  }

  try {
    const graph = await invoke<string>('load_graph_json');
    return JSON.parse(graph) as GraphSnapshot;
  } catch (error) {
    console.warn('Falling back to inferred graph after Tauri graph load failed.', error);
    return null;
  }
}

export async function loadStorageInfo(): Promise<StorageInfo> {
  if (isTauriRuntime()) {
    try {
      const value = await invoke<string>('load_storage_info_json');
      return JSON.parse(value) as StorageInfo;
    } catch (error) {
      console.warn('Falling back to browser storage info after Tauri storage info failed.', error);
    }
  }

  return {
    mode: 'browser',
    path: `localStorage:${STORE_KEY}`,
    backupPath: `localStorage:${AUTO_BACKUP_KEY}`,
  };
}

export async function startUpdateInstaller(installerPath: string): Promise<void> {
  if (isTauriRuntime()) {
    await invoke('start_update_installer', { installerPath });
    return;
  }

  throw new Error('Desktop app is required to launch an installer.');
}

export async function checkForAppUpdate(): Promise<AppUpdateInfo | null> {
  if (!isTauriRuntime()) {
    throw new Error('Desktop app is required to check for updates.');
  }

  pendingUpdate = await check({ timeout: 30000 });

  if (!pendingUpdate) {
    return null;
  }

  return {
    version: pendingUpdate.version,
    date: pendingUpdate.date,
    body: pendingUpdate.body,
  };
}

export async function installPendingAppUpdate(onEvent: (event: DownloadEvent) => void): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error('Desktop app is required to install updates.');
  }

  if (!pendingUpdate) {
    pendingUpdate = await check({ timeout: 30000 });
  }

  if (!pendingUpdate) {
    throw new Error('No update is available.');
  }

  await pendingUpdate.downloadAndInstall(onEvent);
  pendingUpdate = null;
}
