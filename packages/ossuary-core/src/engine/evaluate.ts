// evaluate(spec, item, now): pure. Time enters only through `now`; all arithmetic is on integer day numbers.
import type { BoneSpec } from '../schema/bone-spec';
import type { Issue, IsoDay, Result } from '../schema/issues';
import { type Item, validateItem } from '../schema/item';
import { fromDayNumber, isRealDay, toDayNumber } from './iso-day';
import { pickPrimary } from './primary';
import { runLifespan, valueOf } from './rules';
import { type Remaining, type StageRef, fractionOf, remainingOf, selectStage } from './stage';
import { type TraceLine, traceLines } from './trace';

/** The caller's local wall clock: an ISO day and an optional minute of that day (0 to 1439). */
export interface Now {
  day: IsoDay;
  minuteOfDay?: number;
}

export interface LifespanEvaluation {
  lifespanId: string;
  label: string;
  startedAt: IsoDay;
  expiresAt: IsoDay;
  remaining: Remaining;
  fraction: number;
  stage: StageRef;
  trace: TraceLine[];
}

export interface Evaluation {
  lifespans: LifespanEvaluation[]; // one per spec lifespan, declared order
  primaryIndex: number;
}

function checkNow(now: unknown): Issue[] {
  if (typeof now !== 'object' || now === null) return [{ path: 'now', message: 'Expected an object with a day.' }];
  const { day, minuteOfDay } = now as Record<string, unknown>;
  const issues: Issue[] = [];
  if (typeof day !== 'string' || !isRealDay(day)) issues.push({ path: 'now.day', message: 'Use a real calendar day as YYYY-MM-DD.' });
  if (minuteOfDay !== undefined && !(Number.isInteger(minuteOfDay) && (minuteOfDay as number) >= 0 && (minuteOfDay as number) <= 1439)) {
    issues.push({ path: 'now.minuteOfDay', message: 'Use a whole number of minutes from 0 to 1439.' });
  }
  return issues;
}

/** Every lifespan needs its start day, and its end day when the base is a date field, even if the field is optional. */
function checkLifespanDays(spec: BoneSpec, item: Item): Issue[] {
  const missing = new Set<string>();
  for (const lifespan of spec.lifespans) {
    const keys = lifespan.base.type === 'field' ? [lifespan.startField, lifespan.base.field] : [lifespan.startField];
    for (const key of keys) if (valueOf(item, key) === undefined) missing.add(key);
  }
  return [...missing].map((path) => ({ path, message: 'This is required.' }));
}

export function evaluate(spec: BoneSpec, item: unknown, now: Now): Result<Evaluation> {
  const nowIssues = checkNow(now);
  if (nowIssues.length > 0) return { ok: false, error: nowIssues };
  const valid = validateItem(spec, item);
  if (!valid.ok) return valid;
  const dayIssues = checkLifespanDays(spec, valid.value);
  if (dayIssues.length > 0) return { ok: false, error: dayIssues };

  const nowDay = toDayNumber(now.day);
  const lifespans = spec.lifespans.map((lifespan): LifespanEvaluation => {
    const { start, expiry, steps } = runLifespan(lifespan, valid.value);
    const remaining = remainingOf(expiry, nowDay, now.minuteOfDay);
    return {
      lifespanId: lifespan.id,
      label: lifespan.label,
      startedAt: fromDayNumber(start),
      expiresAt: fromDayNumber(expiry),
      remaining,
      fraction: fractionOf(start, expiry, nowDay),
      stage: selectStage(lifespan.stages, remaining.days),
      trace: traceLines(spec, steps),
    };
  });
  return { ok: true, value: { lifespans, primaryIndex: pickPrimary(lifespans) } };
}
