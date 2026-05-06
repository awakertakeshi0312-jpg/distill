export const DEVICE_IDENTITY_KEY = 'distill.device.v1';

export type DeviceIdentity = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

function fallbackDeviceName() {
  const platform = typeof navigator === 'undefined' ? '' : navigator.platform || '';
  const isWindows = /win/i.test(platform);

  return isWindows ? 'Windows device' : 'Distill device';
}

function isDeviceIdentity(value: unknown): value is DeviceIdentity {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const identity = value as DeviceIdentity;

  return (
    typeof identity.id === 'string' &&
    identity.id.length > 0 &&
    typeof identity.name === 'string' &&
    identity.name.length > 0 &&
    typeof identity.createdAt === 'string' &&
    typeof identity.updatedAt === 'string'
  );
}

function createDeviceIdentity(name = fallbackDeviceName()): DeviceIdentity {
  const timestamp = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    name,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function readDeviceIdentity(): DeviceIdentity | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const parsed = JSON.parse(localStorage.getItem(DEVICE_IDENTITY_KEY) ?? 'null');
    return isDeviceIdentity(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDeviceIdentity(identity: DeviceIdentity) {
  localStorage.setItem(DEVICE_IDENTITY_KEY, JSON.stringify(identity));
}

export function getOrCreateDeviceIdentity() {
  const existing = readDeviceIdentity();

  if (existing) {
    return existing;
  }

  const created = createDeviceIdentity();
  saveDeviceIdentity(created);
  return created;
}

export function renameDeviceIdentity(identity: DeviceIdentity, name: string) {
  const trimmedName = name.trim() || fallbackDeviceName();
  const next = {
    ...identity,
    name: trimmedName,
    updatedAt: new Date().toISOString(),
  };

  saveDeviceIdentity(next);
  return next;
}
