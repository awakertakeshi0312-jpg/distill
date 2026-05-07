import {
  normalizeDistillStore,
  normalizeSyncMetadata,
  type DeletionTombstone,
  type DistillStore,
  type Project,
  type RevokedSyncDevice,
  type SyncDevice,
  type SyncKeyMaterial,
  type ThoughtBlock,
} from './model';
import { stableHash, stableStringify } from './sync';

export const VAULT_RECORD_LOG_SCHEMA_VERSION = 1;
export const VAULT_RECORD_LOG_TYPE = 'distill.encrypted-vault-record-log';
export const VAULT_RECORD_ENCRYPTED_PAYLOAD_TYPE = 'distill.encrypted-vault-record';

export type VaultRecordLogEntryKind =
  | 'project'
  | 'thought-block'
  | 'thought-block-deletion'
  | 'sync-device'
  | 'revoked-sync-device'
  | 'sync-key';

export type PlainVaultRecordLogEntry<TPayload = unknown> = {
  sequence: number;
  kind: VaultRecordLogEntryKind;
  id: string;
  revision: string;
  hash: string;
  payload: TPayload;
};

export type EncryptedVaultRecordLogEntry = Omit<PlainVaultRecordLogEntry, 'payload'> & {
  encrypted: {
    type: typeof VAULT_RECORD_ENCRYPTED_PAYLOAD_TYPE;
    value: string;
  };
};

export type EncryptedVaultRecordLog = {
  type: typeof VAULT_RECORD_LOG_TYPE;
  schemaVersion: typeof VAULT_RECORD_LOG_SCHEMA_VERSION;
  createdAt: string;
  sourceStoreHash: string;
  entries: EncryptedVaultRecordLogEntry[];
};

export type VaultRecordEncryptor = (
  plainJson: string,
  entry: PlainVaultRecordLogEntry,
) => Promise<string> | string;

export type VaultRecordDecryptor = (
  encryptedJson: string,
  entry: EncryptedVaultRecordLogEntry,
) => Promise<string> | string;

type PartialRecordLog = Partial<EncryptedVaultRecordLog>;

function cloneProject(project: Project): Project {
  return { ...project };
}

function cloneBlock(block: ThoughtBlock): ThoughtBlock {
  return {
    ...block,
    tags: [...block.tags],
    links: [...block.links],
  };
}

function cloneTombstone(tombstone: DeletionTombstone): DeletionTombstone {
  return { ...tombstone };
}

function cloneDevice(device: SyncDevice): SyncDevice {
  return { ...device };
}

function cloneRevokedDevice(device: RevokedSyncDevice): RevokedSyncDevice {
  return { ...device };
}

function cloneSyncKey(syncKey: SyncKeyMaterial): SyncKeyMaterial {
  return { ...syncKey };
}

function makeEntry<TPayload>(
  sequence: number,
  kind: VaultRecordLogEntryKind,
  id: string,
  revision: string,
  payload: TPayload,
): PlainVaultRecordLogEntry<TPayload> {
  return {
    sequence,
    kind,
    id,
    revision,
    hash: stableHash(payload),
    payload,
  };
}

function computeSourceStoreHash(store: DistillStore) {
  const normalized = normalizeDistillStore(store);

  return stableHash({
    projects: normalized.projects.map(cloneProject),
    blocks: normalized.blocks.map(cloneBlock),
    sync: normalizeSyncMetadata(normalized.sync),
  });
}

export function buildVaultRecordLogEntries(store: DistillStore): PlainVaultRecordLogEntry[] {
  const sync = normalizeSyncMetadata(store.sync);
  const pending: Omit<PlainVaultRecordLogEntry, 'sequence'>[] = [];

  for (const project of store.projects) {
    const payload = cloneProject(project);
    pending.push({
      kind: 'project',
      id: project.id,
      revision: stableHash(project),
      hash: stableHash(payload),
      payload,
    });
  }

  for (const block of store.blocks) {
    const payload = cloneBlock(block);
    pending.push({
      kind: 'thought-block',
      id: block.id,
      revision: block.updatedAt,
      hash: stableHash(payload),
      payload,
    });
  }

  for (const tombstone of sync.tombstones) {
    const payload = cloneTombstone(tombstone);
    pending.push({
      kind: 'thought-block-deletion',
      id: tombstone.id,
      revision: tombstone.deletedAt,
      hash: stableHash(payload),
      payload,
    });
  }

  for (const device of sync.devices) {
    const payload = cloneDevice(device);
    pending.push({
      kind: 'sync-device',
      id: device.id,
      revision: device.lastSeenAt,
      hash: stableHash(payload),
      payload,
    });
  }

  for (const device of sync.revokedDevices) {
    const payload = cloneRevokedDevice(device);
    pending.push({
      kind: 'revoked-sync-device',
      id: device.id,
      revision: device.revokedAt,
      hash: stableHash(payload),
      payload,
    });
  }

  if (sync.syncKey) {
    const payload = cloneSyncKey(sync.syncKey);
    pending.push({
      kind: 'sync-key',
      id: sync.syncKey.id,
      revision: sync.syncKey.createdAt,
      hash: stableHash(payload),
      payload,
    });
  }

  return pending.map((entry, index) => makeEntry(index + 1, entry.kind, entry.id, entry.revision, entry.payload));
}

