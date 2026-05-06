import { RotateCcw } from 'lucide-react';
import type { Locale, UiCopy } from '../i18n';
import { formatBlockMeta, type Project, type ThoughtBlock } from '../model';
import { HelpNote } from './HelpNote';

type ArchivePanelProps = {
  ui: UiCopy;
  locale: Locale;
  projects: Project[];
  archivedBlocks: ThoughtBlock[];
  onRestoreBlock: (blockId: string) => void;
};

export function ArchivePanel({ ui, locale, projects, archivedBlocks, onRestoreBlock }: ArchivePanelProps) {
  return (
    <section className="panel archivePanel" id="archive">
      <div className="panelHeader">
        <div>
          <p>{ui.archived as string}</p>
          <h2>{ui.archivedBlocks as string}</h2>
        </div>
        <div className="panelHeaderActions">
          <HelpNote ui={ui} content={ui.sectionHelp.archive} />
          <span className="countBadge">{ui.archivedCount(archivedBlocks.length)}</span>
        </div>
      </div>

      <div className="archiveList">
        {archivedBlocks.length > 0 ? (
          archivedBlocks.map((block) => (
            <article className="archiveRow" key={block.id}>
              <div>
                <strong>{block.content}</strong>
                <span>{formatBlockMeta(block, projects, locale)}</span>
              </div>
              <button type="button" onClick={() => onRestoreBlock(block.id)}>
                <RotateCcw size={15} />
                {ui.restoreBlock as string}
              </button>
            </article>
          ))
        ) : (
          <div className="emptyState">{ui.noArchivedBlocks as string}</div>
        )}
      </div>
    </section>
  );
}
