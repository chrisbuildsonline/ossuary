import { z } from 'zod';

/** A lowercase identifier such as `made_on`. Used for field keys and ids. */
export const identifier = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/, 'Use a lowercase identifier: a to z, digits and _, starting with a letter.')
  .max(40);

/** A real calendar day as `YYYY-MM-DD` (zod checks month lengths and leap years). */
export const isoDay = z.iso.date({
  error: (iss) => (iss.input === undefined ? 'This is required.' : 'Use a real calendar day as YYYY-MM-DD.'),
});

/** Short visible text such as a label. */
export const text = z.string().min(1).max(80);

/** A reference to another key by name. Checked against the spec after the structural parse. */
export const ref = z.string().min(1).max(40);

/** Adds `Duplicate <what> "<value>".` at each repeat after the first. */
export function checkUnique<T>(
  items: readonly T[],
  get: (item: T) => string,
  what: string,
  ctx: z.RefinementCtx,
  path: (i: number) => PropertyKey[],
): void {
  const seen = new Set<string>();
  items.forEach((item, i) => {
    const value = get(item);
    if (seen.has(value)) ctx.addIssue({ code: 'custom', path: path(i), message: `Duplicate ${what} "${value}".` });
    seen.add(value);
  });
}
