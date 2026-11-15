import fc from 'fast-check';
import ICAL from 'ical.js';
import { describe, expect, it } from 'vitest';
import { evaluate } from '../engine/evaluate';
import { fromDayNumber, toDayNumber } from '../engine/iso-day';
import { type BoneSpec, parseBoneSpec } from '../schema/bone-spec';
import type { Item } from '../schema/item';
import { gizmoSpec, widgetSpec } from '../testing/fixtures';
import { days, specWith, years } from '../testing/lifespan-spec';
import { specArbitrary } from '../testing/spec-arbitrary';
import { type IcsEntry, exportIcs } from './export-ics';

const parsed = (input: unknown): BoneSpec => {
  const r = parseBoneSpec(input);
  if (!r.ok) throw new Error('fixture invalid');
  return r.value;
};
const widget = parsed(widgetSpec);
const gizmo = parsed(gizmoSpec);

interface ParsedAlarm {
  action: string;
  description: string;
  trigger: string;
  firesAt: string; // floating local time, YYYY-MM-DDTHH:MM:SS
}

interface ParsedEvent {
  uid: string;
  summary: string;
  start: string;
  startIsDate: boolean;
  end: string;
  dtstamp: string;
  alarms: ParsedAlarm[];
}

/** Reads an iCalendar string back with ical.js, the way a calendar app would. */
function read(ics: string): { calendar: InstanceType<typeof ICAL.Component>; events: ParsedEvent[] } {
  const calendar = new ICAL.Component(ICAL.parse(ics));
  const events = calendar.getAllSubcomponents('vevent').map((vevent): ParsedEvent => {
    const event = new ICAL.Event(vevent);
    const alarms = vevent.getAllSubcomponents('valarm').map((valarm): ParsedAlarm => {
      const trigger = valarm.getFirstPropertyValue('trigger') as InstanceType<typeof ICAL.Duration>;
      const firesAt = event.startDate.clone();
      firesAt.isDate = false;
      firesAt.addDuration(trigger);
      return {
        action: String(valarm.getFirstPropertyValue('action')),
        description: String(valarm.getFirstPropertyValue('description')),
        trigger: trigger.toString(),
        firesAt: firesAt.toString(),
      };
    });
    return {
      uid: event.uid,
      summary: event.summary,
      start: event.startDate.toString(),
      startIsDate: event.startDate.isDate,
      end: event.endDate.toString(),
      dtstamp: String(vevent.getFirstPropertyValue('dtstamp')),
      alarms,
    };
  });
  return { calendar, events };
}

const now = { day: '2026-11-14', minuteOfDay: 615 };
const oneWidget = [{ id: 'w1', values: { name: 'Widget', place: 'cold', made: '2026-11-14' } }];

describe('exportIcs, one entry with one lifespan', () => {
  it('returns one all-day event on the expiry day', () => {
    const { ics, skipped } = exportIcs(widget, oneWidget, { now });
    expect(skipped).toEqual([]);
    const { events } = read(ics);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ start: '2026-11-28', startIsDate: true, end: '2026-11-29' });
  });

  it('builds the UID from the app id, item id and lifespan id', () => {
    const { events } = read(exportIcs(widget, oneWidget, { now }).ics);
    expect(events[0]?.uid).toBe('widget-tracker-w1-main@ossuary');
  });

  it('gives a stable UID for the same item on another day', () => {
    const a = read(exportIcs(widget, oneWidget, { now }).ics).events[0]?.uid;
    const b = read(exportIcs(widget, oneWidget, { now: { day: '2026-11-20' } }).ics).events[0]?.uid;
    expect(a).toBe(b);
  });

  it('derives DTSTAMP from now', () => {
    expect(read(exportIcs(widget, oneWidget, { now }).ics).events[0]?.dtstamp).toBe('2026-11-14T10:15:00Z');
    expect(read(exportIcs(widget, oneWidget, { now: { day: '2026-11-20' } }).ics).events[0]?.dtstamp).toBe('2026-11-20T00:00:00Z');
  });

  it('uses the title field as the summary, with no label for a one-lifespan spec', () => {
    expect(read(exportIcs(widget, oneWidget, { now }).ics).events[0]?.summary).toBe('Widget');
  });

  it('writes a version 2.0 calendar with a product id, optionally given', () => {
    const plain = read(exportIcs(widget, oneWidget, { now }).ics).calendar;
    expect(plain.getFirstPropertyValue('version')).toBe('2.0');
    expect(String(plain.getFirstPropertyValue('prodid'))).toContain('widget-tracker');
    const custom = read(exportIcs(widget, oneWidget, { now, prodId: '-//Example//Widgets//EN' }).ics).calendar;
    expect(custom.getFirstPropertyValue('prodid')).toBe('-//Example//Widgets//EN');
  });

  it('ends every line with CRLF', () => {
    const { ics } = exportIcs(widget, oneWidget, { now });
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.split('\r\n').filter((line) => /[\r\n]/.test(line))).toEqual([]);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
  });

  it('is the same for the same input', () => {
    expect(exportIcs(widget, oneWidget, { now })).toEqual(exportIcs(widget, oneWidget, { now }));
  });
});

