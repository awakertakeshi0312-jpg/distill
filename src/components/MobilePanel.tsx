import { Download, ExternalLink, MonitorSmartphone, Settings, ShieldCheck, Smartphone, Wifi } from 'lucide-react';
import type { Locale, UiCopy } from '../i18n';
import type { PwaInstallGuidance, PwaInstallKind, PwaInstallPlatform } from '../pwaInstall';
import { HelpNote } from './HelpNote';

type MobilePanelProps = {
  ui: UiCopy;
  locale: Locale;
  pwaInstallGuidance: PwaInstallGuidance;
  pwaInstallStatus: string;
  appVersion: string;
  latestReleaseUrl: string;
  isDesktopRuntime: boolean;
  onInstallPwa: () => void;
  onOpenSettings: () => void;
};

type MobileCopy = {
  eyebrow: string;
  title: string;
  answerTitle: string;
  answerBody: string;
  desktopTitle: string;
  desktopBody: string;
  browserTitle: string;
  browserBody: string;
  vaultTitle: string;
  vaultBody: string;
  statusTitle: string;
  platform: string;
  installState: string;
  offlineShell: string;
  network: string;
  supported: string;
  unsupported: string;
  online: string;
  offline: string;
  install: string;
  installDisabled: string;
  openSettings: string;
  releasePage: string;
  stepsTitle: string;
  steps: string[];
  help: { title: string; body: string; steps: string[] };
  states: Record<PwaInstallKind, { title: string; body: string }>;
  platforms: Record<PwaInstallPlatform, string>;
};

function getMobileCopy(locale: Locale): MobileCopy {
  if (locale === 'ja') {
    return {
      eyebrow: 'スマホ / PWA',
      title: 'モバイル利用',
      answerTitle: '結論: スマホでも使える設計です',
      answerBody:
        'ただし、Windowsアプリそのものをスマホで開くのではなく、ブラウザ/PWA版としてHTTPSで開く形です。Vaultは端末内で暗号化されます。',
      desktopTitle: 'Windowsアプリ',
      desktopBody: '今のデスクトップ版はこのPC向けです。バックアップ、同期、更新、パスフレーズ変更は設定ページに分離しました。',
      browserTitle: 'スマホブラウザ/PWA',
      browserBody: 'Web公開先をスマホで開き、必要ならホーム画面へ追加します。オフラインシェル対応状態も下で確認できます。',
      vaultTitle: '暗号化Vault',
      vaultBody: 'スマホ側でも保存データは暗号化Vaultです。同期する場合は、同期パケットを確認してから取り込みます。',
      statusTitle: 'この端末のPWA状態',
      platform: '端末',
      installState: 'インストール状態',
      offlineShell: 'オフラインシェル',
      network: 'ネットワーク',
      supported: '対応',
      unsupported: '未対応',
      online: 'オンライン',
      offline: 'オフライン',
      install: 'この端末にインストール',
      installDisabled: 'この環境ではブラウザ側の手動追加が必要です',
      openSettings: '設定を開く',
      releasePage: 'Windows版リリース',
      stepsTitle: 'スマホで使う手順',
      steps: [
        'スマホでHTTPSのWeb版Distillを開く',
        'ホーム画面に追加できる場合は追加する',
        'Vaultを作成または同期パケットで取り込む',
        '同じパスフレーズでロック解除して使う',
      ],
      help: {
        title: 'モバイルはPWAとして扱う',
        body: 'Distillのモバイル利用は、スマホにWindowsアプリを入れるのではなく、ブラウザ/PWAでローカル暗号化Vaultを使う方針です。',
        steps: ['まずWeb公開先を用意する', 'スマホで開いてホーム画面へ追加する', '同期は設定ページで確認してから実行する'],
      },
      states: {
        'desktop-app': {
          title: 'デスクトップアプリで実行中',
          body: '現在はWindows版アプリです。スマホ利用はWeb/PWA版をスマホのブラウザで開きます。',
        },
        standalone: {
          title: 'PWAとして起動中',
          body: 'ホーム画面からアプリのように起動されています。',
        },
        'prompt-ready': {
          title: 'インストール可能',
          body: 'このブラウザはインストール案内を表示できます。',
        },
        'ios-manual': {
          title: 'iPhone/iPadは手動追加',
          body: 'Safariの共有メニューから「ホーム画面に追加」を使います。',
        },
        'browser-manual': {
          title: 'ブラウザ側で追加',
          body: 'ブラウザメニューからインストールまたはホーム画面追加を選びます。',
        },
      },
      platforms: {
        ios: 'iOS',
        android: 'Android',
        desktop: 'Desktop',
        unknown: 'Unknown',
      },
    };
  }

  return {
    eyebrow: 'Phone / PWA',
    title: 'Mobile access',
    answerTitle: 'Answer: mobile is supported as a browser/PWA surface',
    answerBody:
      'The Windows desktop app does not run directly on a phone. Mobile use means opening the HTTPS web build in a phone browser and keeping the vault encrypted on that device.',
    desktopTitle: 'Windows app',
    desktopBody: 'The installed desktop app stays focused on this PC. Backup, sync, update, and passphrase controls now live on Settings.',
    browserTitle: 'Phone browser / PWA',
    browserBody: 'Open the hosted web build on the phone and add it to the home screen when the browser offers it.',
    vaultTitle: 'Encrypted vault',
    vaultBody: 'The phone-side store is still an encrypted vault. For sync, review incoming sync packets before applying them.',
    statusTitle: 'PWA status on this device',
    platform: 'Platform',
    installState: 'Install state',
    offlineShell: 'Offline shell',
    network: 'Network',
    supported: 'Supported',
    unsupported: 'Unsupported',
    online: 'Online',
    offline: 'Offline',
    install: 'Install to device',
    installDisabled: 'Manual browser install is required in this environment',
    openSettings: 'Open Settings',
    releasePage: 'Windows releases',
    stepsTitle: 'How to use on a phone',
    steps: [
      'Open the HTTPS Distill web build on the phone',
      'Add it to the home screen if the browser offers it',
      'Create a vault or import a reviewed sync packet',
      'Unlock with the same passphrase and use it locally',
    ],
    help: {
      title: 'Mobile means PWA first',
      body: 'Distill mobile access is handled through the browser/PWA build, not by installing the Windows desktop app on a phone.',
      steps: ['Prepare a hosted web build', 'Open it from the phone and add to home screen', 'Use Settings to review sync before applying it'],
    },
    states: {
      'desktop-app': {
        title: 'Running as desktop app',
        body: 'This is the Windows app. Use the web/PWA build from the phone browser for mobile access.',
      },
      standalone: {
        title: 'Running as installed PWA',
        body: 'This is already launched from the home screen or app launcher.',
      },
      'prompt-ready': {
        title: 'Install prompt ready',
        body: 'This browser can show an install prompt.',
      },
      'ios-manual': {
        title: 'Manual install on iOS',
        body: 'Use Safari Share, then Add to Home Screen.',
      },
      'browser-manual': {
        title: 'Manual browser install',
        body: 'Use the browser menu to install or add to home screen.',
      },
    },
    platforms: {
      ios: 'iOS',
      android: 'Android',
      desktop: 'Desktop',
      unknown: 'Unknown',
    },
  };
}

