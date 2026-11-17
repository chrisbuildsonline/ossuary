import { parseBoneSpec } from '@ossuary/core/schema';
import { describe, expect, it } from 'vitest';
import bone from '../bone.json';

describe('bone.json', () => {
  const parsed = parseBoneSpec(bone);
  if (!parsed.ok) throw new Error(`bone.json is invalid: ${JSON.stringify(parsed.error)}`);
  const spec = parsed.value;
  const lifespan = spec.lifespans[0];

  it('parses with the pantry-reaper id and copy', () => {
    expect(parsed.ok).toBe(true);
    expect(spec.id).toBe('pantry-reaper');
    expect(spec.copy).toEqual({ emptyTitle: "Nothing's dying yet.", addLabel: 'Add food' });
  });

  it('declares name, a hidden food_id, storage and bought', () => {
    expect(spec.entity.titleField).toBe('name');
    expect(spec.entity.fields.map((f) => [f.key, f.kind, f.required])).toEqual([
      ['name', 'text', true],
      ['food_id', 'text', true],
      ['storage', 'enum', true],
      ['bought', 'date', true],
    ]);
    const byKey = new Map(spec.entity.fields.map((f) => [f.key, f]));
    expect(byKey.get('food_id')).toMatchObject({ label: 'FoodKeeper entry', hidden: true });
    expect(spec.entity.fields.filter((f) => f.hidden).map((f) => f.key)).toEqual(['food_id']);
    expect(byKey.get('bought')?.label).toBe('Opened or bought');
    const storage = byKey.get('storage');
    expect(storage?.kind === 'enum' ? storage.options.map((o) => o.value) : []).toEqual(['pantry', 'fridge', 'freezer']);
  });

  it('has one best_by lifespan that starts on bought', () => {
    expect(spec.lifespans).toHaveLength(1);
    expect(lifespan).toMatchObject({ id: 'best_by', label: 'Best by', startField: 'bought' });
  });

  it('gives the base a human label, never "Base"', () => {
    const base = lifespan?.base;
    expect(base?.label).toBeTruthy();
    expect(base?.label?.trim().toLowerCase()).not.toBe('base');
  });

  it('has five stages, one per tone, in order', () => {
    expect(lifespan?.stages.map((s) => [s.id, s.label, s.tone, s.enterAtDays])).toEqual([
      ['fresh', 'Fresh', 'fresh', undefined],
      ['steady', 'Keeping well', 'steady', 14],
      ['soon', 'Use soon', 'soon', 3],
      ['urgent', 'Eat today', 'urgent', 0],
      ['spoiled', 'Spoiled', 'dead', undefined],
    ]);
  });

  it('has one lookup rule on storage with a table entry per option and the FoodKeeper source', () => {
    const rules = lifespan?.rules ?? [];
    expect(rules).toHaveLength(1);
    const rule = rules[0];
    expect(rule).toMatchObject({ id: 'storage_life', kind: 'lookup', field: 'storage', label: 'Storage', sourceId: 'usda_foodkeeper' });
    expect(rule?.kind === 'lookup' ? Object.keys(rule.table).sort() : []).toEqual(['freezer', 'fridge', 'pantry']);
  });

  it('declares the USDA FoodKeeper source as public domain over https', () => {
    expect(spec.sources).toHaveLength(1);
    const source = spec.sources?.[0];
    expect(source).toMatchObject({ id: 'usda_foodkeeper', name: 'USDA FoodKeeper' });
    expect(source?.url).toMatch(/^https:\/\//);
    expect(source?.license).toMatch(/public domain/i);
    expect(source?.retrievedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
