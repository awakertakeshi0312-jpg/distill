import { Search } from 'lucide-react';
import type { UiCopy } from '../i18n';
import type { PersonMention } from '../repository';
import { HelpNote } from './HelpNote';

type PeoplePanelProps = {
  ui: UiCopy;
  peopleIndex: PersonMention[];
  onSearchPerson: (name: string, firstBlockId?: string) => void;
};

export function PeoplePanel({ ui, peopleIndex, onSearchPerson }: PeoplePanelProps) {
  return (
    <section className="panel peoplePanel" id="people">
      <div className="panelHeader">
        <div>
          <p>{ui.people as string}</p>
          <h2>{ui.peopleIndex as string}</h2>
        </div>
        <div className="panelHeaderActions">
          <HelpNote ui={ui} content={ui.sectionHelp.people} />
          <span className="countBadge">{ui.peopleDetail(peopleIndex.length)}</span>
        </div>
      </div>

      {peopleIndex.length > 0 ? (
        <div className="peopleGrid">
          {peopleIndex.map((person) => (
            <article className="personCard" key={person.name}>
              <div>
                <strong>@{person.name}</strong>
                <span>{ui.blocks(person.blockIds.length)}</span>
              </div>
              <button type="button" onClick={() => onSearchPerson(person.name, person.blockIds[0])}>
                <Search size={15} />
                {ui.navSearch as string}
              </button>
            </article>
          ))}
        </div>
      ) : (
        <div className="emptyState">{ui.peopleHint as string}</div>
      )}
    </section>
  );
}
