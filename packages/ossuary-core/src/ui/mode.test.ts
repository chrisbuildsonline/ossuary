// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MODE_KEY, currentMode, initMode, setMode } from './mode';

const memory = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
};

afterEach(() => delete document.documentElement.dataset.mode);

describe('theme mode', () => {
  it('is the crypt by default', () => {
    expect(initMode(document, memory())).toBe('crypt');
    expect(document.documentElement.dataset.mode).toBe('crypt');
    expect(currentMode(document)).toBe('crypt');
  });

  it('restores a stored light choice and ignores garbage', () => {
    expect(initMode(document, memory({ [MODE_KEY]: 'light' }))).toBe('light');
    expect(document.documentElement.dataset.mode).toBe('light');
    expect(initMode(document, memory({ [MODE_KEY]: 'neon' }))).toBe('crypt');
  });

  it('survives storage that throws', () => {
    const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(initMode(document, broken)).toBe('crypt');
    expect(() => setMode('light', document, broken)).not.toThrow();
    expect(currentMode(document)).toBe('light');
  });

  it('setMode writes the choice, sets the attribute and tells the page', () => {
    const store = memory();
    const heard = vi.fn();
    document.addEventListener('oss-mode', heard);
    setMode('light', document, store);
    expect(store.data.get(MODE_KEY)).toBe('light');
    expect(document.documentElement.dataset.mode).toBe('light');
    expect(heard).toHaveBeenCalledTimes(1);
    document.removeEventListener('oss-mode', heard);
  });
});
