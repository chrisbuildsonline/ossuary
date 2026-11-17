// Inline SVG glyphs, drawn in code. All use currentColor and are hidden from assistive technology.
import type { Tone } from '../schema/stages';

const svg = (size: number, view: number, body: string, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${view} ${view}" aria-hidden="true" focusable="false"${extra}>${body}</svg>`;

const stroke = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';

const tone16: Record<Tone, string> = {
  // filled circle with a check knocked out of it
  fresh:
    '<path fill="currentColor" fill-rule="evenodd" d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1Zm-3.6 7.3 1.2-1.2L7 8.5l3.4-3.4 1.2 1.2L7 10.9Z"/>',
  steady: `<circle cx="8" cy="8" r="5.6" ${stroke} stroke-width="2"/>`,
  soon: `<path ${stroke} stroke-width="1.6" d="M4 1.8h8M4 14.2h8M5 2c0 3.6 6 3.8 6 6s-6 2.4-6 6M11 2c0 3.6-6 3.8-6 6s6 2.4 6 6"/>`,
  urgent: `<path ${stroke} stroke-width="1.6" d="M8 1.9 14.8 13.8H1.2Z"/><path ${stroke} stroke-width="1.8" d="M8 6.2v3.4"/><circle cx="8" cy="11.6" r="1" fill="currentColor"/>`,
  dead: `<path ${stroke} stroke-width="1.6" d="M4.2 13.6V7.1a3.8 3.8 0 0 1 7.6 0v6.5M2.4 13.8h11.2M6.6 8.4h2.8"/>`,
};

/** The 16px glyph for a tone slot. */
export const toneGlyph = (tone: Tone): string => svg(16, 16, tone16[tone]);

const icons = {
  alert: [16, `<circle cx="8" cy="8" r="6.4" ${stroke} stroke-width="1.6"/><path ${stroke} stroke-width="1.8" d="M8 4.8v3.6"/><circle cx="8" cy="11" r="1" fill="currentColor"/>`],
  import: [24, `<path ${stroke} stroke-width="1.75" d="M8 7V4.5A1.5 1.5 0 0 1 9.5 3h8L21 6.5v11a1.5 1.5 0 0 1-1.5 1.5H17M4.5 8h8a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5h-8A1.5 1.5 0 0 1 3 19.5v-10A1.5 1.5 0 0 1 4.5 8ZM8.5 11v6.5M5.8 14.8l2.7 2.7 2.7-2.7"/>`],
  calendar: [24, `<rect x="3.5" y="5" width="17" height="15.5" rx="3" ${stroke} stroke-width="1.75"/><path ${stroke} stroke-width="1.75" d="M3.5 10h17M8 3v4M16 3v4"/>`],
  bone: [20, `<path ${stroke} stroke-width="1.6" d="M6.4 8.6H13.6A2.3 2.3 0 1 1 17.4 10 2.3 2.3 0 1 1 13.6 11.4H6.4A2.3 2.3 0 1 1 2.6 10 2.3 2.3 0 1 1 6.4 8.6Z"/>`],
  close: [24, `<path ${stroke} stroke-width="1.9" d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>`],
  plus: [24, `<path ${stroke} stroke-width="2" d="M12 5.5v13M5.5 12h13"/>`],
  minus: [24, `<path ${stroke} stroke-width="2" d="M5.5 12h13"/>`],
  upload: [24, `<path ${stroke} stroke-width="1.75" d="M12 15V4.5M7.5 9 12 4.5 16.5 9M4.5 15.5v2A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5v-2"/>`],
  list: [24, `<path ${stroke} stroke-width="1.75" d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1.3" fill="currentColor"/><circle cx="4.8" cy="12" r="1.3" fill="currentColor"/><circle cx="4.8" cy="17.5" r="1.3" fill="currentColor"/>`],
  archive: [24, `<rect x="3" y="4" width="18" height="5" rx="1.5" ${stroke} stroke-width="1.75"/><path ${stroke} stroke-width="1.75" d="M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4"/>`],
  more: [24, `<circle cx="5.5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="18.5" cy="12" r="1.6" fill="currentColor"/>`],
  chevron: [16, `<path ${stroke} stroke-width="1.6" d="M4 6l4 4 4-4"/>`],
  arrow: [16, `<path ${stroke} stroke-width="1.6" d="M3 8h10M9 4l4 4-4 4"/>`],
} as const;

export type GlyphName = keyof typeof icons;
export const glyphNames = Object.keys(icons) as GlyphName[];

/** A named glyph at its natural size (alert 16, bone 20, the rest 24). */
export function glyph(name: GlyphName, size?: number): string {
  const [view, body] = icons[name];
  return svg(size ?? view, view, body);
}
