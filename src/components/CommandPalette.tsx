import { Command, X } from 'lucide-react';
import type { UiCopy } from '../i18n';

export type CommandItem = {
  id: string;
  label: string;
  section: string;
  keywords: string;
  run: () => void;
};

type CommandPaletteProps = {
  ui: UiCopy;
  commandQuery: string;
  filteredCommandItems: CommandItem[];
  onCommandQueryChange: (query: string) => void;
  onRunCommand: (command: CommandItem) => void;
  onClose: () => void;
};

export function CommandPalette({
  ui,
  commandQuery,
  filteredCommandItems,
  onCommandQueryChange,
  onRunCommand,
  onClose,
}: CommandPaletteProps) {
  return (
    <div
      className="commandOverlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="commandPalette" role="dialog" aria-modal="true" aria-label={ui.commandPaletteTitle as string}>
        <div className="commandInputRow">
          <Command size={18} />
          <input
            autoFocus
            value={commandQuery}
            placeholder={ui.commandPalettePlaceholder as string}
            onChange={(event) => onCommandQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && filteredCommandItems[0]) {
                onRunCommand(filteredCommandItems[0]);
              }

              if (event.key === 'Escape') {
                onClose();
              }
            }}
          />
          <button type="button" onClick={onClose} aria-label={ui.cancelEdit as string}>
            <X size={17} />
          </button>
        </div>
        <div className="commandList">
          {filteredCommandItems.length > 0 ? (
            filteredCommandItems.map((item) => (
              <button className="commandItem" key={item.id} type="button" onClick={() => onRunCommand(item)}>
                <span>{item.section}</span>
                <strong>{item.label}</strong>
              </button>
            ))
          ) : (
            <div className="emptyState">{ui.commandNoResults as string}</div>
          )}
        </div>
        <p className="commandHint">{ui.commandHint as string}</p>
      </section>
    </div>
  );
}
