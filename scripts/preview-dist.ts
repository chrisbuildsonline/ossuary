// Serves dist/ (the launcher and both apps) as a plain static host would, on port 4180.
// Usage: bun scripts/preview-dist.ts, after bun run build.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { type Server, createServer } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const types: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

const decode = (path: string): string | undefined => {
  try {
    return decodeURIComponent(path);
  } catch {
    return undefined;
  }
};

/** The path inside root that a URL path names, or undefined when it leaves root. */
function inside(root: string, urlPath: string): string | undefined {
  const path = decode(urlPath.split(/[?#]/)[0] ?? '/');
  if (path === undefined) return undefined;
  const full = resolve(root, `.${path}`);
  return full === root || full.startsWith(root + sep) ? full : undefined;
}

/** The file to send for a URL path: a folder gives its index.html. Undefined for no file or a path outside root. */
export function fileFor(root: string, urlPath: string): string | undefined {
  const full = inside(resolve(root), urlPath);
  if (!full || !existsSync(full)) return undefined;
  const file = statSync(full).isDirectory() ? join(full, 'index.html') : full;
  return existsSync(file) && statSync(file).isFile() ? file : undefined;
}

export function serveDist(root: string, port: number): Server {
  return createServer((req, res) => {
    const url = req.url ?? '/';
    const path = url.split(/[?#]/)[0] ?? '/';
    const full = inside(resolve(root), url);
    // A folder without its slash would resolve relative links one level up.
    if (full && !path.endsWith('/') && existsSync(full) && statSync(full).isDirectory()) {
      res.writeHead(301, { location: `${path}/` }).end();
      return;
    }
    const file = fileFor(root, url);
    if (!file) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
      return;
    }
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  }).listen(port);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  serveDist(fileURLToPath(new URL('../dist', import.meta.url)), 4180);
  console.log('dist on http://localhost:4180');
}
