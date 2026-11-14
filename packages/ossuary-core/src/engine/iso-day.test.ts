import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { daysInMonth, formatIsoDay, fromDayNumber, isLeapYear, isRealDay, parseIsoDay, toDayNumber } from './iso-day';

describe('isLeapYear', () => {
  it.each([
    [2024, true],
    [2026, false],
    [2000, true],
    [1900, false],
    [2100, false],
    [2400, true],
    [1600, true],
    [0, true],
  ])('%i is leap: %s', (year, leap) => {
    expect(isLeapYear(year)).toBe(leap);
  });
});

describe('daysInMonth', () => {
  it.each([
    [2026, 1, 31],
    [2026, 2, 28],
    [2024, 2, 29],
    [1900, 2, 28],
    [2000, 2, 29],
    [2026, 4, 30],
    [2026, 12, 31],
  ])('%i-%i has %i days', (year, month, days) => {
    expect(daysInMonth(year, month)).toBe(days);
  });
});

describe('parseIsoDay and formatIsoDay', () => {
  it('parses a real day into parts', () => {
    expect(parseIsoDay('2026-11-14')).toEqual({ year: 2026, month: 11, day: 14 });
  });

  it.each(['2026-02-30', '2026-02-29', '1900-02-29', '2026-13-01', '2026-00-10', '2026-04-31', '2026-1-01', '26-01-01', '2026-01-01T00:00', ' 2026-01-01', '', 'today'])(
    'rejects %j',
    (text) => {
      expect(parseIsoDay(text)).toBeUndefined();
      expect(isRealDay(text)).toBe(false);
    },
  );

  it.each(['2024-02-29', '2000-02-29', '0000-01-01', '9999-12-31', '2026-12-31'])('accepts %s', (text) => {
    expect(isRealDay(text)).toBe(true);
  });

  it('rejects values that are not text', () => {
    expect(isRealDay(20261114 as unknown as string)).toBe(false);
  });

  it('formats with zero padding', () => {
    expect(formatIsoDay({ year: 7, month: 3, day: 5 })).toBe('0007-03-05');
  });
});

describe('day numbers', () => {
  it('counts days from 1970-01-01', () => {
    expect(toDayNumber('1970-01-01')).toBe(0);
    expect(toDayNumber('1970-01-02')).toBe(1);
    expect(toDayNumber('1969-12-31')).toBe(-1);
    expect(toDayNumber('2000-03-01')).toBe(11017);
    expect(toDayNumber('2026-11-14')).toBe(20771);
  });

  it('steps over leap days and century years', () => {
    expect(toDayNumber('2024-03-01') - toDayNumber('2024-02-28')).toBe(2);
    expect(toDayNumber('2026-03-01') - toDayNumber('2026-02-28')).toBe(1);
    expect(toDayNumber('1900-03-01') - toDayNumber('1900-02-28')).toBe(1);
    expect(toDayNumber('2000-03-01') - toDayNumber('2000-02-28')).toBe(2);
    expect(toDayNumber('2001-01-01') - toDayNumber('2000-01-01')).toBe(366);
    expect(toDayNumber('1901-01-01') - toDayNumber('1900-01-01')).toBe(365);
  });

  it('converts back to the same day', () => {
    expect(fromDayNumber(0)).toBe('1970-01-01');
    expect(fromDayNumber(-1)).toBe('1969-12-31');
    expect(fromDayNumber(11017)).toBe('2000-03-01');
    expect(fromDayNumber(toDayNumber('2024-02-29'))).toBe('2024-02-29');
  });

  it('round-trips every day from year 0 to 9999', () => {
    const first = toDayNumber('0000-01-01');
    const last = toDayNumber('9999-12-31');
    fc.assert(
      fc.property(fc.integer({ min: first, max: last }), (n) => {
        const text = fromDayNumber(n);
        expect(isRealDay(text)).toBe(true);
        expect(toDayNumber(text)).toBe(n);
      }),
      { seed: 31, numRuns: 2000 },
    );
  });

  it('agrees with the UTC calendar, which no time zone can shift', () => {
    const msPerDay = 86_400_000;
    fc.assert(
      fc.property(fc.integer({ min: -200_000, max: 200_000 }), (n) => {
        const utc = new Date(n * msPerDay);
        const expected = `${String(utc.getUTCFullYear()).padStart(4, '0')}-${String(utc.getUTCMonth() + 1).padStart(2, '0')}-${String(utc.getUTCDate()).padStart(2, '0')}`;
        expect(fromDayNumber(n)).toBe(expected);
      }),
      { seed: 32, numRuns: 2000 },
    );
  });

  it('throws on a day that is not real, since callers validate first', () => {
    expect(() => toDayNumber('2026-02-30')).toThrow('2026-02-30');
  });
});
