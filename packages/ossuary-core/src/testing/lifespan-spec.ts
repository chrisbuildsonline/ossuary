// Small parsed specs for engine tests. Test support only: not exported from the package.
import { type BoneSpec, parseBoneSpec } from '../schema/bone-spec';

const stages = [
  { id: 'ok', label: 'Fine', tone: 'fresh' },
  { id: 'soon', label: 'Soon', tone: 'soon', enterAtDays: 7 },
  { id: 'urgent', label: 'Urgent', tone: 'urgent', enterAtDays: 2 },
  { id: 'gone', label: 'Gone', tone: 'dead' },
];

const fields = [
  { key: 'name', kind: 'text', label: 'Name', required: true },
  { key: 'start', kind: 'date', label: 'Start', required: true },
  { key: 'ends', kind: 'date', label: 'Ends' },
  { key: 'other', kind: 'date', label: 'Other start' },
  {
    key: 'place',
    kind: 'enum',
    label: 'Place',
    options: [
      { value: 'a', label: 'Shelf A' },
      { value: 'b', label: 'Shelf B' },
    ],
  },
  { key: 'note', kind: 'text', label: 'Note' },
  { key: 'count', kind: 'number', label: 'Count' },
];

/** A valid spec with the given lifespans (each gets `startField: 'start'` and default stages unless set). */
export function specWith(...lifespans: Record<string, unknown>[]): BoneSpec {
  const r = parseBoneSpec({
    id: 'test-spec',
    name: 'Test spec',
    version: 1,
    entity: { titleField: 'name', fields },
    lifespans: lifespans.map((l, i) => ({ id: `l${i}`, label: `Lifespan ${i}`, startField: 'start', stages, ...l })),
    sources: [{ id: 'ref', name: 'Reference Book', url: 'https://example.org/ref', license: 'CC0-1.0' }],
  });
  if (!r.ok) throw new Error(`Test spec is invalid: ${JSON.stringify(r.error)}`);
  return r.value;
}

export const days = (amount: number) => ({ amount, unit: 'day' as const });
export const weeks = (amount: number) => ({ amount, unit: 'week' as const });
export const months = (amount: number) => ({ amount, unit: 'month' as const });
export const years = (amount: number) => ({ amount, unit: 'year' as const });
