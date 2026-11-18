import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { repoRoot } from './root';

const repo = fileURLToPath(new URL('../../..', import.meta.url));
const main = fileURLToPath(new URL('./main.ts', import.meta.url));

describe('repoRoot', () => {
  it('is the repo, found from the file itself', () => {
    expect(repoRoot).toBe(repo.replace(/\/$/, ''));
    expect(JSON.parse(readFileSync(`${repoRoot}/package.json`, 'utf8')).name).toBe('ossuary');
  });
});

describe('main.ts', () => {
  it('answers initialize on stdout with JSON-RPC only and logs to stderr, from any directory', async () => {
    const child = spawn('bun', [main], { cwd: tmpdir(), stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (b: Buffer) => (stdout += b.toString()));
    child.stderr.on('data', (b: Buffer) => (stderr += b.toString()));
    const init = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } },
    };
    child.stdin.write(`${JSON.stringify(init)}\n`);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`no answer; stderr: ${stderr}`)), 10_000);
      child.stdout.on('data', () => {
        if (stdout.includes('\n')) {
          clearTimeout(timer);
          resolve();
        }
      });
    });
    child.stdin.end();
    await new Promise((resolve) => child.on('close', resolve));

    const lines = stdout.trim().split('\n');
    expect(lines).toHaveLength(1);
    const reply = JSON.parse(lines[0] ?? '');
    expect(reply).toMatchObject({ jsonrpc: '2.0', id: 1, result: { serverInfo: { name: 'bone-forge' } } });
    expect(stderr).toContain('bone-forge ready');
  }, 20_000);
});
