import { HelpCircle } from 'lucide-react';
import type { UiCopy } from '../i18n';

type HelpContent = {
  title: string;
  body: string;
  steps: string[];
};

type HelpNoteProps = {
  ui: UiCopy;
  content: HelpContent;
};

export function HelpNote({ ui, content }: HelpNoteProps) {
  return (
    <details className="helpNote">
      <summary>
        <HelpCircle size={15} />
        {ui.helpButton as string}
      </summary>
      <div className="helpNoteBody">
        <strong>{content.title}</strong>
        <p>{content.body}</p>
        <ul>
          {content.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
      </div>
    </details>
  );
}
