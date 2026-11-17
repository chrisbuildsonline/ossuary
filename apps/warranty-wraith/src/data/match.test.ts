import { describe, expect, it } from 'vitest';
import type { Recall } from './cpsc';
import { matchRecalls } from './match';
import recallsJson from './recalls.json';

const recall = (over: Partial<Recall> & { id: string }): Recall => ({
  date: '2024-01-01',
  title: `Recall ${over.id}`,
  hazard: 'Fall',
  url: `https://www.cpsc.gov/Recalls/2024/${over.id}`,
  names: [],
  brands: [],
  models: [],
  ...over,
});

// 80 unrelated recalls, so a word in one recall's names is below the 2% generic threshold.
const filler = Array.from({ length: 80 }, (_, i) => recall({ id: `f-${i}`, names: [`Gizmo q${i}x`], brands: [`Maker q${i}y`] }));
const heaters = Array.from({ length: 5 }, (_, i) => recall({ id: `h-${i}`, names: ['Space Heater'], brands: [`Warmco q${i}z`] }));
const kettle = recall({ id: '24-117', date: '2024-05-01', names: ['K2 Electric Kettle'], brands: ['Acme Inc.'], models: ['K2100'], hazard: 'Burn' });
const sleeper = recall({ id: '19-105', date: '2019-04-12', names: ["Rock 'n Play Sleeper"], brands: ['Fisher-Price'], models: ['CHP55', 'FJL33'] });
const base: Recall[] = [kettle, sleeper, ...heaters, ...filler];

const ids = (item: { name: string; model?: string }, recalls: readonly Recall[] = base) => matchRecalls(item, recalls).map((m) => m.recall.id);

describe('matchRecalls', () => {
  it('matches an item with brand and model to its recall', () => {
    const [hit, ...rest] = matchRecalls({ name: 'Acme K2 kettle', model: 'K2-100' }, base);
    expect(rest).toEqual([]);
    expect(hit?.recall).toBe(kettle);
    expect(hit?.reasons).toEqual(['model', 'brand', 'name']);
    expect(hit?.score).toBe(3 + 2 + 1);
  });

  it('matches two distinctive product-name tokens without a brand', () => {
    expect(ids({ name: 'Rock n Play sleeper' })).toEqual(['19-105']);
  });

  it('ignores accents, case, punctuation and token order', () => {
    expect(ids({ name: 'SLEEPER, Plày — Röck!' })).toEqual(['19-105']);
    expect(ids({ name: 'acme ELECTRIC kettle' })).toEqual(['24-117']);
  });

  it.each(['Heater', 'The kettle', 'Acme', 'Fisher-Price', 'Space heater', 'Kettle for the kitchen'])('matches nothing for "%s"', (name) => {
    expect(ids({ name })).toEqual([]);
  });

  it('matches nothing on a lone model, or a model that is too short or has no digit', () => {
    expect(ids({ name: 'Thing', model: 'K2100' })).toEqual([]);
    expect(ids({ name: 'Acme kettle', model: 'K21' })).toEqual(['24-117']);
    expect(matchRecalls({ name: 'Acme kettle', model: 'K21' }, base)[0]?.reasons).toEqual(['brand', 'name']);
    const noDigit = recall({ id: 'nd', names: ['Lamp'], brands: ['Lumo'], models: ['ABCD'] });
    expect(matchRecalls({ name: 'Thing lamp', model: 'abcd' }, [noDigit, ...filler])).toEqual([]);
  });

  it('needs a name hit beside a brand hit', () => {
    expect(ids({ name: 'Acme toaster' })).toEqual([]);
    expect(ids({ name: 'Acme toaster', model: 'K2100' })).toEqual(['24-117']);
  });

  it('returns at most 5, ranked by score, then newer day, then id', () => {
    const many = [
      recall({ id: 'a-1', date: '2020-01-01', names: ['Pressure Cooker'], brands: ['Brava'] }),
      recall({ id: 'a-2', date: '2023-01-01', names: ['Pressure Cooker'], brands: ['Brava'] }),
      recall({ id: 'a-4', date: '2022-01-01', names: ['Pressure Cooker'], brands: ['Brava'] }),
      recall({ id: 'a-3', date: '2022-01-01', names: ['Pressure Cooker'], brands: ['Brava'] }),
      recall({ id: 'a-5', date: '2021-01-01', names: ['Pressure Cooker'], brands: ['Brava'] }),
      recall({ id: 'a-6', date: '2019-01-01', names: ['Pressure Cooker'], brands: ['Brava'], models: ['PC900'] }),
      recall({ id: 'a-7', date: '2018-01-01', names: ['Pressure Cooker'], brands: ['Brava'] }),
      ...Array.from({ length: 400 }, (_, i) => recall({ id: `g-${i}`, names: [`Gadget q${i}w`] })),
    ];
    const result = matchRecalls({ name: 'Brava pressure cooker', model: 'PC-900' }, many);
    expect(result.map((m) => m.recall.id)).toEqual(['a-6', 'a-2', 'a-3', 'a-4', 'a-5']);
    for (let i = 1; i < result.length; i++) expect(result[i - 1]!.score).toBeGreaterThanOrEqual(result[i]!.score);
  });

  it('computes generic tokens from the recalls it is given', () => {
    const baby = recall({ id: 'b-1', names: ['Baby Sleeper'], brands: ['Nod'] });
    expect(ids({ name: 'baby sleeper' }, [baby, ...filler])).toEqual(['b-1']);
    const babyGoods = Array.from({ length: 10 }, (_, i) => recall({ id: `bg-${i}`, names: [`Baby q${i}v`] }));
    // "baby" is now in the names of more than 2% of the recalls, so one distinctive token is left.
    expect(ids({ name: 'baby sleeper' }, [baby, ...babyGoods, ...filler])).toEqual([]);
    expect(ids({ name: 'Nod baby sleeper' }, [baby, ...babyGoods, ...filler])).toEqual(['b-1']);
  });

  it('returns nothing for an empty list or an empty name', () => {
    expect(matchRecalls({ name: 'Acme kettle' }, [])).toEqual([]);
    expect(matchRecalls({ name: '', model: 'K2100' }, base)).toEqual([]);
  });
});

describe('matchRecalls on the committed recalls.json', () => {
  const recalls = recallsJson as Recall[];
  const generic = [
    'Kettle', 'Heater', 'Toaster', 'Crib', 'Stroller', 'Blender', 'Lamp', 'Dresser', 'Bicycle', 'Helmet',
    'Charger', 'Television', 'Microwave', 'Refrigerator', 'Dishwasher', 'Vacuum', 'Laptop', 'Headphones', 'The jacket', 'A toy',
  ];

  it.each(generic)('matches nothing for the generic purchase "%s"', (name) => {
    expect(matchRecalls({ name }, recalls)).toEqual([]);
  });
});
