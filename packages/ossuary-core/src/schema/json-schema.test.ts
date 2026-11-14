import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { boneSpecJsonSchema } from './json-schema';

const checkedIn = new URL('../../bone-spec.schema.json', import.meta.url);

describe('boneSpecJsonSchema', () => {
  it('matches the checked-in bone-spec.schema.json (run `bun run schema` in packages/ossuary-core to update)', () => {
    expect(JSON.parse(readFileSync(checkedIn, 'utf8'))).toEqual(boneSpecJsonSchema);
  });

  it('describes the structure and says the cross-field checks are not in it', () => {
    const schema = boneSpecJsonSchema as {
      title: string;
      description: string;
      additionalProperties: boolean;
      required: string[];
      properties: { lifespans: { minItems: number; maxItems: number } };
    };
    expect(schema.title).toBe('Ossuary bone spec');
    expect(schema.description).toMatch(/structure only/i);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(['id', 'name', 'version', 'entity', 'lifespans']);
    expect(schema.properties.lifespans).toMatchObject({ minItems: 1, maxItems: 4 });
  });
});
