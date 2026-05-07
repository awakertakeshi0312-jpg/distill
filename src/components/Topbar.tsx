import { Command, LockKeyhole } from 'lucide-react';
import type { Locale, UiCopy } from '../i18n';

type TopbarProps = {
  ui: UiCopy;
  locale: Locale;
  title: string;
  eyebrow: string;
  onLocaleChange: (locale: Locale) => void;
  onOpenCommandPalette: () => void;
  onLockVault: () => void;
};

export function Topbar({ ui, locale, title, eyebrow, onLocaleChange, onOpenCommandPalette, onLockVault }: TopbarProps) {
  const displayDate = new Intl.DateTimeFormat(locale === 'ja' ? 'ja-JP' : 'en-US', {
    dateStyle: 'full',
  }).format(new Date());
  const lockLabel = locale === 'en' ? 'Lock vault' : 'Vaultをロック';

  return (
    <header className="topbar">
      <div>
        <p>{displayDate}</p>
        <span className="topbarEyebrow">{eyebrow}</span>
        <h1>{title}</h1>
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
        <button className="vaultLockButton" type="button" aria-label={lockLabel} title={lockLabel} onClick={onLockVault}>
          <LockKeyhole size={18} />
          <span>{lockLabel}</span>
        </button>
      </div>
    </header>
  );
}
