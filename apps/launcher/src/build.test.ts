// The one static build: the launcher at dist/, each app in its own folder, all of it working from any sub-path.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { REMIX_URL, cards } from './cards';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const dist = join(repo, 'dist');

const filesIn = (dir: string): string[] =>
  (readdirSync(dir, { recursive: true }) as string[]).filter((f) => statSync(join(dir, f)).isFile()).map((f) => f.split(sep).join('/'));
const read = (...path: string[]) => readFileSync(join(dist, ...path), 'utf8');
const scripts = (dir: string) => filesIn(join(dist, dir)).filter((f) => f.endsWith('.js')).map((f) => read(dir, f));

/** Every src and href in a page and every url() in a stylesheet. */
const linksIn = (text: string) => [...text.matchAll(/\b(?:src|href)="([^"]*)"|url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1] ?? m[2] ?? '');

/** The precache list the plugin writes into sw.js. */
function precacheOf(folder: string): { cacheName: string; urls: string[] } {
  const found = /\((\{"cacheName":"[^"]+","urls":\[[^\]]*\]\})\)/.exec(read(folder, 'sw.js'));
  expect(found, `${folder}/sw.js carries its precache list`).not.toBeNull();
  return JSON.parse(found?.[1] ?? '{}');
}

describe('bun run build', () => {
  beforeAll(() => {
    execFileSync('bun', ['run', 'build'], { cwd: repo, stdio: 'pipe' });
  }, 180_000);

  it('writes the launcher to dist/ and each app to its own folder', () => {
    expect(read('index.html')).toContain('<title>Ossuary</title>');
    for (const c of cards) expect(read(c.folder, 'index.html')).toContain(`<title>${c.name}</title>`);
  });

  it('links every asset of every page and stylesheet relatively, to a file that exists', () => {
    const sources = filesIn(dist).filter((f) => /\.(html|css)$/.test(f));
    expect(sources).toEqual(expect.arrayContaining(['index.html', 'pantry-reaper/index.html', 'warranty-wraith/index.html']));
    const bad: string[] = [];
    for (const file of sources) {
      for (const url of linksIn(read(file))) {
        if (url.startsWith('data:')) continue;
        if (/^(\/|[a-z][a-z0-9+.-]*:)/i.test(url)) bad.push(`${file}: ${url} is not relative`);
        else if (!existsSync(resolve(dirname(join(dist, file)), url.split(/[?#]/)[0] ?? ''))) bad.push(`${file}: ${url} is missing`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('builds no script that loads from the site root', () => {
    for (const folder of ['', ...cards.map((c) => c.folder)]) {
      for (const js of scripts(folder)) expect(js).not.toMatch(/["'`]\/assets\//);
    }
  });

  for (const c of cards) {
    it(`${c.folder}: ships a manifest scoped to its folder with relative icons`, () => {
      const manifest = JSON.parse(read(c.folder, 'manifest.webmanifest')) as { scope: string; start_url: string; icons: { src: string }[] };
      expect(manifest).toMatchObject({ scope: './', start_url: './' });
      for (const icon of manifest.icons) {
        expect(icon.src).not.toMatch(/^(\/|[a-z]+:)/);
        expect(existsSync(join(dist, c.folder, icon.src)), icon.src).toBe(true);
      }
    });

    it(`${c.folder}: registers ./sw.js, whose precache list is exactly its own folder`, () => {
      expect(scripts(c.folder).some((js) => /serviceWorker\.register\(["'`]\.\/sw\.js["'`]\)/.test(js))).toBe(true);
      const precache = precacheOf(c.folder);
      expect(precache.cacheName).toMatch(new RegExp(`^${c.folder}-[0-9a-f]{8}$`));
      const own = filesIn(join(dist, c.folder)).filter((f) => f !== 'sw.js' && !f.endsWith('.map'));
      expect([...precache.urls].sort()).toEqual(own.map((f) => `./${f}`).sort());
      expect(precache.urls).toContain('./index.html');
    });
  }

  it('puts no worker or manifest at the root, so the launcher never controls an app folder', () => {
    expect(existsSync(join(dist, 'sw.js'))).toBe(false);
    expect(existsSync(join(dist, 'manifest.webmanifest'))).toBe(false);
    const launcherJs = filesIn(dist).filter((f) => !f.includes('/') || f.startsWith('assets/'));
    for (const f of launcherJs.filter((x) => x.endsWith('.js'))) expect(read(f)).not.toContain('serviceWorker');
  });

  it('points each card at a built app folder and the pill at the remix guide', () => {
    const launcherJs = filesIn(join(dist, 'assets'))
      .filter((f) => f.endsWith('.js'))
      .map((f) => read('assets', f))
      .join('\n');
    for (const c of cards) {
      expect(c.href).toBe(`./${c.folder}/`);
      expect(launcherJs).toContain(c.folder);
      expect(existsSync(join(dist, c.href, 'index.html'))).toBe(true);
    }
    expect(launcherJs).toContain('docs/REMIX.md');
    expect(REMIX_URL).toMatch(/^https:\/\/github\.com\/[\w.-]+\/ossuary\/blob\/main\/docs\/REMIX\.md$/);
  });
});
