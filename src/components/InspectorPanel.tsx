import {
  Database,
  Download,
  FileText,
  FileUp,
  Link2,
  Network,
  RefreshCw,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { UiCopy } from '../i18n';
import type { SyncPacketSignatureStatus } from '../deviceSigning';
import type { Project, RevokedSyncDevice, SyncDevice, ThoughtBlock } from '../model';
import type { RelatedBlock } from '../repository';
import type { RestorePreview } from '../restorePreview';
import type { SyncFolderPacketFile, SyncRecoveryVaultFile } from '../storage';
import type { SyncPreview } from '../syncPreview';
import { isBlockedSyncFolderPacketReview, type SyncFolderPacketReview } from '../syncFolderReview';
import { HelpNote } from './HelpNote';

function syncPreviewRequiresRiskAcknowledgement(preview: SyncPreview | null) {
  return Boolean(
    preview &&
      !preview.diff.replay &&
      (preview.diff.destructiveChanges > 0 || preview.diff.timestampTies > 0),
  );
}

function syncPreviewRequiresDeviceTrust(preview: SyncPreview | null) {
  return Boolean(
    preview &&
      !preview.diff.replay &&
      (preview.signatureReview?.requiresTrust ?? !preview.diff.sourceDeviceKnown),
  );
}

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
  syncRecoveryVaults: SyncRecoveryVaultFile[];
  syncStatus: string;
  syncPreview: SyncPreview | null;
  syncRiskAccepted: boolean;
  syncDeviceTrustAccepted: boolean;
  syncFolderPath: string;
  syncFolderMonitorEnabled: boolean;
  syncFolderLastCheckedAt: string;
  syncFolderAutoExportEnabled: boolean;
  syncFolderAutoExportLastAt: string;
  syncFolderAutoExportLastFile: string;
  syncFolderPackets: SyncFolderPacketFile[];
  syncFolderPacketReviews: SyncFolderPacketReview[];
  personalKmHandoffStatus: string;
  deviceId: string;
  deviceName: string;
  syncDevices: SyncDevice[];
  revokedSyncDevices: RevokedSyncDevice[];
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
  onRefreshSyncRecoveryVaults: () => void;
  onPreviewSyncRecoveryVault: (snapshot: SyncRecoveryVaultFile) => void;
  onApplyRestorePreview: () => void;
  onCancelRestorePreview: () => void;
  onImportMarkdown: (file: File) => void;
  onDeviceNameChange: (name: string) => void;
  onExportEncryptedSyncPacket: () => void;
  onImportEncryptedSyncPacket: (file: File) => void;
  onSyncFolderPathChange: (path: string) => void;
  onSyncFolderMonitorToggle: (enabled: boolean) => void;
  onSyncFolderAutoExportToggle: (enabled: boolean) => void;
  onExportEncryptedSyncPacketToFolder: () => void;
  onRefreshSyncFolderPackets: () => void;
  onReviewSyncFolderPackets: () => void;
  onPreviewRecommendedSyncFolderPacket: () => void;
  onImportSyncFolderPacket: (packetFile: SyncFolderPacketFile) => void;
  onQuarantineSyncFolderPacket: (packetFile: SyncFolderPacketFile) => void;
  onApplySyncPreview: () => void;
  onCancelSyncPreview: () => void;
  onSyncRiskAcceptedChange: (accepted: boolean) => void;
  onSyncDeviceTrustAcceptedChange: (accepted: boolean) => void;
  onRevokeSyncDevice: (deviceId: string) => void;
  onForgetRevokedSyncDevice: (deviceId: string) => void;
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
  syncRecoveryVaults,
  syncStatus,
  syncPreview,
  syncRiskAccepted,
  syncDeviceTrustAccepted,
  syncFolderPath,
  syncFolderMonitorEnabled,
  syncFolderLastCheckedAt,
  syncFolderAutoExportEnabled,
  syncFolderAutoExportLastAt,
  syncFolderAutoExportLastFile,
  syncFolderPackets,
  syncFolderPacketReviews,
  personalKmHandoffStatus,
  deviceId,
  deviceName,
  syncDevices,
  revokedSyncDevices,
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
  onRefreshSyncRecoveryVaults,
  onPreviewSyncRecoveryVault,
  onApplyRestorePreview,
  onCancelRestorePreview,
  onImportMarkdown,
  onDeviceNameChange,
  onExportEncryptedSyncPacket,
  onImportEncryptedSyncPacket,
  onSyncFolderPathChange,
  onSyncFolderMonitorToggle,
  onSyncFolderAutoExportToggle,
  onExportEncryptedSyncPacketToFolder,
  onRefreshSyncFolderPackets,
  onReviewSyncFolderPackets,
  onPreviewRecommendedSyncFolderPacket,
  onImportSyncFolderPacket,
  onQuarantineSyncFolderPacket,
  onApplySyncPreview,
  onCancelSyncPreview,
  onSyncRiskAcceptedChange,
  onSyncDeviceTrustAcceptedChange,
  onRevokeSyncDevice,
  onForgetRevokedSyncDevice,
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
          recoveryTitle: 'Sync recovery snapshots',
          recoveryHint: 'These encrypted snapshots are saved before sync apply. Preview one before replacing the current vault.',
          recoveryRefresh: 'Refresh snapshots',
          recoveryPreview: 'Preview recovery',
          noRecoverySnapshots: 'No sync recovery snapshots found yet',
        }
      : {
          title: '\u6697\u53f7\u5316Vault',
          hint: 'Vault\u89e3\u9664\u5f8c\u306e\u901a\u5e38\u4fdd\u5b58\u306f\u6697\u53f7\u5316\u3055\u308c\u3066\u3044\u307e\u3059\u3002\u30d1\u30b9\u30d5\u30ec\u30fc\u30ba\u4ed8\u304dVault\u30d0\u30c3\u30af\u30a2\u30c3\u30d7\u306e\u4f5c\u6210\u30fb\u5fa9\u5143\u3082\u3067\u304d\u307e\u3059\u3002',
          backup: '\u6697\u53f7\u5316Vault\u3092\u30d0\u30c3\u30af\u30a2\u30c3\u30d7',
          restore: '\u6697\u53f7\u5316Vault\u3092\u5fa9\u5143',
          recoveryTitle: '\u540c\u671f\u30ea\u30ab\u30d0\u30ea\u30b9\u30ca\u30c3\u30d7\u30b7\u30e7\u30c3\u30c8',
          recoveryHint: '\u540c\u671f\u9069\u7528\u524d\u306b\u4fdd\u5b58\u3055\u308c\u305f\u6697\u53f7\u5316\u30b9\u30ca\u30c3\u30d7\u30b7\u30e7\u30c3\u30c8\u3067\u3059\u3002\u73fe\u5728\u306eVault\u3092\u7f6e\u304d\u63db\u3048\u308b\u524d\u306b\u5fc5\u305a\u30d7\u30ec\u30d3\u30e5\u30fc\u3057\u307e\u3059\u3002',
          recoveryRefresh: '\u30b9\u30ca\u30c3\u30d7\u30b7\u30e7\u30c3\u30c8\u66f4\u65b0',
          recoveryPreview: '\u5fa9\u5143\u30d7\u30ec\u30d3\u30e5\u30fc',
          noRecoverySnapshots: '\u540c\u671f\u30ea\u30ab\u30d0\u30ea\u30b9\u30ca\u30c3\u30d7\u30b7\u30e7\u30c3\u30c8\u306f\u307e\u3060\u3042\u308a\u307e\u305b\u3093',
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
          folderPath: 'Sync folder path',
          folderPathPlaceholder: 'C:\\Users\\awake\\OneDrive\\Distill Sync',
          exportToFolder: 'Export to sync folder',
          scanFolder: 'Scan sync folder',
          safetyScanFolder: 'Safety scan',
          recommendedPreview: 'Recommended preview',
          monitorOn: 'Monitor on',
          monitorOff: 'Monitor off',
          monitorHint: 'Refreshes the safety review queue every minute. Distill never applies packets automatically.',
          autoExportOn: 'Auto-export on',
          autoExportOff: 'Auto-export off',
          autoExportHint:
            'Writes an encrypted outbound packet when local content changes. Incoming packets still require manual preview/apply.',
          lastExport: 'Last export',
          lastExportFile: 'File',
          lastChecked: 'Last checked',
          folderPackets: 'Folder packets',
          noFolderPackets: 'No packet files found yet',
          importFolderPacket: 'Preview',
          quarantineFolderPacket: 'Quarantine',
          reviewReady: 'Ready',
          reviewRisk: 'Risk review',
          reviewStale: 'Stale',
          reviewBlocked: 'Blocked',
          reviewCheckpointRisk: 'Checkpoint risk',
          reviewInvalid: 'Invalid',
          reviewSource: 'Source',
          reviewRecords: 'Records',
          reviewDecisions: 'Decisions',
          knownDevices: 'Known devices',
          noKnownDevices: 'No synced devices yet',
          revokedDevices: 'Revoked devices',
          noRevokedDevices: 'No revoked devices',
          thisDevice: 'This device',
          revokedAt: 'Revoked',
          revoke: 'Revoke',
          forget: 'Forget',
        }
      : {
          title: '暗号化同期パケット',
          hint: '手動の端末間同期です。出力前に、同期レコードは現在のVaultパスフレーズで暗号化されます。',
          deviceName: '端末名',
          deviceId: '端末ID',
          rename: '端末名を保存',
          export: '同期パケットを書き出す',
          import: '同期パケットを取り込む',
          folderPath: '同期フォルダのパス',
          folderPathPlaceholder: 'C:\\Users\\awake\\OneDrive\\Distill Sync',
          exportToFolder: '同期フォルダへ書き出す',
          scanFolder: '同期フォルダを確認',
          safetyScanFolder: '安全スキャン',
          recommendedPreview: 'おすすめプレビュー',
          monitorOn: '監視オン',
          monitorOff: '監視オフ',
          monitorHint: '1分ごとに安全レビューキューを更新します。Distillはパケットを自動適用しません。',
          autoExportOn: '自動書き出しオン',
          autoExportOff: '自動書き出しオフ',
          autoExportHint:
            'ローカル内容が変わった時だけ暗号化パケットを書き出します。受信パケットは手動プレビュー/適用が必要です。',
          lastExport: '最終書き出し',
          lastExportFile: 'ファイル',
          lastChecked: '最終確認',
          folderPackets: 'フォルダ内パケット',
          noFolderPackets: '同期パケットはまだ見つかっていません',
          importFolderPacket: 'プレビュー',
          quarantineFolderPacket: '隔離',
          reviewReady: '安全候補',
          reviewRisk: 'リスク確認',
          reviewStale: '古い',
          reviewBlocked: 'ブロック',
          reviewCheckpointRisk: 'チェックポイント注意',
          reviewInvalid: '無効',
          reviewSource: '送信元',
          reviewRecords: 'レコード',
          reviewDecisions: '判定',
          knownDevices: '同期済み端末',
          noKnownDevices: '同期済み端末はまだありません',
          revokedDevices: '信頼解除済み端末',
          noRevokedDevices: '信頼解除済み端末はありません',
          thisDevice: 'この端末',
          revokedAt: '解除日時',
          revoke: '信頼解除',
          forget: '記録削除',
        };
  const syncFolderReviewLabels: Record<SyncFolderPacketReview['status'], string> = {
    ready: syncLabels.reviewReady,
    risk: syncLabels.reviewRisk,
    stale: syncLabels.reviewStale,
    blocked: syncLabels.reviewBlocked,
    'checkpoint-risk': syncLabels.reviewCheckpointRisk,
    invalid: syncLabels.reviewInvalid,
  };

  const restorePreviewLabels =
    ui.navInbox === 'Inbox'
      ? {
          title: 'Restore preview',
          source: 'Source',
          json: 'JSON backup',
          encrypted: 'Encrypted vault',
          syncRecovery: 'Sync recovery snapshot',
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
          syncRecovery: '\u540c\u671f\u30ea\u30ab\u30d0\u30ea\u30b9\u30ca\u30c3\u30d7\u30b7\u30e7\u30c3\u30c8',
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

  const syncPreviewLabels =
    ui.navInbox === 'Inbox'
      ? {
          title: 'Sync preview',
          source: 'Source device',
          sourceTrust: 'Source trust',
          sourceKnown: 'Known device',
          sourceUnknown: 'Unknown device',
          signature: 'Device signature',
          signatureTrustedValid: 'Trusted signature',
          signatureTrustedMissing: 'Missing signature from trusted device',
          signatureTrustedMismatch: 'Trusted device key mismatch',
          signatureTrustedInvalid: 'Invalid trusted-device signature',
          signatureSignedUntrusted: 'Valid signature from untrusted device',
          signatureUnsignedUntrusted: 'Unsigned untrusted device',
          signatureLegacyTrusted: 'Known device without signing key',
          signatureUnsupported: 'Unsupported signature',
          created: 'Created',
          incoming: 'Incoming',
          records: 'Records',
          blocks: 'Blocks',
          deletions: 'Deletions',
          devices: 'Devices',
          revoked: 'Revoked devices',
          added: 'Added',
          updated: 'Updated',
          skipped: 'Skipped',
          deleted: 'Deleted locally',
          decisions: 'Decision review',
          remoteWins: 'Remote wins',
          localWins: 'Local wins',
          timestampTies: 'Same-time tie-breaks',
          destructiveChanges: 'Local changes/deletes',
          riskTitle: 'Risk confirmation required',
          riskCopy: 'This packet will update or delete local data. Confirm after reviewing the decision counts.',
          riskAccepted: 'I reviewed the sync decision risk',
          trustTitle: 'Device trust confirmation required',
          trustCopy:
            'This is the first packet from this device in this vault. Confirm only if you intentionally set up this device.',
          trustAccepted: 'I trust this source device',
          warning: 'This packet is stale or already imported. Applying will not change the vault.',
          apply: 'Apply sync',
          dismiss: 'Dismiss packet',
          cancel: 'Cancel',
        }
      : {
          title: '同期プレビュー',
          source: '送信元端末',
          sourceTrust: '送信元の信頼',
          sourceKnown: '既知の端末',
          sourceUnknown: '未知の端末',
          signature: '端末署名',
          signatureTrustedValid: '信頼済み署名',
          signatureTrustedMissing: '信頼済み端末の署名なし',
          signatureTrustedMismatch: '信頼済み端末の鍵不一致',
          signatureTrustedInvalid: '信頼済み端末の署名不正',
          signatureSignedUntrusted: '未信頼端末の有効署名',
          signatureUnsignedUntrusted: '未信頼端末の未署名',
          signatureLegacyTrusted: '署名鍵なしの既知端末',
          signatureUnsupported: '未対応の署名',
          created: '作成日時',
          incoming: '取り込み内容',
          records: 'レコード',
          blocks: 'ブロック',
          deletions: '削除履歴',
          devices: '端末',
          revoked: '信頼解除済み端末',
          added: '追加',
          updated: '更新',
          skipped: 'スキップ',
          deleted: 'ローカル削除',
          decisions: '判定レビュー',
          remoteWins: '相手側を採用',
          localWins: 'ローカルを維持',
          timestampTies: '同時刻の決着',
          destructiveChanges: '更新・削除されるローカル',
          riskTitle: 'リスク確認が必要',
          riskCopy: 'このパケットはローカルデータを更新または削除します。判定数を確認してからチェックしてください。',
          riskAccepted: '同期判定のリスクを確認しました',
          trustTitle: '端末信頼の確認が必要',
          trustCopy:
            'このVaultでは初めて見る端末からのパケットです。自分で設定した端末だと確認できる場合だけチェックしてください。',
          trustAccepted: 'この送信元端末を信頼します',
          warning: 'このパケットは古い、または取り込み済みです。適用してもVaultは変更されません。',
          apply: '同期を適用',
          dismiss: 'パケットを閉じる',
          cancel: 'キャンセル',
        };

  function signatureStatusLabel(status: SyncPacketSignatureStatus | undefined) {
    if (!status) {
      return syncPreviewLabels.signatureUnsupported;
    }

    const labels = {
      'trusted-valid': syncPreviewLabels.signatureTrustedValid,
      'trusted-missing-signature': syncPreviewLabels.signatureTrustedMissing,
      'trusted-key-mismatch': syncPreviewLabels.signatureTrustedMismatch,
      'trusted-invalid': syncPreviewLabels.signatureTrustedInvalid,
      'signed-untrusted': syncPreviewLabels.signatureSignedUntrusted,
      'unsigned-untrusted': syncPreviewLabels.signatureUnsignedUntrusted,
      'legacy-trusted': syncPreviewLabels.signatureLegacyTrusted,
      unsupported: syncPreviewLabels.signatureUnsupported,
    };

    return labels[status];
  }

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
                {restorePreview.kind === 'sync-recovery'
                  ? restorePreviewLabels.syncRecovery
                  : restorePreview.kind === 'encrypted-vault'
                    ? restorePreviewLabels.encrypted
                    : restorePreviewLabels.json}
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
          <span className="storagePath">{vaultLabels.recoveryTitle}</span>
          <span>{vaultLabels.recoveryHint}</span>
          <button className="restoreButton" type="button" onClick={onRefreshSyncRecoveryVaults}>
            <RefreshCw size={16} />
            {vaultLabels.recoveryRefresh}
          </button>
          {syncRecoveryVaults.length > 0 ? (
            <div className="deviceList">
              {syncRecoveryVaults.map((snapshot) => (
                <div className="deviceRow" key={snapshot.path}>
                  <div className="deviceDetails">
                    <b>{snapshot.fileName}</b>
                    <small>{snapshot.path}</small>
                    <small>
                      {snapshot.bytes} bytes / {snapshot.modifiedAt}
                    </small>
                  </div>
                  <div className="deviceActions">
                    <button
                      className="restoreButton inlineActionButton"
                      type="button"
                      onClick={() => onPreviewSyncRecoveryVault(snapshot)}
                    >
                      <FileUp size={14} />
                      {vaultLabels.recoveryPreview}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <span className="storagePath">{vaultLabels.noRecoverySnapshots}</span>
          )}
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
              {syncDevices.map((device) => {
                const isCurrentDevice = device.id === deviceId;

                return (
                  <div className="deviceRow" key={device.id}>
                    <div className="deviceDetails">
                      <b>{device.name}</b>
                      <small>{isCurrentDevice ? syncLabels.thisDevice : device.id}</small>
                      {device.lastSeenAt ? <small>{device.lastSeenAt}</small> : null}
                    </div>
                    {!isCurrentDevice ? (
                      <div className="deviceActions">
                        <button
                          className="restoreButton dangerButton inlineActionButton"
                          type="button"
                          onClick={() => onRevokeSyncDevice(device.id)}
                        >
                          <ShieldOff size={14} />
                          {syncLabels.revoke}
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <span className="storagePath">{syncLabels.noKnownDevices}</span>
          )}
          <span className="storagePath">{syncLabels.revokedDevices}</span>
          {revokedSyncDevices.length > 0 ? (
            <div className="deviceList">
              {revokedSyncDevices.map((device) => (
                <div className="deviceRow" key={device.id}>
                  <div className="deviceDetails">
                    <b>{device.name}</b>
                    <small>{device.id}</small>
                    <small>
                      {syncLabels.revokedAt}: {device.revokedAt}
                    </small>
                  </div>
                  <div className="deviceActions">
                    <button
                      className="restoreButton inlineActionButton"
                      type="button"
                      onClick={() => onForgetRevokedSyncDevice(device.id)}
                    >
                      <Trash2 size={14} />
                      {syncLabels.forget}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <span className="storagePath">{syncLabels.noRevokedDevices}</span>
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
          <label>
            {syncLabels.folderPath}
            <input
              value={syncFolderPath}
              placeholder={syncLabels.folderPathPlaceholder}
              onChange={(event) => onSyncFolderPathChange(event.target.value)}
            />
          </label>
          <label className="riskGate syncMonitorGate">
            <span>
              <strong>{syncFolderMonitorEnabled ? syncLabels.monitorOn : syncLabels.monitorOff}</strong>
              {syncLabels.monitorHint}
              {syncFolderLastCheckedAt ? (
                <small>
                  {syncLabels.lastChecked}: {syncFolderLastCheckedAt}
                </small>
              ) : null}
            </span>
            <input
              type="checkbox"
              checked={syncFolderMonitorEnabled}
              onChange={(event) => onSyncFolderMonitorToggle(event.target.checked)}
            />
          </label>
          <label className="riskGate syncAutoExportGate">
            <span>
              <strong>{syncFolderAutoExportEnabled ? syncLabels.autoExportOn : syncLabels.autoExportOff}</strong>
              {syncLabels.autoExportHint}
              {syncFolderAutoExportLastAt ? (
                <small>
                  {syncLabels.lastExport}: {syncFolderAutoExportLastAt}
                </small>
              ) : null}
              {syncFolderAutoExportLastFile ? (
                <small>
                  {syncLabels.lastExportFile}: {syncFolderAutoExportLastFile}
                </small>
              ) : null}
            </span>
            <input
              type="checkbox"
              checked={syncFolderAutoExportEnabled}
              onChange={(event) => onSyncFolderAutoExportToggle(event.target.checked)}
            />
          </label>
          <div className="exportActions stackedActions">
            <button className="restoreButton" type="button" onClick={onExportEncryptedSyncPacketToFolder}>
              <Download size={16} />
              {syncLabels.exportToFolder}
            </button>
            <button className="restoreButton" type="button" onClick={onRefreshSyncFolderPackets}>
              <RefreshCw size={16} />
              {syncLabels.scanFolder}
            </button>
            <button className="restoreButton" type="button" onClick={onReviewSyncFolderPackets}>
              <ShieldCheck size={16} />
              {syncLabels.safetyScanFolder}
            </button>
            <button className="restoreButton" type="button" onClick={onPreviewRecommendedSyncFolderPacket}>
              <Sparkles size={16} />
              {syncLabels.recommendedPreview}
            </button>
          </div>
          <span className="storagePath">{syncLabels.folderPackets}</span>
          {syncFolderPackets.length > 0 ? (
            <div className="deviceList">
              {syncFolderPackets.map((packetFile) => {
                const review = syncFolderPacketReviews.find((item) => item.path === packetFile.path);
                const blocksPreview = review ? isBlockedSyncFolderPacketReview(review) : false;

                return (
                  <div className="deviceRow" key={packetFile.path}>
                    <div className="deviceDetails">
                      <b>{packetFile.fileName}</b>
                      {review ? (
                        <span className={`syncPacketBadge syncPacketBadge-${review.status}`}>
                          {syncFolderReviewLabels[review.status]}
                        </span>
                      ) : null}
                      <small>{packetFile.path}</small>
                      <small>
                        {packetFile.bytes} bytes / {packetFile.modifiedAt}
                      </small>
                      {review ? <small>{review.reason}</small> : null}
                      {review?.sourceDeviceId ? (
                        <small>
                          {syncLabels.reviewSource}: {review.sourceDeviceName || review.sourceDeviceId}
                        </small>
                      ) : null}
                      {typeof review?.records === 'number' ? (
                        <small>
                          {syncLabels.reviewRecords}: {review.records}
                          {typeof review.destructiveChanges === 'number' && typeof review.timestampTies === 'number'
                            ? ` / ${syncLabels.reviewDecisions}: ${review.destructiveChanges}+${review.timestampTies}`
                            : ''}
                        </small>
                      ) : null}
                      {review?.signatureStatus ? (
                        <small>
                          {syncPreviewLabels.signature}: {signatureStatusLabel(review.signatureStatus)}
                        </small>
                      ) : null}
                    </div>
                    <div className="deviceActions">
                      <button
                        className="restoreButton inlineActionButton"
                        type="button"
                        disabled={blocksPreview}
                        onClick={() => onImportSyncFolderPacket(packetFile)}
                      >
                        <FileUp size={14} />
                        {syncLabels.importFolderPacket}
                      </button>
                      <button
                        className="restoreButton dangerButton inlineActionButton"
                        type="button"
                        onClick={() => onQuarantineSyncFolderPacket(packetFile)}
                      >
                        <ShieldOff size={14} />
                        {syncLabels.quarantineFolderPacket}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <span className="storagePath">{syncLabels.noFolderPackets}</span>
          )}
          {syncStatus ? <span className="restoreStatus">{syncStatus}</span> : null}
          {syncPreview ? (
            <div className="restorePreviewBox syncPreviewBox">
              <strong>{syncPreviewLabels.title}</strong>
              <span>
                {syncPreviewLabels.source}: {syncPreview.packet.sourceDeviceName || syncPreview.packet.sourceDeviceId}
              </span>
              <span>
                {syncPreviewLabels.sourceTrust}:{' '}
                {syncPreview.diff.sourceDeviceKnown ? syncPreviewLabels.sourceKnown : syncPreviewLabels.sourceUnknown}
              </span>
              <span>
                {syncPreviewLabels.signature}: {signatureStatusLabel(syncPreview.signatureReview?.status)}
              </span>
              <span>
                {syncPreviewLabels.created}: {syncPreview.packet.createdAt}
              </span>
              <div className="restorePreviewGrid" aria-label={syncPreviewLabels.incoming}>
                <b>{syncPreviewLabels.incoming}</b>
                <span>
                  {syncPreviewLabels.records}: {syncPreview.packet.records.length}
                </span>
                <span>
                  {syncPreviewLabels.devices}: {syncPreview.diff.incomingDevices}
                </span>
                <span>
                  {syncPreviewLabels.revoked}: {syncPreview.diff.incomingRevokedDevices}
                </span>
                <span>
                  {syncPreviewLabels.blocks}: {syncPreview.diff.incomingBlocks}
                </span>
                <span>
                  {syncPreviewLabels.deletions}: {syncPreview.diff.incomingDeletions}
                </span>
              </div>
              <div className="restorePreviewGrid" aria-label={syncPreviewLabels.blocks}>
                <b>{syncPreviewLabels.blocks}</b>
                <span>
                  {syncPreviewLabels.added}: {syncPreview.diff.addedBlocks}
                </span>
                <span>
                  {syncPreviewLabels.updated}: {syncPreview.diff.updatedBlocks}
                </span>
                <span>
                  {syncPreviewLabels.skipped}: {syncPreview.diff.skippedBlocks}
                </span>
              </div>
              <div className="restorePreviewGrid" aria-label={syncPreviewLabels.deletions}>
                <b>{syncPreviewLabels.deletions}</b>
                <span>
                  {syncPreviewLabels.deleted}: {syncPreview.diff.deletedBlocks}
                </span>
                <span>
                  {syncPreviewLabels.skipped}: {syncPreview.diff.skippedDeletions}
                </span>
              </div>
              <div className="restorePreviewGrid" aria-label={syncPreviewLabels.decisions}>
                <b>{syncPreviewLabels.decisions}</b>
                <span>
                  {syncPreviewLabels.remoteWins}: {syncPreview.diff.remoteWins}
                </span>
                <span>
                  {syncPreviewLabels.localWins}: {syncPreview.diff.localWins}
                </span>
                <span>
                  {syncPreviewLabels.timestampTies}: {syncPreview.diff.timestampTies}
                </span>
                <span>
                  {syncPreviewLabels.destructiveChanges}: {syncPreview.diff.destructiveChanges}
                </span>
              </div>
              {syncPreview.diff.replay ? <span className="restoreWarning">{syncPreviewLabels.warning}</span> : null}
              {syncPreviewRequiresDeviceTrust(syncPreview) ? (
                <label className="riskGate trustGate">
                  <span>
                    <strong>{syncPreviewLabels.trustTitle}</strong>
                    {syncPreviewLabels.trustCopy}
                  </span>
                  <input
                    type="checkbox"
                    checked={syncDeviceTrustAccepted}
                    onChange={(event) => onSyncDeviceTrustAcceptedChange(event.target.checked)}
                  />
                  <b>{syncPreviewLabels.trustAccepted}</b>
                </label>
              ) : null}
              {syncPreviewRequiresRiskAcknowledgement(syncPreview) ? (
                <label className="riskGate">
                  <span>
                    <strong>{syncPreviewLabels.riskTitle}</strong>
                    {syncPreviewLabels.riskCopy}
                  </span>
                  <input
                    type="checkbox"
                    checked={syncRiskAccepted}
                    onChange={(event) => onSyncRiskAcceptedChange(event.target.checked)}
                  />
                  <b>{syncPreviewLabels.riskAccepted}</b>
                </label>
              ) : null}
              <div className="restorePreviewActions">
                <button className="restoreButton dangerButton" type="button" onClick={onApplySyncPreview}>
                  {syncPreview.diff.replay ? syncPreviewLabels.dismiss : syncPreviewLabels.apply}
                </button>
                <button className="restoreButton" type="button" onClick={onCancelSyncPreview}>
                  {syncPreviewLabels.cancel}
                </button>
              </div>
            </div>
          ) : null}
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
