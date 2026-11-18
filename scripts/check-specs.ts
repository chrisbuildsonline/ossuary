// Validates bone specs against the core zod schema.
// Usage: bun scripts/check-specs.ts [file ...]. With no files it checks every apps/*/bone.json.
// Exits 1 and lists every issue.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBoneSpec } from '../packages/ossuary-core/src/schema/index.ts';

export function findSpecs(root: string): string[] {
  const apps = join(root, 'apps');
  return readdirSync(apps)
    .sort()
    .map((app) => join(apps, app, 'bone.json'))
    .filter((file) => existsSync(file));
}

export function checkSpecs(files: string[]): string[] {
  return files.flatMap((file) => {
    let input: unknown;
    try {
      input = JSON.parse(readFileSync(file, 'utf8'));
    } catch (error) {
      return [`${file}: not valid JSON (${(error as Error).message})`];
    }
    const result = parseBoneSpec(input);
    return result.ok ? [] : result.error.map((issue) => `${file}: ${issue.path}: ${issue.message}`);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const files = process.argv.length > 2 ? process.argv.slice(2) : findSpecs(root);
  if (files.length === 0) {
    console.error('No bone specs found.');
    process.exit(1);
  }
  const problems = checkSpecs(files);
  for (const file of files) if (!problems.some((p) => p.startsWith(`${file}:`))) console.log(`ok ${relative(root, file)}`);
  if (problems.length > 0) {
    console.error(`Bone spec invalid:\n${problems.map((p) => `  ${p}`).join('\n')}`);
    process.exit(1);
  }
}
