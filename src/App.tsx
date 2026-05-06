import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { exportStoreAsJson, exportStoreAsMarkdown, downloadTextFile } from './export';
import { createMarkdownImport, parseDistillImport } from './import';
import { decryptDistillVault, encryptDistillVault } from './vaultCrypto';
import { getOrCreateDeviceIdentity, renameDeviceIdentity, type DeviceIdentity } from './device';
import { APP_VERSION, LATEST_RELEASE_URL, UPDATE_FEED_URL } from './appInfo';
import { initialStore, normalizeSyncMetadata, type DistillStore, type Project, type SearchResult } from './model';
import {
  applySyncPacket,
  buildEncryptedSyncPacket,
  createSyncAutoExportFingerprint,
  decryptEncryptedSyncPacket,
  forgetRevokedSyncDevice,
  getSyncPacketCheckpointStatus,
  isSyncDeviceRevoked,
  parseEncryptedSyncPacket,
  registerSyncDevice,
  registerSyncPacketCheckpoint,
  revokeSyncDevice,
  serializeEncryptedSyncPacket,
} from './sync';
import {
  addCapture,
  archiveBlock,
  assignProject,
  createProject,
  extractPeople,
  getBlock,
  getPeopleIndex,
  getRelatedBlocks,
  permanentlyDeleteBlock,
  restoreBlock,
  toggleProcessed,
  updateBlockContent,
} from './repository';
import {
  checkForAppUpdate,
  clearLegacyPlainStore,
  isDesktopRuntime,
  installPendingAppUpdate,
  listEncryptedSyncPacketFiles,
  listSyncRecoveryVaults,
  loadGraph,
  loadEncryptedVault,
  loadLegacyPlainStore,
  loadStorageInfo,
  quarantineEncryptedSyncPacketFile,
  readEncryptedSyncPacketFile,
  readSyncRecoveryVault,
  saveEncryptedVault,
  saveSyncRecoveryVault,
  searchStore,
  startUpdateInstaller,
  writeEncryptedSyncPacketFile,
  type SyncFolderPacketFile,
  type SyncRecoveryVaultFile,
} from './storage';
import { buildKnowledgeGraph, filterKnowledgeGraph, getGraphNeighbors, layoutKnowledgeGraph, type GraphEdgeType, type GraphSnapshot } from './graph';
import {
  getActiveBlocks,
  getArchivedBlocks,
  getDailyNotes,
  getFocusProjects,
  getOpenBlocks,
  getProjectCounts,
  getTodayBlocks,
  getTodayNoteId,
} from './selectors';
import { ArchivePanel } from './components/ArchivePanel';
import { CapturePanel } from './components/CapturePanel';
import { CommandPalette, type CommandItem } from './components/CommandPalette';
import { GraphPanel } from './components/GraphPanel';
import { InboxPanel } from './components/InboxPanel';
import { InspectorPanel } from './components/InspectorPanel';
import { PeoplePanel } from './components/PeoplePanel';
import { ProjectsPanel } from './components/ProjectsPanel';
import { SearchPanel } from './components/SearchPanel';
import { Sidebar } from './components/Sidebar';
import { TodayPanel } from './components/TodayPanel';
import { Topbar } from './components/Topbar';
import { VaultGate } from './components/VaultGate';
import { copy, getInitialLocale, UI_LOCALE_KEY, type Locale } from './i18n';
import { emitCaptureSaved, emitExportArtifact, emitReviewDecision } from './aiOrg';
import { sendPersonalKmHandoff } from './personalKmHandoff';
import { buildRestorePreview, type RestorePreview } from './restorePreview';
import { buildSyncPreview, type SyncPreview } from './syncPreview';
import {
  chooseAssistedSyncFolderPreview,
  countSyncFolderPacketReviews,
  type SyncFolderPacketReview,
} from './syncFolderReview';

const ONBOARDING_KEY = 'distill.onboarding.dismissed';
const AUTO_LOCK_MINUTES_KEY = 'distill.autoLockMinutes';
const SYNC_FOLDER_PATH_KEY = 'distill.syncFolderPath';
const SYNC_FOLDER_MONITOR_ENABLED_KEY = 'distill.syncFolderMonitor.enabled';
const SYNC_FOLDER_AUTO_EXPORT_ENABLED_KEY = 'distill.syncFolderAutoExport.enabled';
const SYNC_FOLDER_AUTO_EXPORT_FINGERPRINT_KEY = 'distill.syncFolderAutoExport.fingerprint';
const SYNC_FOLDER_MONITOR_INTERVAL_MS = 60_000;
const SYNC_FOLDER_AUTO_EXPORT_INTERVAL_MS = 120_000;
const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
type VaultStatus = 'checking' | 'locked' | 'setup' | 'unlocked';

function syncPreviewRequiresRiskAcknowledgement(preview: SyncPreview | null) {
  return Boolean(
    preview &&
      !preview.diff.replay &&
      (preview.diff.destructiveChanges > 0 || preview.diff.timestampTies > 0),
  );
}

function syncPreviewRequiresDeviceTrust(preview: SyncPreview | null) {
  return Boolean(preview && !preview.diff.replay && !preview.diff.sourceDeviceKnown);
}

