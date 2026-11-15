// exportIcs(spec, entries, { now }): one all-day event per lifespan per entry, as an RFC 5545 calendar.
// A small hand-written serializer: no Date object, so the time zone cannot move a day.
import { evaluate, type LifespanEvaluation, type Now } from '../engine/evaluate';
import { fromDayNumber, isRealDay, toDayNumber } from '../engine/iso-day';
import type { BoneSpec } from '../schema/bone-spec';
import type { Issue, IsoDay } from '../schema/issues';
import type { Item } from '../schema/item';

export interface IcsEntry {
  id: string;
  values: Item;
}

export interface IcsExport {
  ics: string;
  skipped: { id: string; issues: Issue[] }[];
}

/** TEXT value escaping (RFC 5545 3.3.11). Line breaks become `\n`; other control characters are dropped. */
const escapeText = (text: string): string =>
  text
    .replace(/\r\n?/g, '\n')
    .replace(/[\\;,]/g, (c) => `\\${c}`)
    .replace(/\n/g, '\\n')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '');

const encoder = new TextEncoder();

/** Folds a content line to at most 75 octets per line, never splitting a UTF-8 character. */
function fold(line: string): string {
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const char of line) {
    const bytes = encoder.encode(char).length;
    if (size + bytes > 75) {
      parts.push(current);
      current = ' ';
      size = 1;
    }
    current += char;
    size += bytes;
  }
  parts.push(current);
  return parts.join('\r\n');
}

const dateValue = (day: IsoDay): string => day.replaceAll('-', '');

function stampOf(now: Now): string {
  const minutes = now.minuteOfDay ?? 0;
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
  const mm = String(minutes % 60).padStart(2, '0');
  return `${dateValue(now.day)}T${hh}${mm}00Z`;
}

/** An iCalendar DATE has a four-digit year, and an all-day event ends on the next day. */
const LAST_DAY = '9999-12-30';

/** Lifespans a calendar file cannot hold. Huge durations can carry an expiry past the year 9999. */
const tooFar = (lifespans: LifespanEvaluation[]): Issue[] =>
  lifespans.flatMap(({ label, expiresAt }, i) =>
    isRealDay(expiresAt) && expiresAt <= LAST_DAY
      ? []
      : [{ path: `lifespans[${i}]`, message: `${label} ends on ${expiresAt}, past ${LAST_DAY}, the last day a calendar file can hold.` }],
  );

/** Offset from the event start (midnight on the expiry day) to 09:00 on the day `n` days before. */
const triggerFor = (n: number): string => (n === 0 ? 'PT9H' : n === 1 ? '-PT15H' : `-P${n - 1}DT15H`);

export function exportIcs(spec: BoneSpec, entries: IcsEntry[], opts: { now: Now; prodId?: string }): IcsExport {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:${escapeText(opts.prodId ?? `-//Ossuary//${spec.id}//EN`)}`, 'CALSCALE:GREGORIAN'];
  const skipped: IcsExport['skipped'] = [];
  const several = spec.lifespans.length > 1;

  for (const entry of entries) {
    const result = evaluate(spec, entry.values, opts.now);
    const issues = result.ok ? tooFar(result.value.lifespans) : result.error;
    if (!result.ok || issues.length > 0) {
      skipped.push({ id: entry.id, issues });
      continue;
    }
    // evaluate has checked now, so both are safe here.
    const nowDay = toDayNumber(opts.now.day);
    const stamp = stampOf(opts.now);
    const title = String(entry.values[spec.entity.titleField] ?? '');
    result.value.lifespans.forEach((lifespan, i) => {
      const summary = several ? `${title} - ${lifespan.label}` : title;
      const expiry = toDayNumber(lifespan.expiresAt);
      const alarms = (spec.lifespans[i]?.stages ?? []).flatMap(({ enterAtDays, label }) =>
        enterAtDays === undefined || expiry - enterAtDays < nowDay
          ? []
          : ['BEGIN:VALARM', 'ACTION:DISPLAY', `TRIGGER:${triggerFor(enterAtDays)}`, `DESCRIPTION:${escapeText(`${summary}: ${label}`)}`, 'END:VALARM'],
      );
      lines.push(
        'BEGIN:VEVENT',
        `UID:${escapeText(`${spec.id}-${entry.id}-${lifespan.lifespanId}@ossuary`)}`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${dateValue(lifespan.expiresAt)}`,
        `DTEND;VALUE=DATE:${dateValue(fromDayNumber(expiry + 1))}`,
        `SUMMARY:${escapeText(summary)}`,
        'TRANSP:TRANSPARENT',
        ...alarms,
        'END:VEVENT',
      );
    });
  }
  lines.push('END:VCALENDAR');
  return { ics: `${lines.map(fold).join('\r\n')}\r\n`, skipped };
}
