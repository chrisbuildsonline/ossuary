import { z } from 'zod';
import { checkUnique, identifier, ref, text } from './common';
import { durationSchema, rulesSchema } from './rules';
import { stagesSchema } from './stages';

export const MAX_LIFESPANS = 4;

const baseShared = { label: text.optional(), sourceId: ref.optional() };

export const baseSchema = z.discriminatedUnion('type', [
  z.object({ ...baseShared, type: z.literal('duration'), ...durationSchema.shape, amountField: ref.optional() }).strict(),
  z.object({ ...baseShared, type: z.literal('field'), field: ref }).strict(),
]);

export const lifespanSchema = z
  .object({
    id: identifier,
    label: text,
    startField: ref,
    base: baseSchema,
    rules: rulesSchema.optional(),
    stages: stagesSchema,
  })
  .strict()
  .superRefine((l, ctx) => checkUnique(l.rules ?? [], (r) => r.id, 'rule id', ctx, (i) => ['rules', i, 'id']));

export const lifespansSchema = z
  .array(lifespanSchema)
  .min(1)
  .max(MAX_LIFESPANS)
  .superRefine((ls, ctx) => checkUnique(ls, (l) => l.id, 'lifespan id', ctx, (i) => [i, 'id']));

export type Base = z.infer<typeof baseSchema>;
export type Lifespan = z.infer<typeof lifespanSchema>;
