import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkSpecs, findSpecs } from '../../../../scripts/check-specs';
import { oneSpec, twoSpec } from '../fixtures';
import { tmpRoot } from '../test-tmp';
import { scaffoldApp } from '../tools/scaffold-app';

// The same list scripts/check-boundary.ts keeps out of the core.
const domainWords = ['food', 'grocery', 'pantry', 'warranty', 'recall', 'usda', 'receipt', 'kettle'];

describe('a scaffolded app', () => {
  it('has a bone.json that passes the hook:spec check', () => {
    const root = tmpRoot();
    expect(scaffoldApp(root, { spec: oneSpec }).ok).toBe(true);
    expect(scaffoldApp(root, { spec: twoSpec }).ok).toBe(true);
    const specs = findSpecs(root);
    expect(specs).toEqual([join(root, 'apps', 'test-bone', 'bone.json'), join(root, 'apps', 'test-two', 'bone.json')]);
    expect(checkSpecs(specs)).toEqual([]);
  });

  it('holds no banned domain word in any generated file', () => {
    const root = tmpRoot();
    const r = scaffoldApp(root, { spec: twoSpec });
    if (!r.ok) throw new Error(r.error);
    expect(r.value.files.length).toBe(11);
    for (const file of r.value.files) {
      const text = readFileSync(join(root, file), 'utf8').toLowerCase();
      for (const word of domainWords) expect(text.includes(word), `${file} mentions ${word}`).toBe(false);
    }
    expect(readdirSync(join(root, 'apps'))).toEqual(['test-two']);
  });
});
