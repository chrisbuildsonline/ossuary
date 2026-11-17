// Countdown text and accessible names. Pure: dates come from ISO days, never from a Date object or the locale.
import type { Evaluation, LifespanEvaluation, Now } from '../engine/evaluate';
import { parseIsoDay, toDayNumber } from '../engine/iso-day';
import type { IsoDay } from '../schema/issues';

export interface Countdown {
  /** The big number, or "Today". */
  value: string;
  /** The muted unit beside it ("days", "mo", "yr 1 mo", "days ago"); empty for "Today". */
  unit: string;
  /** `value` and `unit` together, as shown in compact lines. */
  text: string;
  /** Words for screen readers ("2 days", "today", "1 year 11 months"). */
  spoken: string;
}

type Lifespan = Pick<LifespanEvaluation, 'remaining' | 'expiresAt' | 'stage'>;

const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);
const make = (value: string, unit: string, spoken: string): Countdown => ({ value, unit, text: unit ? `${value} ${unit}` : value, spoken });

/** Whole calendar months from `from` to `to`. */
function monthsBetween(from: IsoDay, to: IsoDay): number {
  const a = parseIsoDay(from);
  const b = parseIsoDay(to);
  if (!a || !b) return 0;
  return (b.year - a.year) * 12 + (b.month - a.month) - (b.day < a.day ? 1 : 0);
}

/** DESIGN.md: hours under a day, "Today" at 0, days under 60, months under 2 years, then years and months. */
export function formatCountdown(l: Lifespan, now: Now): Countdown {
  const { days, hours } = l.remaining;
  if (days < 0 || l.stage.tone === 'dead') {
    const ago = Math.abs(days);
    return make(String(ago), plural(ago, 'day ago', 'days ago'), `${ago} ${plural(ago, 'day ago', 'days ago')}`);
  }
  if (days === 0) {
    if (hours === undefined) return make('Today', '', 'today');
    return make(String(hours), plural(hours, 'hr'), `${hours} ${plural(hours, 'hour')}`);
  }
  if (days < 60) return make(String(days), plural(days, 'day'), `${days} ${plural(days, 'day')}`);
  const months = monthsBetween(now.day, l.expiresAt);
  if (months < 24) return make(String(months), 'mo', `${months} ${plural(months, 'month')}`);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const unit = rest ? `yr ${rest} mo` : 'yr';
  const spoken = `${years} ${plural(years, 'year')}${rest ? ` ${rest} ${plural(rest, 'month')}` : ''}`;
  return make(String(years), unit, spoken);
}

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function parts(day: IsoDay, now?: Now) {
  const civil = parseIsoDay(day);
  if (!civil) return undefined;
  // Day 0 (1970-01-01) was a Thursday.
  const weekday = weekdays[(((toDayNumber(day) + 4) % 7) + 7) % 7] ?? '';
  const month = monthNames[civil.month - 1] ?? '';
  const year = now && parseIsoDay(now.day)?.year === civil.year ? '' : ` ${civil.year}`;
  return { weekday, month, date: civil.day, year };
}

/** "Fri 20 Nov", with the year when it is not the year of `now`. */
export function shortDay(day: IsoDay, now?: Now): string {
  const p = parts(day, now);
  return p ? `${p.weekday.slice(0, 3)} ${p.date} ${p.month.slice(0, 3)}${p.year}` : day;
}

/** "Friday 20 November", with the year when it is not the year of `now`. */
export function longDay(day: IsoDay, now?: Now): string {
  const p = parts(day, now);
  return p ? `${p.weekday} ${p.date} ${p.month}${p.year}` : day;
}

/** "expires in 2 days, Friday 20 November" (lower case; callers capitalise). */
export function expirySentence(l: Lifespan, now: Now): string {
  const c = formatCountdown(l, now);
  const date = longDay(l.expiresAt, now);
  if (l.remaining.days < 0 || l.stage.tone === 'dead') return `expired ${c.spoken}, ${date}`;
  if (c.spoken === 'today') return `expires today, ${date}`;
  return `expires in ${c.spoken}, ${date}`;
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "Title. Stage. Expires in 2 days, Friday 20 November." plus one sentence per other lifespan. */
export function accessibleName(title: string, e: Evaluation, now: Now): string {
  const primary = e.lifespans[e.primaryIndex];
  if (!primary) return title;
  const several = e.lifespans.length > 1;
  const lead = several ? `${primary.label}: ${expirySentence(primary, now)}` : capital(expirySentence(primary, now));
  const others = e.lifespans.filter((_, i) => i !== e.primaryIndex).map((l) => `${l.label}: ${expirySentence(l, now)}.`);
  return [`${title}.`, `${primary.stage.label}.`, `${lead}.`, ...others].join(' ');
}
