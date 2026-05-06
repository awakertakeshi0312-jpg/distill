import { Archive, CheckCircle2, Circle, Edit3, Tag, X } from 'lucide-react';
import type { Locale, UiCopy } from '../i18n';
import { formatBlockMeta, type Project, type ThoughtBlock } from '../model';
import { HelpNote } from './HelpNote';

type InboxPanelProps = {
  ui: UiCopy;
  locale: Locale;
  projects: Project[];
  activeBlocks: ThoughtBlock[];
  openBlocksCount: number;
  selectedBlockId?: string;
  editingBlockId?: string;
  editingText: string;
  onSelectBlock: (blockId?: string) => void;
  onToggleProcessed: (blockId: string) => void;
  onStartEditing: (blockId: string, content: string) => void;
  onEditingTextChange: (text: string) => void;
  onSaveEditing: () => void;
  onCancelEditing: () => void;
  onArchiveBlock: (blockId: string) => void;
};

export function InboxPanel({
  ui,
  locale,
  projects,
  activeBlocks,
  openBlocksCount,
  selectedBlockId,
  editingBlockId,
  editingText,
  onSelectBlock,
  onToggleProcessed,
  onStartEditing,
  onEditingTextChange,
  onSaveEditing,
  onCancelEditing,
  onArchiveBlock,
}: InboxPanelProps) {
  return (
    <section className="panel largePanel" id="inbox">
      <div className="panelHeader">
        <div>
          <p>{ui.unprocessed as string}</p>
          <h2>{ui.thoughtBlocks as string}</h2>
        </div>
        <div className="panelHeaderActions">
          <HelpNote ui={ui} content={ui.sectionHelp.inbox} />
          <span className="countBadge">{ui.open(openBlocksCount)}</span>
        </div>
      </div>

      <div className="blockList">
        {activeBlocks.map((block) => (
          <article
            className={`thoughtBlock ${selectedBlockId === block.id ? 'selected' : ''}`}
            key={block.id}
            onClick={() => onSelectBlock(block.id)}
          >
            <button
              className="statusButton"
              type="button"
              aria-label={ui.toggleBlock(block.id)}
              onClick={(event) => {
                event.stopPropagation();
                onToggleProcessed(block.id);
              }}
            >
              {block.state === 'processed' ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            </button>
            <div className="blockBody">
              {editingBlockId === block.id ? (
                <div className="editBlockForm" onClick={(event) => event.stopPropagation()}>
                  <textarea
                    aria-label={ui.editBlockLabel as string}
                    placeholder={ui.editBlockPlaceholder as string}
                    value={editingText}
                    onChange={(event) => onEditingTextChange(event.target.value)}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                        onSaveEditing();
                      }

                      if (event.key === 'Escape') {
                        onCancelEditing();
                      }
                    }}
                  />
                  <div className="editActions">
                    <button type="button" onClick={onSaveEditing}>
                      <CheckCircle2 size={15} />
                      {ui.saveEdit as string}
                    </button>
                    <button className="ghostButton" type="button" onClick={onCancelEditing}>
                      <X size={15} />
                      {ui.cancelEdit as string}
                    </button>
                  </div>
                </div>
              ) : (
                <p>{block.content}</p>
              )}
              <div className="blockMeta">
                <span>{formatBlockMeta(block, projects, locale)}</span>
                {block.tags.map((tag) => (
                  <span className="tag" key={tag}>
                    <Tag size={12} />
                    {tag}
                  </span>
                ))}
                <button
                  className="inlineEditButton"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onStartEditing(block.id, block.content);
                  }}
                >
                  <Edit3 size={12} />
                  {ui.editBlock as string}
                </button>
                <button
                  className="inlineEditButton"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onArchiveBlock(block.id);
                  }}
                >
                  <Archive size={12} />
                  {ui.archiveBlock as string}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
