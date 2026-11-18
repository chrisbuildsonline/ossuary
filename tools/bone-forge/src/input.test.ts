import { describe, expect, it } from 'vitest';
import { readSpecInput } from './input';
import { issueLines, ok, toolError } from './result';

describe('readSpecInput', () => {
  it('passes an object through as it is', () => {
    const spec = { id: 'x' };
    const r = readSpecInput(spec);
    expect(r).toEqual({ ok: true, value: spec });
    expect(r.ok && r.value).toBe(spec);
  });

  it('parses JSON text', () => {
    expect(readSpecInput('{"id":"x","n":[1,2]}')).toEqual({ ok: true, value: { id: 'x', n: [1, 2] } });
    expect(readSpecInput('null')).toEqual({ ok: true, value: null });
  });

  it('turns text that is not JSON into one issue at path ""', () => {
    expect(readSpecInput('{not json')).toEqual({ ok: false, error: [{ path: '', message: 'The spec is not valid JSON.' }] });
    expect(readSpecInput('')).toEqual({ ok: false, error: [{ path: '', message: 'The spec is not valid JSON.' }] });
  });

  it('passes any other value through', () => {
    for (const value of [null, undefined, 3, true, [1], { a: 1 }]) expect(readSpecInput(value)).toEqual({ ok: true, value });
  });
});

describe('result helpers', () => {
  it('ok carries structured content and one text block', () => {
    expect(ok({ a: 1 }, 'hi')).toEqual({ content: [{ type: 'text', text: 'hi' }], structuredContent: { a: 1 } });
  });

  it('toolError sets isError with one text block', () => {
    expect(toolError('bad')).toEqual({ isError: true, content: [{ type: 'text', text: 'bad' }] });
  });

  it('issueLines writes one path: message line per issue, (spec) for the root', () => {
    expect(
      issueLines([
        { path: 'name', message: 'This is required.' },
        { path: '', message: 'Could not read this spec.' },
      ]),
    ).toBe('name: This is required.\n(spec): Could not read this spec.');
  });
});
