import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Stage } from '../schema/stages';
import { fractionOf, remainingOf, selectStage } from './stage';

const stages: Stage[] = [
  { id: 'ok', label: 'Fine', tone: 'fresh' },
  { id: 'soon', label: 'Soon', tone: 'soon', enterAtDays: 7 },
  { id: 'urgent', label: 'Urgent', tone: 'urgent', enterAtDays: 2 },
  { id: 'gone', label: 'Gone', tone: 'dead' },
];

describe('selectStage', () => {
  it.each([
    [400, 'ok', 0],
    [8, 'ok', 0],
    [7, 'soon', 1],
    [3, 'soon', 1],
    [2, 'urgent', 2],
    [0, 'urgent', 2],
    [-1, 'gone', 3],
    [-500, 'gone', 3],
  ])('%i days left is stage %s', (days, id, index) => {
    expect(selectStage(stages, days)).toMatchObject({ id, index });
  });

  it('returns id, label, tone and index only', () => {
    expect(selectStage(stages, 2)).toStrictEqual({ id: 'urgent', label: 'Urgent', tone: 'urgent', index: 2 });
  });

  it('with only a first and a dead stage, is the first stage until expiry', () => {
    const two: Stage[] = [
      { id: 'live', label: 'Live', tone: 'steady' },
      { id: 'end', label: 'Ended', tone: 'dead' },
    ];
    expect(selectStage(two, 0).id).toBe('live');
    expect(selectStage(two, -1).id).toBe('end');
  });

  it('a threshold of 0 starts on the expiry day', () => {
    const zero: Stage[] = [
      { id: 'live', label: 'Live', tone: 'steady' },
      { id: 'today', label: 'Today', tone: 'urgent', enterAtDays: 0 },
      { id: 'end', label: 'Ended', tone: 'dead' },
    ];
    expect(selectStage(zero, 1).id).toBe('live');
    expect(selectStage(zero, 0).id).toBe('today');
    expect(selectStage(zero, -1).id).toBe('end');
  });

  it('is exact at every threshold N and the day before it (N + 1)', () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.integer({ min: 0, max: 90 }), { minLength: 1, maxLength: 6 }), (thresholds) => {
        const sorted = [...thresholds].sort((a, b) => b - a);
        const list: Stage[] = [
          { id: 's0', label: 'S0', tone: 'fresh' },
          ...sorted.map((n, i) => ({ id: `s${i + 1}`, label: `S${i + 1}`, tone: 'soon' as const, enterAtDays: n })),
          { id: 'end', label: 'End', tone: 'dead' },
        ];
        sorted.forEach((n, i) => {
          expect(selectStage(list, n).index).toBe(i + 1);
          if (!sorted.includes(n + 1)) expect(selectStage(list, n + 1).index).toBe(i);
        });
      }),
      { seed: 51, numRuns: 300 },
    );
  });
});

describe('remainingOf', () => {
  it('is the expiry day number minus the now day number', () => {
    expect(remainingOf(100, 90)).toEqual({ days: 10 });
    expect(remainingOf(100, 100)).toEqual({ days: 0 });
    expect(remainingOf(100, 103)).toEqual({ days: -3 });
  });

  it('adds hours to the end of the day only on the last day, when a minute is given', () => {
    expect(remainingOf(100, 100, 0)).toEqual({ days: 0, hours: 24 });
    expect(remainingOf(100, 100, 1)).toEqual({ days: 0, hours: 24 });
    expect(remainingOf(100, 100, 60)).toEqual({ days: 0, hours: 23 });
    expect(remainingOf(100, 100, 19 * 60)).toEqual({ days: 0, hours: 5 });
    expect(remainingOf(100, 100, 1439)).toEqual({ days: 0, hours: 1 });
    expect(remainingOf(100, 99, 600)).toEqual({ days: 1 });
    expect(remainingOf(100, 101, 600)).toEqual({ days: -1 });
  });
});

describe('fractionOf', () => {
  it('is the share of the lifespan still left, between 0 and 1', () => {
    expect(fractionOf(0, 10, 0)).toBe(1);
    expect(fractionOf(0, 10, 5)).toBe(0.5);
    expect(fractionOf(0, 10, 10)).toBe(0);
    expect(fractionOf(0, 10, 15)).toBe(0);
    expect(fractionOf(0, 10, -5)).toBe(1);
  });

  it('is 0 when the expiry is on or before the start', () => {
    expect(fractionOf(10, 10, 0)).toBe(0);
    expect(fractionOf(10, 5, 0)).toBe(0);
  });
});
