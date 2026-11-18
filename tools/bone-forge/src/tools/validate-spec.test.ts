import { parseBoneSpec } from '@ossuary/core/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { oneSpec } from '../fixtures';
import { connect } from '../test-client';
import { validateSpec, validateSpecTool } from './validate-spec';

const broken = { ...oneSpec, entity: { ...oneSpec.entity, titleField: 'missing' } };

describe('validateSpec', () => {
  it('accepts a valid spec as an object and as JSON text', () => {
    expect(validateSpec(oneSpec)).toEqual({ valid: true, issues: [] });
    expect(validateSpec(JSON.stringify(oneSpec))).toEqual({ valid: true, issues: [] });
  });

  it('lists the issues exactly as parseBoneSpec reports them', () => {
    const r = parseBoneSpec(broken);
    expect(r.ok).toBe(false);
    const out = validateSpec(broken);
    expect(out.valid).toBe(false);
    expect(out.issues).toEqual(r.ok ? [] : r.error);
    expect(out.issues).toContainEqual({ path: 'entity.titleField', message: 'No field named "missing".' });
  });
});

describe('validateSpec on odd input', () => {
  const notJson = { valid: false, issues: [{ path: '', message: 'The spec is not valid JSON.' }] };

  it('gives one issue at path "" for text that is not JSON', () => {
    expect(validateSpec('{"id": ')).toEqual(notJson);
    expect(validateSpec('')).toEqual(notJson);
    expect(validateSpec('x'.repeat(2_000_000))).toEqual(notJson);
  });

  it('reports null, numbers, booleans, arrays and JSON text of them as invalid, never throwing', () => {
    for (const value of [null, undefined, 0, -1.5, Number.NaN, true, [], [oneSpec], 'null', '42', '[]', '"text"']) {
      const out = validateSpec(value);
      expect(out.valid).toBe(false);
      expect(out.issues.length).toBeGreaterThan(0);
    }
  });

  it('survives a value whose every property access throws', () => {
    const hostile = new Proxy({}, { get: () => { throw new Error('boom'); }, ownKeys: () => { throw new Error('boom'); } });
    expect(validateSpecTool({ spec: hostile }).isError).toBeFalsy();
    expect(validateSpec(hostile).valid).toBe(false);
  });
});

describe('validate_spec tool', () => {
  let client: Client;
  beforeEach(async () => {
    client = await connect('/nowhere');
  });
  afterEach(async () => {
    await client.close();
  });

  it('returns valid: true and one ok line naming the spec id', async () => {
    const r = await client.callTool({ name: 'validate_spec', arguments: { spec: oneSpec } });
    expect(r.isError).toBeFalsy();
    expect(r.structuredContent).toEqual({ valid: true, issues: [] });
    expect(r.content).toEqual([{ type: 'text', text: 'ok: test-bone' }]);
  });

  it('accepts JSON text', async () => {
    const r = await client.callTool({ name: 'validate_spec', arguments: { spec: JSON.stringify(oneSpec) } });
    expect(r.structuredContent).toEqual({ valid: true, issues: [] });
  });

  it('returns an invalid spec as a normal result with one path: message line per issue', async () => {
    const twoIssues = { ...broken, version: 0 };
    const r = await client.callTool({ name: 'validate_spec', arguments: { spec: twoIssues } });
    expect(r.isError).toBeFalsy();
    const { issues } = r.structuredContent as { issues: { path: string; message: string }[] };
    expect((r.structuredContent as { valid: boolean }).valid).toBe(false);
    expect(issues.length).toBeGreaterThanOrEqual(2);
    expect(r.content).toEqual([{ type: 'text', text: issues.map((i) => `${i.path}: ${i.message}`).join('\n') }]);
  });

  it('answers bad JSON text, null, a number and an array with valid: false and no isError', async () => {
    for (const spec of ['{nope', null, 7, [1, 2], 'z'.repeat(100_000)]) {
      const r = await client.callTool({ name: 'validate_spec', arguments: { spec } });
      expect(r.isError).toBeFalsy();
      expect((r.structuredContent as { valid: boolean }).valid).toBe(false);
    }
    const r = await client.callTool({ name: 'validate_spec', arguments: { spec: '{nope' } });
    expect(r.content).toEqual([{ type: 'text', text: '(spec): The spec is not valid JSON.' }]);
  });

  it('declares an output schema with valid and issues', async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'validate_spec');
    expect(Object.keys(tool?.outputSchema?.properties ?? {}).sort()).toEqual(['issues', 'valid']);
  });
});