export async function buildEncryptedVaultRecordLog(
  store: DistillStore,
  encryptRecord: VaultRecordEncryptor,
  options: { createdAt?: string } = {},
): Promise<EncryptedVaultRecordLog> {
  const entries = buildVaultRecordLogEntries(store);
  const encryptedEntries = await Promise.all(
    entries.map(async (entry): Promise<EncryptedVaultRecordLogEntry> => {
      const encrypted = await encryptRecord(stableStringify(entry.payload), entry);
      const { payload: _payload, ...metadata } = entry;

      return {
        ...metadata,
        encrypted: {
          type: VAULT_RECORD_ENCRYPTED_PAYLOAD_TYPE,
          value: encrypted,
        },
      };
    }),
  );

  return {
    type: VAULT_RECORD_LOG_TYPE,
    schemaVersion: VAULT_RECORD_LOG_SCHEMA_VERSION,
    createdAt: options.createdAt ?? new Date().toISOString(),
    sourceStoreHash: computeSourceStoreHash(store),
    entries: encryptedEntries,
  };
}

export function serializeEncryptedVaultRecordLog(log: EncryptedVaultRecordLog) {
  return JSON.stringify(log, null, 2);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function assertEncryptedEntry(value: unknown): asserts value is EncryptedVaultRecordLogEntry {
  if (!isRecord(value)) {
    throw new Error('Vault record log entry is not an object.');
  }

  if (
    typeof value.sequence !== 'number' ||
    !Number.isInteger(value.sequence) ||
    value.sequence < 1 ||
    typeof value.kind !== 'string' ||
    !['project', 'thought-block', 'thought-block-deletion', 'sync-device', 'revoked-sync-device', 'sync-key'].includes(
      value.kind,
    ) ||
    typeof value.id !== 'string' ||
    typeof value.revision !== 'string' ||
    typeof value.hash !== 'string' ||
    !isRecord(value.encrypted) ||
    value.encrypted.type !== VAULT_RECORD_ENCRYPTED_PAYLOAD_TYPE ||
    typeof value.encrypted.value !== 'string'
  ) {
    throw new Error('Vault record log entry is not supported.');
  }
}

export function parseEncryptedVaultRecordLog(serialized: string): EncryptedVaultRecordLog {
  const parsed = JSON.parse(serialized) as PartialRecordLog;

  if (
    parsed.type !== VAULT_RECORD_LOG_TYPE ||
    parsed.schemaVersion !== VAULT_RECORD_LOG_SCHEMA_VERSION ||
    typeof parsed.createdAt !== 'string' ||
    typeof parsed.sourceStoreHash !== 'string' ||
    !Array.isArray(parsed.entries)
  ) {
    throw new Error('Encrypted vault record log is not supported.');
  }

  const seenSequences = new Set<number>();
  const entries = parsed.entries.map((entry) => {
    assertEncryptedEntry(entry);

    if (seenSequences.has(entry.sequence)) {
      throw new Error('Encrypted vault record log has duplicate sequence numbers.');
    }

    seenSequences.add(entry.sequence);
    return entry;
  });

  return {
    type: parsed.type,
    schemaVersion: parsed.schemaVersion,
    createdAt: parsed.createdAt,
    sourceStoreHash: parsed.sourceStoreHash,
    entries,
  };
}

function assertProjectPayload(value: unknown): asserts value is Project {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.signal !== 'string' ||
    !['Active', 'Design', 'Next'].includes(String(value.status))
  ) {
    throw new Error('Vault record log project payload is invalid.');
  }
}

function assertThoughtBlockPayload(value: unknown): asserts value is ThoughtBlock {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.content !== 'string' ||
    typeof value.noteId !== 'string' ||
    typeof value.capturedAt !== 'string' ||
    typeof value.updatedAt !== 'string' ||
    !Array.isArray(value.tags) ||
    !value.tags.every((tag) => typeof tag === 'string') ||
    !Array.isArray(value.links) ||
    !value.links.every((link) => typeof link === 'string') ||
    !['open', 'linked', 'processed', 'archived'].includes(String(value.state)) ||
    (typeof value.projectId !== 'undefined' && typeof value.projectId !== 'string')
  ) {
    throw new Error('Vault record log thought-block payload is invalid.');
  }
}

