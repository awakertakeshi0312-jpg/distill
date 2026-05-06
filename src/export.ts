import { DistillStore, formatBlockMeta } from './model';

export function exportStoreAsJson(store: DistillStore) {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
      ...store,
    },
    null,
    2,
  );
}

export function exportStoreAsMarkdown(store: DistillStore) {
  const lines = ['# Distill Export', '', `Exported: ${new Date().toISOString()}`, ''];

  for (const project of store.projects) {
    const blocks = store.blocks.filter((block) => block.projectId === project.id);

    lines.push(`## ${project.name}`, '', project.signal, '');

    if (blocks.length === 0) {
      lines.push('_No linked blocks._', '');
      continue;
    }

    for (const block of blocks) {
      const tags = block.tags.map((tag) => `#${tag}`).join(' ');
      const links = block.links.map((link) => `[[${link}]]`).join(' ');
      lines.push(`- ${block.content}`);
      lines.push(`  - id: ${block.id}`);
      lines.push(`  - context: ${formatBlockMeta(block, store.projects)}`);
      lines.push(`  - state: ${block.state}`);

      if (tags) {
        lines.push(`  - tags: ${tags}`);
      }

      if (links) {
        lines.push(`  - links: ${links}`);
      }
    }

    lines.push('');
  }

  const inboxBlocks = store.blocks.filter((block) => !block.projectId);
  lines.push('## Inbox', '');

  if (inboxBlocks.length === 0) {
    lines.push('_No inbox blocks._');
  } else {
    for (const block of inboxBlocks) {
      lines.push(`- ${block.content}`);
      lines.push(`  - id: ${block.id}`);
      lines.push(`  - state: ${block.state}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

export function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

