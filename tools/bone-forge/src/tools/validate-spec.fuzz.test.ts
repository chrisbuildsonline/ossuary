import { parseBoneSpec } from '@ossuary/core/schema';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { oneSpec, twoSpec } from '../fixtures';
import { validateSpec, validateSpecTool } from './validate-spec';

const runs = { seed: 20261118, numRuns: 300 };

/** What validate_spec must say: exactly parseBoneSpec's verdict. */
function expected(value: unknown) {
  const r = parseBoneSpec(value);
  return r.ok ? { valid: true, issues: [] } : { valid: false, issues: r.error };
}

/** A copy of `spec` with one value replaced or one key removed, at a path picked by `steps`. */
function mutate(spec: unknown, steps: number[], value: unknown, remove: boolean): unknown {
  const copy = structuredClone(spec);
  let node: unknown = copy;
  for (const [i, step] of steps.entries()) {
    if (typeof node !== 'object' || node === null) break;
    const keys = Object.keys(node);
    if (keys.length === 0) break;
    const key = keys[step % keys.length] as string;
    const record = node as Record<string, unknown>;
    if (i === steps.length - 1 || typeof record[key] !== 'object' || record[key] === null) {
      if (!remove) record[key] = value;
      else if (Array.isArray(node)) node.splice(Number(key), 1);
      else delete record[key];
      break;
    }
    node = record[key];
  }
  return copy;
}

const mutated = fc
  .tuple(fc.constantFrom<unknown>(oneSpec, twoSpec), fc.array(fc.nat(), { minLength: 1, maxLength: 6 }), fc.jsonValue(), fc.boolean())
  .map(([spec, steps, value, remove]) => mutate(spec, steps, value, remove));

describe('validate_spec (fast-check)', () => {
  it('agrees with parseBoneSpec on every JSON value, given as a value and as text', () => {
    fc.assert(
      // A top-level string is read as JSON text; the string test below covers that.
      fc.property(fc.jsonValue().filter((v) => typeof v !== 'string'), (value) => {
        expect(validateSpec(value)).toEqual(expected(value));
        expect(validateSpec(JSON.stringify(value))).toEqual(expected(JSON.parse(JSON.stringify(value))));
      }),
      runs,
    );
  });

  it('agrees with parseBoneSpec on mutated valid specs', () => {
    fc.assert(
      fc.property(mutated, (spec) => {
        expect(validateSpec(spec)).toEqual(expected(spec));
        expect(validateSpec(JSON.stringify(spec))).toEqual(expected(spec));
      }),
      { ...runs, numRuns: 500 },
    );
  });

  it('never throws on any value, and agrees with parseBoneSpec on non-text values', () => {
    fc.assert(
      fc.property(fc.anything(), (value) => {
        const out = validateSpec(value);
        if (typeof value !== 'string') expect(out).toEqual(expected(value));
        expect(validateSpecTool({ spec: value }).isError).toBeFalsy();
      }),
      runs,
    );
  });

  it('reads any string as JSON text or reports one issue at path ""', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), fc.json(), fc.string({ unit: 'binary' })), (text) => {
        let parsed: { ok: true; value: unknown } | { ok: false };
        try {
          parsed = { ok: true, value: JSON.parse(text) };
        } catch {
          parsed = { ok: false };
        }
        const out = validateSpec(text);
        if (parsed.ok) expect(out).toEqual(expected(parsed.value));
        else expect(out).toEqual({ valid: false, issues: [{ path: '', message: 'The spec is not valid JSON.' }] });
      }),
      runs,
    );
  });

  it('does not change its input, and the same input gives the same output', () => {
    fc.assert(
      fc.property(fc.oneof(mutated, fc.jsonValue()), (spec) => {
        const before = structuredClone(spec);
        const first = validateSpecTool({ spec });
        expect(spec).toEqual(before);
        expect(validateSpecTool({ spec })).toEqual(first);
      }),
      runs,
    );
  });
});
