import { z } from 'zod';
import { checkUnique, identifier, text } from './common';

export const MAX_FIELDS = 40;

// `hidden`: validated and stored like any field, but the sheet renders no input for it.
const shared = { key: identifier, label: text, required: z.boolean().optional(), hidden: z.boolean().optional() };

const textField = z.object({ ...shared, kind: z.literal('text') }).strict();
const dateField = z.object({ ...shared, kind: z.literal('date') }).strict();

const numberField = z
  .object({
    ...shared,
    kind: z.literal('number'),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
  })
  .strict()
  .superRefine((f, ctx) => {
    if (f.min !== undefined && f.max !== undefined && f.min > f.max) {
      ctx.addIssue({ code: 'custom', path: ['min'], message: `Min (${f.min}) is greater than max (${f.max}).` });
    }
  });

const option = z.object({ value: z.string().min(1).max(80), label: text }).strict();

const enumField = z
  .object({ ...shared, kind: z.literal('enum'), options: z.array(option).min(1).max(100) })
  .strict()
  .superRefine((f, ctx) => checkUnique(f.options, (o) => o.value, 'option', ctx, (i) => ['options', i, 'value']));

export const fieldSchema = z.discriminatedUnion('kind', [textField, dateField, numberField, enumField]);

export const fieldsSchema = z
  .array(fieldSchema)
  .min(1)
  .max(MAX_FIELDS)
  .superRefine((fields, ctx) => checkUnique(fields, (f) => f.key, 'field key', ctx, (i) => [i, 'key']));

export type Field = z.infer<typeof fieldSchema>;
export type FieldKind = Field['kind'];
