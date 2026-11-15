import ICAL from 'ical.js';
import { describe, expect, it } from 'vitest';
import { type BoneSpec, parseBoneSpec } from '../schema/bone-spec';
import { gizmoSpec, widgetSpec } from '../testing/fixtures';
import { days, specWith } from '../testing/lifespan-spec';
import { exportIcs } from './export-ics';

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
