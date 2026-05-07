export const DEFAULT_VAULT_AUTO_LOCK_MINUTES = 15;
export const MAX_VAULT_AUTO_LOCK_MINUTES = 240;

export function normalizeVaultAutoLockMinutes(
  value: number,
  fallback = DEFAULT_VAULT_AUTO_LOCK_MINUTES,
) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  if (value <= 0) {
    return 0;
  }

  return Math.min(MAX_VAULT_AUTO_LOCK_MINUTES, Math.max(1, Math.round(value)));
}

export function isVaultAutoLockExpired(
  lastActivityAt: number,
  autoLockMinutes: number,
  now = Date.now(),
) {
  if (autoLockMinutes <= 0) {
    return false;
  }

  return now - lastActivityAt >= autoLockMinutes * 60 * 1000;
}
