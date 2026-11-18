// preview_countdown: evaluate one example item against a spec on a given day. Time comes only from `now`.
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { type Evaluation, type LifespanEvaluation, evaluate } from '@ossuary/core/engine';
import type { Issue, Result } from '@ossuary/core/schema';
import { z } from 'zod';
import { readSpec } from '../input';
import { issueLines, ok, toolError } from '../result';

export const previewCountdownInput = {
  spec: z.union([z.record(z.string(), z.unknown()), z.string()]).describe('A bone spec, as a JSON object or as JSON text.'),
  item: z.record(z.string(), z.union([z.string(), z.number()])).describe('One example item: field key to value. Dates as YYYY-MM-DD.'),
  now: z
    .object({
      day: z.string().describe('The day to evaluate on, YYYY-MM-DD.'),
      minuteOfDay: z.number().int().min(0).max(1439).optional().describe('Minute of that day, 0 to 1439.'),
    })
    .describe('The local wall clock to evaluate at.'),
};

export interface PreviewInput {
  spec: unknown;
  item: unknown;
  now: unknown;
}

export function previewCountdown({ spec, item, now }: PreviewInput): Result<Evaluation, Issue[]> {
  const parsed = readSpec(spec);
  if (!parsed.ok) return parsed;
  return evaluate(parsed.value, item, now as never);
}

const lifespanOutput = z.object({
  lifespanId: z.string(),
  label: z.string(),
  startedAt: z.string(),
  expiresAt: z.string(),
  remaining: z.object({ days: z.number().int(), hours: z.number().int().optional() }),
  fraction: z.number(),
  stage: z.object({ id: z.string(), label: z.string(), tone: z.string(), index: z.number().int() }),
  trace: z.array(
    z.object({
      ruleId: z.string(),
      kind: z.string(),
      text: z.string(),
      deltaDays: z.number().int(),
      changed: z.boolean(),
      sourceId: z.string().optional(),
    }),
  ),
});

export const previewCountdownOutput = { lifespans: z.array(lifespanOutput), primaryIndex: z.number().int() };

const days = (n: number) => (n === 1 ? '1 day' : `${n} days`);

/** `Cover ends 2027-03-01, 108 days left, Steady (primary)`. */
function line(l: LifespanEvaluation, primary: boolean): string {
  const { days: d, hours } = l.remaining;
  let when: string;
  if (d < 0) when = `${l.label} ended ${l.expiresAt}, ${days(-d)} ago`;
  else if (d > 0) when = `${l.label} ends ${l.expiresAt}, ${days(d)} left`;
  else when = `${l.label} ends ${l.expiresAt}, ${hours === undefined ? 'today' : `${hours} hour${hours === 1 ? '' : 's'} left`}`;
  return `${when}, ${l.stage.label}${primary ? ' (primary)' : ''}`;
}

export function previewCountdownTool(input: PreviewInput): CallToolResult {
  const r = previewCountdown(input);
  if (!r.ok) return toolError(issueLines(r.error));
  const text = r.value.lifespans.map((l, i) => line(l, i === r.value.primaryIndex)).join('\n');
  return ok({ ...r.value }, text);
}
