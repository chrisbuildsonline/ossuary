import { evaluate } from '@ossuary/core/engine';
import { type BoneSpec, parseBoneSpec } from '@ossuary/core/schema';
import { describe, expect, it } from 'vitest';
import bone from '../bone.json';
import type { Food } from './data/foodkeeper';
import { boneSpec, nowFromClock, specForFood } from './spec';

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

  it('uses the warm theme from DESIGN.md section 4, and nothing else', () => {
    // The raw JSON, so a key the schema would strip still fails here.
    expect(bone.theme).toStrictEqual({
      accent: '#b8460e',
      accentInk: '#9a3a0b',
      accentTint: '#fbe9dc',
      canvas: '#f2efea',
      display: 'fraunces',
      motif: 'candle',
      emptyArt: 'candle-jar-moon',
      wordmark: 'Pantry Reaper',
    });
    expect(spec.theme).toEqual(bone.theme);
  });

  it('keeps the theme within the contrast and canvas rules', () => {
    expect(parseBoneSpec({ ...bone, theme: { ...bone.theme, accent: '#f2a65a' } }).ok).toBe(false);
    expect(parseBoneSpec({ ...bone, theme: { ...bone.theme, canvas: '#ffffff' } }).ok).toBe(false);
    expect(parseBoneSpec(bone).ok).toBe(true);
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

const storageOptions = (spec: BoneSpec) => {
  const field = spec.entity.fields.find((f) => f.key === 'storage');
  return field?.kind === 'enum' ? field.options.map((o) => o.value) : [];
};
const storageTable = (spec: BoneSpec) => {
  const rule = spec.lifespans[0]?.rules?.find((r) => r.id === 'storage_life');
  return rule?.kind === 'lookup' ? rule.table : undefined;
};

/** The derived spec with its two allowed differences put back to the bone.json values. */
function withoutFoodParts(spec: BoneSpec): BoneSpec {
  const copy = structuredClone(spec);
  const field = copy.entity.fields.find((f) => f.key === 'storage');
  const original = boneSpec.entity.fields.find((f) => f.key === 'storage');
  if (field?.kind === 'enum' && original?.kind === 'enum') field.options = structuredClone(original.options);
  const rule = copy.lifespans[0]?.rules?.find((r) => r.id === 'storage_life');
  const table = storageTable(boneSpec);
  if (rule?.kind === 'lookup' && table) rule.table = structuredClone(table);
  return copy;
}

const yogurt: Food = { id: 'fixture-yogurt', name: 'Yogurt', days: { fridge: 7, freezer: 30 } };
const bread: Food = { id: 'fixture-bread', name: 'Bread, homemade', days: { pantry: 3, fridge: 60 } };

describe('boneSpec', () => {
  it('is bone.json parsed', () => {
    const r = parseBoneSpec(bone);
    expect(r.ok && r.value).toEqual(boneSpec);
  });
});

describe('specForFood', () => {
  it('differs from bone.json only in the storage table and the storage options', () => {
    const before = structuredClone(boneSpec);
    const spec = specForFood(yogurt);
    expect(spec).not.toEqual(boneSpec);
    expect(withoutFoodParts(spec)).toEqual(boneSpec);
    expect(storageOptions(spec)).toEqual(['fridge', 'freezer']);
    expect(storageTable(spec)).toEqual({ fridge: { amount: 7, unit: 'day' }, freezer: { amount: 30, unit: 'day' } });
    expect(boneSpec).toEqual(before);
  });

  it('offers no freezer for a food without a freezer value', () => {
    const spec = specForFood(bread);
    expect(storageOptions(spec)).toEqual(['pantry', 'fridge']);
    expect(Object.keys(storageTable(spec) ?? {}).sort()).toEqual(['fridge', 'pantry']);
    expect(parseBoneSpec(spec).ok).toBe(true);
  });

  it('returns the same spec for the same food', () => {
    expect(specForFood(yogurt)).toBe(specForFood(yogurt));
  });

  it('throws for a food with no storage method', () => {
    expect(() => specForFood({ id: 'fixture-none', name: 'Nothing', days: {} })).toThrow(/Nothing/);
  });

  it('gives the expected expiry for fridge and freezer, with a trace line naming Storage, the method and USDA FoodKeeper', () => {
    const now = nowFromClock(new Date(2026, 10, 17, 9, 30));
    const spec = specForFood(yogurt);
    const at = (storage: string) => {
      const r = evaluate(spec, { name: 'Yogurt', food_id: yogurt.id, storage, bought: '2026-11-17' }, now);
      if (!r.ok) throw new Error(JSON.stringify(r.error));
      return r.value.lifespans[0];
    };
    const fridge = at('fridge');
    const freezer = at('freezer');
    expect(fridge?.expiresAt).toBe('2026-11-24');
    expect(freezer?.expiresAt).toBe('2026-12-17');
    const line = freezer?.trace.find((t) => t.ruleId === 'storage_life');
    expect(line?.text).toContain('Storage');
    expect(line?.text).toContain('Freezer');
    expect(line?.text).toContain('30 days');
    expect(line?.text).toContain('USDA FoodKeeper');
    expect(freezer?.trace[0]?.text).not.toMatch(/Base: Base/);
  });

  describe('after-opening fridge', () => {
    const soyMilk: Food = { id: 'fixture-soy', name: 'Soy milk', days: { fridge: 7 }, afterOpening: true };
    const label = (spec: BoneSpec, value: string) => {
      const field = spec.entity.fields.find((f) => f.key === 'storage');
      return field?.kind === 'enum' ? field.options.find((o) => o.value === value)?.label : undefined;
    };

    it('labels the fridge option "Fridge (after opening)", and other foods keep "Fridge"', () => {
      expect(label(specForFood(soyMilk), 'fridge')).toBe('Fridge (after opening)');
      expect(label(specForFood(yogurt), 'fridge')).toBe('Fridge');
      expect(label(specForFood(bread), 'fridge')).toBe('Fridge');
    });

    it('still differs from bone.json only in the storage table and the storage options', () => {
      expect(withoutFoodParts(specForFood(soyMilk))).toEqual(boneSpec);
    });

    it('names the after-opening fridge in the trace with Storage and USDA FoodKeeper', () => {
      const r = evaluate(specForFood(soyMilk), { name: 'Soy milk', food_id: soyMilk.id, storage: 'fridge', bought: '2026-11-17' }, { day: '2026-11-17' });
      if (!r.ok) throw new Error(JSON.stringify(r.error));
      const line = r.value.lifespans[0]?.trace.find((t) => t.ruleId === 'storage_life');
      expect(line?.text).toContain('Storage');
      expect(line?.text).toContain('Fridge (after opening)');
      expect(line?.text).toContain('USDA FoodKeeper');
      expect(r.value.lifespans[0]?.expiresAt).toBe('2026-11-24');
    });
  });

  it('rejects a method the food does not have', () => {
    const r = evaluate(specForFood(bread), { name: 'Bread', food_id: bread.id, storage: 'freezer', bought: '2026-11-17' }, { day: '2026-11-17' });
    expect(r.ok).toBe(false);
  });
});

describe('nowFromClock', () => {
  it('reads the local day and minute of the day', () => {
    expect(nowFromClock(new Date(2026, 10, 17, 9, 30))).toEqual({ day: '2026-11-17', minuteOfDay: 570 });
    expect(nowFromClock(new Date(2026, 0, 1, 0, 0))).toEqual({ day: '2026-01-01', minuteOfDay: 0 });
    expect(nowFromClock(new Date(2026, 11, 31, 23, 59, 59))).toEqual({ day: '2026-12-31', minuteOfDay: 1439 });
  });
});
