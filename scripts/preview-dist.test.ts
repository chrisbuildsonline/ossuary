import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fileFor, serveDist } from './preview-dist.ts';

const root = mkdtempSync(join(tmpdir(), 'ossuary-dist-'));
mkdirSync(join(root, 'app/assets'), { recursive: true });
writeFileSync(join(root, 'index.html'), '<title>root</title>');
writeFileSync(join(root, 'app/index.html'), '<title>app</title>');
writeFileSync(join(root, 'app/sw.js'), 'self;');
writeFileSync(join(root, 'app/assets/a.css'), 'a{}');

describe('fileFor', () => {
  it('maps folder URLs to their index.html and files to themselves', () => {
    expect(fileFor(root, '/')).toBe(join(root, 'index.html'));
    expect(fileFor(root, '/app/')).toBe(join(root, 'app/index.html'));
    expect(fileFor(root, '/app/assets/a.css?v=1')).toBe(join(root, 'app/assets/a.css'));
  });

  it('refuses paths outside the folder and files that do not exist', () => {
    for (const path of ['/../etc/passwd', '/app/../../x', '/%2e%2e/x', '/%zz', '/nope.js']) expect(fileFor(root, path), path).toBeUndefined();
  });
});

describe('serveDist', () => {
  const server = serveDist(root, 0);
  let base = '';
  beforeAll(async () => {
    if (!server.listening) await new Promise((done) => server.once('listening', done));
    base = `http://localhost:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((done) => server.close(() => done())));

  it('serves pages, workers and stylesheets with their types', async () => {
    const page = await fetch(`${base}/app/`);
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toMatch(/^text\/html/);
    expect(await page.text()).toBe('<title>app</title>');
    expect((await fetch(`${base}/app/sw.js`)).headers.get('content-type')).toMatch(/^text\/javascript/);
    expect((await fetch(`${base}/app/assets/a.css`)).headers.get('content-type')).toMatch(/^text\/css/);
  });

  it('redirects a folder without its slash, so relative links resolve inside it', async () => {
    const r = await fetch(`${base}/app`, { redirect: 'manual' });
    expect(r.status).toBe(301);
    expect(r.headers.get('location')).toBe('/app/');
  });

  it('answers 404 for anything else', async () => {
    expect((await fetch(`${base}/missing.js`)).status).toBe(404);
  });
});
