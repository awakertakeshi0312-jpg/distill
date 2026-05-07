import { withSyncKeyMaterial, type DistillStore, type Project, type SyncKeyMaterial, type ThoughtBlock } from './model';
import {
  applySyncPacket,
  buildEncryptedSyncPacket,
  decryptEncryptedSyncPacket,
  parseEncryptedSyncPacket,
  serializeEncryptedSyncPacket,
  stableStringify,
  type DistillSyncPacket,
  type SyncPacketSignature,
} from './sync';
import { buildSyncPreview } from './syncPreview';

export type SyncFolderOperationDrillResult = {
  syncKeyId: string;
  sourceDeviceId: string;
  partnerDeviceId: string;
  bootstrapRecords: number;
  returnRecords: number;
  returnedProjects: number;
  returnedBlocks: number;
  returnPreviewAddedProjects: number;
  returnPreviewAddedBlocks: number;
  activeStoreUnchanged: boolean;
};

type SyncFolderOperationDrillOptions = {
  sourceDeviceId: string;
  sourceDeviceName?: string;
  sourceDeviceSigningPublicKey?: string;
  partnerDeviceId: string;
  partnerDeviceName?: string;
  passphrase: string;
  syncKey: SyncKeyMaterial;
  now?: string;
  returnNow?: string;
  iterations?: number;
  signPacket?: (packet: DistillSyncPacket) => Promise<SyncPacketSignature>;
};

function cloneProjects(projects: Project[]) {
  return projects.map((project) => ({ ...project }));
}

function cloneBlocks(blocks: ThoughtBlock[]) {
  return blocks.map((block) => ({
    ...block,
    tags: [...block.tags],
    links: [...block.links],
  }));
}

function assertNoPlaintextLeak(serialized: string, forbidden: string[]) {
  const leaked = forbidden.find((value) => value && serialized.includes(value));

  if (leaked) {
    throw new Error('A/B sync operation drill failed because plaintext content leaked into an encrypted packet.');
  }
}

export async function runSyncFolderOperationDrill(
  store: DistillStore,
  options: SyncFolderOperationDrillOptions,
): Promise<SyncFolderOperationDrillResult> {
  const before = stableStringify(store);
  const sourceStore = withSyncKeyMaterial(
    {
      ...store,
      projects: cloneProjects(store.projects),
      blocks: cloneBlocks(store.blocks),
    },
    options.syncKey,
  );
  const bootstrapPacket = await buildEncryptedSyncPacket(sourceStore, {
    sourceDeviceId: options.sourceDeviceId,
    sourceDeviceName: options.sourceDeviceName,
    sourceDeviceSigningPublicKey: options.sourceDeviceSigningPublicKey,
    passphrase: options.passphrase,
    syncKey: options.syncKey,
    now: options.now,
    iterations: options.iterations,
    signPacket: options.signPacket,
  });
  const serializedBootstrap = serializeEncryptedSyncPacket(bootstrapPacket);

  assertNoPlaintextLeak(serializedBootstrap, [options.syncKey.secret]);

  const recoveredSyncKeys: SyncKeyMaterial[] = [];
  const bootstrapPlainPacket = await decryptEncryptedSyncPacket(parseEncryptedSyncPacket(serializedBootstrap), {
    passphrase: options.passphrase,
    onDiscoveredSyncKey: (syncKey) => recoveredSyncKeys.push(syncKey),
  });
  const recoveredSyncKey = recoveredSyncKeys[0];

  if (!recoveredSyncKey || recoveredSyncKey.id !== options.syncKey.id) {
    throw new Error('A/B sync operation drill failed because the partner device could not recover the sync key.');
  }

  const partnerBaseStore = applySyncPacket(
    withSyncKeyMaterial(
      {
        projects: [],
        blocks: [],
      },
      recoveredSyncKey,
    ),
    bootstrapPlainPacket,
  );
  const returnCreatedAt = options.returnNow ?? new Date(Date.parse(options.now ?? new Date().toISOString()) + 60_000).toISOString();
  const drillProject: Project = {
    id: `drill-project-${options.partnerDeviceId}`,
    name: 'A/B drill project',
    signal: 'Encrypted project sync drill',
    status: 'Next',
    updatedAt: returnCreatedAt,
  };
  const drillBlock: ThoughtBlock = {
    id: `drill-block-${options.partnerDeviceId}`,
    content: 'A/B drill block should return through encrypted sync',
    noteId: `daily-${returnCreatedAt.slice(0, 10)}`,
    projectId: drillProject.id,
    capturedAt: returnCreatedAt,
    updatedAt: returnCreatedAt,
    tags: ['sync-drill'],
    links: ['A/B Sync Drill'],
    state: 'linked',
  };
  const partnerUpdatedStore: DistillStore = {
    ...partnerBaseStore,
    projects: [...partnerBaseStore.projects, drillProject],
    blocks: [drillBlock, ...partnerBaseStore.blocks],
  };
  const returnPacket = await buildEncryptedSyncPacket(partnerUpdatedStore, {
    sourceDeviceId: options.partnerDeviceId,
    sourceDeviceName: options.partnerDeviceName,
    passphrase: options.passphrase,
    syncKey: recoveredSyncKey,
    now: returnCreatedAt,
    iterations: options.iterations,
  });
  const serializedReturn = serializeEncryptedSyncPacket(returnPacket);

  assertNoPlaintextLeak(serializedReturn, [
    options.syncKey.secret,
    drillProject.name,
    drillProject.signal,
    drillBlock.content,
  ]);

  const returnPlainPacket = await decryptEncryptedSyncPacket(parseEncryptedSyncPacket(serializedReturn), {
    syncKey: options.syncKey,
  });
  const returnPreview = buildSyncPreview(sourceStore, returnPlainPacket);
  const sourceAfterReturn = applySyncPacket(sourceStore, returnPlainPacket);
  const returnedProject = sourceAfterReturn.projects.find((project) => project.id === drillProject.id);
  const returnedBlock = sourceAfterReturn.blocks.find((block) => block.id === drillBlock.id);

  if (!returnedProject || !returnedBlock || returnedBlock.projectId !== returnedProject.id) {
    throw new Error('A/B sync operation drill failed because the return packet did not merge the partner project and block.');
  }

  if (returnPreview.diff.addedProjects < 1 || returnPreview.diff.addedBlocks < 1) {
    throw new Error('A/B sync operation drill failed because the return preview did not show the expected additions.');
  }

  return {
    syncKeyId: options.syncKey.id,
    sourceDeviceId: options.sourceDeviceId,
    partnerDeviceId: options.partnerDeviceId,
    bootstrapRecords: bootstrapPlainPacket.records.length,
    returnRecords: returnPlainPacket.records.length,
    returnedProjects: sourceAfterReturn.projects.length,
    returnedBlocks: sourceAfterReturn.blocks.length,
    returnPreviewAddedProjects: returnPreview.diff.addedProjects,
    returnPreviewAddedBlocks: returnPreview.diff.addedBlocks,
    activeStoreUnchanged: stableStringify(store) === before,
  };
}
