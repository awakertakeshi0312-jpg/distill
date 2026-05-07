export const BROWSER_VAULT_DB_NAME = 'distill-browser-vault';
export const BROWSER_VAULT_DB_VERSION = 1;
export const BROWSER_VAULT_STORE_NAME = 'vaults';

export type BrowserVaultBackend = 'indexeddb' | 'localStorage';

export type BrowserVaultStorageInfo = {
  backend: BrowserVaultBackend;
  path: string;
  backupPath: string;
};

function getBrowserLocalStorage(): Storage {
  if (typeof localStorage === 'undefined') {
    throw new Error('Browser localStorage is not available.');
  }

  return localStorage;
}

export function isBrowserIndexedDbSupported() {
  return typeof indexedDB !== 'undefined';
}

export function browserVaultPath(key: string, backend: BrowserVaultBackend) {
  return backend === 'indexeddb'
    ? `indexedDB:${BROWSER_VAULT_DB_NAME}/${BROWSER_VAULT_STORE_NAME}/${key}`
    : `localStorage:${key}`;
}

export function getBrowserVaultStorageInfo(
  key: string,
  indexedDbSupported = isBrowserIndexedDbSupported(),
): BrowserVaultStorageInfo {
  const backend = indexedDbSupported ? 'indexeddb' : 'localStorage';

  return {
    backend,
    path: browserVaultPath(key, backend),
    backupPath:
      backend === 'indexeddb'
        ? 'encrypted browser vault in IndexedDB'
        : 'encrypted browser vault in localStorage fallback',
  };
}

function openBrowserVaultDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(BROWSER_VAULT_DB_NAME, BROWSER_VAULT_DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(BROWSER_VAULT_STORE_NAME)) {
        database.createObjectStore(BROWSER_VAULT_STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB vault store.'));
    request.onblocked = () => reject(new Error('IndexedDB vault store upgrade is blocked by another tab.'));
  });
}

async function readIndexedDbValue(key: string): Promise<string | null> {
  const database = await openBrowserVaultDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(BROWSER_VAULT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(BROWSER_VAULT_STORE_NAME);
    const request = store.get(key);

    request.onsuccess = () => resolve(typeof request.result === 'string' ? request.result : null);
    request.onerror = () => reject(request.error ?? new Error('Could not read IndexedDB vault value.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB vault read transaction failed.'));
    transaction.oncomplete = () => database.close();
  });
}

async function writeIndexedDbValue(key: string, value: string): Promise<void> {
  const database = await openBrowserVaultDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(BROWSER_VAULT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(BROWSER_VAULT_STORE_NAME);
    const request = store.put(value, key);

    request.onerror = () => reject(request.error ?? new Error('Could not write IndexedDB vault value.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB vault write transaction failed.'));
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
  });
}

async function deleteIndexedDbValue(key: string): Promise<void> {
  const database = await openBrowserVaultDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(BROWSER_VAULT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(BROWSER_VAULT_STORE_NAME);
    const request = store.delete(key);

    request.onerror = () => reject(request.error ?? new Error('Could not delete IndexedDB vault value.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB vault delete transaction failed.'));
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
  });
}

export async function loadBrowserEncryptedValue(
  key: string,
  storage: Storage = getBrowserLocalStorage(),
): Promise<string | null> {
  if (!isBrowserIndexedDbSupported()) {
    return storage.getItem(key);
  }

  try {
    const indexedValue = await readIndexedDbValue(key);

    if (indexedValue) {
      return indexedValue;
    }

    const legacyValue = storage.getItem(key);

    if (!legacyValue) {
      return null;
    }

    await writeIndexedDbValue(key, legacyValue);
    storage.removeItem(key);
    return legacyValue;
  } catch (error) {
    console.warn('Falling back to localStorage after IndexedDB vault load failed.', error);
    return storage.getItem(key);
  }
}

export async function saveBrowserEncryptedValue(
  key: string,
  value: string,
  storage: Storage = getBrowserLocalStorage(),
): Promise<BrowserVaultBackend> {
  if (!isBrowserIndexedDbSupported()) {
    storage.setItem(key, value);
    return 'localStorage';
  }

  try {
    await writeIndexedDbValue(key, value);
    storage.removeItem(key);
    return 'indexeddb';
  } catch (error) {
    console.warn('Falling back to localStorage after IndexedDB vault save failed.', error);
    storage.setItem(key, value);
    return 'localStorage';
  }
}

export async function deleteBrowserEncryptedValue(
  key: string,
  storage: Storage = getBrowserLocalStorage(),
): Promise<void> {
  if (!isBrowserIndexedDbSupported()) {
    storage.removeItem(key);
    return;
  }

  try {
    await deleteIndexedDbValue(key);
    storage.removeItem(key);
  } catch (error) {
    console.warn('Falling back to localStorage after IndexedDB vault delete failed.', error);
    storage.removeItem(key);
  }
}
