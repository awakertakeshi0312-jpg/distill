import { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { exportStoreAsJson, exportStoreAsMarkdown, downloadTextFile } from './export';
import { createMarkdownImport, parseDistillImport } from './import';
import { decryptDistillVault, encryptDistillVault } from './vaultCrypto';
import { getOrCreateDeviceIdentity, renameDeviceIdentity, type DeviceIdentity } from './device';
import { APP_VERSION, LATEST_RELEASE_URL, UPDATE_FEED_URL } from './appInfo';
import { initialStore, type DistillStore, type Project, type SearchResult } from './model';
import {
  applyEncryptedSyncPacket,
  buildEncryptedSyncPacket,
  parseEncryptedSyncPacket,
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
  restoreBlock,
  toggleProcessed,
  updateBlockContent,
} from './repository';
import {
  checkForAppUpdate,
  clearLegacyPlainStore,
  isDesktopRuntime,
  installPendingAppUpdate,
  loadGraph,
  loadEncryptedVault,
  loadLegacyPlainStore,
  loadStorageInfo,
  saveEncryptedVault,
  searchStore,
  startUpdateInstaller,
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

const ONBOARDING_KEY = 'distill.onboarding.dismissed';
const AUTO_LOCK_MINUTES_KEY = 'distill.autoLockMinutes';
const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024;
type VaultStatus = 'checking' | 'locked' | 'setup' | 'unlocked';

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
  const [syncStatus, setSyncStatus] = useState('');
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
  }

  function exportMarkdown() {
    downloadTextFile('distill-export.md', exportStoreAsMarkdown(store), 'text/markdown');
  }

  function exportJson() {
    downloadTextFile('distill-export.json', exportStoreAsJson(store), 'application/json');
  }

  function backupJson() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadTextFile(`distill-backup-${timestamp}.json`, exportStoreAsJson(store), 'application/json');
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
          encryptedRestoreInvalid: 'Could not decrypt or restore that encrypted vault. Check the passphrase and file.',
          fileTooLarge: 'Import file is too large. Keep imports under 5 MB for this MVP.',
        }
      : {
          passphrase: '12文字以上のVaultパスフレーズを入力してください。',
          confirmPassphrase: '同じVaultパスフレーズをもう一度入力してください。',
          mismatch: 'Vaultパスフレーズが一致しません。',
          encryptedBackupSuccess: '暗号化Vaultバックアップを作成しました。',
          encryptedRestoreSuccess: (blocks: number, projects: number) => `暗号化Vaultから${blocks}件のブロックと${projects}件のプロジェクトを復元しました。`,
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
          importSuccess: (records: number, deviceId: string) =>
            `Merged ${records} encrypted sync records from device ${deviceId}.`,
          importInvalid: 'Could not import that encrypted sync packet. Check the file and vault passphrase.',
          deviceRenamed: 'Device name updated.',
        }
      : {
          passphraseRequired: '暗号化Vaultを開いてから同期パケットを出力・取り込みしてください。',
          exportSuccess: (records: number, deviceName: string) =>
            `${deviceName} から ${records} 件の暗号化同期パケットを出力しました。`,
          importConfirm: (records: number, deviceId: string) =>
            `端末 ${deviceId} からの暗号化同期レコード ${records} 件を統合しますか？新しいレコードが古いローカルレコードを置き換えます。`,
          importSuccess: (records: number, deviceId: string) =>
            `端末 ${deviceId} からの暗号化同期レコード ${records} 件を統合しました。`,
          importInvalid: '暗号化同期パケットを取り込めませんでした。ファイルとVaultパスフレーズを確認してください。',
          deviceRenamed: '端末名を更新しました。',
        };
  }

  function renameCurrentDevice(name: string) {
    const identity = deviceIdentity ?? getOrCreateDeviceIdentity();
    setDeviceIdentity(renameDeviceIdentity(identity, name));
    setSyncStatus(syncLabels().deviceRenamed);
  }

  async function exportEncryptedSyncPacket() {
    const labels = syncLabels();
    const identity = deviceIdentity ?? getOrCreateDeviceIdentity();

    if (!vaultPassphrase) {
      setSyncStatus(labels.passphraseRequired);
      return;
    }

    try {
      const packet = await buildEncryptedSyncPacket(store, {
        sourceDeviceId: identity.id,
        passphrase: vaultPassphrase,
      });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      downloadTextFile(
        `distill-sync-${timestamp}.distill-sync.json`,
        serializeEncryptedSyncPacket(packet),
        'application/json',
      );
      setSyncStatus(labels.exportSuccess(packet.records.length, identity.name));
    } catch (error) {
      console.warn('Failed to export encrypted Distill sync packet.', error);
      setSyncStatus(error instanceof Error ? error.message : labels.importInvalid);
    }
  }

  async function importEncryptedSyncPacket(file: File) {
    const labels = syncLabels();

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setSyncStatus(vaultLabels().fileTooLarge);
      return;
    }

    if (!vaultPassphrase) {
      setSyncStatus(labels.passphraseRequired);
      return;
    }

    setSyncStatus('');

    try {
      const packet = parseEncryptedSyncPacket(await file.text());
      const confirmed = window.confirm(labels.importConfirm(packet.records.length, packet.sourceDeviceId));

      if (!confirmed) {
        return;
      }

      const mergedStore = await applyEncryptedSyncPacket(store, packet, vaultPassphrase);
      setStore(mergedStore);
      setSelectedBlockId(mergedStore.blocks[0]?.id);
      setSyncStatus(labels.importSuccess(packet.records.length, packet.sourceDeviceId));
    } catch (error) {
      console.warn('Failed to import encrypted Distill sync packet.', error);
      setSyncStatus(labels.importInvalid);
    }
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

  async function restoreEncryptedVault(file: File) {
    const labels = vaultLabels();

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setRestoreStatus(labels.fileTooLarge);
      return;
    }

    const passphrase = window.prompt(labels.passphrase);

    if (!passphrase) {
      return;
    }

    setRestoreStatus('');

    try {
      const decrypted = await decryptDistillVault(await file.text(), passphrase);
      const importedStore = parseDistillImport(decrypted);
      const confirmed = window.confirm(ui.restoreConfirm(importedStore.blocks.length, importedStore.projects.length));

      if (!confirmed) {
        return;
      }

      setStore(importedStore);
      setSelectedBlockId(importedStore.blocks[0]?.id);
      setRestoreStatus(labels.encryptedRestoreSuccess(importedStore.blocks.length, importedStore.projects.length));
    } catch (error) {
      console.warn('Failed to restore encrypted Distill vault.', error);
      setRestoreStatus(labels.encryptedRestoreInvalid);
    }
  }

  async function restoreJson(file: File) {
    setRestoreStatus('');

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setRestoreStatus(vaultLabels().fileTooLarge);
      return;
    }

    try {
      const importedStore = parseDistillImport(await file.text());
      const confirmed = window.confirm(ui.restoreConfirm(importedStore.blocks.length, importedStore.projects.length));

      if (!confirmed) {
        return;
      }

      setStore(importedStore);
      setSelectedBlockId(importedStore.blocks[0]?.id);
      setRestoreStatus(ui.restoreSuccess(importedStore.blocks.length, importedStore.projects.length));
    } catch (error) {
      console.warn('Failed to import Distill JSON.', error);
      setRestoreStatus(ui.restoreInvalid as string);
    }
  }

  async function importMarkdown(file: File) {
    setRestoreStatus('');

    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setRestoreStatus(vaultLabels().fileTooLarge);
      return;
    }

    try {
      const importedStore = createMarkdownImport(await file.text());

      setStore((current) => ({
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
            onToggleProcessed={(blockId) => setStore(toggleProcessed(blockId))}
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
            syncStatus={syncStatus}
            deviceId={deviceIdentity?.id ?? ''}
            deviceName={deviceIdentity?.name ?? ''}
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
            onImportMarkdown={importMarkdown}
            onDeviceNameChange={renameCurrentDevice}
            onExportEncryptedSyncPacket={() => void exportEncryptedSyncPacket()}
            onImportEncryptedSyncPacket={(file) => void importEncryptedSyncPacket(file)}
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

