// Draws the three app icons from the ghost motif in the theme's accent and canvas colours, rasterised by Playwright's
// Chromium. Run once with `bun run icons:wraith`; the PNGs in public/ are committed.
import { chromium } from '@playwright/test';

const accent = '#5a4bd1';
const canvas = '#edeff6';
const white = '#ffffff';

/** The outline of the core ghost (64x80 view box): a rounded head and a wavy three-lobe hem. */
const body = 'M12.2 70V34.4C12 18.6 21.2 8.4 32.1 8.4 43 8.2 52 18.4 51.8 34.2V70q-6.5-6.9-13.2 0-6.8-7.2-13.5.1-6.5-7.1-12.9-.1Z';

/** A ghost with round eyes: `fill` for the body, `eyes` for the eyes, a soft shadow of `shade` under the hem. */
const ghost = (fill: string, eyes: string, shade: string) => `
  <ellipse cx="32" cy="76" rx="17" ry="2.6" fill="${shade}" opacity=".22"/>
  <path d="${body}" fill="${fill}" stroke="${fill}" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="25.2" cy="35" r="3.4" fill="${eyes}"/>
  <circle cx="38.9" cy="34.8" r="3.4" fill="${eyes}"/>`;

/**
 * Plain icons: the accent ghost on the canvas with rounded corners. The maskable icon: a white ghost on the
 * accent, filling the square, with the ghost kept inside the 80% safe circle.
 */
function icon(size: number, maskable: boolean): string {
  const h = size * (maskable ? 0.54 : 0.68);
  const w = (h * 64) / 80;
  const art = maskable ? ghost(white, accent, '#15171c') : ghost(accent, canvas, accent);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${maskable ? 0 : size * 0.22}" fill="${maskable ? accent : canvas}"/>
  <svg x="${(size - w) / 2}" y="${(size - h) / 2}" width="${w}" height="${h}" viewBox="0 0 64 80">${art}</svg>
</svg>`;
}

const out = new URL('../public/', import.meta.url);
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const [name, size, maskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-512-maskable.png', 512, true],
] as const) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${icon(size, maskable)}`);
  await page.screenshot({ path: new URL(name, out).pathname, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log(`Wrote public/${name}`);
}
await browser.close();
