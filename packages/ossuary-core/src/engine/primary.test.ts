import { describe, expect, it } from 'vitest';
import { pickPrimary } from './primary';

const of = (...days: number[]) => days.map((d) => ({ remaining: { days: d } }));

describe('pickPrimary', () => {
  it('a single lifespan is primary, live or expired', () => {
    expect(pickPrimary(of(10))).toBe(0);
    expect(pickPrimary(of(-10))).toBe(0);
  });

  it('picks the live lifespan with the fewest days left', () => {
    expect(pickPrimary(of(30, 5, 700))).toBe(1);
    expect(pickPrimary(of(700, 30, 0))).toBe(2);
  });

  it('breaks a tie with the earlier declared lifespan', () => {
    expect(pickPrimary(of(9, 4, 4))).toBe(1);
    expect(pickPrimary(of(0, 0))).toBe(0);
  });

  it('never picks an expired lifespan while one is live', () => {
    expect(pickPrimary(of(-1, 400))).toBe(1);
    expect(pickPrimary(of(-300, -1, 0, 50))).toBe(2);
  });

  it('when all have expired, picks the one that expired last', () => {
    expect(pickPrimary(of(-30, -2, -400))).toBe(1);
  });

  it('when all have expired, breaks a tie with the earlier declared lifespan', () => {
    expect(pickPrimary(of(-9, -3, -3))).toBe(1);
  });
});
