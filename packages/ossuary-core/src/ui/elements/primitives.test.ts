// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { tones } from '../../schema/stages';
import './oss-button';
import './oss-decay';
import './oss-pill';

afterEach(() => document.body.replaceChildren());

function mount<T extends HTMLElement>(html: string): T {
  const box = document.createElement('div');
  box.innerHTML = html;
  document.body.append(box);
  return box.firstElementChild as T;
}

describe('oss-button', () => {
  it('renders a native button with the variant and the slotted label', () => {
    const el = mount('<oss-button variant="primary">Add widget</oss-button>');
    const button = el.shadowRoot?.querySelector('button');
    expect(button).toBeTruthy();
    expect(button?.classList.contains('primary')).toBe(true);
    expect(button?.querySelector('slot')).toBeTruthy();
    expect(el.textContent).toBe('Add widget');
  });

  it('defaults to ghost, passes disabled through and focuses the inner button', () => {
    const el = mount('<oss-button disabled>Later</oss-button>');
    const button = el.shadowRoot?.querySelector('button') as HTMLButtonElement;
    expect(button.classList.contains('ghost')).toBe(true);
    expect(button.disabled).toBe(true);
    el.removeAttribute('disabled');
    el.focus();
    expect(el.shadowRoot?.activeElement).toBe(el.shadowRoot?.querySelector('button'));
  });

  it('gives icon buttons a name and a glyph, and links accent text', () => {
    const icon = mount('<oss-button variant="icon" icon="close" label="Close"></oss-button>');
    const b = icon.shadowRoot?.querySelector('button');
    expect(b?.getAttribute('aria-label')).toBe('Close');
    expect(b?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    const link = mount('<oss-button variant="link">or import a list</oss-button>');
    expect(link.shadowRoot?.querySelector('button')?.classList.contains('link')).toBe(true);
  });

  it('keeps every variant at 44px or more and the primary pill at 52px', () => {
    const el = mount('<oss-button variant="primary">Go</oss-button>');
    const css = el.shadowRoot?.adoptedStyleSheets.map((s) => Array.from(s.cssRules, (r) => r.cssText).join('\n')).join('\n') ?? '';
    expect(css).toMatch(/min-height:\s*44px/);
    expect(css).toMatch(/min-width:\s*44px/);
    expect(css).toMatch(/\.primary\s*\{[^}]*min-height:\s*52px/);
  });
});

describe('oss-pill', () => {
  it.each(tones)('shows the %s label as text with a hidden glyph and the tone colours', (tone) => {
    const el = mount(`<oss-pill tone="${tone}" label="Stage word"></oss-pill>`);
    const pill = el.shadowRoot?.querySelector('.pill');
    expect(pill?.classList.contains(`tone-${tone}`)).toBe(true);
    expect(pill?.textContent?.trim()).toBe('Stage word');
    expect(pill?.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('sets the label as text, never markup, and updates on change', () => {
    const el = mount('<oss-pill tone="soon"></oss-pill>');
    el.setAttribute('label', '<b>bold</b>');
    expect(el.shadowRoot?.querySelector('b')).toBeNull();
    expect(el.shadowRoot?.textContent).toContain('<b>bold</b>');
    el.setAttribute('tone', 'urgent');
    expect(el.shadowRoot?.querySelector('.pill')?.classList.contains('tone-urgent')).toBe(true);
  });
});

describe('oss-decay', () => {
  it('is hidden from assistive technology and draws the motif with a quantised fraction', () => {
    const el = mount('<oss-decay motif="candle" fraction="0.512" tone="soon" size="m"></oss-decay>');
    expect(el.getAttribute('aria-hidden')).toBe('true');
    const svg = el.shadowRoot?.querySelector('svg');
    expect(svg?.getAttribute('data-motif')).toBe('candle');
    expect(svg?.getAttribute('data-fraction')).toBe('0.5');
    expect(svg?.getAttribute('data-tone')).toBe('soon');
    expect(svg?.getAttribute('width')).toBe('48');
  });

  it('follows the stage mood and redraws on change, defaulting to the hourglass', () => {
    const el = mount('<oss-decay fraction="1" tone="fresh" size="s"></oss-decay>');
    expect(el.shadowRoot?.querySelector('svg')?.getAttribute('data-motif')).toBe('hourglass');
    el.setAttribute('motif', 'ghost');
    el.setAttribute('tone', 'urgent');
    const svg = el.shadowRoot?.querySelector('svg');
    expect(svg?.getAttribute('data-motif')).toBe('ghost');
    expect(svg?.getAttribute('data-eyes')).toBe('worried');
  });

  it('accepts property values and ignores unknown motifs', () => {
    const el = mount('<oss-decay></oss-decay>') as HTMLElement & { fraction: number; motif: string; tone: string };
    el.motif = 'nope';
    el.fraction = 0.25;
    el.tone = 'dead';
    const svg = el.shadowRoot?.querySelector('svg');
    expect(svg?.getAttribute('data-motif')).toBe('hourglass');
    expect(svg?.getAttribute('data-fraction')).toBe('0.25');
  });
});
