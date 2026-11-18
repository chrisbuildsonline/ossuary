import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { type Evaluation, evaluate } from '@ossuary/core/engine';
import { parseBoneSpec } from '@ossuary/core/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { item, oneSpec, twoSpec } from '../fixtures';
import { connect } from '../test-client';
import { previewCountdown } from './preview-countdown';

// The item starts 2026-11-01; its 30 day cover ends 2026-12-01.
function run(now: { day: string; minuteOfDay?: number }, spec: unknown = oneSpec): Evaluation {
  const r = previewCountdown({ spec, item, now });
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
}

describe('previewCountdown, one lifespan', () => {
  it('counts the days left on a plain day', () => {
    const e = run({ day: '2026-11-18' });
    expect(e.primaryIndex).toBe(0);
    expect(e.lifespans).toHaveLength(1);
    expect(e.lifespans[0]).toMatchObject({
      lifespanId: 'cover',
      label: 'Cover',
      startedAt: '2026-11-01',
      expiresAt: '2026-12-01',
      remaining: { days: 13 },
      fraction: 13 / 30,
      stage: { id: 'steady', label: 'Steady', tone: 'steady', index: 1 },
    });
    expect(e.lifespans[0]?.trace).toEqual([
      { ruleId: 'base', kind: 'base', text: 'Base: Cover period 30 days', deltaDays: 30, changed: true },
    ]);
  });

  it('counts hours on the last day when minuteOfDay is given', () => {
    const e = run({ day: '2026-12-01', minuteOfDay: 600 });
    expect(e.lifespans[0]?.remaining).toEqual({ days: 0, hours: 14 });
    expect(e.lifespans[0]?.stage.id).toBe('last_day');
  });

  it('enters a stage on its threshold day and not the day before', () => {
    expect(run({ day: '2026-11-17' }).lifespans[0]?.stage.id).toBe('steady');
    expect(run({ day: '2026-11-17' }).lifespans[0]?.remaining.days).toBe(14);
    expect(run({ day: '2026-11-16' }).lifespans[0]?.stage.id).toBe('fresh');
  });

  it('accepts the spec as JSON text and equals evaluate', () => {
    const spec = parseBoneSpec(oneSpec);
    if (!spec.ok) throw new Error('fixture');
    const now = { day: '2026-11-20', minuteOfDay: 75 };
    expect(previewCountdown({ spec: JSON.stringify(oneSpec), item, now })).toEqual(evaluate(spec.value, item, now));
  });
});

describe('preview_countdown, two lifespans', () => {
  let client: Client;
  beforeEach(async () => {
    client = await connect('/nowhere');
  });
  afterEach(async () => {
    await client.close();
  });

  const call = (day: string, minuteOfDay?: number) =>
    client.callTool({ name: 'preview_countdown', arguments: { spec: twoSpec, item, now: minuteOfDay === undefined ? { day } : { day, minuteOfDay } } });

  it('marks the cover primary while it runs, with one text line per lifespan', async () => {
    const r = await call('2026-11-18');
    expect((r.structuredContent as unknown as Evaluation).primaryIndex).toBe(0);
    expect(r.content).toEqual([
      {
        type: 'text',
        text: 'Cover ends 2026-12-01, 13 days left, Steady (primary)\nService ends 2027-11-01, 348 days left, Fresh',
      },
    ]);
  });

  it('moves primary to the live lifespan once the first has ended', async () => {
    const r = await call('2026-12-10');
    expect((r.structuredContent as unknown as Evaluation).primaryIndex).toBe(1);
    expect(r.content).toEqual([
      { type: 'text', text: 'Cover ended 2026-12-01, 9 days ago, Gone\nService ends 2027-11-01, 326 days left, Fresh (primary)' },
    ]);
  });

  it('says one day, today and hours in plain words', async () => {
    expect((await call('2026-11-30')).content).toMatchObject([{ text: expect.stringMatching(/^Cover ends 2026-12-01, 1 day left, Soon \(primary\)\n/) }]);
    expect((await call('2026-12-01')).content).toMatchObject([{ text: expect.stringMatching(/^Cover ends 2026-12-01, today, Last day \(primary\)\n/) }]);
    expect((await call('2026-12-01', 600)).content).toMatchObject([{ text: expect.stringMatching(/^Cover ends 2026-12-01, 14 hours left, Last day/) }]);
    expect((await call('2026-12-02')).content).toMatchObject([{ text: expect.stringMatching(/^Cover ended 2026-12-01, 1 day ago, Gone\n/) }]);
  });

  it('returns structured content equal to evaluate', async () => {
    const spec = parseBoneSpec(twoSpec);
    if (!spec.ok) throw new Error('fixture');
    const now = { day: '2027-06-30', minuteOfDay: 1439 };
    const expected = evaluate(spec.value, item, now);
    expect(expected.ok).toBe(true);
    const r = await call(now.day, now.minuteOfDay);
    expect(r.structuredContent).toEqual(expected.ok && expected.value);
  });

  it('declares an output schema with lifespans and primaryIndex', async () => {
    const { tools } = await client.listTools();
    const schema = tools.find((t) => t.name === 'preview_countdown')?.outputSchema;
    expect(Object.keys(schema?.properties ?? {}).sort()).toEqual(['lifespans', 'primaryIndex']);
  });
});

describe('preview_countdown tool, one lifespan', () => {
  let client: Client;
  beforeEach(async () => {
    client = await connect('/nowhere');
  });
  afterEach(async () => {
    await client.close();
  });

  it('declares spec, item and now in its input schema', async () => {
    const { tools } = await client.listTools();
    const schema = tools.find((t) => t.name === 'preview_countdown')?.inputSchema;
    expect(Object.keys(schema?.properties ?? {}).sort()).toEqual(['item', 'now', 'spec']);
    expect(schema?.required?.slice().sort()).toEqual(['item', 'now', 'spec']);
  });

  it('returns the evaluation as structured content', async () => {
    const now = { day: '2026-11-18' };
    const r = await client.callTool({ name: 'preview_countdown', arguments: { spec: oneSpec, item, now } });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toEqual(run(now));
  });
});
