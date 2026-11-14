// ISO calendar days as integer day numbers (day 0 is 1970-01-01), proleptic Gregorian.
// Integer arithmetic only: no Date object, so neither the time zone nor daylight saving can move a result.
import type { IsoDay } from '../schema/issues';

export interface CivilDay {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
}

const shape = /^(\d{4})-(\d{2})-(\d{2})$/;
const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export const isLeapYear = (year: number): boolean => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

export const daysInMonth = (year: number, month: number): number =>
  month === 2 && isLeapYear(year) ? 29 : (monthLengths[month - 1] ?? 0);

/** Parts of a real calendar day written as `YYYY-MM-DD`, or undefined. */
export function parseIsoDay(text: string): CivilDay | undefined {
  if (typeof text !== 'string') return undefined;
  const m = shape.exec(text);
  if (!m) return undefined;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return undefined;
  return { year, month, day };
}

export const isRealDay = (text: string): boolean => parseIsoDay(text) !== undefined;

const pad = (n: number, width: number) => String(n).padStart(width, '0');

export const formatIsoDay = ({ year, month, day }: CivilDay): IsoDay => `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;

/** Day number of a civil date (Howard Hinnant's days_from_civil). */
export function civilToDayNumber({ year, month, day }: CivilDay): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (month + (month > 2 ? -3 : 9)) + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Civil date of a day number (Howard Hinnant's civil_from_days). */
export function dayNumberToCivil(n: number): CivilDay {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return { year: yoe + era * 400 + (month <= 2 ? 1 : 0), month, day };
}

/** Day number of an ISO day. Throws on a day that is not real; callers validate first. */
export function toDayNumber(text: IsoDay): number {
  const civil = parseIsoDay(text);
  if (!civil) throw new RangeError(`Not a real calendar day: ${text}`);
  return civilToDayNumber(civil);
}

export const fromDayNumber = (n: number): IsoDay => formatIsoDay(dayNumberToCivil(n));
