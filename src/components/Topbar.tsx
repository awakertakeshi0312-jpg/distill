import { Command, LockKeyhole } from 'lucide-react';
import type { Locale, UiCopy } from '../i18n';

type TopbarProps = {
  ui: UiCopy;
  locale: Locale;
  onLocaleChange: (locale: Locale) => void;
  onOpenCommandPalette: () => void;
  onLockVault: () => void;
};

export function Topbar({ ui, locale, onLocaleChange, onOpenCommandPalette, onLockVault }: TopbarProps) {
  const displayDate = new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
    dateStyle: 'full',
  }).format(new Date());

  return (
    <header className="topbar">
      <div>
        <p>{displayDate}</p>
        <h1>{ui.inboxTriage as string}</h1>
      </div>
      <div className="topbarActions">
        <div className="localeToggle" aria-label={ui.languageLabel as string}>
          <button className={locale === 'ja' ? 'active' : ''} type="button" onClick={() => onLocaleChange('ja')}>
            日本語
          </button>
          <button className={locale === 'en' ? 'active' : ''} type="button" onClick={() => onLocaleChange('en')}>
            English
          </button>
        </div>
        <button
          className="iconButton"
          type="button"
          aria-label={ui.commandPalette as string}
          title={ui.commandPalette as string}
          onClick={onOpenCommandPalette}
        >
          <Command size={19} />
        </button>
        <button
          className="iconButton"
          type="button"
          aria-label={locale === 'en' ? 'Lock vault' : 'Vaultをロック'}
          title={locale === 'en' ? 'Lock vault' : 'Vaultをロック'}
          onClick={onLockVault}
        >
          <LockKeyhole size={18} />
        </button>
      </div>
    </header>
  );
}
