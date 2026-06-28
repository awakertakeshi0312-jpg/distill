import { useState } from 'react';
import type { Locale } from '../i18n';

const DISMISS_KEY = 'distill.aiSecretaryBannerDismissed';

type AiSecretaryRedirectBannerProps = {
  locale: Locale;
  aiSecretaryUrl: string;
};

function readDismissed() {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

// 思考キャプチャはAI秘書「思考の整理」へ統合済み。Distillは当面そのまま使えるが、新規はAI秘書へ誘導する。
export function AiSecretaryRedirectBanner({ locale, aiSecretaryUrl }: AiSecretaryRedirectBannerProps) {
  const [dismissed, setDismissed] = useState(readDismissed);

  if (dismissed) {
    return null;
  }

  const isJa = locale === 'ja';
  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // 表示の都合なので保存に失敗しても無視する。
    }
    setDismissed(true);
  };

  return (
    <div className="aiSecretaryRedirectBanner" role="note">
      <div className="aiSecretaryRedirectBannerBody">
        <strong>{isJa ? '思考の保存先はAI秘書に統合されました' : 'Thought capture has moved into AI Secretary'}</strong>
        <span>
          {isJa
            ? '新しい問い・メモはAI秘書の「思考の整理」で書くと、予定・タスクと一緒に整理できます。Distillは当面そのまま使えます。'
            : 'Write new questions and notes in AI Secretary’s thinking workspace to keep them with your schedule and tasks. Distill still works for now.'}
        </span>
      </div>
      <div className="aiSecretaryRedirectBannerActions">
        <a href={aiSecretaryUrl} target="_blank" rel="noreferrer">
          {isJa ? 'AI秘書を開く' : 'Open AI Secretary'}
        </a>
        <button type="button" onClick={dismiss}>
          {isJa ? '閉じる' : 'Dismiss'}
        </button>
      </div>
    </div>
  );
}
