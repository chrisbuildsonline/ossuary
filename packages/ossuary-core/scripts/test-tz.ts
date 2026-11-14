// Runs the core suite (engine included) once per time zone: UTC, America/New_York, Pacific/Auckland.
// `--all` first runs the whole workspace suite in the current zone; any other arguments go to that run.
// Stops at the first failing run and exits with its code.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const vitest = fileURLToPath(new URL('../../../node_modules/.bin/vitest', import.meta.url));
const zones = ['UTC', 'America/New_York', 'Pacific/Auckland'];

const args = process.argv.slice(2);
const all = args.includes('--all');
const extra = args.filter((a) => a !== '--all');

const runs: { title: string; args: string[]; tz?: string }[] = [
  ...(all ? [{ title: 'whole suite', args: extra }] : []),
  ...zones.map((tz) => ({ title: `core suite, TZ=${tz}`, args: ['packages/ossuary-core'], tz })),
];

for (const run of runs) {
  console.log(`\n== ${run.title} ==`);
  const env = run.tz ? { ...process.env, TZ: run.tz } : process.env;
  const result = spawnSync(vitest, ['run', ...run.args], { cwd: root, env, stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`\n${run.title} failed.`);
    process.exit(result.status ?? 1);
  }
}
console.log(`\nAll ${runs.length} runs passed.`);