describe('exportIcs alarms', () => {
  const alarmsOn = (day: string) => read(exportIcs(widget, oneWidget, { now: { day } }).ics).events[0]?.alarms;

  it('adds a display alarm at 09:00 on the day each threshold stage begins', () => {
    // Expires 2026-11-28; "Soon" begins 7 days before, "Urgent" 2 days before.
    expect(alarmsOn('2026-11-14')).toEqual([
      { action: 'DISPLAY', description: 'Widget: Soon', trigger: '-P6DT15H', firesAt: '2026-11-21T09:00:00' },
      { action: 'DISPLAY', description: 'Widget: Urgent', trigger: '-P1DT15H', firesAt: '2026-11-26T09:00:00' },
    ]);
  });

  it('keeps an alarm on the now day and drops alarms on earlier days', () => {
    expect(alarmsOn('2026-11-21')?.map((a) => a.firesAt)).toEqual(['2026-11-21T09:00:00', '2026-11-26T09:00:00']);
    expect(alarmsOn('2026-11-22')?.map((a) => a.firesAt)).toEqual(['2026-11-26T09:00:00']);
    expect(alarmsOn('2026-11-27')).toEqual([]);
  });

  it('still exports the event when every alarm has passed', () => {
    expect(read(exportIcs(widget, oneWidget, { now: { day: '2026-12-30' } }).ics).events).toHaveLength(1);
  });

  it('writes thresholds of 1 and 0 days as 09:00 the day before and 09:00 on the day', () => {
    const spec = specWith({
      base: { type: 'duration', ...days(10) },
      stages: [
        { id: 'ok', label: 'Fine', tone: 'fresh' },
        { id: 'tomorrow', label: 'Tomorrow', tone: 'soon', enterAtDays: 1 },
        { id: 'today', label: 'Today', tone: 'urgent', enterAtDays: 0 },
        { id: 'gone', label: 'Gone', tone: 'dead' },
      ],
    });
    const { events } = read(exportIcs(spec, [{ id: 'x', values: { name: 'Thing', start: '2026-11-14' } }], { now }).ics);
    expect(events[0]?.alarms.map(({ trigger, firesAt }) => ({ trigger, firesAt }))).toEqual([
      { trigger: '-PT15H', firesAt: '2026-11-23T09:00:00' },
      { trigger: 'PT9H', firesAt: '2026-11-24T09:00:00' },
    ]);
  });

  it('adds no alarm for a lifespan with only a first and a dead stage', () => {
    const spec = specWith({
      base: { type: 'duration', ...days(10) },
      stages: [
        { id: 'ok', label: 'Fine', tone: 'fresh' },
        { id: 'gone', label: 'Gone', tone: 'dead' },
      ],
    });
    const { events } = read(exportIcs(spec, [{ id: 'x', values: { name: 'Thing', start: '2026-11-14' } }], { now }).ics);
    expect(events[0]?.alarms).toEqual([]);
  });
});

