import { Send, Sparkles } from 'lucide-react';
import type { UiCopy } from '../i18n';
import { HelpNote } from './HelpNote';

type CapturePanelProps = {
  ui: UiCopy;
  captureText: string;
  onCaptureTextChange: (text: string) => void;
  onCapture: () => void;
};

export function CapturePanel({ ui, captureText, onCaptureTextChange, onCapture }: CapturePanelProps) {
  return (
    <section className="capture" aria-label={ui.quickCapture as string}>
      <div className="captureHeader">
        <div>
          <p>{ui.quickCapture as string}</p>
          <strong>{ui.captureThought as string}</strong>
        </div>
        <HelpNote ui={ui} content={ui.sectionHelp.capture} />
      </div>
      <textarea
        aria-label={ui.captureThought as string}
        placeholder={ui.capturePlaceholder as string}
        value={captureText}
        onChange={(event) => onCaptureTextChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            onCapture();
          }
        }}
      />
      <div className="captureActions">
        <div className="captureHint">
          <Sparkles size={16} />
          {ui.captureHint as string}
        </div>
        <button type="button" onClick={onCapture}>
          <Send size={17} />
          {ui.capture as string}
        </button>
      </div>
    </section>
  );
}
