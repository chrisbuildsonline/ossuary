import { parseBoneSpec } from '@ossuary/core/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { oneSpec } from '../fixtures';
import { connect } from '../test-client';
import { validateSpec } from './validate-spec';

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

  it('declares an output schema with valid and issues', async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === 'validate_spec');
    expect(Object.keys(tool?.outputSchema?.properties ?? {}).sort()).toEqual(['issues', 'valid']);
  });
});
