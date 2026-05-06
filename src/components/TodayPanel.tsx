import type { Locale, UiCopy } from '../i18n';
import { formatBlockMeta, type Project, type ThoughtBlock } from '../model';
import type { DailyNoteGroup, ProjectCount } from '../selectors';
import { HelpNote } from './HelpNote';

type TodayPanelProps = {
  ui: UiCopy;
  locale: Locale;
  projects: Project[];
  todayNoteId: string;
  todayBlocks: ThoughtBlock[];
  focusProjects: ProjectCount[];
  dailyNotes: DailyNoteGroup[];
  onSelectBlock: (blockId?: string) => void;
  onSearchProject: (projectName: string) => void;
};

export function TodayPanel({
  ui,
  locale,
  projects,
  todayNoteId,
  todayBlocks,
  focusProjects,
  dailyNotes,
  onSelectBlock,
  onSearchProject,
}: TodayPanelProps) {
  const dailyNoteCount = dailyNotes.reduce((sum, note) => sum + note.blocks.length, 0);

  return (
    <section className="panel todayPanel" id="today">
      <div className="panelHeader">
        <div>
          <p>{ui.dailyNote as string}</p>
          <h2>{ui.todayBlocks as string}</h2>
        </div>
        <div className="panelHeaderActions">
          <HelpNote ui={ui} content={ui.sectionHelp.today} />
          <span className="countBadge">{ui.dailyNoteCount(todayBlocks.length)}</span>
        </div>
      </div>

      <div className="todayGrid">
        <div className="todayColumn">
          <div className="todayColumnHeader">
            <strong>{ui.today as string}</strong>
            <span>{todayNoteId}</span>
          </div>
          <div className="dailyBlockList">
            {todayBlocks.length > 0 ? (
              todayBlocks.map((block) => (
                <button className="dailyBlockButton" key={block.id} type="button" onClick={() => onSelectBlock(block.id)}>
                  <strong>{block.content}</strong>
                  <span>{formatBlockMeta(block, projects, locale)}</span>
                </button>
              ))
            ) : (
              <div className="emptyState">{ui.noTodayBlocks as string}</div>
            )}
          </div>
        </div>

        <div className="todayColumn">
          <div className="todayColumnHeader">
            <strong>{ui.todayFocus as string}</strong>
            <span>{ui.activeFocus as string}</span>
          </div>
          <div className="focusList">
            {focusProjects.map((project) => (
              <button className="focusPill" key={project.id} type="button" onClick={() => onSearchProject(project.name)}>
                <strong>{project.name}</strong>
                <span>{ui.blocks(project.blocks)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="todayColumn wide">
          <div className="todayColumnHeader">
            <strong>{ui.recentDailyNotes as string}</strong>
            <span>{ui.dailyNoteCount(dailyNoteCount)}</span>
          </div>
          <div className="dailyNoteList">
            {dailyNotes.map((note) => (
              <article className="dailyNoteRow" key={note.noteId}>
                <div>
                  <strong>{note.date}</strong>
                  <span>{ui.dailyNoteCount(note.blocks.length)}</span>
                </div>
                <button type="button" onClick={() => onSelectBlock(note.blocks[0]?.id)}>
                  {note.blocks[0]?.content ?? note.noteId}
                </button>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
