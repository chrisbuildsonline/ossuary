import { describe, expect, it } from 'vitest';
import { parseWith } from './issues';
import { stagesSchema } from './stages';

const issuesOf = (input: unknown) => {
  const r = parseWith(stagesSchema, input);
  return r.ok ? [] : r.error;
};

const first = { id: 'ok', label: 'Fine', tone: 'fresh' };
const soon = { id: 'soon', label: 'Soon', tone: 'soon', enterAtDays: 7 };
const urgent = { id: 'urgent', label: 'Urgent', tone: 'urgent', enterAtDays: 2 };
const last = { id: 'gone', label: 'Gone', tone: 'dead' };

describe('stagesSchema', () => {
  it('accepts a first stage, decreasing thresholds and a last dead stage', () => {
    const stages = [first, soon, urgent, last];
    expect(parseWith(stagesSchema, stages)).toEqual({ ok: true, value: stages });
  });

  it('accepts the shortest list: a first stage and the dead stage', () => {
    expect(issuesOf([first, last])).toEqual([]);
  });

  it('accepts a threshold of 0 and the steady tone', () => {
    expect(issuesOf([{ ...first, tone: 'steady' }, { ...urgent, enterAtDays: 0 }, last])).toEqual([]);
  });

  it('rejects an unknown tone', () => {
    expect(issuesOf([{ ...first, tone: 'red' }, last])).toEqual([
      { path: '[0].tone', message: 'Expected one of: fresh, steady, soon, urgent, dead.' },
    ]);
  });

  it('rejects duplicate stage ids', () => {
    expect(issuesOf([first, { ...soon, id: 'ok' }, last])).toEqual([{ path: '[1].id', message: 'Duplicate stage id "ok".' }]);
  });

  it('rejects a threshold on the first stage', () => {
    expect(issuesOf([{ ...first, enterAtDays: 30 }, soon, last])).toEqual([
      { path: '[0].enterAtDays', message: 'The first stage has no threshold.' },
    ]);
  });

  it('needs a threshold on every middle stage', () => {
    expect(issuesOf([first, { id: 'mid', label: 'Mid', tone: 'soon' }, last])).toEqual([
      { path: '[1].enterAtDays', message: 'This stage needs enterAtDays, the days left when it starts.' },
    ]);
  });

  it('needs thresholds strictly lower than the stage before', () => {
    expect(issuesOf([first, soon, { ...urgent, enterAtDays: 7 }, last])).toEqual([
      { path: '[2].enterAtDays', message: 'Must be lower than the stage before it (7).' },
    ]);
    expect(issuesOf([first, urgent, soon, last])).toEqual([
      { path: '[2].enterAtDays', message: 'Must be lower than the stage before it (2).' },
    ]);
  });

  it('rejects negative or fractional thresholds', () => {
    expect(issuesOf([first, { ...soon, enterAtDays: -1 }, last])[0]?.path).toBe('[1].enterAtDays');
    expect(issuesOf([first, { ...soon, enterAtDays: 1.5 }, last])[0]?.path).toBe('[1].enterAtDays');
  });

  it('needs the last stage to be dead, with no threshold', () => {
    expect(issuesOf([first, soon])).toEqual([{ path: '[1].tone', message: 'The last stage must have the dead tone.' }]);
    expect(issuesOf([first, { ...last, enterAtDays: 0 }])).toEqual([
      { path: '[1].enterAtDays', message: 'The dead stage has no threshold.' },
    ]);
  });

  it('allows only one dead stage', () => {
    expect(issuesOf([first, { ...soon, tone: 'dead' }, last])).toEqual([
      { path: '[1].tone', message: 'Only the last stage can have the dead tone.' },
    ]);
    expect(issuesOf([{ ...first, tone: 'dead' }, last])).toEqual([
      { path: '[0].tone', message: 'Only the last stage can have the dead tone.' },
    ]);
  });

  it('needs two to eight stages', () => {
    expect(issuesOf([last])).toEqual([{ path: '', message: 'Must have at least 2 items.' }]);
    const middle = Array.from({ length: 7 }, (_, i) => ({ id: `s${i}`, label: `S${i}`, tone: 'soon', enterAtDays: 20 - i }));
    expect(issuesOf([first, ...middle, last])).toEqual([{ path: '', message: 'Must have at most 8 items.' }]);
  });
});
