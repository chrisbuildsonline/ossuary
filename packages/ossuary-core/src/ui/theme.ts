// applyTheme writes a spec's theme block onto an element as CSS custom properties, once for the light mode and once
// for the derived crypt; tokens.css picks the set for the current mode. Nothing else is themable.
import type { Theme } from '../schema/theme';
import { cryptTheme } from './crypt';
import { displayFamilies } from './fonts';

export const themeProperties = [
  '--light-accent',
  '--light-accent-ink',
  '--light-accent-tint',
  '--light-canvas',
  '--crypt-accent',
  '--crypt-accent-ink',
  '--crypt-accent-tint',
  '--crypt-canvas',
  '--crypt-surface',
  '--crypt-surface-sunken',
  '--font-display',
] as const;

export function applyTheme(el: HTMLElement, theme: Theme | undefined): void {
  const t = theme ?? {};
  const crypt = theme ? cryptTheme(theme) : undefined;
  const values: Record<(typeof themeProperties)[number], string | undefined> = {
    '--light-accent': t.accent,
    '--light-accent-ink': t.accentInk ?? t.accent,
    '--light-accent-tint': t.accentTint,
    '--light-canvas': t.canvas,
    '--crypt-accent': crypt?.accent,
    '--crypt-accent-ink': crypt?.accentInk,
    '--crypt-accent-tint': crypt?.accentTint,
    '--crypt-canvas': crypt?.canvas,
    '--crypt-surface': crypt?.surface,
    '--crypt-surface-sunken': crypt?.surfaceSunken,
    '--font-display': t.display ? displayFamilies[t.display] : undefined,
  };
  for (const name of themeProperties) {
    const value = values[name];
    if (value === undefined) el.style.removeProperty(name);
    else el.style.setProperty(name, value);
  }
  el.toggleAttribute('data-themed', theme !== undefined);
  el.dataset.motif = t.motif ?? 'hourglass';
  el.dataset.emptyArt = t.emptyArt ?? 'hourglass-side';
}
