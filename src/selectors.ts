import type { DistillStore, Project, ThoughtBlock } from './model';

export type ProjectCount = Project & {
  blocks: number;
};

export type DailyNoteGroup = {
  noteId: string;
  date: string;
  blocks: ThoughtBlock[];
};

export function getActiveBlocks(store: DistillStore) {
  return store.blocks.filter((block) => block.state !== 'archived');
}

export function getArchivedBlocks(store: DistillStore) {
  return store.blocks.filter((block) => block.state === 'archived');
}

export function getOpenBlocks(activeBlocks: ThoughtBlock[]) {
  return activeBlocks.filter((block) => block.state !== 'processed');
}

export function getProjectCounts(store: DistillStore, activeBlocks: ThoughtBlock[]): ProjectCount[] {
  return store.projects.map((project) => ({
    ...project,
    blocks: activeBlocks.filter((block) => block.projectId === project.id).length,
  }));
}

export function getTodayNoteId(date = new Date()) {
  return `daily-${date.toISOString().slice(0, 10)}`;
}

export function getTodayBlocks(activeBlocks: ThoughtBlock[], todayNoteId: string) {
  return activeBlocks.filter((block) => block.noteId === todayNoteId);
}

export function getDailyNotes(activeBlocks: ThoughtBlock[], limit = 5): DailyNoteGroup[] {
  return Object.entries(
    activeBlocks.reduce<Record<string, ThoughtBlock[]>>((groups, block) => {
      if (!block.noteId.startsWith('daily-')) {
        return groups;
      }

      return {
        ...groups,
        [block.noteId]: [...(groups[block.noteId] ?? []), block],
      };
    }, {}),
  )
    .map(([noteId, blocks]) => ({
      noteId,
      date: noteId.replace('daily-', ''),
      blocks: blocks.sort((a, b) => Date.parse(b.capturedAt) - Date.parse(a.capturedAt)),
    }))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

export function getFocusProjects(projectCounts: ProjectCount[], limit = 3) {
  return projectCounts.filter((project) => project.status === 'Active').slice(0, limit);
}
