import type { UiCopy } from '../i18n';
import type { SearchResult } from '../model';
import { HelpNote } from './HelpNote';

type SearchPanelProps = {
  ui: UiCopy;
  query: string;
  results: SearchResult[];
  onQueryChange: (query: string) => void;
  onSelectBlock: (blockId: string) => void;
};

function translateReason(ui: UiCopy, reason: string) {
  if (reason === 'Recent capture') {
    return ui.recentCapture as string;
  }

  if (reason === 'FTS match - content/tags/links') {
    return ui.ftsMatch as string;
  }

  if (reason.includes('Semantic overlap')) {
    return ui.semanticOverlap as string;
  }

  return reason;
}

export function SearchPanel({ ui, query, results, onQueryChange, onSelectBlock }: SearchPanelProps) {
  return (
    <section className="panel searchPanel" id="search">
      <div className="panelHeader">
        <div>
          <p>{ui.hybridRetrieval as string}</p>
          <h2>{ui.meaningSearch as string}</h2>
        </div>
        <div className="panelHeaderActions searchHeaderActions">
          <HelpNote ui={ui} content={ui.sectionHelp.search} />
          <input aria-label={ui.searchNotes as string} value={query} onChange={(event) => onQueryChange(event.target.value)} />
        </div>
      </div>

      <div className="resultList">
        {results.length > 0 ? (
          results.map((result) => (
            <button className="resultRow" key={result.block.id} type="button" onClick={() => onSelectBlock(result.block.id)}>
              <div className="resultSummary">
                <strong>{result.block.content}</strong>
                <span>{translateReason(ui, result.reason)}</span>
              </div>
              {(result.matchedFields.length > 0 || result.matchedTerms.length > 0) && (
                <div className="resultEvidence" aria-label={ui.matchedFieldsLabel as string}>
                  {result.matchedFields.map((field) => (
                    <span className="evidencePill" key={field}>
                      {ui.fieldLabels[field as keyof typeof ui.fieldLabels] ?? field}
                    </span>
                  ))}
                  {result.matchedTerms.map((term) => (
                    <span className="evidencePill termPill" key={term}>
                      {term}
                    </span>
                  ))}
                </div>
              )}
            </button>
          ))
        ) : (
          <div className="emptyState">{ui.noMatches as string}</div>
        )}
      </div>
    </section>
  );
}
