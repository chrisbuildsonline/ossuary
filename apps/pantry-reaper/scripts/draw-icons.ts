// Draws the app icons from the candle motif and rasterizes them with Playwright's Chromium.
// Run once from the repo root: bun apps/pantry-reaper/scripts/draw-icons.ts. The PNGs are committed.
import { chromium } from '@playwright/test';

const accent = '#b8460e';
const canvas = '#f2efea';
const ink = '#15171c';
const flame = '#fde68a';
const flameCore = '#f59e0b';

/**
 * A lit candle on its dish in a 48x96 box, the shape of the core candle motif at full height,
 * filled with the canvas colour so it reads on the accent.
 */
const candle = `
  <ellipse cx="24" cy="91.2" rx="18.4" ry="3.6" fill="${canvas}" stroke="${ink}" stroke-width="2.5"/>
  <rect x="12" y="26" width="24" height="64" rx="4" fill="${canvas}" stroke="${ink}" stroke-width="2.5"/>
  <path d="M15.2 27v9c0 2.1 3.2 2.3 3.1-.2V27" fill="${canvas}" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>
  <rect x="23" y="21" width="2" height="6" rx="1" fill="${ink}"/>
  <g transform="translate(24 21) scale(1.25)">
    <path d="M0 0C-5.2-3.4-5-8.1.1-13.1 5-8 5.1-3.6 0 0Z" fill="${flame}"/>
    <path d="M0-1.6C-2.4-3.4-2.6-6 0-8.6 2.5-6 2.4-3.5 0-1.6Z" fill="${flameCore}"/>
  </g>`;

/**
 * `art` is the share of the icon the candle's height takes. Maskable icons keep it inside the
 * 80% safe circle and fill the whole square; plain icons get rounded corners.
 */
function icon(size: number, maskable: boolean): string {
  const art = maskable ? 0.56 : 0.7;
  const h = size * art;
  const w = h / 2;
  const radius = maskable ? 0 : size * 0.22;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${radius}" fill="${accent}"/>
  <svg x="${(size - w) / 2}" y="${(size - h) / 2 + size * 0.02}" width="${w}" height="${h}" viewBox="0 0 48 96" overflow="visible">${candle}</svg>
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
