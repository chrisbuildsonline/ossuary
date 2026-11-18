// A spec arrives as a JSON value or as JSON text. Never throws, never changes its argument.
import type { Result } from '@ossuary/core/schema';

export function readSpecInput(value: unknown): Result<unknown> {
  if (typeof value !== 'string') return { ok: true, value };
  try {
    return { ok: true, value: JSON.parse(value) as unknown };
  } catch {
    return { ok: false, error: [{ path: '', message: 'The spec is not valid JSON.' }] };
  }
}
