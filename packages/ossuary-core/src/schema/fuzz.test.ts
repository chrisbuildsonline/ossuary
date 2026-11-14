import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { copyOf, gizmoSpec, widgetSpec } from '../testing/fixtures';
import { specArbitrary } from '../testing/spec-arbitrary';
import { parseBoneSpec } from './bone-spec';
import { MAX_ISSUES } from './issues';

// Mutations reach into arbitrary shapes.
type Loose = any;

/** Every result is a well-formed Result, and every accepted spec reparses to itself. */
function checkResult(input: unknown) {
  const r = parseBoneSpec(input);
  if (r.ok) {
    expect(parseBoneSpec(r.value)).toStrictEqual(r);
    return;
  }
  expect(r.error.length).toBeGreaterThan(0);
  expect(r.error.length).toBeLessThanOrEqual(MAX_ISSUES);
  for (const issue of r.error) {
    expect(typeof issue.path).toBe('string');
    expect(typeof issue.message).toBe('string');
  }
}

function pathsOf(value: unknown, prefix: PropertyKey[] = []): PropertyKey[][] {
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => {
    const path = [...prefix, Array.isArray(value) ? Number(key) : key];
    return [path, ...pathsOf(child, path)];
  });
}

const retype = (v: unknown): unknown => {
  if (typeof v === 'string') return 42;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return 'true';
  if (Array.isArray(v)) return {};
  if (v === null) return 0;
  return [];
};

type Mutation = { at: number; op: 'delete' | 'replace' | 'retype'; value: unknown };

function mutate(spec: object, { at, op, value }: Mutation): unknown {
  const copy: Loose = copyOf(spec);
  const paths = pathsOf(copy);
  const path = paths[at % paths.length] ?? [];
  const key = path[path.length - 1] as Loose;
  const parent = path.slice(0, -1).reduce((node: Loose, k) => node[k], copy);
  if (op === 'delete') {
    if (Array.isArray(parent)) parent.splice(key, 1);
    else delete parent[key];
  } else {
    parent[key] = op === 'replace' ? value : retype(parent[key]);
  }
  return copy;
}

const mutation: fc.Arbitrary<Mutation> = fc.record({
  at: fc.nat(),
  op: fc.constantFrom('delete', 'replace', 'retype'),
  value: fc.jsonValue({ maxDepth: 2 }),
});

describe('parseBoneSpec fuzz', () => {
  it('never throws on random JSON', () => {
    fc.assert(fc.property(fc.jsonValue(), (input) => checkResult(input)), { numRuns: 500 });
  });

  it('never throws on anything at all', () => {
    fc.assert(
      fc.property(fc.anything({ withMap: true, withSet: true, withDate: true, withTypedArray: true, withNullPrototype: true }), (input) =>
        checkResult(input),
      ),
      { numRuns: 500 },
    );
  });

  it('never throws on random objects shaped like a spec', () => {
    const keys = fc.constantFrom('id', 'name', 'version', 'entity', 'lifespans', 'theme', 'copy', 'sources', 'fields', 'rules', 'stages');
    fc.assert(fc.property(fc.dictionary(keys, fc.jsonValue({ maxDepth: 3 })), (input) => checkResult(input)), { numRuns: 300 });
  });

  it('never throws on mutated fixture specs, and accepted mutants reparse equal', () => {
    fc.assert(
      fc.property(fc.constantFrom(widgetSpec, gizmoSpec), fc.array(mutation, { minLength: 1, maxLength: 3 }), (spec, changes) => {
        checkResult(changes.reduce((s: object, m) => mutate(s, m) as object, spec));
      }),
      { numRuns: 500 },
    );
  });

  it('never throws on mutated generated specs', () => {
    fc.assert(fc.property(specArbitrary, mutation, (spec, m) => checkResult(mutate(spec, m))), { numRuns: 300 });
  });
});

describe('specArbitrary', () => {
  it('generates valid specs with one to four lifespans that reparse equal', () => {
    fc.assert(
      fc.property(specArbitrary, (spec) => {
        const r = parseBoneSpec(spec);
        expect(r).toStrictEqual({ ok: true, value: spec });
        expect(spec.lifespans.length).toBeGreaterThanOrEqual(1);
        expect(spec.lifespans.length).toBeLessThanOrEqual(4);
      }),
      { numRuns: 300 },
    );
  });

  it('covers every lifespan count from one to four', () => {
    const counts = new Set(fc.sample(specArbitrary, { numRuns: 200, seed: 1 }).map((s) => s.lifespans.length));
    expect([...counts].sort()).toEqual([1, 2, 3, 4]);
  });
});
