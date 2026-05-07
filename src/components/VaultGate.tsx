import { Eye, EyeOff, LockKeyhole, ShieldCheck } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useState } from 'react';
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

type VaultGateCopy = {
  eyebrow: string;
  checkingTitle: string;
  lockedTitle: string;
  setupTitle: string;
  checkingBody: string;
  lockedBody: string;
  setupBody: string;
  passphrase: string;
  confirm: string;
  unlock: string;
  create: string;
  warning: string;
  storage: string;
  show: string;
  hide: string;
  length: (count: number) => string;
  edgeWhitespace: string;
  trimEdgeWhitespace: string;
  capsLock: string;
  mismatch: string;
  saveTitle: string;
  saveBody: string;
  saveSteps: string[];
  unlockHelpTitle: string;
  unlockHelpBody: string;
  unlockHelpSteps: string[];
  errorHelpTitle: string;
  resetTitle: string;
  resetBody: string;
  resetWarningTitle: string;
  resetWarningSteps: string[];
  resetInstruction: string;
  resetPlaceholder: string;
  resetButton: string;
  language: string;
};

function getVaultGateCopy(locale: Locale, hasLegacyPlainStore: boolean, resetPhrase: string): VaultGateCopy {
  if (locale === 'en') {
    return {
      eyebrow: 'Encrypted local vault',
      checkingTitle: 'Checking vault storage',
      lockedTitle: 'Unlock Distill',
      setupTitle: hasLegacyPlainStore ? 'Encrypt existing local data' : 'Create your encrypted vault',
      checkingBody: 'Distill is checking whether an encrypted vault already exists on this device.',
      lockedBody: 'Enter the exact vault passphrase. Spaces, symbols, input language, and letter case all matter.',
      setupBody: hasLegacyPlainStore
        ? 'A plaintext local store was found. Create a passphrase to migrate it into an encrypted vault and remove the old plaintext copy.'
        : 'Create a passphrase before using Distill. If you forget it, Distill cannot decrypt the vault for you.',
      passphrase: 'Vault passphrase',
      confirm: 'Confirm vault passphrase',
      unlock: 'Unlock vault',
      create: hasLegacyPlainStore ? 'Encrypt and migrate' : 'Create vault',
      warning: 'Use at least 12 characters. Distill cannot recover a forgotten passphrase.',
      storage: 'At rest: AES-GCM encrypted vault. In use: decrypted in memory only.',
      show: 'Show',
      hide: 'Hide',
      length: (count: number) => `${count} characters`,
      edgeWhitespace: 'There is a space at the beginning or end. Remove it unless this was intentional.',
      trimEdgeWhitespace: 'Remove outer spaces',
      capsLock: 'Caps Lock appears to be on.',
      mismatch: 'The two passphrases do not match exactly.',
      saveTitle: 'Save the passphrase before continuing',
      saveBody: 'Distill does not store a readable copy of this passphrase. Keep it in a password manager or an offline note you control.',
      saveSteps: [
        'Do not post it in chat, screenshots, or public issue comments.',
        'If you generate a recovery text file, keep it outside the app vault and back it up.',
        'Test unlock once after creating or changing it.',
      ],
      unlockHelpTitle: 'If unlock fails, check these first',
      unlockHelpBody: 'Most failed unlocks come from a different saved passphrase, an extra space, Caps Lock, or the wrong input language.',
      unlockHelpSteps: [
        'Click Show and compare the passphrase character by character.',
        'Check for accidental leading or trailing spaces.',
        'Check Caps Lock and Japanese/English input mode.',
        'If Codex generated a passphrase file, open the latest NEW_VAULT_PASSPHRASE.txt from the project recovery folder and paste it exactly.',
        'Use reset only when you accept that the old encrypted vault cannot be opened without the old passphrase.',
      ],
      errorHelpTitle: 'Unlock failed recovery checklist',
      resetTitle: 'Forgot the passphrase?',
      resetBody:
        'Resetting cannot decrypt the current vault. Distill backs it up, removes it from active use, and lets you create a new empty vault.',
      resetWarningTitle: 'Before resetting',
      resetWarningSteps: [
        'The backup remains encrypted with the old passphrase.',
        'Reset does not recover old notes by itself.',
        'Only continue if the old passphrase is truly unavailable.',
      ],
      resetInstruction: `Type ${resetPhrase} to enable reset.`,
      resetPlaceholder: resetPhrase,
      resetButton: 'Back up and reset vault',
      language: 'Language',
    };
  }

  return {
    eyebrow: '暗号化ローカルVault',
    checkingTitle: 'Vault保存を確認中',
    lockedTitle: 'Distillを解除',
    setupTitle: hasLegacyPlainStore ? '既存データを暗号化' : '暗号化Vaultを作成',
    checkingBody: 'この端末に暗号化Vaultがあるか確認しています。',
    lockedBody: 'Vaultパスフレーズを正確に入力してください。空白、記号、日本語/英語入力、大文字小文字はすべて区別されます。',
    setupBody: hasLegacyPlainStore
      ? '平文のローカル保存データが見つかりました。パスフレーズを作成して暗号化Vaultへ移行し、古い平文コピーを削除します。'
      : 'Distillを使う前にパスフレーズを作成します。忘れるとDistill側ではVaultを復号できません。',
    passphrase: 'Vaultパスフレーズ',
    confirm: 'Vaultパスフレーズ確認',
    unlock: 'Vaultを開く',
    create: hasLegacyPlainStore ? '暗号化して移行' : 'Vaultを作成',
    warning: '12文字以上を推奨します。忘れたパスフレーズは復元できません。',
    storage: '保存時: AES-GCM暗号化Vault。利用中: メモリ上だけ復号。',
    show: '表示',
    hide: '非表示',
    length: (count: number) => `${count}文字`,
    edgeWhitespace: '先頭または末尾に空白があります。意図していない場合は削除してください。',
    trimEdgeWhitespace: '前後の空白を削除',
    capsLock: 'Caps Lockがオンの可能性があります。',
    mismatch: '2つのパスフレーズが完全には一致していません。',
    saveTitle: '続行前にパスフレーズを保存してください',
    saveBody: 'Distillは読める形のパスフレーズを保存しません。パスワード管理アプリ、または自分だけが管理するオフラインメモに保管してください。',
    saveSteps: [
      'チャット、スクリーンショット、公開Issueには貼らない。',
      '復旧用テキストファイルを作る場合は、アプリVaultの外に置いてバックアップする。',
      '作成・変更後に一度ロック解除テストをする。',
    ],
    unlockHelpTitle: '開けない時にまず確認すること',
    unlockHelpBody: '解除失敗の多くは、別の保存済みパスフレーズ、余分な空白、Caps Lock、入力モード違いが原因です。',
    unlockHelpSteps: [
      '「表示」を押して、1文字ずつ見比べる。',
      '先頭・末尾に余分な空白が入っていないか確認する。',
      'Caps Lockと日本語/英語入力モードを確認する。',
      'Codexが生成したパスフレーズファイルがある場合は、projectのrecoveryフォルダ内の最新NEW_VAULT_PASSPHRASE.txtを正確に貼り付ける。',
      'リセットは、古いパスフレーズなしでは旧Vaultを開けないことを理解した場合だけ使う。',
    ],
    errorHelpTitle: '解除失敗時の復旧チェックリスト',
    resetTitle: 'パスフレーズを忘れた場合',
    resetBody: 'リセットしても現在のVaultは復号できません。Distillは旧Vaultを退避し、アクティブ状態から外して、新しい空のVaultを作れる状態にします。',
    resetWarningTitle: 'リセット前の注意',
    resetWarningSteps: [
      '退避バックアップは古いパスフレーズで暗号化されたままです。',
      'リセットだけでは古いノートは復元されません。',
      '古いパスフレーズが本当に使えない場合だけ続行してください。',
    ],
    resetInstruction: `${resetPhrase} と入力するとリセットボタンを有効化します。`,
    resetPlaceholder: resetPhrase,
    resetButton: '退避してVaultを初期化',
    language: '言語',
  };
}

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
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const isSetup = mode === 'setup';
  const isChecking = mode === 'checking';
  const canResetEncryptedVault = mode === 'locked';
  const resetPhrase = 'RESET';
  const labels = getVaultGateCopy(locale, hasLegacyPlainStore, resetPhrase);
  const hasEdgeWhitespace = passphrase.length > 0 && passphrase !== passphrase.trim();
  const hasConfirmationEdgeWhitespace = confirmation.length > 0 && confirmation !== confirmation.trim();
  const confirmationMismatch = isSetup && confirmation.length > 0 && passphrase !== confirmation;
  const canSubmitSetup =
    !isSetup ||
    (passphrase.length >= 12 &&
      confirmation.length >= 12 &&
      passphrase === confirmation &&
      !hasEdgeWhitespace &&
      !hasConfirmationEdgeWhitespace);

  function updateCapsLock(event: KeyboardEvent<HTMLInputElement>) {
    setCapsLockOn(event.getModifierState('CapsLock'));
  }

  function trimOuterSpaces() {
    setPassphrase((current) => current.trim());
    setConfirmation((current) => current.trim());
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSetup) {
      if (!canSubmitSetup) {
        return;
      }

      onCreate(passphrase, confirmation);
      return;
    }

    onUnlock(passphrase);
  }

  return (
    <main className="vaultGate" aria-label={labels.eyebrow}>
      <section className="vaultCard">
        <div className="vaultMark">{isSetup ? <ShieldCheck size={24} /> : <LockKeyhole size={24} />}</div>
        <div className="vaultLocaleToggle" aria-label={labels.language}>
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

        {!isChecking && isSetup ? (
          <section className="vaultGuidanceBox" aria-label={labels.saveTitle}>
            <strong>{labels.saveTitle}</strong>
            <p>{labels.saveBody}</p>
            <ol>
              {labels.saveSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        ) : null}

        {!isChecking && !isSetup ? (
          <details className="vaultGuidanceBox" open={Boolean(error)}>
            <summary>{error ? labels.errorHelpTitle : labels.unlockHelpTitle}</summary>
            <p>{labels.unlockHelpBody}</p>
            <ol>
              {labels.unlockHelpSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </details>
        ) : null}

        {isChecking ? (
          <div className="vaultProgress" aria-label={labels.checkingTitle} />
        ) : (
          <form className="vaultForm" onSubmit={submit}>
            <label>
              {labels.passphrase}
              <div className="vaultPasswordField">
                <input
                  aria-label="Vault passphrase"
                  autoComplete={isSetup ? 'new-password' : 'current-password'}
                  autoFocus
                  minLength={isSetup ? 12 : undefined}
                  type={showPassphrase ? 'text' : 'password'}
                  value={passphrase}
                  onChange={(event) => setPassphrase(event.target.value)}
                  onKeyUp={updateCapsLock}
                  onKeyDown={updateCapsLock}
                />
                <button type="button" onClick={() => setShowPassphrase((current) => !current)}>
                  {showPassphrase ? <EyeOff size={16} /> : <Eye size={16} />}
                  {showPassphrase ? labels.hide : labels.show}
                </button>
              </div>
            </label>
            {isSetup ? (
              <label>
                {labels.confirm}
                <div className="vaultPasswordField">
                  <input
                    aria-label="Confirm vault passphrase"
                    autoComplete="new-password"
                    minLength={12}
                    type={showConfirmation ? 'text' : 'password'}
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    onKeyUp={updateCapsLock}
                    onKeyDown={updateCapsLock}
                  />
                  <button type="button" onClick={() => setShowConfirmation((current) => !current)}>
                    {showConfirmation ? <EyeOff size={16} /> : <Eye size={16} />}
                    {showConfirmation ? labels.hide : labels.show}
                  </button>
                </div>
              </label>
            ) : null}
            <div className="vaultPassphraseMeta">
              <span>{labels.length(passphrase.length)}</span>
              {hasEdgeWhitespace || hasConfirmationEdgeWhitespace ? (
                <>
                  <b>{labels.edgeWhitespace}</b>
                  <button className="vaultInlineAction" type="button" onClick={trimOuterSpaces}>
                    {labels.trimEdgeWhitespace}
                  </button>
                </>
              ) : null}
              {capsLockOn ? <b>{labels.capsLock}</b> : null}
              {confirmationMismatch ? <b>{labels.mismatch}</b> : null}
            </div>
            <span className="vaultWarning">{labels.warning}</span>
            <button type="submit" disabled={isSetup && !canSubmitSetup}>
              {isSetup ? labels.create : labels.unlock}
            </button>
          </form>
        )}

        {canResetEncryptedVault ? (
          <details className="vaultResetPanel">
            <summary>{labels.resetTitle}</summary>
            <p>{labels.resetBody}</p>
            <div className="vaultResetWarning">
              <strong>{labels.resetWarningTitle}</strong>
              <ol>
                {labels.resetWarningSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
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
