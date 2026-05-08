import { Send, Sparkles } from 'lucide-react';
import type { CrossAppHandoff } from '../crossAppHandoff';
import type { UiCopy } from '../i18n';
import { HelpNote } from './HelpNote';

type CapturePanelProps = {
  ui: UiCopy;
  captureText: string;
  diaryText: string;
  incomingHandoff?: CrossAppHandoff | null;
  handoffStatus?: string;
  onCaptureTextChange: (text: string) => void;
  onDiaryTextChange: (text: string) => void;
  onCapture: () => void;
  onCaptureDiary: () => void;
  onImportHandoff?: () => void;
  onStageHandoff?: () => void;
  onDismissHandoff?: () => void;
};

export function CapturePanel({
  ui,
  captureText,
  diaryText,
  incomingHandoff,
  handoffStatus,
  onCaptureTextChange,
  onDiaryTextChange,
  onCapture,
  onCaptureDiary,
  onImportHandoff,
  onStageHandoff,
  onDismissHandoff,
}: CapturePanelProps) {
  return (
    <section className="capture" aria-label={ui.quickCapture as string}>
      <div className="captureHeader">
        <div>
          <p>{ui.quickCapture as string}</p>
          <strong>{ui.captureThought as string}</strong>
        </div>
        <HelpNote ui={ui} content={ui.sectionHelp.capture} />
      </div>
      {incomingHandoff ? (
        <div className="handoffBanner">
          <div>
            <p>{ui.handoffEyebrow as string}</p>
            <strong>{incomingHandoff.title}</strong>
            <span>{ui.handoffBody as string}</span>
            <code>{incomingHandoff.markdown.slice(0, 240)}</code>
          </div>
          <div className="handoffActions">
            <button type="button" onClick={onImportHandoff}>
              {ui.handoffImport as string}
            </button>
            <button type="button" onClick={onStageHandoff}>
              {ui.handoffStage as string}
            </button>
            <button type="button" onClick={onDismissHandoff}>
              {ui.handoffDismiss as string}
            </button>
          </div>
        </div>
      ) : null}
      {handoffStatus ? <div className="handoffStatus">{handoffStatus}</div> : null}
      <div className="captureEntryGrid">
        <div className="captureEntry">
          <div className="captureEntryHeader">
            <span>{ui.captureThought as string}</span>
            <small>{ui.captureHint as string}</small>
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
        </div>
        <div className="captureEntry captureEntryDiary">
          <div className="captureEntryHeader">
            <span>{ui.diaryTitle as string}</span>
            <small>{ui.diaryHint as string}</small>
          </div>
          <textarea
            aria-label={ui.diaryTitle as string}
            placeholder={ui.diaryPlaceholder as string}
            value={diaryText}
            onChange={(event) => onDiaryTextChange(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                onCaptureDiary();
              }
            }}
          />
          <div className="captureActions">
            <div className="captureHint">
              <Sparkles size={16} />
              {ui.diarySaveHint as string}
            </div>
            <button type="button" onClick={onCaptureDiary}>
              <Send size={17} />
              {ui.diarySave as string}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
