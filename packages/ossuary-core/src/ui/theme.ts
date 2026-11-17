// applyTheme writes a spec's theme block onto an element as CSS custom properties. Nothing else is themable.
import type { Theme } from '../schema/theme';
import { displayFamilies } from './fonts';

export const themeProperties = ['--accent', '--accent-ink', '--accent-tint', '--canvas', '--font-display'] as const;

export function applyTheme(el: HTMLElement, theme: Theme | undefined): void {
  const t = theme ?? {};
  const values: Record<(typeof themeProperties)[number], string | undefined> = {
    '--accent': t.accent,
    '--accent-ink': t.accentInk ?? t.accent,
    '--accent-tint': t.accentTint,
    '--canvas': t.canvas,
    '--font-display': t.display ? displayFamilies[t.display] : undefined,
  };
  for (const name of themeProperties) {
    const value = values[name];
    if (value === undefined) el.style.removeProperty(name);
    else el.style.setProperty(name, value);
  }
  el.dataset.motif = t.motif ?? 'hourglass';
  el.dataset.emptyArt = t.emptyArt ?? 'hourglass-side';
}