describe('exportIcs with two lifespans', () => {
  const oneGizmo = [{ id: 'g1', values: { name: 'Gizmo', bought: '2026-11-14' } }];

  it('writes one event per lifespan with distinct UIDs and the label in the summary', () => {
    const { ics, skipped } = exportIcs(gizmo, oneGizmo, { now });
    expect(skipped).toEqual([]);
    expect(read(ics).events.map(({ uid, summary, start }) => ({ uid, summary, start }))).toEqual([
      { uid: 'gizmo-keeper-g1-return_window@ossuary', summary: 'Gizmo - Return window', start: '2026-12-14' },
      { uid: 'gizmo-keeper-g1-cover@ossuary', summary: 'Gizmo - Cover', start: '2028-11-14' },
    ]);
  });

  it("takes each event's alarms from its own lifespan's stages", () => {
    const [window, cover] = read(exportIcs(gizmo, oneGizmo, { now }).ics).events;
    expect(window?.alarms).toEqual([
      { action: 'DISPLAY', description: 'Gizmo - Return window: Last days', trigger: '-P2DT15H', firesAt: '2026-12-11T09:00:00' },
    ]);
    expect(cover?.alarms).toEqual([
      { action: 'DISPLAY', description: 'Gizmo - Cover: Ending', trigger: '-P29DT15H', firesAt: '2028-10-15T09:00:00' },
    ]);
  });

  it('drops past alarms per lifespan', () => {
    const [window, cover] = read(exportIcs(gizmo, oneGizmo, { now: { day: '2026-12-12' } }).ics).events;
    expect(window?.alarms).toEqual([]);
    expect(cover?.alarms).toHaveLength(1);
  });
});

describe('exportIcs with many entries', () => {
  const widgets = [
    { id: 'w1', values: { name: 'Cold one', place: 'cold', made: '2026-11-14' } },
    { id: 'w2', values: { name: 'Deep one', place: 'deep_cold', made: '2026-11-14' } },
    { id: 'w3', values: { name: 'Shelf one', place: 'shelf', made: '2026-11-14', opened: 'yes' } },
  ];

  it('writes one event per entry for a one-lifespan spec, in entry order', () => {
    const { ics, skipped } = exportIcs(widget, widgets, { now });
    expect(skipped).toEqual([]);
    expect(read(ics).events.map(({ uid, summary, start, alarms }) => ({ uid, summary, start, alarms: alarms.length }))).toEqual([
      { uid: 'widget-tracker-w1-main@ossuary', summary: 'Cold one', start: '2026-11-28', alarms: 2 },
      { uid: 'widget-tracker-w2-main@ossuary', summary: 'Deep one', start: '2027-05-14', alarms: 2 },
      { uid: 'widget-tracker-w3-main@ossuary', summary: 'Shelf one', start: '2027-11-07', alarms: 2 },
    ]);
  });

  it('writes one event per lifespan per entry for a two-lifespan spec', () => {
    const gizmos = [
      { id: 'g1', values: { name: 'Basic', bought: '2026-11-14' } },
      { id: 'g2', values: { name: 'Plus', bought: '2026-11-14', plan: 'plus' } },
    ];
    const { events } = read(exportIcs(gizmo, gizmos, { now }).ics);
    expect(events.map(({ uid, start }) => [uid, start])).toEqual([
      ['gizmo-keeper-g1-return_window@ossuary', '2026-12-14'],
      ['gizmo-keeper-g1-cover@ossuary', '2028-11-14'],
      ['gizmo-keeper-g2-return_window@ossuary', '2026-12-28'],
      ['gizmo-keeper-g2-cover@ossuary', '2029-11-14'],
    ]);
    expect(new Set(events.map((e) => e.uid)).size).toBe(4);
  });

  it('skips an entry that cannot be evaluated, reports its issues and exports the rest', () => {
    const bad = { id: 'bad', values: { name: 'Bad', place: 'cold', made: '2026-02-30' } };
    const { ics, skipped } = exportIcs(widget, [widgets[0]!, bad, widgets[1]!], { now });
    const expected = evaluate(widget, bad.values, now);
    expect(expected.ok).toBe(false);
    expect(skipped).toEqual([{ id: 'bad', issues: expected.ok ? [] : expected.error }]);
    expect(read(ics).events.map((e) => e.uid)).toEqual(['widget-tracker-w1-main@ossuary', 'widget-tracker-w2-main@ossuary']);
  });

  it('skips every lifespan of an entry that cannot be evaluated', () => {
    const entries = [
      { id: 'g1', values: { name: 'Basic', bought: '2026-11-14' } },
      { id: 'g2', values: { bought: '2026-11-14' } },
    ];
    const { ics, skipped } = exportIcs(gizmo, entries, { now });
    expect(skipped).toEqual([{ id: 'g2', issues: [{ path: 'name', message: 'This is required.' }] }]);
    expect(read(ics).events.map((e) => e.uid)).toEqual(['gizmo-keeper-g1-return_window@ossuary', 'gizmo-keeper-g1-cover@ossuary']);
  });

  it('never throws on a bad now: every entry is skipped and the calendar is still valid', () => {
    const { ics, skipped } = exportIcs(widget, widgets, { now: { day: 'soon' } });
    expect(skipped.map((s) => s.id)).toEqual(['w1', 'w2', 'w3']);
    expect(skipped[0]?.issues).toEqual([{ path: 'now.day', message: 'Use a real calendar day as YYYY-MM-DD.' }]);
    expect(read(ics).events).toEqual([]);
  });

  it('writes an empty calendar for no entries', () => {
    const { ics, skipped } = exportIcs(widget, [], { now });
    expect(skipped).toEqual([]);
    expect(read(ics).events).toEqual([]);
  });
});

