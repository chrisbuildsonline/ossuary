// A spec arrives as a JSON value or as JSON text. Never throws, never changes its argument.
import { type BoneSpec, type Result, parseBoneSpec } from '@ossuary/core/schema';

/** readSpecInput, then parseBoneSpec. */
export function readSpec(value: unknown): Result<BoneSpec> {
  const input = readSpecInput(value);
  return input.ok ? parseBoneSpec(input.value) : input;
}

export function readSpecInput(value: unknown): Result<unknown> {
  if (typeof value !== 'string') return { ok: true, value };
  try {
    return { ok: true, value: JSON.parse(value) as unknown };
  } catch {
    return { ok: false, error: [{ path: '', message: 'The spec is not valid JSON.' }] };
  }
}
