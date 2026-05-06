import { invoke } from '@tauri-apps/api/core';
import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater';
import type { GraphSnapshot } from './graph';
import { DistillStore, SearchResult, searchBlocks } from './model';

const STORE_KEY = 'distill.store.v1';
const AUTO_BACKUP_KEY = 'distill.backup.latest.v1';
const VAULT_KEY = 'distill.vault.v1';

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

export type StorageInfo = {
  mode: 'encrypted-vault' | 'browser';
  path: string;
  backupPath?: string;
};

export type AppUpdateInfo = {
  version: string;
  date?: string;
  body?: string;
};

export type SyncFolderPacketFile = {
  fileName: string;
  path: string;
  bytes: number;
  modifiedAt: string;
};

let pendingUpdate: Update | null = null;

function isTauriRuntime() {
  return typeof window !== 'undefined' && Boolean((window as TauriWindow).__TAURI_INTERNALS__);
}

export function isDesktopRuntime() {
  return isTauriRuntime();
}

function parseLegacyStore(value: string | null): DistillStore | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as DistillStore;
  } catch {
    return null;
  }
}

export async function loadEncryptedVault(): Promise<string | null> {
  if (isTauriRuntime()) {
    try {
      return await invoke<string | null>('load_vault_json');
    } catch (error) {
      console.warn('Falling back to browser vault after Tauri vault load failed.', error);
    }
  }

  return localStorage.getItem(VAULT_KEY);
}

export async function saveEncryptedVault(value: string): Promise<void> {
  if (isTauriRuntime()) {
    await invoke('save_vault_json', { value });
    return;
  }

  localStorage.setItem(VAULT_KEY, value);
}

export async function loadLegacyPlainStore(): Promise<DistillStore | null> {
  if (isTauriRuntime()) {
    try {
      const stored = await invoke<string | null>('load_store_json');
      return parseLegacyStore(stored);
    } catch (error) {
      console.warn('Falling back to browser legacy store after Tauri legacy load failed.', error);
    }
  }

  return parseLegacyStore(localStorage.getItem(STORE_KEY));
}

export async function clearLegacyPlainStore(): Promise<void> {
  if (isTauriRuntime()) {
    try {
      await invoke('clear_plain_store');
      return;
    } catch (error) {
      console.warn('Falling back to browser legacy clear after Tauri legacy clear failed.', error);
    }
  }

  localStorage.removeItem(STORE_KEY);
  localStorage.removeItem(AUTO_BACKUP_KEY);
}

export async function searchStore(store: DistillStore, query: string): Promise<SearchResult[]> {
  // The unlocked vault lives in memory. Searching the plaintext SQLite mirror would
  // reintroduce decrypted note content at rest, so retrieval runs against memory.
  return searchBlocks(store.blocks, query);
}

export async function loadGraph(): Promise<GraphSnapshot | null> {
  // Graphs are inferred from the decrypted in-memory store for the same reason as
  // search: no active plaintext index should be required after vault unlock.
  return null;
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
    path: `localStorage:${VAULT_KEY}`,
    backupPath: 'encrypted browser vault',
  };
}

export async function startUpdateInstaller(installerPath: string): Promise<void> {
  if (isTauriRuntime()) {
    await invoke('start_update_installer', { installerPath });
    return;
  }

  throw new Error('Desktop app is required to launch an installer.');
}

export async function writeEncryptedSyncPacketFile(
  folderPath: string,
  fileName: string,
  packetJson: string,
): Promise<string> {
  if (isTauriRuntime()) {
    return await invoke<string>('write_encrypted_sync_packet_file', { folderPath, fileName, packetJson });
  }

  throw new Error('Desktop app is required to use a sync folder.');
}

export async function listEncryptedSyncPacketFiles(folderPath: string): Promise<SyncFolderPacketFile[]> {
  if (isTauriRuntime()) {
    const value = await invoke<string>('list_encrypted_sync_packet_files', { folderPath });
    return JSON.parse(value) as SyncFolderPacketFile[];
  }

  throw new Error('Desktop app is required to use a sync folder.');
}

export async function readEncryptedSyncPacketFile(filePath: string): Promise<string> {
  if (isTauriRuntime()) {
    return await invoke<string>('read_encrypted_sync_packet_file', { filePath });
  }

  throw new Error('Desktop app is required to use a sync folder.');
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
