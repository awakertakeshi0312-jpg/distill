import { Database, Download, FileText, FileUp, Link2, Network, RefreshCw, UserRound } from 'lucide-react';
import type { UiCopy } from '../i18n';
import type { Project, ThoughtBlock } from '../model';
import type { RelatedBlock } from '../repository';
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
  onExportMarkdown: () => void;
  onExportJson: () => void;
  onRestoreJson: (file: File) => void;
  onImportMarkdown: (file: File) => void;
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
  onExportMarkdown,
  onExportJson,
  onRestoreJson,
  onImportMarkdown,
  onUpdateInstallerPathChange,
  onStartUpdate,
  onCheckForUpdates,
  onInstallAutoUpdate,
}: InspectorPanelProps) {
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
