type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

export function isTauriRuntimeWindow(
  windowValue: Window | undefined = typeof window === 'undefined' ? undefined : window,
): boolean {
  return Boolean(windowValue && (windowValue as TauriWindow).__TAURI_INTERNALS__);
}

export function shouldRegisterServiceWorker(options: {
  hasServiceWorker: boolean;
  isProduction: boolean;
  isTauriRuntime: boolean;
}): boolean {
  return options.hasServiceWorker && options.isProduction && !options.isTauriRuntime;
}

export function isDistillShellCache(cacheName: string): boolean {
  return cacheName.startsWith('distill-shell-');
}

export async function unregisterDesktopServiceWorkers(): Promise<void> {
  if (!('serviceWorker' in navigator) || !isTauriRuntimeWindow()) {
    return;
  }

  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.filter(isDistillShellCache).map((cacheName) => caches.delete(cacheName)));
  }
}
