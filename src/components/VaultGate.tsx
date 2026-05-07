import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import type { Locale } from '../i18n';

type VaultGateMode = 'checking' | 'locked' | 'setup';

type VaultGateProps = {
  locale: Locale;
  mode: VaultGateMode;
  hasLegacyPlainStore: boolean;
  error: string;
  notice: string;
  onLocaleChange: (locale: Locale) => void;
  onUnlock: (passphrase: string) => void;
  onCreate: (passphrase: string, confirmation: string) => void;
  onResetEncryptedVault: () => void;
};

export function VaultGate({
  locale,
  mode,
  hasLegacyPlainStore,
  error,
  notice,
  onLocaleChange,
  onUnlock,
  onCreate,
  onResetEncryptedVault,
}: VaultGateProps) {
  const [passphrase, setPassphrase] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [resetConfirmation, setResetConfirmation] = useState('');
  const isSetup = mode === 'setup';
  const isChecking = mode === 'checking';
  const canResetEncryptedVault = mode === 'locked';
  const resetPhrase = 'RESET';
  const labels =
    locale === 'en'
      ? {
          eyebrow: 'Encrypted local vault',
          checkingTitle: 'Checking vault storage',
          lockedTitle: 'Unlock Distill',
          setupTitle: hasLegacyPlainStore ? 'Encrypt existing local data' : 'Create your encrypted vault',
          checkingBody: 'Distill is checking whether an encrypted vault already exists on this device.',
          lockedBody: 'Enter your vault passphrase. Your thoughts are decrypted only into the running app session.',
          setupBody: hasLegacyPlainStore
            ? 'A plaintext local store was found. Create a passphrase to migrate it into an encrypted vault and remove the old plaintext copy.'
            : 'Create a passphrase before using Distill. If you forget it, the vault cannot be recovered.',
          passphrase: 'Vault passphrase',
          confirm: 'Confirm vault passphrase',
          unlock: 'Unlock vault',
          create: hasLegacyPlainStore ? 'Encrypt and migrate' : 'Create vault',
          warning: 'Use at least 12 characters. Distill cannot recover a forgotten passphrase.',
          storage: 'At rest: AES-GCM encrypted vault. In use: decrypted in memory only.',
          resetTitle: 'Forgot the passphrase?',
          resetBody:
            'Resetting cannot decrypt the current vault. Distill backs it up, removes it from active use, and lets you create a new empty vault.',
          resetInstruction: `Type ${resetPhrase} to enable reset.`,
          resetPlaceholder: resetPhrase,
          resetButton: 'Back up and reset vault',
        }
      : {
          eyebrow: '暗号化ローカルVault',
          checkingTitle: 'Vault保存先を確認中',
          lockedTitle: 'Distillをロック解除',
          setupTitle: hasLegacyPlainStore ? '既存データを暗号化' : '暗号化Vaultを作成',
          checkingBody: 'この端末に暗号化Vaultがあるか確認しています。',
          lockedBody: 'Vaultパスフレーズを入力してください。思考データは起動中のアプリ内メモリにだけ復号されます。',
          setupBody: hasLegacyPlainStore
            ? '平文のローカル保存データが見つかりました。パスフレーズを作成して暗号化Vaultへ移行し、古い平文コピーを削除します。'
            : 'Distillを使う前にパスフレーズを作成します。忘れるとVaultは復元できません。',
          passphrase: 'Vaultパスフレーズ',
          confirm: 'Vaultパスフレーズ確認',
          unlock: 'Vaultを開く',
          create: hasLegacyPlainStore ? '暗号化して移行' : 'Vaultを作成',
          warning: '12文字以上を推奨します。忘れたパスフレーズは復元できません。',
          storage: '保存時: AES-GCM暗号化Vault。利用中: メモリ上だけ復号。',
          resetTitle: 'パスフレーズを忘れた場合',
          resetBody:
            '初期化しても現在のVaultは復号できません。Distillは旧Vaultを退避し、アクティブ状態から外して、新しい空のVaultを作れる状態にします。',
          resetInstruction: `${resetPhrase} と入力すると初期化ボタンを押せます。`,
          resetPlaceholder: resetPhrase,
          resetButton: '退避してVaultを初期化',
        };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSetup) {
      onCreate(passphrase, confirmation);
      return;
    }

    onUnlock(passphrase);
  }

  return (
    <main className="vaultGate" aria-label={labels.eyebrow}>
      <section className="vaultCard">
        <div className="vaultMark">
          {isSetup ? <ShieldCheck size={24} /> : <LockKeyhole size={24} />}
        </div>
        <div className="vaultLocaleToggle" aria-label={locale === 'en' ? 'Language' : '言語'}>
          <button className={locale === 'ja' ? 'active' : ''} type="button" onClick={() => onLocaleChange('ja')}>
            日本語
          </button>
          <button className={locale === 'en' ? 'active' : ''} type="button" onClick={() => onLocaleChange('en')}>
            English
          </button>
        </div>
        <p className="vaultEyebrow">{labels.eyebrow}</p>
        <h1>{isChecking ? labels.checkingTitle : isSetup ? labels.setupTitle : labels.lockedTitle}</h1>
        <p className="vaultBody">{isChecking ? labels.checkingBody : isSetup ? labels.setupBody : labels.lockedBody}</p>

        {isChecking ? (
          <div className="vaultProgress" aria-label={labels.checkingTitle} />
        ) : (
          <form className="vaultForm" onSubmit={submit}>
            <label>
              {labels.passphrase}
              <input
                aria-label="Vault passphrase"
                autoComplete="current-password"
                autoFocus
                minLength={isSetup ? 12 : undefined}
                type="password"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
              />
            </label>
            {isSetup ? (
              <label>
                {labels.confirm}
                <input
                  aria-label="Confirm vault passphrase"
                  autoComplete="new-password"
                  minLength={12}
                  type="password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </label>
            ) : null}
            <span className="vaultWarning">{labels.warning}</span>
            <button type="submit">{isSetup ? labels.create : labels.unlock}</button>
          </form>
        )}

        {canResetEncryptedVault ? (
          <details className="vaultResetPanel">
            <summary>{labels.resetTitle}</summary>
            <p>{labels.resetBody}</p>
            <label>
              {labels.resetInstruction}
              <input
                aria-label="Confirm vault reset"
                autoComplete="off"
                placeholder={labels.resetPlaceholder}
                value={resetConfirmation}
                onChange={(event) => setResetConfirmation(event.target.value)}
              />
            </label>
            <button
              className="vaultResetButton"
              disabled={resetConfirmation !== resetPhrase}
              type="button"
              onClick={onResetEncryptedVault}
            >
              {labels.resetButton}
            </button>
          </details>
        ) : null}

        {error ? <p className="vaultError">{error}</p> : null}
        {notice ? <p className="vaultNotice">{notice}</p> : null}
        <span className="vaultStorage">{labels.storage}</span>
      </section>
    </main>
  );
}