function App() {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);
  const [store, setStore] = useState(initialStore);
  const [hasLoadedStore, setHasLoadedStore] = useState(false);
  const [vaultStatus, setVaultStatus] = useState<VaultStatus>('checking');
  const [legacyPlainStore, setLegacyPlainStore] = useState<DistillStore | null>(null);
  const [vaultPassphrase, setVaultPassphrase] = useState('');
  const [vaultError, setVaultError] = useState('');
  const [vaultNotice, setVaultNotice] = useState('');
  const vaultSaveSerial = useRef(0);
  const lastVaultActivityAt = useRef(Date.now());
  const [captureText, setCaptureText] = useState(copy[getInitialLocale()].initialCapture as string);
  const [query, setQuery] = useState(copy[getInitialLocale()].initialQuery as string);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [sqliteGraph, setSqliteGraph] = useState<GraphSnapshot | null>(null);
  const [graphEdgeFilter, setGraphEdgeFilter] = useState<GraphEdgeType>('all');
  const [selectedGraphNodeId, setSelectedGraphNodeId] = useState<string | undefined>(undefined);
  const [selectedBlockId, setSelectedBlockId] = useState<string | undefined>(undefined);
  const [editingBlockId, setEditingBlockId] = useState<string | undefined>(undefined);
  const [editingText, setEditingText] = useState('');
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectSignal, setNewProjectSignal] = useState('');
  const [newProjectStatus, setNewProjectStatus] = useState<Project['status']>('Active');
  const [projectFormError, setProjectFormError] = useState('');
  const [storagePath, setStoragePath] = useState('');
  const [backupPath, setBackupPath] = useState('');
  const [restoreStatus, setRestoreStatus] = useState('');
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null);
  const [syncRecoveryVaults, setSyncRecoveryVaults] = useState<SyncRecoveryVaultFile[]>([]);
  const [syncStatus, setSyncStatus] = useState('');
  const [syncPreview, setSyncPreview] = useState<SyncPreview | null>(null);
  const [syncRiskAccepted, setSyncRiskAccepted] = useState(false);
  const [syncDeviceTrustAccepted, setSyncDeviceTrustAccepted] = useState(false);
  const [syncFolderPath, setSyncFolderPath] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    return localStorage.getItem(SYNC_FOLDER_PATH_KEY) ?? '';
  });
  const [syncFolderPackets, setSyncFolderPackets] = useState<SyncFolderPacketFile[]>([]);
  const [syncFolderPacketReviews, setSyncFolderPacketReviews] = useState<SyncFolderPacketReview[]>([]);
  const [syncFolderMonitorEnabled, setSyncFolderMonitorEnabled] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return localStorage.getItem(SYNC_FOLDER_MONITOR_ENABLED_KEY) === 'true';
  });
  const [syncFolderLastCheckedAt, setSyncFolderLastCheckedAt] = useState('');
  const [syncFolderAutoExportEnabled, setSyncFolderAutoExportEnabled] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return localStorage.getItem(SYNC_FOLDER_AUTO_EXPORT_ENABLED_KEY) === 'true';
  });
  const [syncFolderAutoExportFingerprint, setSyncFolderAutoExportFingerprint] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    return localStorage.getItem(SYNC_FOLDER_AUTO_EXPORT_FINGERPRINT_KEY) ?? '';
  });
  const [syncFolderAutoExportLastAt, setSyncFolderAutoExportLastAt] = useState('');
  const [syncFolderAutoExportLastFile, setSyncFolderAutoExportLastFile] = useState('');
  const syncFolderAutoExportInFlight = useRef(false);
  const [personalKmHandoffStatus, setPersonalKmHandoffStatus] = useState('');
  const [deviceIdentity, setDeviceIdentity] = useState<DeviceIdentity | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }

    return getOrCreateDeviceIdentity();
  });
  const [updateInstallerPath, setUpdateInstallerPath] = useState('');
  const [updateStatus, setUpdateStatus] = useState('');
  const [autoUpdateStatus, setAutoUpdateStatus] = useState('');
  const [isAutoUpdateAvailable, setIsAutoUpdateAvailable] = useState(false);
  const [vaultSecurityStatus, setVaultSecurityStatus] = useState('');
  const [autoLockMinutes, setAutoLockMinutes] = useState(() => {
    if (typeof window === 'undefined') {
      return 15;
    }

    const stored = Number(localStorage.getItem(AUTO_LOCK_MINUTES_KEY));
    return Number.isFinite(stored) ? stored : 15;
  });
  const [isOnboardingVisible, setIsOnboardingVisible] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return localStorage.getItem(ONBOARDING_KEY) !== 'true';
  });
  const ui = copy[locale];

  useEffect(() => {
    let isMounted = true;

    async function initializeVault() {
      if (!isMounted) {
        return;
      }

      try {
        const encryptedVault = await loadEncryptedVault();

        if (!isMounted) {
          return;
        }

        if (encryptedVault) {
          setVaultStatus('locked');
          return;
        }

        const legacyStore = await loadLegacyPlainStore();

        if (!isMounted) {
          return;
        }

        setLegacyPlainStore(legacyStore);
        setVaultStatus('setup');
      } catch (error) {
        console.warn('Failed to initialize encrypted vault.', error);
        setVaultError(runtimeVaultLabels().unlockInvalid);
        setVaultStatus('setup');
      }
    }

    void initializeVault();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (vaultStatus !== 'unlocked' || !hasLoadedStore || !vaultPassphrase) {
      return;
    }

    const serial = vaultSaveSerial.current + 1;
    vaultSaveSerial.current = serial;
    const timer = window.setTimeout(() => {
      void persistEncryptedStore(store, serial).catch((error) => {
        console.warn('Failed to persist encrypted Distill vault.', error);
        setRestoreStatus(error instanceof Error ? error.message : vaultLabels().encryptedRestoreInvalid);
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [store, hasLoadedStore, vaultStatus, vaultPassphrase]);

  useEffect(() => {
    localStorage.setItem(UI_LOCALE_KEY, locale);
  }, [locale]);

  useEffect(() => {
    if (!deviceIdentity && typeof window !== 'undefined') {
      setDeviceIdentity(getOrCreateDeviceIdentity());
    }
  }, [deviceIdentity]);

  useEffect(() => {
    localStorage.setItem(AUTO_LOCK_MINUTES_KEY, String(autoLockMinutes));
  }, [autoLockMinutes]);

  useEffect(() => {
    localStorage.setItem(SYNC_FOLDER_PATH_KEY, syncFolderPath);
  }, [syncFolderPath]);

  useEffect(() => {
    localStorage.setItem(SYNC_FOLDER_MONITOR_ENABLED_KEY, String(syncFolderMonitorEnabled));
  }, [syncFolderMonitorEnabled]);

  useEffect(() => {
    localStorage.setItem(SYNC_FOLDER_AUTO_EXPORT_ENABLED_KEY, String(syncFolderAutoExportEnabled));
  }, [syncFolderAutoExportEnabled]);

  useEffect(() => {
    localStorage.setItem(SYNC_FOLDER_AUTO_EXPORT_FINGERPRINT_KEY, syncFolderAutoExportFingerprint);
  }, [syncFolderAutoExportFingerprint]);

  useEffect(() => {
    if (vaultStatus !== 'unlocked' || autoLockMinutes <= 0) {
      return;
    }

    function markActivity() {
      lastVaultActivityAt.current = Date.now();
    }

    const events = ['keydown', 'pointerdown', 'mousemove', 'touchstart', 'scroll'];
    events.forEach((eventName) => window.addEventListener(eventName, markActivity, { passive: true }));
    markActivity();

    const timer = window.setInterval(() => {
      const idleMs = Date.now() - lastVaultActivityAt.current;

      if (idleMs >= autoLockMinutes * 60 * 1000) {
        void lockVault(runtimeVaultLabels().autoLocked);
      }
    }, 10_000);

    function lockBeforeSleepOrHide() {
      if (document.visibilityState === 'hidden') {
        void lockVault(runtimeVaultLabels().autoLocked);
      }
    }

    document.addEventListener('visibilitychange', lockBeforeSleepOrHide);

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, markActivity));
      document.removeEventListener('visibilitychange', lockBeforeSleepOrHide);
      window.clearInterval(timer);
    };
  }, [autoLockMinutes, vaultStatus, vaultPassphrase, hasLoadedStore, store]);

  useEffect(() => {
    let isMounted = true;

    void loadStorageInfo().then((info) => {
      if (isMounted) {
        setStoragePath(info.path);
        setBackupPath(info.backupPath ?? '');
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (vaultStatus !== 'unlocked') {
      setSyncRecoveryVaults([]);
      return;
    }

    void refreshSyncRecoveryVaultSnapshots(true);
  }, [vaultStatus]);

  useEffect(() => {
    if (
      vaultStatus !== 'unlocked' ||
      !syncFolderMonitorEnabled ||
      !syncFolderPath.trim() ||
      !vaultPassphrase ||
      !isDesktopRuntime()
    ) {
      return;
    }

    void runSyncFolderMonitorTick();
    const timer = window.setInterval(() => {
      void runSyncFolderMonitorTick();
    }, SYNC_FOLDER_MONITOR_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [vaultStatus, syncFolderMonitorEnabled, syncFolderPath, vaultPassphrase, store]);

  useEffect(() => {
    if (
      vaultStatus !== 'unlocked' ||
      !syncFolderAutoExportEnabled ||
      !syncFolderPath.trim() ||
      !vaultPassphrase ||
      !isDesktopRuntime()
    ) {
      return;
    }

    void runSyncFolderAutoExportTick();
    const timer = window.setInterval(() => {
      void runSyncFolderAutoExportTick();
    }, SYNC_FOLDER_AUTO_EXPORT_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [
    vaultStatus,
    syncFolderAutoExportEnabled,
    syncFolderPath,
    vaultPassphrase,
    store,
    deviceIdentity,
    syncFolderAutoExportFingerprint,
  ]);

  useEffect(() => {
    function handleGlobalShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setIsCommandOpen((current) => !current);
      }

      if (event.key === 'Escape') {
        setIsCommandOpen(false);
      }
    }

    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, []);

  useEffect(() => {
    if (!hasLoadedStore) {
      return;
    }

    let isMounted = true;

    void searchStore(store, query).then((searchResults) => {
      if (!isMounted) {
        return;
      }

      startTransition(() => {
        setResults(searchResults);
      });
    });

    return () => {
      isMounted = false;
    };
  }, [store, query, hasLoadedStore]);

  useEffect(() => {
    if (!hasLoadedStore) {
      return;
    }

    let isMounted = true;

    void loadGraph().then((graphSnapshot) => {
      if (!isMounted) {
        return;
      }

      setSqliteGraph(graphSnapshot);
    });

    return () => {
      isMounted = false;
    };
  }, [store, hasLoadedStore]);

  const activeBlocks = useMemo(() => getActiveBlocks(store), [store]);
  const archivedBlocks = useMemo(() => getArchivedBlocks(store), [store]);
  const openBlocks = useMemo(() => getOpenBlocks(activeBlocks), [activeBlocks]);
  const selectedBlock = getBlock(store, selectedBlockId);
  const relatedBlocks = useMemo(() => getRelatedBlocks(store, selectedBlockId), [store, selectedBlockId]);
  const selectedPeople = selectedBlock ? extractPeople(selectedBlock) : [];
  const peopleIndex = useMemo(() => getPeopleIndex(store), [store]);
  const syncDevices = useMemo(() => normalizeSyncMetadata(store.sync).devices, [store.sync]);
  const revokedSyncDevices = useMemo(() => normalizeSyncMetadata(store.sync).revokedDevices, [store.sync]);
  const projectCounts = useMemo(() => getProjectCounts(store, activeBlocks), [store, activeBlocks]);
  const todayNoteId = useMemo(() => getTodayNoteId(), []);
  const todayBlocks = useMemo(() => getTodayBlocks(activeBlocks, todayNoteId), [activeBlocks, todayNoteId]);
  const dailyNotes = useMemo(() => getDailyNotes(activeBlocks), [activeBlocks]);
  const focusProjects = useMemo(() => getFocusProjects(projectCounts), [projectCounts]);
  const fallbackGraph = useMemo(
    () => buildKnowledgeGraph(activeBlocks, projectCounts, peopleIndex),
    [activeBlocks, projectCounts, peopleIndex],
  );
  const unfilteredKnowledgeGraph = useMemo(
    () => (sqliteGraph ? layoutKnowledgeGraph(sqliteGraph) : fallbackGraph),
    [fallbackGraph, sqliteGraph],
  );
  const knowledgeGraph = useMemo(
    () => filterKnowledgeGraph(unfilteredKnowledgeGraph, graphEdgeFilter),
    [graphEdgeFilter, unfilteredKnowledgeGraph],
  );
  const graphNodes = knowledgeGraph.nodes;
  const graphEdges = knowledgeGraph.edges;
  const positionedGraphNodes = knowledgeGraph.positionedNodes;
  const graphPositionById = knowledgeGraph.positionById;
  const graphNeighbors = useMemo(
    () => getGraphNeighbors(knowledgeGraph, selectedGraphNodeId),
    [knowledgeGraph, selectedGraphNodeId],
  );

  const commandItems: CommandItem[] = [
    {
      id: 'go-inbox',
      label: ui.commandActions.inbox,
      section: ui.commandSections.navigation,
      keywords: 'inbox capture triage',
      run: () => scrollToSection('inbox'),
    },
    {
      id: 'go-today',
      label: ui.commandActions.today,
      section: ui.commandSections.navigation,
      keywords: 'today daily note',
      run: () => scrollToSection('today'),
    },
    {
      id: 'go-search',
      label: ui.commandActions.search,
      section: ui.commandSections.navigation,
      keywords: 'search meaning retrieval',
      run: () => scrollToSection('search'),
    },
    {
      id: 'go-projects',
      label: ui.commandActions.projects,
      section: ui.commandSections.navigation,
      keywords: 'projects work',
      run: () => scrollToSection('projects'),
    },
    {
      id: 'go-archive',
      label: ui.commandActions.archive,
      section: ui.commandSections.navigation,
      keywords: 'archive restore',
      run: () => scrollToSection('archive'),
    },
    {
      id: 'search-text',
      label: ui.commandActions.focusSearch,
      section: ui.commandSections.actions,
      keywords: 'find query search',
      run: () => {
        if (commandQuery.trim()) {
          setQuery(commandQuery.trim());
        }
        scrollToSection('search');
      },
    },
    {
      id: 'capture-text',
      label: ui.commandActions.captureText,
      section: ui.commandSections.actions,
      keywords: 'capture thought inbox',
      run: () => {
        if (!commandQuery.trim()) {
          scrollToSection('inbox');
          return;
        }
        const nextStore = addCapture(commandQuery)(store);
        setStore(nextStore);
        setSelectedBlockId(nextStore.blocks[0]?.id);
        scrollToSection('inbox');
      },
    },
    {
      id: 'create-project-text',
      label: ui.commandActions.createProject,
      section: ui.commandSections.actions,
      keywords: 'project create area',
      run: () => createProjectFromText(commandQuery),
    },
    {
      id: 'export-markdown',
      label: ui.commandActions.exportMarkdown,
      section: ui.commandSections.export,
      keywords: 'export markdown md',
      run: exportMarkdown,
    },
    {
      id: 'export-json',
      label: ui.commandActions.exportJson,
      section: ui.commandSections.export,
      keywords: 'export json backup',
      run: exportJson,
    },
    {
      id: 'handoff-personal-km',
      label: 'Handoff to Personal KM',
      section: ui.commandSections.export,
      keywords: 'personal km handoff review queue',
      run: () => void handoffToPersonalKm(),
    },
  ];

  const filteredCommandItems = commandItems.filter((item) => {
    const text = [item.label, item.section, item.keywords].join(' ').toLowerCase();
    return commandQuery
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .every((term) => text.includes(term) || commandQuery.trim().length > 0 && item.id.includes('text'));
  });

  function captureBlock() {
    if (!captureText.trim()) {
      return;
    }

    const nextStore = addCapture(captureText)(store);
    const block = nextStore.blocks[0];

    setStore(nextStore);
    setSelectedBlockId(block?.id);
    setCaptureText('');
    if (block) {
      void emitCaptureSaved(block, nextStore);
    }
  }

  function exportMarkdown() {
    downloadTextFile('distill-export.md', exportStoreAsMarkdown(store), 'text/markdown');
    void emitExportArtifact('markdown', store);
  }

  function exportJson() {
    downloadTextFile('distill-export.json', exportStoreAsJson(store), 'application/json');
    void emitExportArtifact('json', store);
  }

  function backupJson() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadTextFile(`distill-backup-${timestamp}.json`, exportStoreAsJson(store), 'application/json');
    void emitExportArtifact('backup-json', store);
  }

  async function handoffToPersonalKm() {
    setPersonalKmHandoffStatus('Sending summary-only handoff to Personal KM...');
    try {
      const result = await sendPersonalKmHandoff(store);
      setPersonalKmHandoffStatus(
        result.submitted > 0
          ? `Submitted ${result.submitted} reviewed summaries to Personal KM. Skipped ${result.skipped}.`
          : 'No processed blocks are ready for Personal KM handoff.',
      );
      if (result.submitted > 0) {
        void emitExportArtifact(
          'personal-km-handoff',
          store,
          'wp_20260506_connect-distill-reviewed-artifacts-to-personal-km',
          {
            submitted: result.submitted,
            skipped: result.skipped,
            endpoint: result.endpoint,
          },
        );
      }
    } catch (error) {
      setPersonalKmHandoffStatus(error instanceof Error ? error.message : 'Personal KM handoff failed.');
    }
  }

  function runtimeVaultLabels() {
    return locale === 'en'
      ? {
          mismatch: 'Vault passphrases did not match.',
          unlockInvalid: 'Could not unlock the vault. Check the passphrase.',
          missingVault: 'No encrypted vault was found. Create a new vault first.',
          createSuccess: 'Encrypted vault created. Active storage is now encrypted at rest.',
          migrationSuccess: 'Existing plaintext store was encrypted and the old plaintext copy was cleared.',
          passphraseRequired: 'Vault passphrase is required before saving.',
          currentPassphraseInvalid: 'Current vault passphrase is incorrect.',
          passphraseChanged: 'Vault passphrase changed.',
          autoLocked: 'Vault locked after inactivity.',
        }
      : {
          mismatch: 'Vault\u30d1\u30b9\u30d5\u30ec\u30fc\u30ba\u304c\u4e00\u81f4\u3057\u307e\u305b\u3093\u3002',
          unlockInvalid:
            'Vault\u3092\u958b\u3051\u307e\u305b\u3093\u3067\u3057\u305f\u3002\u30d1\u30b9\u30d5\u30ec\u30fc\u30ba\u3092\u78ba\u8a8d\u3057\u3066\u304f\u3060\u3055\u3044\u3002',
          missingVault:
            '\u6697\u53f7\u5316Vault\u304c\u898b\u3064\u304b\u308a\u307e\u305b\u3093\u3002\u5148\u306bVault\u3092\u4f5c\u6210\u3057\u3066\u304f\u3060\u3055\u3044\u3002',
          createSuccess:
            '\u6697\u53f7\u5316Vault\u3092\u4f5c\u6210\u3057\u307e\u3057\u305f\u3002\u901a\u5e38\u4fdd\u5b58\u306f\u6697\u53f7\u5316\u4fdd\u5b58\u306b\u5207\u308a\u66ff\u308f\u308a\u307e\u3057\u305f\u3002',
          migrationSuccess:
            '\u65e2\u5b58\u306e\u5e73\u6587\u30b9\u30c8\u30a2\u3092\u6697\u53f7\u5316\u3057\u3001\u53e4\u3044\u5e73\u6587\u30b3\u30d4\u30fc\u3092\u524a\u9664\u3057\u307e\u3057\u305f\u3002',
          passphraseRequired:
            '\u4fdd\u5b58\u524d\u306bVault\u30d1\u30b9\u30d5\u30ec\u30fc\u30ba\u304c\u5fc5\u8981\u3067\u3059\u3002',
          currentPassphraseInvalid:
            '\u73fe\u5728\u306eVault\u30d1\u30b9\u30d5\u30ec\u30fc\u30ba\u304c\u6b63\u3057\u304f\u3042\u308a\u307e\u305b\u3093\u3002',
          passphraseChanged: 'Vault\u30d1\u30b9\u30d5\u30ec\u30fc\u30ba\u3092\u5909\u66f4\u3057\u307e\u3057\u305f\u3002',
          autoLocked:
            '\u4e00\u5b9a\u6642\u9593\u64cd\u4f5c\u304c\u306a\u304b\u3063\u305f\u305f\u3081Vault\u3092\u30ed\u30c3\u30af\u3057\u307e\u3057\u305f\u3002',
        };
  }

  async function persistEncryptedStore(nextStore: DistillStore, serial?: number) {
    if (!vaultPassphrase) {
      throw new Error(runtimeVaultLabels().passphraseRequired);
    }

    const encrypted = await encryptDistillVault(exportStoreAsJson(nextStore), vaultPassphrase);

    if (serial !== undefined && serial !== vaultSaveSerial.current) {
      return;
    }

    await saveEncryptedVault(encrypted);
  }

  async function unlockVault(passphrase: string) {
    setVaultError('');
    setVaultNotice('');

    try {
      const encryptedVault = await loadEncryptedVault();

      if (!encryptedVault) {
        setVaultError(runtimeVaultLabels().missingVault);
        setVaultStatus('setup');
        return;
      }

      const decrypted = await decryptDistillVault(encryptedVault, passphrase);
      const loadedStore = parseDistillImport(decrypted);

      setStore(loadedStore);
      setSelectedBlockId(loadedStore.blocks[0]?.id);
      setVaultPassphrase(passphrase);
      setHasLoadedStore(true);
      setVaultStatus('unlocked');
    } catch (error) {
      console.warn('Failed to unlock encrypted Distill vault.', error);
      setVaultError(runtimeVaultLabels().unlockInvalid);
    }
  }

  async function createOrMigrateVault(passphrase: string, confirmation: string) {
    const labels = runtimeVaultLabels();

    if (passphrase !== confirmation) {
      setVaultError(labels.mismatch);
      return;
    }

    setVaultError('');
    setVaultNotice('');

    try {
      const nextStore = legacyPlainStore ?? initialStore;
      const encrypted = await encryptDistillVault(exportStoreAsJson(nextStore), passphrase);

      await saveEncryptedVault(encrypted);
      await clearLegacyPlainStore();

      setStore(nextStore);
      setSelectedBlockId(nextStore.blocks[0]?.id);
      setVaultPassphrase(passphrase);
      setHasLoadedStore(true);
      setVaultStatus('unlocked');
      setLegacyPlainStore(null);
      setVaultNotice(legacyPlainStore ? labels.migrationSuccess : labels.createSuccess);
    } catch (error) {
      console.warn('Failed to create encrypted Distill vault.', error);
      setVaultError(error instanceof Error ? error.message : labels.unlockInvalid);
    }
  }

  async function changeVaultPassphrase(currentPassphrase: string, nextPassphrase: string, confirmation: string) {
    const labels = runtimeVaultLabels();
    setVaultSecurityStatus('');

    if (nextPassphrase !== confirmation) {
      setVaultSecurityStatus(labels.mismatch);
      return;
    }

    const encryptedVault = await loadEncryptedVault();

    if (!encryptedVault) {
      setVaultSecurityStatus(labels.missingVault);
      return;
    }

    try {
      await decryptDistillVault(encryptedVault, currentPassphrase);
    } catch (error) {
      console.warn('Failed to verify current Distill vault passphrase.', error);
      setVaultSecurityStatus(labels.currentPassphraseInvalid);
      return;
    }

    try {
      const encrypted = await encryptDistillVault(exportStoreAsJson(store), nextPassphrase);

      // Cancel any pending autosave that may still be using the old passphrase.
      vaultSaveSerial.current += 1;
      await saveEncryptedVault(encrypted);
      setVaultPassphrase(nextPassphrase);
      setVaultSecurityStatus(labels.passphraseChanged);
    } catch (error) {
      console.warn('Failed to change Distill vault passphrase.', error);
      setVaultSecurityStatus(error instanceof Error ? error.message : labels.unlockInvalid);
    }
  }

  async function lockVault(notice = '') {
    try {
      if (hasLoadedStore && vaultPassphrase) {
        await persistEncryptedStore(store);
      }
    } finally {
      setVaultPassphrase('');
      setHasLoadedStore(false);
      setStore(initialStore);
      setResults([]);
      setSqliteGraph(null);
      setSelectedBlockId(undefined);
      setVaultStatus('locked');
      setVaultNotice(notice);
      setRestoreStatus('');
      setRestorePreview(null);
      setSyncRecoveryVaults([]);
      setSyncPreview(null);
      setSyncRiskAccepted(false);
      setSyncDeviceTrustAccepted(false);
      setSyncFolderMonitorEnabled(false);
      setSyncFolderLastCheckedAt('');
      setSyncFolderAutoExportEnabled(false);
      setSyncFolderAutoExportLastAt('');
      setSyncFolderAutoExportLastFile('');
      setVaultSecurityStatus('');
    }
  }

  function vaultLabels() {
    return locale === 'en'
      ? {
          passphrase: 'Enter a vault passphrase with at least 12 characters.',
          confirmPassphrase: 'Re-enter the same vault passphrase.',
          mismatch: 'Vault passphrases did not match.',
          encryptedBackupSuccess: 'Encrypted vault backup created.',
          encryptedRestoreSuccess: (blocks: number, projects: number) => `Restored encrypted vault with ${blocks} blocks and ${projects} projects.`,
          syncRecoveryListSuccess: (snapshots: number) => `Found ${snapshots} encrypted sync recovery snapshots.`,
          syncRecoveryRestoreSuccess: (blocks: number, projects: number) =>
            `Restored sync recovery snapshot with ${blocks} blocks and ${projects} projects.`,
          syncRecoveryRestoreInvalid:
            'Could not decrypt or preview that sync recovery snapshot. Check the passphrase and snapshot file.',
          encryptedRestoreInvalid: 'Could not decrypt or restore that encrypted vault. Check the passphrase and file.',
          fileTooLarge: 'Import file is too large. Keep imports under 5 MB for this MVP.',
        }
      : {
          passphrase: '12文字以上のVaultパスフレーズを入力してください。',
          confirmPassphrase: '同じVaultパスフレーズをもう一度入力してください。',
          mismatch: 'Vaultパスフレーズが一致しません。',
          encryptedBackupSuccess: '暗号化Vaultバックアップを作成しました。',
          encryptedRestoreSuccess: (blocks: number, projects: number) => `暗号化Vaultから${blocks}件のブロックと${projects}件のプロジェクトを復元しました。`,
          syncRecoveryListSuccess: (snapshots: number) =>
            `暗号化された同期リカバリスナップショットが${snapshots}件見つかりました。`,
          syncRecoveryRestoreSuccess: (blocks: number, projects: number) =>
            `同期リカバリスナップショットから${blocks}件のブロックと${projects}件のプロジェクトを復元しました。`,
          syncRecoveryRestoreInvalid:
            '同期リカバリスナップショットを復号またはプレビューできませんでした。パスフレーズとファイルを確認してください。',
          encryptedRestoreInvalid: '暗号化Vaultを復号または復元できませんでした。パスフレーズとファイルを確認してください。',
          fileTooLarge: 'インポートファイルが大きすぎます。このMVPでは5 MB未満にしてください。',
        };
  }

  function syncLabels() {
    return locale === 'en'
      ? {
          passphraseRequired: 'Unlock the encrypted vault before exporting or importing sync packets.',
          exportSuccess: (records: number, deviceName: string) =>
            `Encrypted sync packet exported from ${deviceName} with ${records} records.`,
          importConfirm: (records: number, deviceId: string) =>
            `Merge ${records} encrypted sync records from device ${deviceId}? Newer records replace older local records.`,
          previewReady: (records: number, deviceId: string) =>
            `Sync preview ready for ${records} encrypted records from device ${deviceId}. Review the diff before applying.`,
          previewCanceled: 'Sync preview canceled. Current vault was not changed.',
          staleSkipped: (deviceId: string) =>
            `Skipped an older or already imported sync packet from device ${deviceId}.`,
          checkpointRejected:
            'Sync packet was not imported because it does not continue the known device checkpoint chain.',
          importSuccess: (records: number, deviceId: string) =>
            `Merged ${records} encrypted sync records from device ${deviceId}.`,
          importSuccessWithRecovery: (records: number, deviceId: string, recoveryPath: string) =>
            `Merged ${records} encrypted sync records from device ${deviceId}. Recovery snapshot saved at ${recoveryPath}.`,
          importInvalid: 'Could not import that encrypted sync packet. Check the file and vault passphrase.',
          deviceRenamed: 'Device name updated.',
          knownDevices: 'Known devices',
          noKnownDevices: 'No synced devices yet',
          revokedDevices: 'Revoked devices',
          noRevokedDevices: 'No revoked devices',
          thisDevice: 'This device',
          revoke: 'Revoke',
          forget: 'Forget',
          revokeConfirm: (deviceName: string) =>
            `Revoke ${deviceName} and reject future sync packets from that device?`,
          forgetConfirm: (deviceName: string) =>
            `Forget the revoked record for ${deviceName}? Future packets from that device can be imported again.`,
          deviceRevoked: (deviceName: string) => `Revoked device ${deviceName}.`,
          revokedForgotten: (deviceName: string) => `Forgot revoked record for ${deviceName}.`,
          revokedSourceRejected: (deviceId: string) => `Blocked a sync packet from revoked device ${deviceId}.`,
          syncDeviceTrustRequired: (deviceName: string) =>
            `This sync packet is from an untrusted device (${deviceName}). Confirm device trust before applying.`,
          syncFolderRequired: 'Enter a desktop sync folder path first.',
          syncFolderDesktopRequired: 'Desktop app is required to use a sync folder.',
          syncFolderExportSuccess: (records: number, filePath: string) =>
            `Wrote ${records} encrypted sync records to ${filePath}.`,
          syncFolderScanSuccess: (files: number) => `Found ${files} encrypted sync packet files in the folder.`,
          syncFolderReviewSuccess: (files: number, ready: number, risky: number, blocked: number) =>
            `Reviewed ${files} encrypted sync packets: ${ready} ready, ${risky} require risk review, ${blocked} quarantine candidates.`,
          syncFolderMonitorEnabled: 'Sync folder monitor enabled. Distill will refresh the safety review queue, but will not apply packets automatically.',
          syncFolderMonitorDisabled: 'Sync folder monitor disabled.',
          syncFolderMonitorUpdated: (files: number, ready: number, risky: number, blocked: number) =>
            `Monitor refreshed ${files} packets: ${ready} ready, ${risky} risk review, ${blocked} blocked/invalid.`,
          syncFolderAutoExportEnabled:
            'Sync folder auto-export enabled. Distill will write encrypted outbound packets when local content changes, but will not import or apply anything automatically.',
          syncFolderAutoExportDisabled: 'Sync folder auto-export disabled.',
          syncFolderAutoExportSuccess: (records: number, filePath: string) =>
            `Auto-export wrote ${records} encrypted sync records to ${filePath}. Incoming packets still require manual preview/apply.`,
          syncFolderReviewReady: (records: number, deviceId: string) =>
            'Ready: ' + records + ' records from ' + deviceId + '. Preview before applying.',
          syncFolderReviewRisky: (destructiveChanges: number, timestampTies: number) =>
            `Risk review required: ${destructiveChanges} local updates/deletes and ${timestampTies} same-time ties.`,
          syncFolderReviewUnknownDevice: (deviceName: string) =>
            `Risk review required: unknown source device ${deviceName}. Preview it and confirm trust before applying.`,
          syncFolderReviewStale: 'Stale or already imported. Applying will not change the vault.',
          syncFolderReviewBlocked: (deviceId: string) => `Blocked: source device ${deviceId} is revoked.`,
          syncFolderReviewCheckpointRisk: (status: string) => `Blocked: checkpoint status is ${status}.`,
          syncFolderReviewInvalid: 'Invalid or cannot decrypt with the current vault passphrase.',
          syncFolderAssistedPreviewReady: (fileName: string) =>
            `Safety scan selected ${fileName} and opened its preview. Review before applying.`,
          syncFolderAssistedPreviewChoose: (ready: number, risky: number) =>
            `Safety scan found ${ready} ready and ${risky} risk-review packets. Choose one manually.`,
          syncFolderAssistedPreviewNone:
            'Safety scan did not find an actionable safe packet. Quarantine invalid or blocked packets if needed.',
          syncFolderImportReady: (fileName: string) => `Loaded ${fileName}. Review the sync preview before applying.`,
          syncFolderQuarantineConfirm: (fileName: string) =>
            `Move ${fileName} into the sync folder quarantine? It will no longer appear in normal sync scans.`,
          syncFolderQuarantineSuccess: (fileName: string, quarantinePath: string) =>
            `Moved ${fileName} to quarantine: ${quarantinePath}`,
          syncRiskAcknowledgementRequired:
            'This sync packet updates or deletes local data. Review the decision counts and confirm the risk before applying.',
          syncRecoveryFailed:
            'Sync was not applied because Distill could not save an encrypted recovery snapshot first.',
          deleteConfirm: (content: string) =>
            `Permanently delete this archived block and sync the deletion?\n\n${content}`,
        }
      : {
          passphraseRequired: '暗号化Vaultを開いてから同期パケットを出力・取り込みしてください。',
          exportSuccess: (records: number, deviceName: string) =>
            `${deviceName} から ${records} 件の暗号化同期パケットを出力しました。`,
          importConfirm: (records: number, deviceId: string) =>
            `端末 ${deviceId} からの暗号化同期レコード ${records} 件を統合しますか？新しいレコードが古いローカルレコードを置き換えます。`,
          previewReady: (records: number, deviceId: string) =>
            `端末 ${deviceId} からの暗号化同期レコード ${records} 件のプレビューを作成しました。差分を確認してから適用してください。`,
          previewCanceled: '同期プレビューをキャンセルしました。現在のVaultは変更されていません。',
          staleSkipped: (deviceId: string) =>
            `端末 ${deviceId} からの古い、または取り込み済みの同期パケットをスキップしました。`,
          checkpointRejected:
            '既知端末の同期チェックポイントにつながらないため、この同期パケットは取り込みませんでした。',
          importSuccess: (records: number, deviceId: string) =>
            `端末 ${deviceId} からの暗号化同期レコード ${records} 件を統合しました。`,
          importSuccessWithRecovery: (records: number, deviceId: string, recoveryPath: string) =>
            `端末 ${deviceId} からの暗号化同期レコード ${records} 件を統合しました。復元用スナップショットを ${recoveryPath} に保存しました。`,
          importInvalid: '暗号化同期パケットを取り込めませんでした。ファイルとVaultパスフレーズを確認してください。',
          deviceRenamed: '端末名を更新しました。',
          knownDevices: '同期済み端末',
          noKnownDevices: '同期済み端末はまだありません',
          revokedDevices: '信頼解除済み端末',
          noRevokedDevices: '信頼解除済み端末はありません',
          thisDevice: 'この端末',
          revoke: '信頼解除',
          forget: '記録削除',
          revokeConfirm: (deviceName: string) =>
            `${deviceName} を信頼解除し、この端末からの今後の同期パケットを拒否しますか？`,
          forgetConfirm: (deviceName: string) =>
            `${deviceName} の信頼解除記録を削除しますか？今後この端末のパケットを再び取り込めるようになります。`,
          deviceRevoked: (deviceName: string) => `${deviceName} を信頼解除しました。`,
          revokedForgotten: (deviceName: string) => `${deviceName} の信頼解除記録を削除しました。`,
          revokedSourceRejected: (deviceId: string) =>
            `信頼解除済み端末 ${deviceId} からの同期パケットを拒否しました。`,
          syncDeviceTrustRequired: (deviceName: string) =>
            `この同期パケットは未信頼の端末（${deviceName}）から届いています。適用前に端末を信頼する確認をしてください。`,
          syncFolderRequired: '同期フォルダのパスを先に入力してください。',
          syncFolderDesktopRequired: '同期フォルダはデスクトップアプリでのみ使えます。',
          syncFolderExportSuccess: (records: number, filePath: string) =>
            `${records}件の暗号化同期レコードを ${filePath} に書き出しました。`,
          syncFolderScanSuccess: (files: number) => `同期フォルダ内に${files}件の暗号化同期パケットが見つかりました。`,
          syncFolderReviewSuccess: (files: number, ready: number, risky: number, blocked: number) =>
            `${files}件の暗号化同期パケットを安全スキャンしました。安全候補${ready}件、リスク確認${risky}件、隔離候補${blocked}件です。`,
          syncFolderMonitorEnabled:
            '同期フォルダ監視を有効にしました。Distillは安全レビューキューを更新しますが、パケットは自動適用しません。',
          syncFolderMonitorDisabled: '同期フォルダ監視を無効にしました。',
          syncFolderMonitorUpdated: (files: number, ready: number, risky: number, blocked: number) =>
            `監視で${files}件を更新しました。安全候補${ready}件、リスク確認${risky}件、ブロック/無効${blocked}件です。`,
          syncFolderAutoExportEnabled:
            '同期フォルダへの自動書き出しを有効にしました。ローカル内容が変わった時だけ暗号化パケットを書き出しますが、受信パケットは自動適用しません。',
          syncFolderAutoExportDisabled: '同期フォルダへの自動書き出しを無効にしました。',
          syncFolderAutoExportSuccess: (records: number, filePath: string) =>
            `自動書き出しで${records}件の暗号化同期レコードを${filePath}へ保存しました。受信パケットは引き続き手動プレビュー/適用が必要です。`,
          syncFolderReviewReady: (records: number, deviceId: string) =>
            `安全候補: ${deviceId} からの ${records} 件です。適用前にプレビューしてください。`,
          syncFolderReviewRisky: (destructiveChanges: number, timestampTies: number) =>
            `リスク確認が必要: ローカル更新・削除${destructiveChanges}件、同時刻の決着${timestampTies}件です。`,
          syncFolderReviewUnknownDevice: (deviceName: string) =>
            `リスク確認が必要: 未知の送信元端末 ${deviceName} からのパケットです。プレビュー後、端末信頼を確認してから適用してください。`,
          syncFolderReviewStale: '古い、または取り込み済みです。適用してもVaultは変更されません。',
          syncFolderReviewBlocked: (deviceId: string) => `ブロック: 信頼解除済み端末 ${deviceId} からのパケットです。`,
          syncFolderReviewCheckpointRisk: (status: string) => `ブロック: チェックポイント状態が ${status} です。`,
          syncFolderReviewInvalid: '無効、または現在のVaultパスフレーズで復号できません。',
          syncFolderAssistedPreviewReady: (fileName: string) =>
            `安全スキャンで ${fileName} を選び、プレビューを開きました。適用前に内容を確認してください。`,
          syncFolderAssistedPreviewChoose: (ready: number, risky: number) =>
            `安全スキャンで安全候補${ready}件、リスク確認${risky}件が見つかりました。手動で1件選んでください。`,
          syncFolderAssistedPreviewNone:
            '安全スキャンで適用可能な安全候補は見つかりませんでした。必要なら無効・ブロック済みパケットを隔離してください。',
          syncFolderImportReady: (fileName: string) =>
            `${fileName} を読み込みました。同期プレビューを確認してから適用してください。`,
          syncFolderQuarantineConfirm: (fileName: string) =>
            `${fileName} を同期フォルダの隔離場所へ移動しますか？通常の同期スキャンには表示されなくなります。`,
          syncFolderQuarantineSuccess: (fileName: string, quarantinePath: string) =>
            `${fileName} を隔離しました: ${quarantinePath}`,
          syncRiskAcknowledgementRequired:
            'この同期パケットはローカルデータを更新または削除します。判定レビューを確認し、リスク確認にチェックしてから適用してください。',
          syncRecoveryFailed:
            '暗号化された復元用スナップショットを先に保存できなかったため、同期は適用しませんでした。',
          deleteConfirm: (content: string) =>
            `このアーカイブ済みブロックを完全削除し、削除履歴を同期しますか？\n\n${content}`,
        };
  }

  function restorePreviewLabels() {
    return locale === 'en'
      ? {
          previewReady: (blocks: number, projects: number) =>
            `Restore preview ready for ${blocks} blocks and ${projects} projects. Review the diff before applying.`,
          jsonSuccess: (blocks: number, projects: number) => `Restored ${blocks} blocks and ${projects} projects.`,
          encryptedSuccess: (blocks: number, projects: number) =>
            `Restored encrypted vault with ${blocks} blocks and ${projects} projects.`,
          canceled: 'Restore preview canceled. Current vault was not changed.',
        }
      : {
          previewReady: (blocks: number, projects: number) =>
            `${blocks}件のブロックと${projects}件のプロジェクトの復元プレビューを作成しました。差分を確認してから適用してください。`,
          jsonSuccess: (blocks: number, projects: number) =>
            `${blocks}件のブロックと${projects}件のプロジェクトを復元しました。`,
          encryptedSuccess: (blocks: number, projects: number) =>
            `暗号化Vaultから${blocks}件のブロックと${projects}件のプロジェクトを復元しました。`,
          canceled: '復元プレビューをキャンセルしました。現在のVaultは変更されていません。',
        };
  }

  function renameCurrentDevice(name: string) {
    const identity = deviceIdentity ?? getOrCreateDeviceIdentity();
    const renamed = renameDeviceIdentity(identity, name);

    setDeviceIdentity(renamed);
    setStore((current) => registerSyncDevice(current, renamed));
    setSyncStatus(syncLabels().deviceRenamed);
  }

  function createSyncPacketFileName() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `distill-sync-${timestamp}.distill-sync.json`;
  }

  async function createCurrentEncryptedSyncPacket() {
    const identity = deviceIdentity ?? getOrCreateDeviceIdentity();
    const registeredStore = registerSyncDevice(store, identity);
    const packet = await buildEncryptedSyncPacket(registeredStore, {
      sourceDeviceId: identity.id,
      sourceDeviceName: identity.name,
      passphrase: vaultPassphrase,
    });

    return {
      identity,
      registeredStore,
      packet,
      serializedPacket: serializeEncryptedSyncPacket(packet),
    };
  }

  async function writeCurrentEncryptedSyncPacketToFolder() {
    const { identity, packet, serializedPacket } = await createCurrentEncryptedSyncPacket();
    const filePath = await writeEncryptedSyncPacketFile(syncFolderPath.trim(), createSyncPacketFileName(), serializedPacket);

    setDeviceIdentity(identity);
    setStore((current) => registerSyncPacketCheckpoint(registerSyncDevice(current, identity), packet));
    setSyncFolderPackets(await listEncryptedSyncPacketFiles(syncFolderPath.trim()));
    setSyncFolderPacketReviews([]);

    return { identity, packet, filePath };
  }

  async function exportEncryptedSyncPacket() {
    const labels = syncLabels();
    setSyncPreview(null);
    setSyncRiskAccepted(false);
    setSyncDeviceTrustAccepted(false);

    if (!vaultPassphrase) {
      setSyncStatus(labels.passphraseRequired);
      return;
    }

    try {
      const { identity, packet, serializedPacket } = await createCurrentEncryptedSyncPacket();

      downloadTextFile(createSyncPacketFileName(), serializedPacket, 'application/json');
      setDeviceIdentity(identity);
      setStore((current) => registerSyncPacketCheckpoint(registerSyncDevice(current, identity), packet));
      setSyncStatus(labels.exportSuccess(packet.records.length, identity.name));
    } catch (error) {
      console.warn('Failed to export encrypted Distill sync packet.', error);
      setSyncStatus(error instanceof Error ? error.message : labels.importInvalid);
    }
  }

  async function refreshSyncFolderPackets() {
    const labels = syncLabels();

    if (!syncFolderPath.trim()) {
      setSyncStatus(labels.syncFolderRequired);
      return;
    }

    if (!isDesktopRuntime()) {
      setSyncStatus(labels.syncFolderDesktopRequired);
      return;
    }

    try {
      const files = await listEncryptedSyncPacketFiles(syncFolderPath.trim());
      setSyncFolderPackets(files);
      setSyncFolderPacketReviews([]);
      setSyncStatus(labels.syncFolderScanSuccess(files.length));
    } catch (error) {
      console.warn('Failed to scan Distill sync folder.', error);
      setSyncStatus(error instanceof Error ? error.message : labels.importInvalid);
    }
  }

  async function createSyncFolderPacketReview(packetFile: SyncFolderPacketFile): Promise<SyncFolderPacketReview> {
    const labels = syncLabels();

    try {
      const packetText = await readEncryptedSyncPacketFile(packetFile.path);
      const encryptedPacket = parseEncryptedSyncPacket(packetText);
      const packet = await decryptEncryptedSyncPacket(encryptedPacket, vaultPassphrase);
      const sourceDevice = packet.sourceDeviceName || packet.sourceDeviceId;
      const baseReview = {
        ...packetFile,
        sourceDeviceId: packet.sourceDeviceId,
        sourceDeviceName: packet.sourceDeviceName,
        createdAt: packet.createdAt,
        records: packet.records.length,
      };

      if (isSyncDeviceRevoked(store, packet.sourceDeviceId)) {
        return {
          ...baseReview,
          status: 'blocked',
          reason: labels.syncFolderReviewBlocked(sourceDevice),
        };
      }

      const preview = buildSyncPreview(store, packet);
      const checkpointStatus = getSyncPacketCheckpointStatus(store, packet);
      const decisionReview = {
        destructiveChanges: preview.diff.destructiveChanges,
        timestampTies: preview.diff.timestampTies,
        trustRequired: !preview.diff.sourceDeviceKnown,
        checkpointStatus,
      };

      if (preview.diff.replay) {
        return {
          ...baseReview,
          ...decisionReview,
          status: 'stale',
          reason: labels.syncFolderReviewStale,
        };
      }

      if (checkpointStatus === 'packet-hash-mismatch' || checkpointStatus === 'previous-packet-hash-mismatch') {
        return {
          ...baseReview,
          ...decisionReview,
          status: 'checkpoint-risk',
          reason: labels.syncFolderReviewCheckpointRisk(checkpointStatus),
        };
      }

      if (!preview.diff.sourceDeviceKnown) {
        return {
          ...baseReview,
          ...decisionReview,
          status: 'risk',
          reason: labels.syncFolderReviewUnknownDevice(sourceDevice),
        };
      }

      if (preview.diff.destructiveChanges > 0 || preview.diff.timestampTies > 0) {
        return {
          ...baseReview,
          ...decisionReview,
          status: 'risk',
          reason: labels.syncFolderReviewRisky(preview.diff.destructiveChanges, preview.diff.timestampTies),
        };
      }

      return {
        ...baseReview,
        ...decisionReview,
        status: 'ready',
        reason: labels.syncFolderReviewReady(packet.records.length, sourceDevice),
      };
    } catch (error) {
      console.warn('Failed to review Distill sync packet.', error);
      return {
        ...packetFile,
        status: 'invalid',
        reason: labels.syncFolderReviewInvalid,
      };
    }
  }

  async function collectSyncFolderPacketReviews() {
    const labels = syncLabels();

    if (!syncFolderPath.trim()) {
      setSyncStatus(labels.syncFolderRequired);
      return null;
    }

    if (!vaultPassphrase) {
      setSyncStatus(labels.passphraseRequired);
      return null;
    }

    if (!isDesktopRuntime()) {
      setSyncStatus(labels.syncFolderDesktopRequired);
      return null;
    }

    try {
      const files = await listEncryptedSyncPacketFiles(syncFolderPath.trim());
      const reviews = await Promise.all(files.map((packetFile) => createSyncFolderPacketReview(packetFile)));

      setSyncFolderPackets(files);
      setSyncFolderPacketReviews(reviews);
      return reviews;
    } catch (error) {
      console.warn('Failed to safety scan Distill sync folder.', error);
      setSyncStatus(error instanceof Error ? error.message : labels.importInvalid);
      return null;
    }
  }

  async function reviewSyncFolderPackets() {
    const labels = syncLabels();
    const reviews = await collectSyncFolderPacketReviews();

    if (!reviews) {
      return;
    }

    const counts = countSyncFolderPacketReviews(reviews);
    setSyncStatus(
      labels.syncFolderReviewSuccess(
        reviews.length,
        counts.ready,
        counts.risk,
        counts.blocked + counts.checkpointRisk + counts.invalid,
      ),
    );
  }

  async function runSyncFolderMonitorTick() {
    const labels = syncLabels();
    const reviews = await collectSyncFolderPacketReviews();

    if (!reviews) {
      return;
    }

    const counts = countSyncFolderPacketReviews(reviews);
    setSyncFolderLastCheckedAt(new Date().toLocaleString());
    setSyncStatus(
      labels.syncFolderMonitorUpdated(
        reviews.length,
        counts.ready,
        counts.risk,
        counts.blocked + counts.checkpointRisk + counts.invalid,
      ),
    );
  }

  function toggleSyncFolderMonitor(enabled: boolean) {
    const labels = syncLabels();

    if (enabled && !syncFolderPath.trim()) {
      setSyncStatus(labels.syncFolderRequired);
      return;
    }

    if (enabled && !vaultPassphrase) {
      setSyncStatus(labels.passphraseRequired);
      return;
    }

    if (enabled && !isDesktopRuntime()) {
      setSyncStatus(labels.syncFolderDesktopRequired);
      return;
    }

    setSyncFolderMonitorEnabled(enabled);
    setSyncStatus(enabled ? labels.syncFolderMonitorEnabled : labels.syncFolderMonitorDisabled);

    if (!enabled) {
      setSyncFolderLastCheckedAt('');
    }
  }

  async function runSyncFolderAutoExportTick() {
    const labels = syncLabels();

    if (syncFolderAutoExportInFlight.current) {
      return;
    }

    if (!syncFolderPath.trim()) {
      setSyncStatus(labels.syncFolderRequired);
      return;
    }

    if (!vaultPassphrase) {
      setSyncStatus(labels.passphraseRequired);
      return;
    }

    if (!isDesktopRuntime()) {
      setSyncStatus(labels.syncFolderDesktopRequired);
      return;
    }

    const identity = deviceIdentity ?? getOrCreateDeviceIdentity();
    const fingerprint = createSyncAutoExportFingerprint(store, identity);

    if (fingerprint === syncFolderAutoExportFingerprint) {
      return;
    }

    syncFolderAutoExportInFlight.current = true;

    try {
      const { packet, filePath } = await writeCurrentEncryptedSyncPacketToFolder();

      setSyncFolderAutoExportFingerprint(fingerprint);
      setSyncFolderAutoExportLastAt(new Date().toLocaleString());
      setSyncFolderAutoExportLastFile(filePath);
      setSyncStatus(labels.syncFolderAutoExportSuccess(packet.records.length, filePath));
    } catch (error) {
      console.warn('Failed to auto-export encrypted Distill sync packet to folder.', error);
      setSyncStatus(error instanceof Error ? error.message : labels.importInvalid);
    } finally {
      syncFolderAutoExportInFlight.current = false;
    }
  }

  function toggleSyncFolderAutoExport(enabled: boolean) {
    const labels = syncLabels();

    if (enabled && !syncFolderPath.trim()) {
      setSyncStatus(labels.syncFolderRequired);
      return;
    }

    if (enabled && !vaultPassphrase) {
      setSyncStatus(labels.passphraseRequired);
      return;
    }

    if (enabled && !isDesktopRuntime()) {
      setSyncStatus(labels.syncFolderDesktopRequired);
      return;
    }

    setSyncFolderAutoExportEnabled(enabled);
    setSyncStatus(enabled ? labels.syncFolderAutoExportEnabled : labels.syncFolderAutoExportDisabled);

    if (!enabled) {
      setSyncFolderAutoExportLastAt('');
      setSyncFolderAutoExportLastFile('');
    }
  }

  async function previewRecommendedSyncFolderPacket() {
    const labels = syncLabels();
    const reviews = await collectSyncFolderPacketReviews();

    if (!reviews) {
      return;
    }

    const decision = chooseAssistedSyncFolderPreview(reviews);

    if (decision.kind === 'auto-preview') {
      await importEncryptedSyncPacketFromFolder(
        decision.candidate,
        labels.syncFolderAssistedPreviewReady(decision.candidate.fileName),
      );
      return;
    }

    if (decision.kind === 'choose') {
      setSyncStatus(labels.syncFolderAssistedPreviewChoose(decision.counts.ready, decision.counts.risk));
      return;
    }

    setSyncStatus(labels.syncFolderAssistedPreviewNone);
  }

  async function exportEncryptedSyncPacketToFolder() {
    const labels = syncLabels();
    setSyncPreview(null);
    setSyncRiskAccepted(false);
    setSyncDeviceTrustAccepted(false);

    if (!syncFolderPath.trim()) {
      setSyncStatus(labels.syncFolderRequired);
      return;
    }

    if (!vaultPassphrase) {
      setSyncStatus(labels.passphraseRequired);
      return;
    }

    if (!isDesktopRuntime()) {
      setSyncStatus(labels.syncFolderDesktopRequired);
      return;
    }

    try {
      const fingerprint = createSyncAutoExportFingerprint(store, deviceIdentity ?? getOrCreateDeviceIdentity());
      const { packet, filePath } = await writeCurrentEncryptedSyncPacketToFolder();

      setSyncFolderAutoExportFingerprint(fingerprint);
      setSyncStatus(labels.syncFolderExportSuccess(packet.records.length, filePath));
    } catch (error) {
      console.warn('Failed to export encrypted Distill sync packet to folder.', error);
      setSyncStatus(error instanceof Error ? error.message : labels.importInvalid);
    }
  }

  async function previewEncryptedSyncPacketText(packetText: string, readyMessage?: string) {
    const labels = syncLabels();
    setSyncPreview(null);
    setSyncRiskAccepted(false);
    setSyncDeviceTrustAccepted(false);

    if (!vaultPassphrase) {
      setSyncStatus(labels.passphraseRequired);
      return;
    }

    setSyncStatus('');

    try {
      const encryptedPacket = parseEncryptedSyncPacket(packetText);
      const packet = await decryptEncryptedSyncPacket(encryptedPacket, vaultPassphrase);

      if (isSyncDeviceRevoked(store, packet.sourceDeviceId)) {
        setSyncStatus(labels.revokedSourceRejected(packet.sourceDeviceId));
        setSyncPreview(null);
        setSyncRiskAccepted(false);
        setSyncDeviceTrustAccepted(false);
        return;
      }

      const preview = buildSyncPreview(store, packet);
      const checkpointStatus = getSyncPacketCheckpointStatus(store, packet);

      if (!preview.diff.replay && checkpointStatus === 'previous-packet-hash-mismatch') {
        setSyncStatus(labels.checkpointRejected);
        setSyncPreview(null);
        setSyncRiskAccepted(false);
        setSyncDeviceTrustAccepted(false);
        return;
      }

      setSyncRiskAccepted(false);
      setSyncDeviceTrustAccepted(false);
      setSyncPreview(preview);
      setSyncStatus(
        readyMessage
          ? readyMessage
          : preview.diff.replay
          ? labels.staleSkipped(packet.sourceDeviceId)
          : labels.previewReady(packet.records.length, packet.sourceDeviceId),
      );
    } catch (error) {
      console.warn('Failed to import encrypted Distill sync packet.', error);
      setSyncStatus(labels.importInvalid);
      setSyncPreview(null);
      setSyncRiskAccepted(false);
      setSyncDeviceTrustAccepted(false);
    }
  }

  async function importEncryptedSyncPacket(file: File) {
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setSyncStatus(vaultLabels().fileTooLarge);
      setSyncPreview(null);
      setSyncRiskAccepted(false);
      setSyncDeviceTrustAccepted(false);
      return;
    }

    await previewEncryptedSyncPacketText(await file.text());
  }

  async function importEncryptedSyncPacketFromFolder(packetFile: SyncFolderPacketFile, readyMessage?: string) {
    const labels = syncLabels();

    if (!vaultPassphrase) {
      setSyncStatus(labels.passphraseRequired);
      return;
    }

    if (!isDesktopRuntime()) {
      setSyncStatus(labels.syncFolderDesktopRequired);
      return;
    }

    try {
      const packetText = await readEncryptedSyncPacketFile(packetFile.path);
      await previewEncryptedSyncPacketText(packetText, readyMessage ?? labels.syncFolderImportReady(packetFile.fileName));
    } catch (error) {
      console.warn('Failed to import encrypted Distill sync packet from folder.', error);
      setSyncStatus(error instanceof Error ? error.message : labels.importInvalid);
      setSyncPreview(null);
      setSyncRiskAccepted(false);
      setSyncDeviceTrustAccepted(false);
    }
  }

  async function quarantineSyncFolderPacket(packetFile: SyncFolderPacketFile) {
    const labels = syncLabels();

    if (!isDesktopRuntime()) {
      setSyncStatus(labels.syncFolderDesktopRequired);
      return;
    }

    const confirmed = window.confirm(labels.syncFolderQuarantineConfirm(packetFile.fileName));

    if (!confirmed) {
      return;
    }

    try {
      const quarantinePath = await quarantineEncryptedSyncPacketFile(packetFile.path);
      setSyncPreview(null);
      setSyncRiskAccepted(false);
      setSyncDeviceTrustAccepted(false);
      setSyncFolderPacketReviews((current) => current.filter((review) => review.path !== packetFile.path));
      setSyncStatus(labels.syncFolderQuarantineSuccess(packetFile.fileName, quarantinePath));

      if (syncFolderPath.trim()) {
        setSyncFolderPackets(await listEncryptedSyncPacketFiles(syncFolderPath.trim()));
      }
    } catch (error) {
      console.warn('Failed to quarantine Distill sync packet.', error);
      setSyncStatus(error instanceof Error ? error.message : labels.importInvalid);
    }
  }

  async function savePreSyncRecoverySnapshot(preview: SyncPreview) {
    const encrypted = await encryptDistillVault(exportStoreAsJson(store), vaultPassphrase);
    return await saveSyncRecoveryVault(encrypted, preview.packet.sourceDeviceId);
  }

  async function applySyncPreview() {
    if (!syncPreview) {
      return;
    }

    const labels = syncLabels();

    if (syncPreview.diff.replay) {
      setSyncStatus(labels.staleSkipped(syncPreview.packet.sourceDeviceId));
      setSyncPreview(null);
      setSyncRiskAccepted(false);
      setSyncDeviceTrustAccepted(false);
      return;
    }

    if (syncPreviewRequiresDeviceTrust(syncPreview) && !syncDeviceTrustAccepted) {
      setSyncStatus(
        labels.syncDeviceTrustRequired(syncPreview.packet.sourceDeviceName || syncPreview.packet.sourceDeviceId),
      );
      return;
    }

    if (syncPreviewRequiresRiskAcknowledgement(syncPreview) && !syncRiskAccepted) {
      setSyncStatus(labels.syncRiskAcknowledgementRequired);
      return;
    }

    let recoveryPath = '';

    try {
      recoveryPath = await savePreSyncRecoverySnapshot(syncPreview);
    } catch (error) {
      console.warn('Failed to save pre-sync Distill recovery snapshot.', error);
      setSyncStatus(labels.syncRecoveryFailed);
      return;
    }

    try {
      const mergedStore = applySyncPacket(store, syncPreview.packet);
      setStore(mergedStore);
      setSelectedBlockId(mergedStore.blocks[0]?.id);
      setSyncStatus(
        labels.importSuccessWithRecovery(
          syncPreview.packet.records.length,
          syncPreview.packet.sourceDeviceId,
          recoveryPath,
        ),
      );
      setSyncPreview(null);
      setSyncRiskAccepted(false);
      setSyncDeviceTrustAccepted(false);
      void refreshSyncRecoveryVaultSnapshots(true);
    } catch (error) {
      console.warn('Failed to apply encrypted Distill sync preview.', error);
      setSyncStatus(labels.checkpointRejected);
      setSyncPreview(null);
      setSyncRiskAccepted(false);
      setSyncDeviceTrustAccepted(false);
    }
  }

  function cancelSyncPreview() {
    setSyncPreview(null);
    setSyncRiskAccepted(false);
    setSyncDeviceTrustAccepted(false);
    setSyncStatus(syncLabels().previewCanceled);
  }

  function revokeKnownSyncDevice(deviceId: string) {
    if (!deviceId || deviceId === deviceIdentity?.id) {
      return;
    }

    const labels = syncLabels();
    const deviceName = syncDevices.find((device) => device.id === deviceId)?.name ?? deviceId;
    const confirmed = window.confirm(labels.revokeConfirm(deviceName));

    if (!confirmed) {
      return;
    }

    setStore((current) => revokeSyncDevice(current, deviceId));
    setSyncPreview(null);
    setSyncStatus(labels.deviceRevoked(deviceName));
  }

  function forgetRevokedDeviceRecord(deviceId: string) {
    if (!deviceId) {
      return;
    }

    const labels = syncLabels();
    const deviceName = revokedSyncDevices.find((device) => device.id === deviceId)?.name ?? deviceId;
    const confirmed = window.confirm(labels.forgetConfirm(deviceName));

    if (!confirmed) {
      return;
    }

    setStore((current) => forgetRevokedSyncDevice(current, deviceId));
    setSyncStatus(labels.revokedForgotten(deviceName));
  }

  function permanentlyDeleteArchivedBlock(blockId: string) {
    const labels = syncLabels();
    const block = store.blocks.find((item) => item.id === blockId);

    if (!block) {
      return;
    }

    const confirmed = window.confirm(labels.deleteConfirm(block.content));

    if (!confirmed) {
      return;
    }

    const identity = deviceIdentity ?? getOrCreateDeviceIdentity();
    const nextStore = registerSyncDevice(permanentlyDeleteBlock(blockId, identity.id)(store), identity);

    setDeviceIdentity(identity);
    setStore(nextStore);
    setSelectedBlockId(nextStore.blocks[0]?.id);
  }

  async function backupEncryptedVault() {
    const labels = vaultLabels();
    const passphrase = window.prompt(labels.passphrase);

    if (!passphrase) {
      return;
    }

    const confirmation = window.prompt(labels.confirmPassphrase);

    if (passphrase !== confirmation) {
      setRestoreStatus(labels.mismatch);
      return;
    }

    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const encrypted = await encryptDistillVault(exportStoreAsJson(store), passphrase);
      downloadTextFile(`distill-vault-${timestamp}.distill-vault.json`, encrypted, 'application/json');
      setRestoreStatus(labels.encryptedBackupSuccess);
    } catch (error) {
      console.warn('Failed to create encrypted Distill vault.', error);
      setRestoreStatus(error instanceof Error ? error.message : labels.encryptedRestoreInvalid);
    }
  }

  async function refreshSyncRecoveryVaultSnapshots(silent = false) {
    const labels = vaultLabels();

    try {
      const snapshots = await listSyncRecoveryVaults();
      setSyncRecoveryVaults(snapshots);

      if (!silent) {
        setRestoreStatus(labels.syncRecoveryListSuccess(snapshots.length));
      }
    } catch (error) {
      console.warn('Failed to list Distill sync recovery snapshots.', error);
      setSyncRecoveryVaults([]);

      if (!silent) {
        setRestoreStatus(error instanceof Error ? error.message : labels.syncRecoveryRestoreInvalid);
      }
    }
  }

  async function previewSyncRecoveryVaultSnapshot(snapshot: SyncRecoveryVaultFile) {
    const labels = vaultLabels();

    setRestoreStatus('');
    setRestorePreview(null);

    if (snapshot.bytes > MAX_IMPORT_FILE_BYTES) {
      setRestoreStatus(labels.fileTooLarge);
      return;
    }

    const passphrase = window.prompt(labels.passphrase);

    if (!passphrase) {
      return;
    }

    try {
      const encrypted = await readSyncRecoveryVault(snapshot.path);
      const decrypted = await decryptDistillVault(encrypted, passphrase);
      const importedStore = parseDistillImport(decrypted);
      setRestorePreview(buildRestorePreview(store, importedStore, 'sync-recovery'));
      setRestoreStatus(restorePreviewLabels().previewReady(importedStore.blocks.length, importedStore.projects.length));
    } catch (error) {
      console.warn('Failed to preview Distill sync recovery snapshot.', error);
      setRestoreStatus(labels.syncRecoveryRestoreInvalid);
      setRestorePreview(null);
    }
  }

  async function restoreEncryptedVault(file: File) {
    const labels = vaultLabels();

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setRestoreStatus(labels.fileTooLarge);
      setRestorePreview(null);
      return;
    }

    const passphrase = window.prompt(labels.passphrase);

    if (!passphrase) {
      return;
    }

    setRestoreStatus('');
    setRestorePreview(null);

    try {
      const decrypted = await decryptDistillVault(await file.text(), passphrase);
      const importedStore = parseDistillImport(decrypted);
      setRestorePreview(buildRestorePreview(store, importedStore, 'encrypted-vault'));
      setRestoreStatus(restorePreviewLabels().previewReady(importedStore.blocks.length, importedStore.projects.length));
    } catch (error) {
      console.warn('Failed to restore encrypted Distill vault.', error);
      setRestoreStatus(labels.encryptedRestoreInvalid);
      setRestorePreview(null);
    }
  }

  async function restoreJson(file: File) {
    setRestoreStatus('');
    setRestorePreview(null);

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setRestoreStatus(vaultLabels().fileTooLarge);
      return;
    }

    try {
      const importedStore = parseDistillImport(await file.text());
      setRestorePreview(buildRestorePreview(store, importedStore, 'json'));
      setRestoreStatus(restorePreviewLabels().previewReady(importedStore.blocks.length, importedStore.projects.length));
    } catch (error) {
      console.warn('Failed to import Distill JSON.', error);
      setRestoreStatus(ui.restoreInvalid as string);
      setRestorePreview(null);
    }
  }

  function applyRestorePreview() {
    if (!restorePreview) {
      return;
    }

    const labels = restorePreviewLabels();
    const incomingStore = restorePreview.store;

    setStore(incomingStore);
    setSelectedBlockId(incomingStore.blocks[0]?.id);
    setRestoreStatus(
      restorePreview.kind === 'sync-recovery'
        ? vaultLabels().syncRecoveryRestoreSuccess(incomingStore.blocks.length, incomingStore.projects.length)
        : restorePreview.kind === 'encrypted-vault'
          ? labels.encryptedSuccess(incomingStore.blocks.length, incomingStore.projects.length)
          : labels.jsonSuccess(incomingStore.blocks.length, incomingStore.projects.length),
    );
    setRestorePreview(null);
  }

  function cancelRestorePreview() {
    setRestorePreview(null);
    setRestoreStatus(restorePreviewLabels().canceled);
  }

  async function importMarkdown(file: File) {
    setRestoreStatus('');
    setRestorePreview(null);

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setRestoreStatus(vaultLabels().fileTooLarge);
      return;
    }

    try {
      const importedStore = createMarkdownImport(await file.text());

      setStore((current) => ({
        ...current,
        projects: [...current.projects, ...importedStore.projects],
        blocks: [...importedStore.blocks, ...current.blocks],
      }));
      setSelectedBlockId(importedStore.blocks[0]?.id);
      setRestoreStatus(ui.importSuccess(importedStore.blocks.length, importedStore.projects.length));
    } catch (error) {
      console.warn('Failed to import Markdown.', error);
      setRestoreStatus(ui.markdownInvalid as string);
    }
  }

  async function startUpdate() {
    const path = updateInstallerPath.trim();

    if (!path) {
      setUpdateStatus(ui.updatePathRequired as string);
      return;
    }

    setUpdateStatus(ui.updateStarting as string);

    try {
      await persistEncryptedStore(store);
      await startUpdateInstaller(path);
    } catch (error) {
      console.warn('Failed to start update installer.', error);
      setUpdateStatus(error instanceof Error && error.message.includes('Desktop app') ? (ui.updateDesktopOnly as string) : (ui.updateFailed as string));
    }
  }

  async function checkForUpdates() {
    setAutoUpdateStatus(ui.autoUpdateChecking as string);

    try {
      const update = await checkForAppUpdate();

      if (!update) {
        setIsAutoUpdateAvailable(false);
        setAutoUpdateStatus(ui.autoUpdateNone as string);
        return;
      }

      setIsAutoUpdateAvailable(true);
      setAutoUpdateStatus(ui.autoUpdateAvailable(update.version));
    } catch (error) {
      console.warn('Failed to check for app update.', error);
      setIsAutoUpdateAvailable(false);
      setAutoUpdateStatus(
        error instanceof Error && error.message.includes('Desktop app')
          ? (ui.updateDesktopOnly as string)
          : `${ui.autoUpdateFailed as string} ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async function installAutoUpdate() {
    setAutoUpdateStatus(ui.autoUpdateInstalling as string);

    try {
      await persistEncryptedStore(store);
      await installPendingAppUpdate((event) => {
        if (event.event === 'Started') {
          setAutoUpdateStatus(ui.autoUpdateDownloadStarted(event.data.contentLength ?? 0));
        }

        if (event.event === 'Progress') {
          setAutoUpdateStatus(ui.autoUpdateDownloading(event.data.chunkLength));
        }

        if (event.event === 'Finished') {
          setAutoUpdateStatus(ui.autoUpdateDownloaded as string);
        }
      });
      setAutoUpdateStatus(ui.autoUpdateInstalled as string);
    } catch (error) {
      console.warn('Failed to install app update.', error);
      setAutoUpdateStatus(
        error instanceof Error && error.message.includes('Desktop app')
          ? (ui.updateDesktopOnly as string)
          : `${ui.autoUpdateInstallFailed as string} ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  function createProjectFromText(text: string) {
    const name = text.trim();
    if (!name) {
      scrollToSection('projects');
      return;
    }

    const nextStore = createProject({
      name,
      signal: '',
      status: 'Active',
    })(store);

    setStore(nextStore);
    scrollToSection('projects');
  }

  function submitNewProject() {
    if (!newProjectName.trim()) {
      setProjectFormError(ui.projectRequired as string);
      return;
    }

    setStore(
      createProject({
        name: newProjectName,
        signal: newProjectSignal,
        status: newProjectStatus,
      }),
    );
    setNewProjectName('');
    setNewProjectSignal('');
    setNewProjectStatus('Active');
    setProjectFormError('');
  }

  function scrollToSection(sectionId: string) {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `#${sectionId}`);
  }

  function runCommand(command: CommandItem) {
    command.run();
    setIsCommandOpen(false);
    setCommandQuery('');
  }

  function dismissOnboarding() {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setIsOnboardingVisible(false);
  }

  function startEditing(blockId: string, content: string) {
    setSelectedBlockId(blockId);
    setEditingBlockId(blockId);
    setEditingText(content);
  }

  function toggleBlockProcessed(blockId: string) {
    const previousBlock = store.blocks.find((item) => item.id === blockId);
    const nextStore = toggleProcessed(blockId)(store);
    const nextBlock = nextStore.blocks.find((item) => item.id === blockId);

    setStore(nextStore);
    if (nextBlock && previousBlock?.state !== 'processed' && nextBlock.state === 'processed') {
      void emitReviewDecision(nextBlock, nextStore);
    }
  }

  function cancelEditing() {
    setEditingBlockId(undefined);
    setEditingText('');
  }

  function saveEditing() {
    if (!editingBlockId || !editingText.trim()) {
      return;
    }

    setStore(updateBlockContent(editingBlockId, editingText));
    cancelEditing();
  }

  if (vaultStatus !== 'unlocked') {
    return (
      <VaultGate
        locale={locale}
        mode={vaultStatus}
        hasLegacyPlainStore={Boolean(legacyPlainStore)}
        error={vaultError}
        notice={vaultNotice}
        onLocaleChange={setLocale}
        onUnlock={(passphrase) => void unlockVault(passphrase)}
        onCreate={(passphrase, confirmation) => void createOrMigrateVault(passphrase, confirmation)}
      />
    );
  }

  return (
    <main className="shell">
      <Sidebar ui={ui} blockCount={store.blocks.length} hasLoadedStore={hasLoadedStore} appVersion={APP_VERSION} />

      <section className="workspace">
        <Topbar
          ui={ui}
          locale={locale}
          onLocaleChange={setLocale}
          onOpenCommandPalette={() => setIsCommandOpen(true)}
          onLockVault={() => void lockVault()}
        />

        {isOnboardingVisible ? (
          <section className="onboardingPanel" aria-label={ui.onboardingTitle as string}>
            <div>
              <p>{ui.localFirst as string}</p>
              <h2>{ui.onboardingTitle as string}</h2>
              <span>{ui.onboardingBody as string}</span>
            </div>
            <ol>
              {ui.onboardingSteps.map((step: string) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <button type="button" onClick={dismissOnboarding}>
              {ui.dismissOnboarding as string}
            </button>
          </section>
        ) : null}

        <CapturePanel
          ui={ui}
          captureText={captureText}
          onCaptureTextChange={setCaptureText}
          onCapture={captureBlock}
        />

        <div className="contentGrid">
          <TodayPanel
            ui={ui}
            locale={locale}
            projects={store.projects}
            todayNoteId={todayNoteId}
            todayBlocks={todayBlocks}
            focusProjects={focusProjects}
            dailyNotes={dailyNotes}
            onSelectBlock={setSelectedBlockId}
            onSearchProject={(projectName) => {
              setQuery(projectName);
              scrollToSection('search');
            }}
          />

          <InboxPanel
            ui={ui}
            locale={locale}
            projects={store.projects}
            activeBlocks={activeBlocks}
            openBlocksCount={openBlocks.length}
            selectedBlockId={selectedBlockId}
            editingBlockId={editingBlockId}
            editingText={editingText}
            onSelectBlock={setSelectedBlockId}
            onToggleProcessed={toggleBlockProcessed}
            onStartEditing={startEditing}
            onEditingTextChange={setEditingText}
            onSaveEditing={saveEditing}
            onCancelEditing={cancelEditing}
            onArchiveBlock={(blockId) => {
              setStore(archiveBlock(blockId));
              if (selectedBlockId === blockId) {
                setSelectedBlockId(activeBlocks.find((item) => item.id !== blockId)?.id);
              }
            }}
          />

          <InspectorPanel
            ui={ui}
            projects={store.projects}
            selectedBlock={selectedBlock}
            selectedPeople={selectedPeople}
            relatedBlocks={relatedBlocks}
            hasLoadedStore={hasLoadedStore}
            storagePath={storagePath}
            backupPath={backupPath}
            restoreStatus={restoreStatus}
            restorePreview={restorePreview}
            syncRecoveryVaults={syncRecoveryVaults}
            syncStatus={syncStatus}
            syncPreview={syncPreview}
            syncRiskAccepted={syncRiskAccepted}
            syncDeviceTrustAccepted={syncDeviceTrustAccepted}
            syncFolderPath={syncFolderPath}
            syncFolderMonitorEnabled={syncFolderMonitorEnabled}
            syncFolderLastCheckedAt={syncFolderLastCheckedAt}
            syncFolderAutoExportEnabled={syncFolderAutoExportEnabled}
            syncFolderAutoExportLastAt={syncFolderAutoExportLastAt}
            syncFolderAutoExportLastFile={syncFolderAutoExportLastFile}
            syncFolderPackets={syncFolderPackets}
            syncFolderPacketReviews={syncFolderPacketReviews}
            personalKmHandoffStatus={personalKmHandoffStatus}
            deviceId={deviceIdentity?.id ?? ''}
            deviceName={deviceIdentity?.name ?? ''}
            syncDevices={syncDevices}
            revokedSyncDevices={revokedSyncDevices}
            vaultSecurityStatus={vaultSecurityStatus}
            autoLockMinutes={autoLockMinutes}
            updateInstallerPath={updateInstallerPath}
            updateStatus={updateStatus}
            autoUpdateStatus={autoUpdateStatus}
            isAutoUpdateAvailable={isAutoUpdateAvailable}
            appVersion={APP_VERSION}
            updateFeedUrl={UPDATE_FEED_URL}
            latestReleaseUrl={LATEST_RELEASE_URL}
            isDesktopRuntime={isDesktopRuntime()}
            onSearch={(searchText) => {
              setQuery(searchText);
              scrollToSection('search');
            }}
            onSelectBlock={setSelectedBlockId}
            onAssignProject={(blockId, projectId) => setStore(assignProject(blockId, projectId))}
            onBackupJson={backupJson}
            onBackupEncryptedVault={backupEncryptedVault}
            onExportMarkdown={exportMarkdown}
            onExportJson={exportJson}
            onRestoreJson={restoreJson}
            onRestoreEncryptedVault={restoreEncryptedVault}
            onRefreshSyncRecoveryVaults={() => void refreshSyncRecoveryVaultSnapshots()}
            onPreviewSyncRecoveryVault={(snapshot) => void previewSyncRecoveryVaultSnapshot(snapshot)}
            onApplyRestorePreview={applyRestorePreview}
            onCancelRestorePreview={cancelRestorePreview}
            onImportMarkdown={importMarkdown}
            onDeviceNameChange={renameCurrentDevice}
            onExportEncryptedSyncPacket={() => void exportEncryptedSyncPacket()}
            onImportEncryptedSyncPacket={(file) => void importEncryptedSyncPacket(file)}
            onSyncFolderPathChange={(path) => {
              setSyncFolderPath(path);
              setSyncFolderPacketReviews([]);
            }}
            onSyncFolderMonitorToggle={toggleSyncFolderMonitor}
            onSyncFolderAutoExportToggle={toggleSyncFolderAutoExport}
            onExportEncryptedSyncPacketToFolder={() => void exportEncryptedSyncPacketToFolder()}
            onRefreshSyncFolderPackets={() => void refreshSyncFolderPackets()}
            onReviewSyncFolderPackets={() => void reviewSyncFolderPackets()}
            onPreviewRecommendedSyncFolderPacket={() => void previewRecommendedSyncFolderPacket()}
            onImportSyncFolderPacket={(packetFile) => void importEncryptedSyncPacketFromFolder(packetFile)}
            onQuarantineSyncFolderPacket={(packetFile) => void quarantineSyncFolderPacket(packetFile)}
            onApplySyncPreview={() => void applySyncPreview()}
            onCancelSyncPreview={cancelSyncPreview}
            onSyncRiskAcceptedChange={setSyncRiskAccepted}
            onSyncDeviceTrustAcceptedChange={setSyncDeviceTrustAccepted}
            onRevokeSyncDevice={revokeKnownSyncDevice}
            onForgetRevokedSyncDevice={forgetRevokedDeviceRecord}
            onHandoffToPersonalKm={() => void handoffToPersonalKm()}
            onChangeVaultPassphrase={(currentPassphrase, nextPassphrase, confirmation) =>
              void changeVaultPassphrase(currentPassphrase, nextPassphrase, confirmation)
            }
            onAutoLockMinutesChange={setAutoLockMinutes}
            onUpdateInstallerPathChange={setUpdateInstallerPath}
            onStartUpdate={startUpdate}
            onCheckForUpdates={checkForUpdates}
            onInstallAutoUpdate={installAutoUpdate}
          />

          <SearchPanel
            ui={ui}
            query={query}
            results={results}
            onQueryChange={setQuery}
            onSelectBlock={setSelectedBlockId}
          />

          <PeoplePanel
            ui={ui}
            peopleIndex={peopleIndex}
            onSearchPerson={(name, firstBlockId) => {
              setQuery(`@${name}`);
              setSelectedBlockId(firstBlockId);
              scrollToSection('search');
            }}
          />

          <GraphPanel
            ui={ui}
            graphNodes={graphNodes}
            graphEdges={graphEdges}
            positionedGraphNodes={positionedGraphNodes}
            graphPositionById={graphPositionById}
            edgeFilter={graphEdgeFilter}
            onEdgeFilterChange={setGraphEdgeFilter}
            selectedGraphNodeId={selectedGraphNodeId}
            graphNeighbors={graphNeighbors}
            selectedBlockId={selectedBlockId}
            onSelectGraphNode={setSelectedGraphNodeId}
            onSelectBlock={setSelectedBlockId}
            onSearchConcept={(concept) => {
              setQuery(concept);
              scrollToSection('search');
            }}
          />

          <ProjectsPanel
            ui={ui}
            projectCounts={projectCounts}
            newProjectName={newProjectName}
            newProjectSignal={newProjectSignal}
            newProjectStatus={newProjectStatus}
            projectFormError={projectFormError}
            onNewProjectNameChange={setNewProjectName}
            onNewProjectSignalChange={setNewProjectSignal}
            onNewProjectStatusChange={setNewProjectStatus}
            onClearProjectFormError={() => setProjectFormError('')}
            onSubmitNewProject={submitNewProject}
          />

          <ArchivePanel
            ui={ui}
            locale={locale}
            projects={store.projects}
            archivedBlocks={archivedBlocks}
            onRestoreBlock={(blockId) => {
              setStore(restoreBlock(blockId));
              setSelectedBlockId(blockId);
            }}
            onDeleteBlock={permanentlyDeleteArchivedBlock}
          />
        </div>
      </section>

      {isCommandOpen && (
        <CommandPalette
          ui={ui}
          commandQuery={commandQuery}
          filteredCommandItems={filteredCommandItems}
          onCommandQueryChange={setCommandQuery}
          onRunCommand={runCommand}
          onClose={() => setIsCommandOpen(false)}
        />
      )}
    </main>
  );
}

export default App;

