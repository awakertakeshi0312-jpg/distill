import { DistillStore, initialStore } from './model';

const STORE_KEY = 'distill.store.v1';

export function loadStore(): DistillStore {
  const stored = localStorage.getItem(STORE_KEY);

  if (!stored) {
    return initialStore;
  }

  try {
    return JSON.parse(stored) as DistillStore;
  } catch {
    return initialStore;
  }
}

export function saveStore(store: DistillStore) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

