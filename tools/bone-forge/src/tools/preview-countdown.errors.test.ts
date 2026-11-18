import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { item, oneSpec, twoSpec } from '../fixtures';
import { connect } from '../test-client';
import { previewCountdownTool } from './preview-countdown';

const errorText = (r: { isError?: boolean; content?: unknown }) => {
  expect(r.isError).toBe(true);
  return (r.content as { text: string }[])[0]?.text;
};

describe('preview_countdown errors', () => {
  it('lists the spec issues for an invalid spec', () => {
    const spec = { ...oneSpec, version: 0, entity: { ...oneSpec.entity, titleField: 'nope' } };
    expect(errorText(previewCountdownTool({ spec, item, now: { day: '2026-11-18' } }))).toBe(
      'version: Must be at least 1.\nentity.titleField: No field named "nope".',
    );
  });

  it('lists the item issues for an invalid item', () => {
    const text = errorText(previewCountdownTool({ spec: oneSpec, item: { started: '2026-02-30' }, now: { day: '2026-11-18' } }));
    expect(text?.split('\n')).toContain('name: This is required.');
    expect(text).toMatch(/^started: /m);
  });

  it('puts now issues under the path now', () => {
    expect(errorText(previewCountdownTool({ spec: oneSpec, item, now: { day: '2026-02-30' } }))).toBe(
      'now.day: Use a real calendar day as YYYY-MM-DD.',
    );
    expect(errorText(previewCountdownTool({ spec: oneSpec, item, now: { day: '2026-11-18', minuteOfDay: 1440 } }))).toBe(
      'now.minuteOfDay: Use a whole number of minutes from 0 to 1439.',
    );
  });

  it('reports bad JSON text as a spec issue', () => {
    expect(errorText(previewCountdownTool({ spec: '{', item, now: { day: '2026-11-18' } }))).toBe('(spec): The spec is not valid JSON.');
  });

  it('comes back as isError over MCP for a bad day, minute 1440 and an invalid spec', async () => {
    const client = await connect('/nowhere');
    for (const args of [
      { spec: oneSpec, item, now: { day: '2026-13-01' } },
      { spec: oneSpec, item, now: { day: '2026-11-18', minuteOfDay: 1440 } },
      { spec: { id: 'x' }, item, now: { day: '2026-11-18' } },
    ]) {
      const r = await client.callTool({ name: 'preview_countdown', arguments: args });
      expect(r.isError).toBe(true);
    }
    const r = await client.callTool({ name: 'preview_countdown', arguments: { spec: oneSpec, item, now: { day: '2026-13-01' } } });
    expect(r.content).toEqual([{ type: 'text', text: 'now.day: Use a real calendar day as YYYY-MM-DD.' }]);
    await client.close();
  });
});

describe('preview_countdown determinism', () => {
  const input = { spec: twoSpec, item, now: { day: '2027-01-15', minuteOfDay: 30 } };

  it('gives the same output for the same input and leaves the input unchanged', () => {
    const before = structuredClone(input);
    const first = previewCountdownTool(input);
    expect(previewCountdownTool(input)).toEqual(first);
    expect(input).toEqual(before);
  });

  it('gives the same output under three TZ settings', () => {
    const module = fileURLToPath(new URL('./preview-countdown.ts', import.meta.url));
    const script = `const { previewCountdownTool } = await import(${JSON.stringify(module)}); console.log(JSON.stringify(previewCountdownTool(${JSON.stringify(input)})));`;
    const outputs = ['UTC', 'Pacific/Kiritimati', 'America/Adak'].map((TZ) => {
      const r = spawnSync('bun', ['-e', script], { env: { ...process.env, TZ }, encoding: 'utf8' });
      expect(r.status, r.stderr).toBe(0);
      return r.stdout;
    });
    expect(new Set(outputs).size).toBe(1);
    expect(JSON.parse(outputs[0] ?? '')).toEqual(previewCountdownTool(input));
  });

  it('never throws, whatever the spec, item and now', () => {
    const spec = fc.oneof(fc.anything(), fc.constantFrom<unknown>(oneSpec, twoSpec, JSON.stringify(twoSpec)));
    const someItem = fc.oneof(fc.anything(), fc.dictionary(fc.constantFrom('name', 'place', 'started', 'other'), fc.oneof(fc.string(), fc.double(), fc.date().map(String))));
    const now = fc.oneof(fc.anything(), fc.record({ day: fc.oneof(fc.string(), fc.constant('2026-11-18')), minuteOfDay: fc.oneof(fc.integer(), fc.double()) }, { requiredKeys: ['day'] }));
    fc.assert(
      fc.property(spec, someItem, now, (s, i, n) => {
        const r = previewCountdownTool({ spec: s, item: i, now: n });
        expect(r.content).toHaveLength(1);
      }),
      { seed: 20261119, numRuns: 400 },
    );
  });
});
