import { z } from 'zod';
import type { BoneSpec } from './bone-spec';
import { isoDay } from './common';
import type { Field } from './fields';
import { type Result, parseWith } from './issues';

/** One user record: field key to value. Dates are ISO days. */
export type Item = Record<string, string | number | undefined>;

function valueSchema(field: Field): z.ZodType<string | number> {
  switch (field.kind) {
    case 'text':
      return field.required ? z.string().min(1, 'This is required.') : z.string();
    case 'date':
      return isoDay;
    case 'enum':
      return z.enum(field.options.map((o) => o.value) as [string, ...string[]]);
    case 'number': {
      let n = z.number();
      if (field.min !== undefined) n = n.min(field.min);
      if (field.max !== undefined) n = n.max(field.max);
      return n;
    }
  }
}

/** A zod schema for items of this spec. Keys that are not fields are dropped. */
export function buildItemSchema(spec: BoneSpec): z.ZodType<Item> {
  const shape = Object.fromEntries(
    spec.entity.fields.map((f) => [f.key, f.required ? valueSchema(f) : valueSchema(f).optional()]),
  );
  return z.object(shape) as z.ZodType<Item>;
}

/** Validates one item against the spec's fields. Never throws. */
export function validateItem(spec: BoneSpec, input: unknown): Result<Item> {
  return parseWith(buildItemSchema(spec), input, 'Could not read this item.');
}
