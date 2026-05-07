export type DeviceLossRunbookStatus = 'ready' | 'todo' | 'watch';

export type DeviceLossRunbookLevel = 'ready' | 'partial' | 'setup-required';

export type DeviceLossRunbookStepId =
  | 'sync-key'
  | 'device-verification'
  | 'partner-device'
  | 'sync-folder'
  | 'recovery-snapshot'
  | 'dry-run-drills'
  | 'rollback-drill';

export type DeviceLossRunbookInput = {
  syncKeyId?: string;
  deviceSigningFingerprint?: string;
  knownDeviceCount: number;
  recoverySnapshotCount: number;
  syncFolderPath?: string;
  syncFolderAutoExportEnabled: boolean;
  syncFolderMonitorEnabled: boolean;
  isDesktopRuntime: boolean;
  hasOpenSyncPreview: boolean;
};

export type DeviceLossRunbookStep = {
  id: DeviceLossRunbookStepId;
  status: DeviceLossRunbookStatus;
};

export type DeviceLossRunbook = {
  level: DeviceLossRunbookLevel;
  readyCount: number;
  todoCount: number;
  watchCount: number;
  totalSteps: number;
  steps: DeviceLossRunbookStep[];
};

export function buildDeviceLossRunbook(input: DeviceLossRunbookInput): DeviceLossRunbook {
  const hasSyncFolder = Boolean(input.syncFolderPath?.trim());
  const syncFolderActive = input.isDesktopRuntime && hasSyncFolder;
  const syncAutomationActive = syncFolderActive && (input.syncFolderAutoExportEnabled || input.syncFolderMonitorEnabled);
  const steps: DeviceLossRunbookStep[] = [
    {
      id: 'sync-key',
      status: input.syncKeyId ? 'ready' : 'todo',
    },
    {
      id: 'device-verification',
      status: input.deviceSigningFingerprint ? 'ready' : 'todo',
    },
    {
      id: 'partner-device',
      status: input.knownDeviceCount > 1 ? 'ready' : input.knownDeviceCount > 0 ? 'watch' : 'todo',
    },
    {
      id: 'sync-folder',
      status: syncAutomationActive ? 'ready' : syncFolderActive ? 'watch' : 'todo',
    },
    {
      id: 'recovery-snapshot',
      status: input.recoverySnapshotCount > 0 ? 'ready' : 'watch',
    },
    {
      id: 'dry-run-drills',
      status: input.syncKeyId ? 'ready' : 'todo',
    },
    {
      id: 'rollback-drill',
      status: input.hasOpenSyncPreview ? 'ready' : 'watch',
    },
  ];
  const readyCount = steps.filter((step) => step.status === 'ready').length;
  const todoCount = steps.filter((step) => step.status === 'todo').length;
  const watchCount = steps.filter((step) => step.status === 'watch').length;

  return {
    level: todoCount > 0 ? 'setup-required' : watchCount > 0 ? 'partial' : 'ready',
    readyCount,
    todoCount,
    watchCount,
    totalSteps: steps.length,
    steps,
  };
}