describe('exportIcs text', () => {
  const octets = (line: string) => new TextEncoder().encode(line).length;
  const strictUtf8 = new TextDecoder('utf-8', { fatal: true });

  it('escapes commas, semicolons, backslashes and line breaks so a parser reads back the original', () => {
    const name = 'One, two; three \\ four\nfive';
    const { ics } = exportIcs(widget, [{ id: 'a,b;c', values: { name, place: 'cold', made: '2026-11-14' } }], { now });
    const [event] = read(ics).events;
    expect(event?.summary).toBe(name);
    expect(event?.uid).toBe('widget-tracker-a,b;c-main@ossuary');
    expect(event?.alarms[0]?.description).toBe(`${name}: Soon`);
    expect(ics).toContain('SUMMARY:One\\, two\\; three \\\\ four\\nfive\r\n');
  });

  it('reads CRLF and CR line breaks back as one line break', () => {
    const { ics } = exportIcs(widget, [{ id: 'w', values: { name: 'a\r\nb\rc', place: 'cold', made: '2026-11-14' } }], { now });
    expect(read(ics).events[0]?.summary).toBe('a\nb\nc');
  });

  it('folds long lines at 75 octets without splitting a UTF-8 character', () => {
    const name = `Ünïcödé widget ${'🦴 bone, ü; '.repeat(20)}end`;
    const { ics } = exportIcs(gizmo, [{ id: 'long', values: { name, bought: '2026-11-14' } }], { now });
    const lines = ics.split('\r\n').slice(0, -1);
    expect(lines.filter((line) => octets(line) > 75)).toEqual([]);
    expect(lines.some((line) => line.startsWith(' '))).toBe(true);
    for (const line of lines) expect(strictUtf8.decode(new TextEncoder().encode(line))).toBe(line);
    const [window, cover] = read(ics).events;
    expect(window?.summary).toBe(`${name} - Return window`);
    expect(cover?.alarms[0]?.description).toBe(`${name} - Cover: Ending`);
  });
});