export function MobilePanel({
  ui,
  locale,
  pwaInstallGuidance,
  pwaInstallStatus,
  appVersion,
  latestReleaseUrl,
  isDesktopRuntime,
  onInstallPwa,
  onOpenSettings,
}: MobilePanelProps) {
  const copy = getMobileCopy(locale);
  const state = copy.states[pwaInstallGuidance.kind];

  return (
    <section className="panel mobilePanel" id="mobile" aria-label={copy.title}>
      <div className="panelHeader">
        <div>
          <p>{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
        </div>
        <HelpNote ui={ui} content={copy.help} />
      </div>

      <div className="mobileAnswer">
        <Smartphone size={24} />
        <div>
          <strong>{copy.answerTitle}</strong>
          <span>{copy.answerBody}</span>
        </div>
      </div>

      <div className="mobileCardGrid">
        <article className="mobileCard">
          <MonitorSmartphone size={20} />
          <strong>{copy.desktopTitle}</strong>
          <span>{copy.desktopBody}</span>
          <small>Distill v{appVersion}</small>
        </article>
        <article className="mobileCard">
          <Wifi size={20} />
          <strong>{copy.browserTitle}</strong>
          <span>{copy.browserBody}</span>
          <small>{isDesktopRuntime ? copy.states['desktop-app'].title : state.title}</small>
        </article>
        <article className="mobileCard">
          <ShieldCheck size={20} />
          <strong>{copy.vaultTitle}</strong>
          <span>{copy.vaultBody}</span>
          <button className="restoreButton inlineActionButton" type="button" onClick={onOpenSettings}>
            <Settings size={14} />
            {copy.openSettings}
          </button>
        </article>
      </div>

      <div className="mobileStatusBox">
        <strong>{copy.statusTitle}</strong>
        <div className="mobileStatusGrid">
          <span>
            <b>{copy.installState}</b>
            {state.title}: {state.body}
          </span>
          <span>
            <b>{copy.platform}</b>
            {copy.platforms[pwaInstallGuidance.platform]}
          </span>
          <span>
            <b>{copy.offlineShell}</b>
            {pwaInstallGuidance.hasServiceWorker ? copy.supported : copy.unsupported}
          </span>
          <span>
            <b>{copy.network}</b>
            {pwaInstallGuidance.isOnline ? copy.online : copy.offline}
          </span>
        </div>
        <div className="exportActions stackedActions">
          <button className="restoreButton" type="button" disabled={!pwaInstallGuidance.canUsePrompt} onClick={onInstallPwa}>
            <Download size={16} />
            {copy.install}
          </button>
          {!pwaInstallGuidance.canUsePrompt ? <span className="storagePath">{copy.installDisabled}</span> : null}
          {pwaInstallStatus ? <span className="restoreStatus">{pwaInstallStatus}</span> : null}
          <a className="diagnosticLink" href={latestReleaseUrl} target="_blank" rel="noreferrer">
            <ExternalLink size={14} />
            {copy.releasePage}
          </a>
        </div>
      </div>

      <div className="mobileSteps">
        <strong>{copy.stepsTitle}</strong>
        <ol>
          {copy.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}
