// Remaining time, fraction left and stage of one lifespan, from integer day numbers.
import type { Stage, Tone } from '../schema/stages';

export interface StageRef {
  id: string;
  label: string;
  tone: Tone;
  index: number; // within this lifespan's stages
}

export interface Remaining {
  days: number;
  hours?: number; // only when days === 0 and the minute of day is known
}

/**
 * Stages are `[first, ...middle, dead]`. Below 0 days it is the dead stage; otherwise the last
 * non-dead stage whose threshold (infinite for the first) is at least the days left.
 */
export function selectStage(stages: readonly Stage[], remainingDays: number): StageRef {
  const last = stages.length - 1;
  let index = last;
  if (remainingDays >= 0) {
    index = 0;
    for (let i = 1; i < last; i += 1) {
      if ((stages[i]?.enterAtDays ?? -1) >= remainingDays) index = i;
    }
  }
  const stage = stages[index];
  if (!stage) throw new RangeError('A lifespan needs stages.');
  return { id: stage.id, label: stage.label, tone: stage.tone, index };
}

/** Days from now to the end of the expiry day; 0 means today. Hours count to midnight on the last day. */
export function remainingOf(expiry: number, nowDay: number, minuteOfDay?: number): Remaining {
  const days = expiry - nowDay;
  if (days !== 0 || minuteOfDay === undefined) return { days };
  return { days, hours: Math.ceil((1440 - minuteOfDay) / 60) };
}

/** Share of the lifespan still left, clamped to 0..1; 0 when the expiry is not after the start. */
export function fractionOf(start: number, expiry: number, nowDay: number): number {
  if (expiry <= start) return 0;
  return Math.min(Math.max((expiry - nowDay) / (expiry - start), 0), 1);
}
