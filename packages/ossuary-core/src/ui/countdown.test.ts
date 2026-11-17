import { describe, expect, it } from 'vitest';
import type { Evaluation, LifespanEvaluation } from '../engine/evaluate';
import type { Tone } from '../schema/stages';
import { accessibleName, formatCountdown, longDay, shortDay } from './countdown';

const now = { day: '2026-11-14' };

const lifespan = (expiresAt: string, days: number, extra: Partial<LifespanEvaluation> = {}, tone: Tone = 'fresh'): LifespanEvaluation => ({
  lifespanId: 'main',
  label: 'Use by',
  startedAt: '2026-11-01',
  expiresAt,
  remaining: { days },
  fraction: 0.5,
  stage: { id: tone, label: tone === 'dead' ? 'Gone' : 'Soon', tone, index: 0 },
  trace: [],
  ...extra,
});

describe('formatCountdown', () => {
  it.each([
    ['5 hrs', lifespan('2026-11-14', 0, { remaining: { days: 0, hours: 5 } }), '5', 'hrs', '5 hours'],
    ['1 hr', lifespan('2026-11-14', 0, { remaining: { days: 0, hours: 1 } }), '1', 'hr', '1 hour'],
    ['today', lifespan('2026-11-14', 0), 'Today', '', 'today'],
    ['1 day', lifespan('2026-11-15', 1), '1', 'day', '1 day'],
    ['59 days', lifespan('2027-01-12', 59), '59', 'days', '59 days'],
    ['60 days', lifespan('2027-01-13', 60), '1', 'mo', '1 month'],
    ['23 months', lifespan('2028-10-14', 700), '23', 'mo', '23 months'],
    ['24 months', lifespan('2028-11-14', 731), '2', 'yr', '2 years'],
    ['25 months', lifespan('2028-12-20', 767), '2', 'yr 1 mo', '2 years 1 month'],
    ['dead', lifespan('2026-11-11', -3, {}, 'dead'), '3', 'days ago', '3 days ago'],
    ['dead yesterday', lifespan('2026-11-13', -1, {}, 'dead'), '1', 'day ago', '1 day ago'],
  ])('%s', (_name, l, value, unit, spoken) => {
    const c = formatCountdown(l, now);
    expect([c.value, c.unit, c.spoken]).toEqual([value, unit, spoken]);
    expect(c.text).toBe(unit ? `${value} ${unit}` : value);
  });
});

describe('dates', () => {
  it('formats short and long days without a Date object', () => {
    expect(shortDay('2026-11-20', now)).toBe('Fri 20 Nov');
    expect(shortDay('2027-01-21', now)).toBe('Thu 21 Jan 2027');
    expect(longDay('2026-11-20', now)).toBe('Friday 20 November');
    expect(longDay('2028-02-29', now)).toBe('Tuesday 29 February 2028');
    expect(longDay('2026-11-14', now)).toBe('Saturday 14 November');
  });
});

describe('accessibleName', () => {
  it('builds one sentence set from the primary lifespan', () => {
    const e: Evaluation = { lifespans: [lifespan('2026-11-16', 2, {}, 'soon')], primaryIndex: 0 };
    expect(accessibleName('Blue widget', e, now)).toBe('Blue widget. Soon. Expires in 2 days, Monday 16 November.');
  });

  it('reads today, hours and dead plainly', () => {
    const one = (l: LifespanEvaluation): Evaluation => ({ lifespans: [l], primaryIndex: 0 });
    expect(accessibleName('W', one(lifespan('2026-11-14', 0)), now)).toBe('W. Soon. Expires today, Saturday 14 November.');
    expect(accessibleName('W', one(lifespan('2026-11-14', 0, { remaining: { days: 0, hours: 5 } })), now)).toBe(
      'W. Soon. Expires in 5 hours, Saturday 14 November.',
    );
    expect(accessibleName('W', one(lifespan('2026-11-11', -3, {}, 'dead')), now)).toBe('W. Gone. Expired 3 days ago, Wednesday 11 November.');
  });

  it('names the primary lifespan and adds one sentence per other lifespan in declared order', () => {
    const cover = lifespan('2026-12-01', 17, { lifespanId: 'cover', label: 'Cover' });
    const window = lifespan('2026-11-16', 2, { lifespanId: 'return_window', label: 'Return window' }, 'urgent');
    const e: Evaluation = { lifespans: [cover, window], primaryIndex: 1 };
    expect(accessibleName('Gizmo', e, now)).toBe(
      'Gizmo. Soon. Return window: expires in 2 days, Monday 16 November. Cover: expires in 17 days, Tuesday 1 December.',
    );
  });
});
