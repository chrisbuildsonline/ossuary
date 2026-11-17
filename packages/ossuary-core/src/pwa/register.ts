// Registers the service worker in production builds only. If it fails, the app still works online.

// Vite replaces import.meta.env.PROD at build time; this is the one part of vite/client the core reads.
declare global {
  interface ImportMetaEnv {
    PROD: boolean;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export function registerSw(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
