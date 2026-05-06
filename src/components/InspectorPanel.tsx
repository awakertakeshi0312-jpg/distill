import { Database, Download, FileText, FileUp, Link2, Network, RefreshCw, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { UiCopy } from '../i18n';
import type { Project, SyncDevice, ThoughtBlock } from '../model';
import type { RelatedBlock } from '../repository';
import type { RestorePreview } from '../restorePreview';
import { HelpNote } from './HelpNote';

type InspectorPanelProps = {
  ui: UiCopy;
  projects: Project[];
  selectedBlock?: ThoughtBlock;
  selectedPeople: string[];
  relatedBlocks: RelatedBlock[];
  hasLoadedStore: boolean;
  storagePath: string;
  backupPath: string;
  restoreStatus: string;
  restorePreview: RestorePreview | null;
  syncStatus: string;
  personalKmHandoffStatus: string;
  deviceId: string;
  deviceName: string;
  syncDevices: SyncDevice[];
  vaultSecurityStatus: string;
  autoLockMinutes: number;
  updateInstallerPath: string;
  updateStatus: string;
  autoUpdateStatus: string;
  isAutoUpdateAvailable: boolean;
  appVersion: string;
  updateFeedUrl: string;
  latestReleaseUrl: string;
  isDesktopRuntime: boolean;
  onSearch: (query: string) => void;
  onSelectBlock: (blockId: string) => void;
  onAssignProject: (blockId: string, projectId: string) => void;
  onBackupJson: () => void;
  onBackupEncryptedVault: () => void;
  onExportMarkdown: () => void;
  onExportJson: () => void;
  onRestoreJson: (file: File) => void;
  onRestoreEncryptedVault: (file: File) => void;
  onApplyRestorePreview: () => void;
  onCancelRestorePreview: () => void;
  onImportMarkdown: (file: File) => void;
  onDeviceNameChange: (name: string) => void;
  onExportEncryptedSyncPacket: () => void;
  onImportEncryptedSyncPacket: (file: File) => void;
  onHandoffToPersonalKm: () => void;
  onChangeVaultPassphrase: (currentPassphrase: string, nextPassphrase: string, confirmation: string) => void;
  onAutoLockMinutesChange: (minutes: number) => void;
  onUpdateInstallerPathChange: (path: string) => void;
  onStartUpdate: () => void;
  onCheckForUpdates: () => void;
  onInstallAutoUpdate: () => void;
};

export function InspectorPanel({
  ui,
  projects,
  selectedBlock,
  selectedPeople,
  relatedBlocks,
  hasLoadedStore,
  storagePath,
  backupPath,
  restoreStatus,
  restorePreview,
  syncStatus,
  personalKmHandoffStatus,
  deviceId,
  deviceName,
  syncDevices,
  vaultSecurityStatus,
  autoLockMinutes,
  updateInstallerPath,
  updateStatus,
  autoUpdateStatus,
  isAutoUpdateAvailable,
  appVersion,
  updateFeedUrl,
  latestReleaseUrl,
  isDesktopRuntime,
  onSearch,
  onSelectBlock,
  onAssignProject,
  onBackupJson,
  onBackupEncryptedVault,
  onExportMarkdown,
  onExportJson,
  onRestoreJson,
  onRestoreEncryptedVault,
  onApplyRestorePreview,
  onCancelRestorePreview,
  onImportMarkdown,
  onDeviceNameChange,
  onExportEncryptedSyncPacket,
  onImportEncryptedSyncPacket,
  onHandoffToPersonalKm,
  onChangeVaultPassphrase,
  onAutoLockMinutesChange,
  onUpdateInstallerPathChange,
  onStartUpdate,
  onCheckForUpdates,
  onInstallAutoUpdate,
}: InspectorPanelProps) {
  const [currentVaultPassphrase, setCurrentVaultPassphrase] = useState('');
  const [nextVaultPassphrase, setNextVaultPassphrase] = useState('');
  const [confirmVaultPassphrase, setConfirmVaultPassphrase] = useState('');
  const [draftDeviceName, setDraftDeviceName] = useState(deviceName);

  useEffect(() => {
    setDraftDeviceName(deviceName);
  }, [deviceName]);
  const updateLabels =
    ui.navInbox === 'Inbox'
      ? {
          diagnostics: 'Update diagnostics',
          currentVersion: 'Current version',
          runtime: 'Runtime',
          desktop: 'Desktop app',
          browser: 'Browser preview',
          feed: 'Release feed',
          latestRelease: 'Latest release page',
        }
      : {
          diagnostics: '更新診断',
          currentVersion: '現在のバージョン',
          runtime: '実行環境',
          desktop: 'デスクトップアプリ',
          browser: 'ブラウザプレビュー',
          feed: '更新フィード',
          latestRelease: '最新リリースページ',
        };
  const vaultLabels =
    ui.navInbox === 'Inbox'
      ? {
          title: 'Encrypted vault',
          hint: 'Create or restore a passphrase-protected vault backup. Active local storage is encrypted after vault unlock.',
          backup: 'Backup encrypted vault',
          restore: 'Restore encrypted vault',
        }
      : {
          title: '暗号化Vault',
          hint: 'Vault解除後の通常保存は暗号化されています。パスフレーズ付きVaultバックアップの作成・復元もできます。',
          backup: '暗号化Vaultをバックアップ',
          restore: '暗号化Vaultを復元',
        };
  const vaultSecurityLabels =
    ui.navInbox === 'Inbox'
      ? {
          title: 'Vault security',
          hint: 'Change the passphrase used for local encrypted storage and choose when Distill locks itself.',
          current: 'Current vault passphrase',
          next: 'New vault passphrase',
          confirm: 'Confirm new vault passphrase',
          change: 'Change passphrase',
          autoLock: 'Auto-lock',
          options: [
            { value: 0, label: 'Off' },
            { value: 5, label: '5 minutes' },
            { value: 15, label: '15 minutes' },
            { value: 30, label: '30 minutes' },
            { value: 60, label: '60 minutes' },
          ],
        }
      : {
          title: 'Vaultセキュリティ',
          hint: 'ローカル暗号化保存のパスフレーズ変更と、自動ロック時間を設定します。',
          current: '現在のVaultパスフレーズ',
          next: '新しいVaultパスフレーズ',
          confirm: '新しいVaultパスフレーズ確認',
          change: 'パスフレーズを変更',
          autoLock: '自動ロック',
          options: [
            { value: 0, label: 'オフ' },
            { value: 5, label: '5分' },
            { value: 15, label: '15分' },
            { value: 30, label: '30分' },
            { value: 60, label: '60分' },
          ],
        };
  const syncLabels =
    ui.navInbox === 'Inbox'
      ? {
          title: 'Encrypted sync packet',
          hint: 'Manual device-to-device sync. Packet records are encrypted with the current vault passphrase before export.',
          deviceName: 'Device name',
          deviceId: 'Device ID',
          rename: 'Save device name',
          export: 'Export sync packet',
          import: 'Import sync packet',
          knownDevices: 'Known devices',
          noKnownDevices: 'No synced devices yet',
          thisDevice: 'This device',
        }
      : {
          title: '暗号化同期パケット',
          hint: '手動の端末間同期です。出力前に、同期レコードは現在のVaultパスフレーズで暗号化されます。',
          deviceName: '端末名',
          deviceId: '端末ID',
          rename: '端末名を保存',
          export: '同期パケットを書き出す',
          import: '同期パケットを取り込む',
          knownDevices: '同期済み端末',
          noKnownDevices: '同期済み端末はまだありません',
          thisDevice: 'この端末',
        };

  const restorePreviewLabels =
    ui.navInbox === 'Inbox'
      ? {
          title: 'Restore preview',
          source: 'Source',
          json: 'JSON backup',
          encrypted: 'Encrypted vault',
          incoming: 'Incoming',
          blocks: 'Blocks',
          projects: 'Projects',
          added: 'Added',
          updated: 'Updated',
          removed: 'Removed',
          unchanged: 'Unchanged',
          sync: 'Sync metadata',
          tombstones: 'Tombstones',
          devices: 'Devices',
          warning: 'Applying this preview replaces the current local store.',
          apply: 'Apply restore',
          cancel: 'Cancel',
        }
      : {
          title: '復元プレビュー',
          source: '種類',
          json: 'JSONバックアップ',
          encrypted: '暗号化Vault',
          incoming: '読み込み内容',
          blocks: 'ブロック',
          projects: 'プロジェクト',
          added: '追加',
          updated: '更新',
          removed: '削除',
          unchanged: '変更なし',
          sync: '同期メタデータ',
          tombstones: '削除履歴',
          devices: '端末',
          warning: '適用すると現在のローカルストアを置き換えます。',
          apply: '復元を適用',
          cancel: 'キャンセル',
        };

  function submitPassphraseChange() {
    onChangeVaultPassphrase(currentVaultPassphrase, nextVaultPassphrase, confirmVaultPassphrase);
    setCurrentVaultPassphrase('');
    setNextVaultPassphrase('');
    setConfirmVaultPassphrase('');
  }

  function submitDeviceName() {
    onDeviceNameChange(draftDeviceName);
  }

  return (
    <aside className="panel contextPanel" aria-label="Context inspector">
      <div className="panelHeader compact">
        <div>
          <p>{ui.inspector as string}</p>
          <h2>{ui.relatedContext as string}</h2>
        </div>
        <HelpNote ui={ui} content={ui.sectionHelp.inspector} />
      </div>

      <div className="contextList">
        <div className="contextItem">
          <Link2 size={17} />
          <div>
            <strong>{ui.backlinks as string}</strong>
            <span>{ui.backlinksDetail(selectedBlock?.links.length ?? 0)}</span>
            {selectedBlock && selectedBlock.links.length > 0 ? (
              <div className="conceptList">
                {selectedBlock.links.map((link) => (
                  <button className="conceptPill" key={link} type="button" onClick={() => onSearch(link)}>
                    {link}
                  </button>
                ))}
              </div>
            ) : (
              <span>{ui.noLinkedConcepts as string}</span>
            )}
          </div>
        </div>
        <div className="contextItem">
          <Network size={17} />
          <div>
            <strong>{ui.relatedBlocks as string}</strong>
            <span>{ui.relatedBlocksDetail(relatedBlocks.length)}</span>
            {relatedBlocks.length > 0 ? (
              <div className="relatedBlockList">
                {relatedBlocks.map((related) => (
                  <button
                    className="miniBlockButton"
                    key={related.block.id}
                    type="button"
                    onClick={() => onSelectBlock(related.block.id)}
                  >
                    <strong>{related.block.content}</strong>
                    <span>{ui.relationReasons[related.reason]}</span>
                  </button>
                ))}
              </div>
            ) : (
              <span>{ui.noRelatedBlocks as string}</span>
            )}
          </div>
        </div>
        <div className="contextItem">
          <UserRound size={17} />
          <div>
            <strong>{ui.people as string}</strong>
            <span>{ui.peopleDetail(selectedPeople.length)}</span>
            {selectedPeople.length > 0 ? (
              <div className="conceptList">
                {selectedPeople.map((person) => (
                  <button className="conceptPill personPill" key={person} type="button" onClick={() => onSearch(`@${person}`)}>
                    @{person}
                  </button>
                ))}
              </div>
            ) : (
              <span>{ui.noPeople as string}</span>
            )}
          </div>
        </div>
        <div className="contextItem">
          <FileText size={17} />
          <div>
            <strong>{ui.selectedBlock as string}</strong>
            <span>{selectedBlock?.id ?? (ui.noBlockSelected as string)}</span>
          </div>
        </div>
        <div className="contextItem">
          <Database size={17} />
          <div>
            <strong>{ui.storage as string}</strong>
            <span>{hasLoadedStore ? (ui.storageActive as string) : (ui.storageLayerLoading as string)}</span>
            {storagePath ? (
              <span className="storagePath">
                {ui.storagePath as string}: {storagePath}
              </span>
            ) : null}
            {backupPath ? (
              <span className="storagePath">
                {ui.autoBackupPath as string}: {backupPath}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="inspectorControls">
        <label>
          {ui.project as string}
          <select
            value={selectedBlock?.projectId ?? ''}
            onChange={(event) => {
              if (selectedBlock) {
                onAssignProject(selectedBlock.id, event.target.value);
              }
            }}
          >
            <option value="">{ui.navInbox as string}</option>
            {projects.map((project) => (
              <option value={project.id} key={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <div className="exportActions">
          <button type="button" onClick={onExportMarkdown}>
            <Download size={16} />
            Markdown
          </button>
          <button type="button" onClick={onExportJson}>
            <Download size={16} />
            JSON
          </button>
        </div>

        <div className="restoreBox">
          <strong>{ui.backupRestore as string}</strong>
          <span>{ui.restoreJsonHint as string}</span>
          <button className="restoreButton" type="button" onClick={onBackupJson}>
            <Download size={16} />
            {ui.backupJson as string}
          </button>
          <label className="restoreButton">
            <FileUp size={16} />
            {ui.restoreJson as string}
            <input
              accept="application/json,.json"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = '';
                if (file) {
                  onRestoreJson(file);
                }
              }}
            />
          </label>
          <label className="restoreButton">
            <FileUp size={16} />
            {ui.importMarkdown as string}
            <input
              accept="text/markdown,.md,.markdown,text/plain"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = '';
                if (file) {
                  onImportMarkdown(file);
                }
              }}
            />
          </label>
          {restoreStatus ? <span className="restoreStatus">{restoreStatus}</span> : null}
          {restorePreview ? (
            <div className="restorePreviewBox">
              <strong>{restorePreviewLabels.title}</strong>
              <span>
                {restorePreviewLabels.source}:{' '}
                {restorePreview.kind === 'encrypted-vault' ? restorePreviewLabels.encrypted : restorePreviewLabels.json}
              </span>
              <span>
                {restorePreviewLabels.incoming}: {restorePreview.store.blocks.length} {restorePreviewLabels.blocks} /{' '}
                {restorePreview.store.projects.length} {restorePreviewLabels.projects}
              </span>
              <div className="restorePreviewGrid" aria-label={restorePreviewLabels.blocks}>
                <b>{restorePreviewLabels.blocks}</b>
                <span>
                  {restorePreviewLabels.added}: {restorePreview.diff.addedBlocks}
                </span>
                <span>
                  {restorePreviewLabels.updated}: {restorePreview.diff.updatedBlocks}
                </span>
                <span>
                  {restorePreviewLabels.removed}: {restorePreview.diff.removedBlocks}
                </span>
                <span>
                  {restorePreviewLabels.unchanged}: {restorePreview.diff.unchangedBlocks}
                </span>
              </div>
              <div className="restorePreviewGrid" aria-label={restorePreviewLabels.projects}>
                <b>{restorePreviewLabels.projects}</b>
                <span>
                  {restorePreviewLabels.added}: {restorePreview.diff.addedProjects}
                </span>
                <span>
                  {restorePreviewLabels.updated}: {restorePreview.diff.updatedProjects}
                </span>
                <span>
                  {restorePreviewLabels.removed}: {restorePreview.diff.removedProjects}
                </span>
                <span>
                  {restorePreviewLabels.unchanged}: {restorePreview.diff.unchangedProjects}
                </span>
              </div>
              <span>
                {restorePreviewLabels.sync}: {restorePreview.diff.tombstones} {restorePreviewLabels.tombstones} /{' '}
                {restorePreview.diff.devices} {restorePreviewLabels.devices}
              </span>
              <span className="restoreWarning">{restorePreviewLabels.warning}</span>
              <div className="restorePreviewActions">
                <button className="restoreButton dangerButton" type="button" onClick={onApplyRestorePreview}>
                  {restorePreviewLabels.apply}
                </button>
                <button className="restoreButton" type="button" onClick={onCancelRestorePreview}>
                  {restorePreviewLabels.cancel}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="restoreBox vaultBox">
          <strong>{vaultLabels.title}</strong>
          <span>{vaultLabels.hint}</span>
          <button className="restoreButton" type="button" onClick={onBackupEncryptedVault}>
            <Download size={16} />
            {vaultLabels.backup}
          </button>
          <label className="restoreButton">
            <FileUp size={16} />
            {vaultLabels.restore}
            <input
              accept="application/json,.json,.distill-vault"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = '';
                if (file) {
                  onRestoreEncryptedVault(file);
                }
              }}
            />
          </label>
        </div>

        <div className="restoreBox vaultSecurityBox">
          <strong>{vaultSecurityLabels.title}</strong>
          <span>{vaultSecurityLabels.hint}</span>
          <label>
            {vaultSecurityLabels.autoLock}
            <select value={autoLockMinutes} onChange={(event) => onAutoLockMinutesChange(Number(event.target.value))}>
              {vaultSecurityLabels.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {vaultSecurityLabels.current}
            <input
              autoComplete="current-password"
              type="password"
              value={currentVaultPassphrase}
              onChange={(event) => setCurrentVaultPassphrase(event.target.value)}
            />
          </label>
          <label>
            {vaultSecurityLabels.next}
            <input
              autoComplete="new-password"
              type="password"
              value={nextVaultPassphrase}
              onChange={(event) => setNextVaultPassphrase(event.target.value)}
            />
          </label>
          <label>
            {vaultSecurityLabels.confirm}
            <input
              autoComplete="new-password"
              type="password"
              value={confirmVaultPassphrase}
              onChange={(event) => setConfirmVaultPassphrase(event.target.value)}
            />
          </label>
          <button
            className="restoreButton"
            type="button"
            disabled={!currentVaultPassphrase || !nextVaultPassphrase || !confirmVaultPassphrase}
            onClick={submitPassphraseChange}
          >
            <RefreshCw size={16} />
            {vaultSecurityLabels.change}
          </button>
          {vaultSecurityStatus ? <span className="restoreStatus">{vaultSecurityStatus}</span> : null}
        </div>

        <div className="restoreBox syncBox">
          <strong>{syncLabels.title}</strong>
          <span>{syncLabels.hint}</span>
          <label>
            {syncLabels.deviceName}
            <input value={draftDeviceName} onChange={(event) => setDraftDeviceName(event.target.value)} />
          </label>
          <button className="restoreButton" type="button" onClick={submitDeviceName}>
            <RefreshCw size={16} />
            {syncLabels.rename}
          </button>
          <span className="storagePath">
            {syncLabels.deviceId}: {deviceId}
          </span>
          <span className="storagePath">{syncLabels.knownDevices}</span>
          {syncDevices.length > 0 ? (
            <div className="deviceList">
              {syncDevices.map((device) => (
                <span className="deviceRow" key={device.id}>
                  <b>{device.name}</b>
                  <small>{device.id === deviceId ? syncLabels.thisDevice : device.id}</small>
                </span>
              ))}
            </div>
          ) : (
            <span className="storagePath">{syncLabels.noKnownDevices}</span>
          )}
          <button className="restoreButton" type="button" onClick={onExportEncryptedSyncPacket}>
            <Download size={16} />
            {syncLabels.export}
          </button>
          <label className="restoreButton">
            <FileUp size={16} />
            {syncLabels.import}
            <input
              accept="application/json,.json,.distill-sync,.distill-sync.json"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = '';
                if (file) {
                  onImportEncryptedSyncPacket(file);
                }
              }}
            />
          </label>
          {syncStatus ? <span className="restoreStatus">{syncStatus}</span> : null}
        </div>

        <div className="restoreBox">
          <strong>Personal KM handoff</strong>
          <span>
            Send processed Distill blocks to the Personal KM review queue as summary-only records. Note bodies and vault
            payloads are not sent.
          </span>
          <button className="restoreButton" type="button" onClick={onHandoffToPersonalKm}>
            <Database size={16} />
            Send reviewed summaries
          </button>
          {personalKmHandoffStatus ? <span className="restoreStatus">{personalKmHandoffStatus}</span> : null}
        </div>

        <div className="restoreBox">
          <strong>{ui.updateApp as string}</strong>
          <span>{ui.updateHint as string}</span>
          <div className="updateDiagnostics" aria-label={updateLabels.diagnostics}>
            <span className="diagnosticRow">
              <b>{updateLabels.currentVersion}</b>
              {appVersion}
            </span>
            <span className="diagnosticRow">
              <b>{updateLabels.runtime}</b>
              {isDesktopRuntime ? updateLabels.desktop : updateLabels.browser}
            </span>
            <span className="diagnosticRow">
              <b>{updateLabels.feed}</b>
              {updateFeedUrl}
            </span>
            <a className="diagnosticLink" href={latestReleaseUrl} target="_blank" rel="noreferrer">
              {updateLabels.latestRelease}
            </a>
          </div>
          <div className="exportActions stackedActions">
            <button className="restoreButton" type="button" onClick={onCheckForUpdates}>
              <RefreshCw size={16} />
              {ui.checkForUpdates as string}
            </button>
            <button className="restoreButton" type="button" disabled={!isAutoUpdateAvailable} onClick={onInstallAutoUpdate}>
              <Download size={16} />
              {ui.installAutoUpdate as string}
            </button>
          </div>
          {autoUpdateStatus ? <span className="restoreStatus">{autoUpdateStatus}</span> : null}
          <strong>{ui.manualUpdateFallback as string}</strong>
          <span>{ui.manualUpdateHint as string}</span>
          <label>
            {ui.updateInstallerPath as string}
            <input
              value={updateInstallerPath}
              placeholder={ui.updateInstallerPlaceholder as string}
              onChange={(event) => onUpdateInstallerPathChange(event.target.value)}
            />
          </label>
          <button className="restoreButton" type="button" onClick={onStartUpdate}>
            <RefreshCw size={16} />
            {ui.startUpdate as string}
          </button>
          {updateStatus ? <span className="restoreStatus">{updateStatus}</span> : null}
        </div>
      </div>
    </aside>
  );
}
