// The primary lifespan: the most pressing live countdown, or the last to expire when all have.

/**
 * First pass: among live lifespans (days >= 0), the fewest days left. If none is live, second pass:
 * the greatest days left. Strict comparisons give every tie to the earlier declared lifespan.
 */
export function pickPrimary(lifespans: readonly { remaining: { days: number } }[]): number {
  let best = -1;
  lifespans.forEach(({ remaining }, i) => {
    const current = lifespans[best]?.remaining.days;
    if (remaining.days >= 0 && (current === undefined || remaining.days < current)) best = i;
  });
  if (best >= 0) return best;
  best = 0;
  lifespans.forEach(({ remaining }, i) => {
    if (remaining.days > (lifespans[best]?.remaining.days ?? -Infinity)) best = i;
  });
  return best;
}
