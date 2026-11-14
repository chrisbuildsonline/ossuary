import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MAX_ISSUES, formatIssues, parseWith } from './issues';

const shape = z
  .object({
    name: z.string().min(1),
    count: z.number().min(0).optional(),
    list: z.array(z.object({ kind: z.literal('a'), when: z.object({ field: z.string() }).strict() }).strict()).max(2),
    table: z.record(z.string(), z.number()),
  })
  .strict();

const issuesOf = (input: unknown) => {
  const r = parseWith(shape, input);
  return r.ok ? [] : r.error;
};

describe('formatIssues', () => {
  it('writes paths as readable strings', () => {
    expect(issuesOf({ name: 'x', list: [{ kind: 'a', when: {} }], table: {} })).toEqual([
      { path: 'list[0].when.field', message: 'This is required.' },
    ]);
  });

  it('quotes keys that are not identifiers', () => {
    expect(issuesOf({ name: 'x', list: [], table: { 'a b': 'x' } })).toEqual([
      { path: 'table["a b"]', message: 'Expected a number.' },
    ]);
  });

  it('reports each unknown key at its own path', () => {
    expect(issuesOf({ name: 'x', list: [{ kind: 'a', when: { field: 'f', extra: 1, more: 2 } }], table: {} })).toEqual([
      { path: 'list[0].when.extra', message: 'Unknown key "extra".' },
      { path: 'list[0].when.more', message: 'Unknown key "more".' },
    ]);
  });

  it('uses plain English without library wording', () => {
    const issues = [
      ...issuesOf({ name: '', count: -1, list: [{ kind: 'b', when: { field: 1 } }, 1], table: [] }),
      ...issuesOf({ name: 'x', list: [1, 2, 3], table: {} }),
    ];
    expect(issues).toEqual([
      { path: 'name', message: 'Must not be empty.' },
      { path: 'count', message: 'Must be at least 0.' },
      { path: 'list[0].kind', message: 'Expected "a".' },
      { path: 'list[0].when.field', message: 'Expected text.' },
      { path: 'list[1]', message: 'Expected an object.' },
      { path: 'table', message: 'Expected an object.' },
      { path: 'list', message: 'Must have at most 2 items.' },
    ]);
    for (const issue of issues) expect(issue.message).not.toMatch(/invalid input|received|zod/i);
  });

  it('names the allowed values for a bad discriminator', () => {
    const union = z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('a') }),
      z.object({ kind: z.literal('b') }),
    ]);
    const r = parseWith(union, { kind: 'c' });
    expect(r).toEqual({ ok: false, error: [{ path: 'kind', message: 'Expected one of: a, b.' }] });
  });

  it('returns at most 50 issues', () => {
    const r = z.array(z.string()).safeParse(Array.from({ length: 80 }, (_, i) => i));
    expect(r.success).toBe(false);
    if (!r.success) expect(formatIssues(r.error)).toHaveLength(MAX_ISSUES);
    expect(MAX_ISSUES).toBe(50);
  });
});

describe('parseWith', () => {
  it('returns the parsed value on success', () => {
    expect(parseWith(z.number(), 3)).toEqual({ ok: true, value: 3 });
  });

  it('turns an internal error into one root issue', () => {
    const throwing = z.number().transform(() => {
      throw new Error('boom');
    });
    expect(parseWith(throwing, 1)).toEqual({ ok: false, error: [{ path: '', message: 'Could not read this value.' }] });
  });
});