function assertTombstonePayload(value: unknown): asserts value is DeletionTombstone {
  if (
    !isRecord(value) ||
    value.kind !== 'thought-block' ||
    typeof value.id !== 'string' ||
    typeof value.deletedAt !== 'string' ||
    (typeof value.deletedByDeviceId !== 'undefined' && typeof value.deletedByDeviceId !== 'string')
  ) {
    throw new Error('Vault record log deletion payload is invalid.');
  }
}

function assertSyncDevicePayload(value: unknown): asserts value is SyncDevice {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.firstSeenAt !== 'string' ||
    typeof value.lastSeenAt !== 'string' ||
    (typeof value.lastPacketAt !== 'undefined' && typeof value.lastPacketAt !== 'string') ||
    (typeof value.lastPacketHash !== 'undefined' && typeof value.lastPacketHash !== 'string') ||
    (typeof value.signingKeyAlgorithm !== 'undefined' && typeof value.signingKeyAlgorithm !== 'string') ||
    (typeof value.signingPublicKey !== 'undefined' && typeof value.signingPublicKey !== 'string')
  ) {
    throw new Error('Vault record log sync-device payload is invalid.');
  }
}

function assertRevokedSyncDevicePayload(value: unknown): asserts value is RevokedSyncDevice {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.revokedAt !== 'string' ||
    (typeof value.lastPacketHash !== 'undefined' && typeof value.lastPacketHash !== 'string')
  ) {
    throw new Error('Vault record log revoked-device payload is invalid.');
  }
}

function assertSyncKeyPayload(value: unknown): asserts value is SyncKeyMaterial {
  if (
    !isRecord(value) ||
    value.type !== 'distill.sync-key' ||
    value.version !== 1 ||
    value.algorithm !== 'PBKDF2-AES-GCM-256' ||
    typeof value.id !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.secret !== 'string' ||
    value.secret.length < 32
  ) {
    throw new Error('Vault record log sync-key payload is invalid.');
  }
}

function pushPayload(
  entry: EncryptedVaultRecordLogEntry,
  payload: unknown,
  output: {
    projects: Project[];
    blocks: ThoughtBlock[];
    tombstones: DeletionTombstone[];
    devices: SyncDevice[];
    revokedDevices: RevokedSyncDevice[];
    syncKey?: SyncKeyMaterial;
  },
) {
  switch (entry.kind) {
    case 'project':
      assertProjectPayload(payload);
      output.projects.push(cloneProject(payload));
      break;
    case 'thought-block':
      assertThoughtBlockPayload(payload);
      output.blocks.push(cloneBlock(payload));
      break;
    case 'thought-block-deletion':
      assertTombstonePayload(payload);
      output.tombstones.push(cloneTombstone(payload));
      break;
    case 'sync-device':
      assertSyncDevicePayload(payload);
      output.devices.push(cloneDevice(payload));
      break;
    case 'revoked-sync-device':
      assertRevokedSyncDevicePayload(payload);
      output.revokedDevices.push(cloneRevokedDevice(payload));
      break;
    case 'sync-key':
      assertSyncKeyPayload(payload);
      output.syncKey = cloneSyncKey(payload);
      break;
    default:
      throw new Error('Vault record log entry kind is not supported.');
  }
}

export async function decryptVaultRecordLog(
  log: EncryptedVaultRecordLog,
  decryptRecord: VaultRecordDecryptor,
): Promise<DistillStore> {
  const parsed = parseEncryptedVaultRecordLog(serializeEncryptedVaultRecordLog(log));
  const output: {
    projects: Project[];
    blocks: ThoughtBlock[];
    tombstones: DeletionTombstone[];
    devices: SyncDevice[];
    revokedDevices: RevokedSyncDevice[];
    syncKey?: SyncKeyMaterial;
  } = {
    projects: [],
    blocks: [],
    tombstones: [],
    devices: [],
    revokedDevices: [],
  };

  for (const entry of [...parsed.entries].sort((a, b) => a.sequence - b.sequence)) {
    const plainJson = await decryptRecord(entry.encrypted.value, entry);
    const payload = JSON.parse(plainJson) as unknown;

    if (stableHash(payload) !== entry.hash) {
      throw new Error('Vault record log payload hash mismatch.');
    }

    pushPayload(entry, payload, output);
  }

  return normalizeDistillStore({
    projects: output.projects,
    blocks: output.blocks,
    sync: {
      tombstones: output.tombstones,
      devices: output.devices,
      revokedDevices: output.revokedDevices,
      syncKey: output.syncKey,
    },
  });
}
