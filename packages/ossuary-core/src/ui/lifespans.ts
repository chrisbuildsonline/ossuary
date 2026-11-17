// The lifespans of one evaluation in display order: the primary first, the others as declared.
import type { Evaluation, LifespanEvaluation } from '../engine/evaluate';

export function orderLifespans(e: Evaluation): LifespanEvaluation[] {
  const primary = e.lifespans[e.primaryIndex];
  const others = e.lifespans.filter((_, i) => i !== e.primaryIndex);
  return primary ? [primary, ...others] : others;
}
