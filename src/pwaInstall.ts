export type PwaInstallPlatform = 'ios' | 'android' | 'desktop' | 'unknown';

export type PwaInstallKind = 'desktop-app' | 'standalone' | 'prompt-ready' | 'ios-manual' | 'browser-manual';

export type PwaInstallGuidance = {
  kind: PwaInstallKind;
  platform: PwaInstallPlatform;
  canUsePrompt: boolean;
  hasServiceWorker: boolean;
  isOnline: boolean;
};

export type PwaInstallInput = {
  isDesktopRuntime: boolean;
  canPrompt: boolean;
  isStandalone: boolean;
  hasServiceWorker: boolean;
  isOnline: boolean;
  userAgent: string;
};

export type PwaBeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export function detectPwaPlatform(userAgent: string): PwaInstallPlatform {
  const agent = userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(agent)) {
    return 'ios';
  }

  if (/android/.test(agent)) {
    return 'android';
  }

  if (/windows|macintosh|linux|cros/.test(agent)) {
    return 'desktop';
  }

  return 'unknown';
}

export function isPwaStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

export function getPwaInstallGuidance(input: PwaInstallInput): PwaInstallGuidance {
  const platform = detectPwaPlatform(input.userAgent);

  if (input.isDesktopRuntime) {
    return {
      kind: 'desktop-app',
      platform,
      canUsePrompt: false,
      hasServiceWorker: input.hasServiceWorker,
      isOnline: input.isOnline,
    };
  }

  if (input.isStandalone) {
    return {
      kind: 'standalone',
      platform,
      canUsePrompt: false,
      hasServiceWorker: input.hasServiceWorker,
      isOnline: input.isOnline,
    };
  }

  if (input.canPrompt) {
    return {
      kind: 'prompt-ready',
      platform,
      canUsePrompt: true,
      hasServiceWorker: input.hasServiceWorker,
      isOnline: input.isOnline,
    };
  }

  return {
    kind: platform === 'ios' ? 'ios-manual' : 'browser-manual',
    platform,
    canUsePrompt: false,
    hasServiceWorker: input.hasServiceWorker,
    isOnline: input.isOnline,
  };
}
