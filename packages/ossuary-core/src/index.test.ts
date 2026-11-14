import { describe, expect, it } from 'vitest';
import { widgetSpec } from './testing/fixtures';
import * as core from './index';
import * as schema from './schema/index';

describe('ossuary-core', () => {
  it('exports its name', () => {
    expect(core.coreName).toBe('ossuary-core');
  });

  it('exports the schema API from the root and from ./schema', () => {
    for (const api of [core, schema]) {
      expect(api.parseBoneSpec(widgetSpec).ok).toBe(true);
      expect(typeof api.validateItem).toBe('function');
      expect(typeof api.buildItemSchema).toBe('function');
      expect(typeof api.formatIssues).toBe('function');
      expect(api.contrastRatio('#000000', '#ffffff')).toBe(21);
      expect(api.relativeLuminance('#ffffff')).toBe(1);
      expect(api.boneSpecJsonSchema).toHaveProperty('title', 'Ossuary bone spec');
      expect(api.tones).toEqual(['fresh', 'steady', 'soon', 'urgent', 'dead']);
      expect(api.MAX_ISSUES).toBe(50);
    }
  });
});