describe('exportIcs properties', () => {
  const lo = toDayNumber('0000-01-01');
  const hi = toDayNumber('9999-12-31');
  const entry = fc.oneof(
    fc.record({ id: fc.string(), name: fc.string({ unit: 'grapheme', minLength: 1 }), start: fc.integer({ min: lo, max: hi }), length: fc.integer({ min: -30, max: 800 }) }).map(
      ({ id, name, start, length }) => ({ id, values: { name, start: fromDayNumber(start), ends: fromDayNumber(Math.min(hi, Math.max(lo, start + length))) } as Item }),
    ),
    fc.record({ id: fc.string(), values: fc.anything() }).map((e) => e as IcsEntry),
  );
  const nowDay = fc.integer({ min: toDayNumber('2020-01-01'), max: toDayNumber('2030-12-31') }).map(fromDayNumber);

  it('never throws, always parses, and writes one event per lifespan of every entry it keeps', () => {
    fc.assert(
      fc.property(specArbitrary, fc.array(entry, { maxLength: 6 }), nowDay, (spec, entries, day) => {
        const { ics, skipped } = exportIcs(spec, entries, { now: { day } });
        const { events } = read(ics);
        expect(events).toHaveLength((entries.length - skipped.length) * spec.lifespans.length);
        expect(ics.split('\r\n').filter((line) => new TextEncoder().encode(line).length > 75)).toEqual([]);
        for (const event of events) {
          expect(event.startIsDate).toBe(true);
          for (const alarm of event.alarms) expect(alarm.firesAt >= `${day}T09:00:00`).toBe(true);
        }
      }),
      { seed: 4242, numRuns: 150 },
    );
  });
});

describe('exportIcs past the year 9999', () => {
  it('skips an entry whose expiry has a five-digit year, with a readable issue, and exports the rest', () => {
    const spec = specWith({
      base: { type: 'duration', ...days(30) },
      rules: [{ id: 'far', kind: 'extend', when: { field: 'place', equals: 'b' }, by: years(9999) }],
    });
    const entries = [
      { id: 'far', values: { name: 'Far', start: '2026-11-14', place: 'b' } },
      { id: 'near', values: { name: 'Near', start: '2026-11-14', ends: '2026-12-01' } },
    ];
    const out = exportIcs(spec, entries, { now });
    expect(out.skipped).toEqual([
      { id: 'far', issues: [{ path: 'lifespans[0]', message: 'Lifespan 0 ends on 12025-12-14, past 9999-12-30, the last day a calendar file can hold.' }] },
    ]);
    expect(out.ics).not.toMatch(/\d{9}/);
    expect(read(out.ics).events.map(({ uid, start }) => [uid, start])).toEqual([['test-spec-near-l0@ossuary', '2026-12-14']]);

    // One lifespan out of range skips the whole entry, so no partial entry reaches the calendar.
    const twoLifespans = specWith({ base: { type: 'field', field: 'ends' } }, { base: { type: 'duration', ...years(9999) } });
    const mixed = exportIcs(twoLifespans, [entries[1]!], { now });
    expect(mixed.skipped).toEqual([
      { id: 'near', issues: [{ path: 'lifespans[1]', message: 'Lifespan 1 ends on 12025-11-14, past 9999-12-30, the last day a calendar file can hold.' }] },
    ]);
    expect(read(mixed.ics).events).toEqual([]);
  });

  it('exports an expiry on 9999-12-30 and skips 9999-12-31, whose all-day event would end in year 10000', () => {
    const spec = specWith({ base: { type: 'field', field: 'ends' } });
    const entries = [
      { id: 'last', values: { name: 'Last', start: '9999-01-01', ends: '9999-12-30' } },
      { id: 'over', values: { name: 'Over', start: '9999-01-01', ends: '9999-12-31' } },
    ];
    const { ics, skipped } = exportIcs(spec, entries, { now });
    expect(skipped).toEqual([
      { id: 'over', issues: [{ path: 'lifespans[0]', message: 'Lifespan 0 ends on 9999-12-31, past 9999-12-30, the last day a calendar file can hold.' }] },
    ]);
    expect(read(ics).events.map(({ uid, start, end }) => ({ uid, start, end }))).toEqual([
      { uid: 'test-spec-last-l0@ossuary', start: '9999-12-30', end: '9999-12-31' },
    ]);
  });
});
