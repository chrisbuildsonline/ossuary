import { describe, expect, it } from 'vitest';
import { toStoreError } from './errors';

describe('toStoreError', () => {
  it('maps QuotaExceededError to quota', () => {
    const e = toStoreError(new DOMException('full', 'QuotaExceededError'));
    expect(e.code).toBe('quota');
    expect(e.code === 'quota' && e.message).toMatch(/full/i);
  });

  it('maps SecurityError to unavailable', () => {
    expect(toStoreError(new DOMException('no', 'SecurityError')).code).toBe('unavailable');
  });

  it('maps a duplicate key (ConstraintError) to an invalid id issue', () => {
    expect(toStoreError(new DOMException('dup', 'ConstraintError'))).toEqual({
      code: 'invalid',
      issues: [{ path: 'id', message: 'An item with this id already exists.' }],
    });
  });

  it('maps a newer database (VersionError) to unavailable with a plain message', () => {
    const e = toStoreError(new DOMException('older', 'VersionError'));
    expect(e).toEqual({ code: 'unavailable', message: expect.stringMatching(/newer version/) });
  });

  it.each([new Error('boom'), 'text', 42, null, undefined, { name: 7 }, new DOMException('x', 'AbortError')])(
    'maps anything else to unavailable: %s',
    (input) => {
      const e = toStoreError(input);
      expect(e.code).toBe('unavailable');
      expect(e.code === 'unavailable' && e.message.length).toBeGreaterThan(0);
    },
  );

  it('returns store errors unchanged', () => {
    const blocked = { code: 'blocked', message: 'x' } as const;
    expect(toStoreError(blocked)).toBe(blocked);
  });
});
