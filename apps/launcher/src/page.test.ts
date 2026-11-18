// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import pantry from '../../pantry-reaper/bone.json';
import wraith from '../../warranty-wraith/bone.json';
import { REMIX_URL, REPO_URL, cards } from './cards';
import { renderLauncher } from './page';

const all = (selector: string) => [...document.body.querySelectorAll(selector)];
const card = (folder: string) => document.body.querySelector<HTMLAnchorElement>(`a.card[href="./${folder}/"]`);
const nameOf = (a: Element | null) => document.getElementById(a?.getAttribute('aria-labelledby') ?? '')?.textContent;

beforeEach(() => {
  document.body.replaceChildren();
  renderLauncher(document.body, cards);
});

describe('launcher page', () => {
  it('has one headline, one supporting line, two app cards and one primary pill', () => {
    expect(all('h1').map((h) => h.textContent)).toEqual(['Everything expires. Know when.']);
    expect(all('.lede').map((p) => p.textContent)).toEqual([expect.stringMatching(/bone spec/)]);
    expect(all('a.card')).toHaveLength(2);
    expect(all('a.pill')).toHaveLength(1);
  });

  it('links each card to its app folder, named after the app in its bone spec', () => {
    expect(all('a.card').map((a) => [a.getAttribute('href'), nameOf(a)])).toEqual([
      ['./pantry-reaper/', pantry.name],
      ['./warranty-wraith/', wraith.name],
    ]);
    for (const a of all('a.card')) {
      expect(document.getElementById(a.getAttribute('aria-describedby') ?? '')?.textContent).toMatch(/^Know when /);
    }
  });

  it('links the pill to the remix guide in the repo, in a new tab', () => {
    const pill = document.body.querySelector('a.pill');
    expect(pill?.textContent).toBe('Make your own');
    expect(pill?.getAttribute('href')).toBe(REMIX_URL);
    expect(REMIX_URL).toBe(`${REPO_URL}/blob/main/docs/REMIX.md`);
    expect(pill?.getAttribute('target')).toBe('_blank');
    expect(pill?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('styles each card from the theme in its bone spec', () => {
    for (const [folder, spec, face] of [
      ['pantry-reaper', pantry, 'Fraunces'],
      ['warranty-wraith', wraith, 'Space Grotesk'],
    ] as const) {
      const a = card(folder);
      expect(a?.style.getPropertyValue('--accent')).toBe(spec.theme.accent);
      expect(a?.style.getPropertyValue('--accent-ink')).toBe(spec.theme.accentInk);
      expect(a?.style.getPropertyValue('--accent-tint')).toBe(spec.theme.accentTint);
      expect(a?.style.getPropertyValue('--font-display')).toContain(face);
      expect(a?.dataset.motif).toBe(spec.theme.motif);
    }
  });

  it('draws the candle and the ghost live at xl, hidden from assistive technology', () => {
    const decays = all('a.card oss-decay');
    expect(decays.map((d) => [d.getAttribute('motif'), d.getAttribute('size'), d.getAttribute('aria-hidden')])).toEqual([
      ['candle', 'xl', 'true'],
      ['ghost', 'xl', 'true'],
    ]);
    expect(decays.every((d) => d.shadowRoot?.querySelector('svg.motif'))).toBe(true);
  });

  it('idles only the motif of the hovered or focused card', () => {
    const [a, b] = all('a.card');
    const idle = () => all('oss-decay[idle]').length;
    a?.dispatchEvent(new Event('pointerenter'));
    expect(idle()).toBe(1);
    a?.dispatchEvent(new Event('pointerleave'));
    b?.dispatchEvent(new Event('focus'));
    expect(all('oss-decay[idle]').map((d) => d.getAttribute('motif'))).toEqual(['ghost']);
    b?.dispatchEvent(new Event('blur'));
    expect(idle()).toBe(0);
  });

  it('links the repo from the header and copies no colour by hand', () => {
    expect(document.body.querySelector('header a')?.getAttribute('href')).toBe(REPO_URL);
    for (const file of ['page.ts', 'cards.ts', 'launcher.css']) {
      const text = readFileSync(new URL(file, import.meta.url), 'utf8');
      expect(text, file).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    }
  });
});
