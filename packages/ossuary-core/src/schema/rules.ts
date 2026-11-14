import { z } from 'zod';
import { identifier, ref, text } from './common';

export const MAX_RULES = 50;
export const units = ['day', 'week', 'month', 'year'] as const;

const amount = z.number().int().min(0).max(9999);

export const durationSchema = z.object({ amount, unit: z.enum(units) }).strict();
const positiveDuration = z.object({ amount: amount.min(1), unit: z.enum(units) }).strict();

const equals = z.union([z.string(), z.number()], {
  error: (iss) => (iss.input === undefined ? 'This is required.' : 'Expected text or a number.'),
});

export const condSchema = z.object({ field: ref, equals }).strict();

const shared = { id: identifier, label: text.optional(), sourceId: ref.optional() };

const extendRule = z.object({ ...shared, kind: z.literal('extend'), by: positiveDuration, when: condSchema.optional() }).strict();
const shortenRule = z.object({ ...shared, kind: z.literal('shorten'), by: positiveDuration, when: condSchema.optional() }).strict();

/** Average length in days, only used to compare two durations of different units. */
const averageDays = { day: 1, week: 7, month: 30.436875, year: 365.2425 } as const;
const daysOf = (d: Duration) => d.amount * averageDays[d.unit];

export const formatDuration = (d: Duration) => `${d.amount} ${d.unit}${d.amount === 1 ? '' : 's'}`;

const clampRule = z
  .object({ ...shared, kind: z.literal('clamp'), min: durationSchema.optional(), max: durationSchema.optional(), when: condSchema.optional() })
  .strict()
  .superRefine((r, ctx) => {
    if (!r.min && !r.max) ctx.addIssue({ code: 'custom', path: [], message: 'A clamp needs min, max or both.' });
    if (r.min && r.max && daysOf(r.min) > daysOf(r.max)) {
      ctx.addIssue({ code: 'custom', path: [], message: `Min (${formatDuration(r.min)}) is longer than max (${formatDuration(r.max)}).` });
    }
  });

const lookupRule = z
  .object({
    ...shared,
    kind: z.literal('lookup'),
    field: ref,
    table: z.record(z.string(), durationSchema),
    default: durationSchema.optional(),
  })
  .strict();

export const ruleSchema = z.discriminatedUnion('kind', [extendRule, shortenRule, clampRule, lookupRule]);
export const rulesSchema = z.array(ruleSchema).max(MAX_RULES);

export type Unit = (typeof units)[number];
export type Duration = z.infer<typeof durationSchema>;
export type Cond = z.infer<typeof condSchema>;
export type Rule = z.infer<typeof ruleSchema>;
export type RuleKind = Rule['kind'];
