import { z } from 'zod';
import { checkUnique, identifier, isoDay, ref, text } from './common';
import { type FieldKind, fieldsSchema } from './fields';
import { type Result, parseWith } from './issues';
import { lifespansSchema } from './lifespans';
import { MAX_RULES } from './rules';
import { themeSchema } from './theme';

const sourceSchema = z
  .object({
    id: identifier,
    name: text,
    url: z.url({
      protocol: /^https$/,
      hostname: z.regexes.domain,
      error: (iss) => (iss.input === undefined ? 'This is required.' : 'Use an https:// address.'),
    }),
    license: text,
    retrievedOn: isoDay.optional(),
  })
  .strict();

const sourcesSchema = z
  .array(sourceSchema)
  .max(20)
  .superRefine((sources, ctx) => checkUnique(sources, (s) => s.id, 'source id', ctx, (i) => [i, 'id']));

const entitySchema = z
  .object({ titleField: ref, summaryFields: z.array(ref).max(3).optional(), fields: fieldsSchema })
  .strict();

const copySchema = z.object({ emptyTitle: text.optional(), emptyBody: text.optional(), addLabel: text.optional() }).strict();

const kindNeeds = { date: 'a date field', number: 'a number field', lookup: 'an enum or text field' } as const;

export const boneSpecSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z][a-z0-9-]*$/, 'Use a lowercase id: a to z, digits and -, starting with a letter.')
      .max(40),
    name: text,
    version: z.number().int().min(1),
    entity: entitySchema,
    lifespans: lifespansSchema,
    theme: themeSchema.optional(),
    copy: copySchema.optional(),
    sources: sourcesSchema.optional(),
  })
  .strict()
  // Cross-references. Zod runs this only once the structure has parsed, so every value has its declared type.
  .superRefine((spec, ctx) => {
    const issue = (path: PropertyKey[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const fields = new Map(spec.entity.fields.map((f) => [f.key, f]));
    const sources = new Set((spec.sources ?? []).map((s) => s.id));

    const field = (key: string, path: PropertyKey[], needs?: keyof typeof kindNeeds) => {
      const f = fields.get(key);
      if (!f) return issue(path, `No field named "${key}".`);
      const allowed: FieldKind[] = needs === 'lookup' ? ['enum', 'text'] : needs ? [needs] : [f.kind];
      if (needs && !allowed.includes(f.kind)) return issue(path, `Field "${key}" is ${f.kind}; it must be ${kindNeeds[needs]}.`);
      return f;
    };
    const source = (id: string | undefined, path: PropertyKey[]) => {
      if (id !== undefined && !sources.has(id)) issue(path, `No source named "${id}".`);
    };

    field(spec.entity.titleField, ['entity', 'titleField']);
    spec.entity.summaryFields?.forEach((key, i) => field(key, ['entity', 'summaryFields', i]));

    let total = 0;
    spec.lifespans.forEach((lifespan, li) => {
      const at = (...path: PropertyKey[]) => ['lifespans', li, ...path];
      field(lifespan.startField, at('startField'), 'date');
      if (lifespan.base.type === 'field') field(lifespan.base.field, at('base', 'field'), 'date');
      if (lifespan.base.type === 'duration' && lifespan.base.amountField !== undefined) {
        field(lifespan.base.amountField, at('base', 'amountField'), 'number');
      }
      source(lifespan.base.sourceId, at('base', 'sourceId'));

      (lifespan.rules ?? []).forEach((rule, ri) => {
        total += 1;
        if (total === MAX_RULES + 1) issue(at('rules', ri), `A spec can have at most ${MAX_RULES} rules in total.`);
        source(rule.sourceId, at('rules', ri, 'sourceId'));
        if (rule.kind !== 'lookup') {
          if (rule.when) field(rule.when.field, at('rules', ri, 'when', 'field'));
          return;
        }
        const f = field(rule.field, at('rules', ri, 'field'), 'lookup');
        if (f?.kind !== 'enum') return;
        const options = f.options.map((o) => o.value);
        for (const key of Object.keys(rule.table)) {
          if (!options.includes(key)) issue(at('rules', ri, 'table', key), `"${key}" is not an option of field "${f.key}".`);
        }
        if (rule.default) return;
        for (const option of options) {
          if (!Object.hasOwn(rule.table, option)) {
            issue(at('rules', ri, 'table'), `Option "${option}" of field "${f.key}" has no table entry and there is no default.`);
          }
        }
      });
    });
  });

export type BoneSpec = z.infer<typeof boneSpecSchema>;
export type Source = z.infer<typeof sourceSchema>;

/** Parses a candidate bone spec. Never throws. */
export function parseBoneSpec(input: unknown): Result<BoneSpec> {
  return parseWith(boneSpecSchema, input, 'Could not read this spec.');
}
