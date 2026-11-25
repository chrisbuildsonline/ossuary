// Crypt or light: the mode lives on <html data-mode> and in localStorage, and tokens.css does the rest.
export type Mode = 'crypt' | 'light';
export const MODE_KEY = 'ossuary:mode';

type ModeStorage = Pick<Storage, 'getItem' | 'setItem'>;

const defaultStorage = (): ModeStorage | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

export const currentMode = (doc: Document = document): Mode => (doc.documentElement.dataset.mode === 'light' ? 'light' : 'crypt');

/** Applies the stored mode (the crypt unless "light" was chosen). Never writes. */
export function initMode(doc: Document = document, storage: ModeStorage | undefined = defaultStorage()): Mode {
  let stored: string | null = null;
  try {
    stored = storage?.getItem(MODE_KEY) ?? null;
  } catch {
    stored = null;
  }
  const mode: Mode = stored === 'light' ? 'light' : 'crypt';
  doc.documentElement.dataset.mode = mode;
  return mode;
}

/** Switches the mode, remembers it and tells the page with an `oss-mode` event. */
export function setMode(mode: Mode, doc: Document = document, storage: ModeStorage | undefined = defaultStorage()): void {
  doc.documentElement.dataset.mode = mode;
  try {
    storage?.setItem(MODE_KEY, mode);
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
  doc.dispatchEvent(new CustomEvent('oss-mode', { detail: { mode } }));
}
