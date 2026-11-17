// Empty-state art at xl (200x240): pure SVG strings from constants. Reuses the motif part classes.
import { candle } from './candle';
import { ghost } from './ghost';
import { hourglass } from './hourglass';

export type EmptyArt = 'hourglass-side' | 'candle-jar-moon' | 'ghost-parcel';
export const emptyArts: readonly EmptyArt[] = ['hourglass-side', 'candle-jar-moon', 'ghost-parcel'];

const frame = (name: EmptyArt, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" class="motif art art-${name}" viewBox="0 0 200 240" width="200" height="240" data-art="${name}" aria-hidden="true" focusable="false">${body}</svg>`;

/** Places a motif SVG (its inner markup) into a box of the art's view box. */
const place = (markup: string, x: number, y: number, w: number, h: number) =>
  markup.replace(/^<svg[^>]*viewBox="([^"]+)"[^>]*>/, (_m, view: string) => `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${view}">`);

const arts: Record<EmptyArt, () => string> = {
  // An hourglass lying on its side on a soft shadow line.
  'hourglass-side': () => `<ellipse class="dish" cx="100" cy="182" rx="70" ry="6"/>${place(hourglass(0.35, 'dead', 'xl'), 28, 46, 144, 150)}`,
  // An unlit candle beside a jar, under a crescent moon.
  'candle-jar-moon': () =>
    '<path class="moon" d="M150.4 30.2a22 22 0 1 0 19.4 31.4 17.6 17.6 0 1 1-19.4-31.4Z"/>' +
    `${place(candle(0.55, 'dead', 'xl'), 22, 70, 84, 150)}` +
    '<rect class="jar" x="112.2" y="128.4" width="58" height="80" rx="12"/><rect class="lid-cap" x="116" y="118.2" width="50.4" height="13" rx="4"/>' +
    '<path class="jar-line" d="M124.6 156.2h33.2M124.6 170.4h22.4"/>',
  // A ghost asleep in an open box.
  'ghost-parcel': () =>
    `${place(ghost(0.9, 'fresh', 'xl').replace(/<circle class="eye"[^>]*\/>/g, ''), 52, 34, 96, 120)}` +
    '<path class="lid" d="M84.6 82.4q4.2 3.4 8.4 0M107 82.2q4.2 3.4 8.4 0"/>' +
    '<path class="zz" d="M146 52.4h9.6l-9.6 10.2h9.6M160.4 36.2h7.2l-7.2 7.6h7.2"/>' +
    '<path class="box" d="M38.2 130.6h123.6v68.2a8 8 0 0 1-8 8H46.2a8 8 0 0 1-8-8Z"/>' +
    '<path class="box-flap" d="M38.2 130.6 24.4 112.8h52.2l14 17.8M161.8 130.6l13.8-17.8h-52.2l-14 17.8"/>' +
    '<path class="jar-line" d="M86.4 160.2h27.2"/>',
};

export function emptyArtSvg(name: EmptyArt): string {
  return frame(name, arts[name]());
}
