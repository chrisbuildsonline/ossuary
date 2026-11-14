import type { z } from 'zod';

export type IsoDay = string;
export interface Issue {
  path: string;
  message: string;
}
export type Result<T, E = Issue[]> = { ok: true; value: T } | { ok: false; error: E };

export const MAX_ISSUES = 50;

const nouns: Record<string, string> = {
  string: 'text',
  number: 'a number',
  int: 'a whole number',
  boolean: 'true or false',
  object: 'an object',
  record: 'an object',
  array: 'a list',
};

const plural = (n: number | bigint, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function sizeMessage(bound: 'least' | 'most', origin: string, limit: number | bigint): string {
  if (origin === 'array' || origin === 'set') return `Must have at ${bound} ${plural(limit, 'item')}.`;
  if (origin === 'string') return bound === 'least' && limit === 1 ? 'Must not be empty.' : `Must be at ${bound} ${plural(limit, 'character')}.`;
  return `Must be at ${bound} ${limit}.`;
}

const plainError: z.core.$ZodErrorMap = (iss) => {
  switch (iss.code) {
    case 'invalid_type':
      return iss.input === undefined ? 'This is required.' : `Expected ${nouns[iss.expected] ?? iss.expected}.`;
    case 'too_small':
      return iss.inclusive === false ? `Must be more than ${iss.minimum}.` : sizeMessage('least', iss.origin, iss.minimum);
    case 'too_big':
      return iss.inclusive === false ? `Must be less than ${iss.maximum}.` : sizeMessage('most', iss.origin, iss.maximum);
    case 'invalid_value':
      return iss.values.length === 1 ? `Expected ${JSON.stringify(iss.values[0])}.` : `Expected one of: ${iss.values.join(', ')}.`;
    case 'invalid_union': {
      const options = (iss as { options?: unknown[] }).options;
      return options ? `Expected one of: ${options.join(', ')}.` : 'Does not match any allowed shape.';
    }
    case 'not_multiple_of':
      return `Must be a multiple of ${iss.divisor}.`;
    case 'invalid_format':
      return 'Has the wrong format.';
    default:
      return 'Invalid value.';
  }
};

const identifier = /^[A-Za-z_$][\w$]*$/;

function formatPath(path: readonly PropertyKey[]): string {
  return path
    .map((key, i) => {
      if (typeof key === 'number') return `[${key}]`;
      const name = String(key);
      if (!identifier.test(name)) return `[${JSON.stringify(name)}]`;
      return i === 0 ? name : `.${name}`;
    })
    .join('');
}

export function formatIssues(err: z.ZodError): Issue[] {
  return err.issues
    .flatMap((issue) =>
      issue.code === 'unrecognized_keys'
        ? issue.keys.map((key) => ({ path: formatPath([...issue.path, key]), message: `Unknown key "${key}".` }))
        : [{ path: formatPath(issue.path), message: issue.message }],
    )
    .slice(0, MAX_ISSUES);
}

export function parseWith<T>(schema: z.ZodType<T>, input: unknown, failure = 'Could not read this value.'): Result<T> {
  try {
    const r = schema.safeParse(input, { error: plainError });
    return r.success ? { ok: true, value: r.data } : { ok: false, error: formatIssues(r.error) };
  } catch {
    return { ok: false, error: [{ path: '', message: failure }] };
  }
}
