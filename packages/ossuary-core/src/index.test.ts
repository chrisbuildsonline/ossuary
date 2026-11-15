import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as engine from './engine/index';
import * as ics from './ics/index';
import { widgetSpec } from './testing/fixtures';
import * as core from './index';
import * as schema from './schema/index';
import * as store from './store/index';

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

  it('exports the engine API from the root and from ./engine', () => {
    for (const api of [core, engine]) {
      const spec = core.parseBoneSpec(widgetSpec);
      if (!spec.ok) throw new Error('fixture invalid');
      const r = api.evaluate(spec.value, { name: 'Widget', place: 'cold', made: '2026-11-14' }, { day: '2026-11-14' });
      expect(r.ok && r.value.lifespans[0]?.expiresAt).toBe('2026-11-28');
      expect(api.pickPrimary([{ remaining: { days: 3 } }, { remaining: { days: 1 } }])).toBe(1);
      expect(api.toDayNumber('1970-01-02')).toBe(1);
      expect(api.fromDayNumber(0)).toBe('1970-01-01');
      expect(api.isRealDay('2026-02-29')).toBe(false);
      expect(api.parseIsoDay('2026-11-14')).toEqual({ year: 2026, month: 11, day: 14 });
      expect(api.formatIsoDay({ year: 2026, month: 1, day: 2 })).toBe('2026-01-02');
      expect(api.addDuration(0, { amount: 1, unit: 'month' })).toBe(31);
      expect(api.selectStage(spec.value.lifespans[0]?.stages ?? [], -1).tone).toBe('dead');
    }
  });

  it('exports the store API from the root and from ./store', () => {
    for (const api of [core, store] as Record<string, unknown>[]) {
      for (const name of ['openStore', 'parseBackup', 'parseCsv', 'suggestMapping', 'previewCsvImport', 'commitCsvImport', 'dbName']) {
        expect(typeof api[name], name).toBe('function');
      }
      expect(api.BACKUP_FORMAT).toBe('ossuary-backup');
      expect(api.BACKUP_VERSION).toBe(1);
      expect(api.DB_VERSION).toBe(1);
      expect(api.MAX_CSV_ROWS).toBe(10_000);
      expect(api.MAX_CSV_BYTES).toBe(5 * 1024 * 1024);
    }
  });

  it('exports the ICS API from the root and from ./ics', () => {
    for (const api of [core, ics]) {
      const spec = core.parseBoneSpec(widgetSpec);
      if (!spec.ok) throw new Error('fixture invalid');
      const out = api.exportIcs(spec.value, [{ id: 'w1', values: { name: 'Widget', place: 'cold', made: '2026-11-14' } }], { now: { day: '2026-11-14' } });
      expect(out.skipped).toEqual([]);
      expect(out.ics).toContain('BEGIN:VEVENT');
    }
  });

  it('declares the ./engine, ./store and ./ics subpath exports', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { exports: Record<string, string> };
    expect(pkg.exports['./engine']).toBe('./src/engine/index.ts');
    expect(pkg.exports['./store']).toBe('./src/store/index.ts');
    expect(pkg.exports['./ics']).toBe('./src/ics/index.ts');
  });
});
