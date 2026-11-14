// Adds a duration to a day number. Days and weeks are exact; months and years use the calendar.
import type { Duration } from '../schema/rules';
import { civilToDayNumber, dayNumberToCivil, daysInMonth } from './iso-day';

/** `day` and `week` add 7n days; `month` and `year` (12 months) keep the day of month, or use the target month's last day. */
export function addDuration(dayNumber: number, { amount, unit }: Duration): number {
  if (unit === 'day') return dayNumber + amount;
  if (unit === 'week') return dayNumber + amount * 7;
  const months = unit === 'year' ? amount * 12 : amount;
  const { year, month, day } = dayNumberToCivil(dayNumber);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = index - targetYear * 12 + 1;
  return civilToDayNumber({ year: targetYear, month: targetMonth, day: Math.min(day, daysInMonth(targetYear, targetMonth)) });
}

export const negate = (d: Duration): Duration => ({ amount: -d.amount, unit: d.unit });
