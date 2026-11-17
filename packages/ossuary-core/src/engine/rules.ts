// Runs one lifespan's base and rules, in declared order, on integer day numbers.
import type { Item } from '../schema/item';
import type { Base, Lifespan } from '../schema/lifespans';
import type { Cond, Duration, Rule } from '../schema/rules';
import { addDuration, negate } from './duration';
import { toDayNumber } from './iso-day';

type RuleOf<K extends Rule['kind']> = Extract<Rule, { kind: K }>;

/** What one applied base or rule did to the expiry day. `trace.ts` turns each step into a line. */
export type Step =
  | { kind: 'base'; base: Base; before: number; after: number }
  | { kind: 'extend'; rule: RuleOf<'extend'>; before: number; after: number }
  | { kind: 'shorten'; rule: RuleOf<'shorten'>; before: number; after: number; floored: boolean }
  | { kind: 'clamp'; rule: RuleOf<'clamp'>; before: number; after: number; bound: 'min' | 'max' | undefined }
  | { kind: 'lookup'; rule: RuleOf<'lookup'>; before: number; after: number; value: string | undefined; duration: Duration; fromDefault: boolean };

export interface LifespanRun {
  start: number;
  expiry: number;
  steps: Step[];
}

/** An item's own value for a key, never an inherited one such as `constructor`. */
export const valueOf = (item: Item, key: string) => (Object.hasOwn(item, key) ? item[key] : undefined);

const holds = (item: Item, when: Cond | undefined) => when === undefined || valueOf(item, when.field) === when.equals;

function applyRule(rule: Rule, expiry: number, start: number, item: Item): Step | undefined {
  switch (rule.kind) {
    case 'extend':
      if (!holds(item, rule.when)) return undefined;
      return { kind: 'extend', rule, before: expiry, after: addDuration(expiry, rule.by) };
    case 'shorten': {
      if (!holds(item, rule.when)) return undefined;
      const moved = addDuration(expiry, negate(rule.by));
      return { kind: 'shorten', rule, before: expiry, after: Math.max(start, moved), floored: moved < start };
    }
    case 'clamp': {
      if (!holds(item, rule.when)) return undefined;
      const lo = rule.min ? addDuration(start, rule.min) : -Infinity;
      const hi = rule.max ? addDuration(start, rule.max) : Infinity;
      const after = Math.min(Math.max(expiry, lo), hi);
      const bound = after === expiry ? undefined : after === hi ? 'max' : 'min';
      return { kind: 'clamp', rule, before: expiry, after, bound };
    }
    case 'lookup': {
      const raw = valueOf(item, rule.field);
      const value = raw === undefined ? undefined : String(raw);
      const entry = value !== undefined && Object.hasOwn(rule.table, value) ? rule.table[value] : undefined;
      const duration = entry ?? rule.default;
      if (!duration) return undefined;
      return { kind: 'lookup', rule, before: expiry, after: addDuration(start, duration), value, duration, fromDefault: entry === undefined };
    }
  }
}

/** The base as used for this item: a duration's `amountField` value, when the item has one, replaces `amount`. */
function baseFor(base: Base, item: Item): Base {
  if (base.type !== 'duration' || base.amountField === undefined) return base;
  const value = valueOf(item, base.amountField);
  return value === undefined ? base : { ...base, amount: Number(value) };
}

/** An `amountField` value the engine cannot use: anything but a whole number from 0 to 9999. */
export const badAmount = (value: unknown) => value !== undefined && !(Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 9999);

/** Evaluates one lifespan on a validated item whose start field (and date base) are present. */
export function runLifespan(lifespan: Lifespan, item: Item): LifespanRun {
  const dayOf = (key: string) => toDayNumber(String(valueOf(item, key)));
  const start = dayOf(lifespan.startField);
  const base = baseFor(lifespan.base, item);
  let expiry = base.type === 'duration' ? addDuration(start, base) : dayOf(base.field);
  const steps: Step[] = [{ kind: 'base', base, before: start, after: expiry }];
  for (const rule of lifespan.rules ?? []) {
    const step = applyRule(rule, expiry, start, item);
    if (!step) continue;
    steps.push(step);
    expiry = step.after;
  }
  return { start, expiry, steps };
}
