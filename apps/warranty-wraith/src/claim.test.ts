import { describe, expect, it } from 'vitest';
import { claimNote } from './claim';

const full = { name: 'DREO space heater', retailer: 'Corner shop', bought: '2026-11-05', model: 'DR-HSH015', price: 49.9, warranty_months: 12 };

describe('claimNote', () => {
  it('writes a message ready to paste into an email, with every detail of the purchase', () => {
    expect(claimNote(full, '2027-11-05')).toBe(
      [
        'Hello,',
        '',
        'I would like to make a warranty claim for my DREO space heater (model DR-HSH015), bought at Corner shop on 5 November 2026 for $49.90.',
        'Its warranty runs until 5 November 2027.',
        '',
        'The fault: ',
        '',
        'My receipt is attached.',
      ].join('\n'),
    );
  });

  it('leaves out the model and the price when they are missing or empty', () => {
    const note = claimNote({ name: 'Desk lamp', retailer: 'Corner shop', bought: '2026-01-31', model: '' }, '2027-01-31');
    expect(note).toContain('for my Desk lamp, bought at Corner shop on 31 January 2026.');
    expect(note).not.toMatch(/undefined|null|model|\$/);
  });

  it('writes whole-dollar prices without cents and leaves out a missing shop', () => {
    const note = claimNote({ name: 'Kettle', bought: '2026-02-01', price: 30 }, '2026-12-01');
    expect(note).toContain('for my Kettle, bought on 1 February 2026 for $30.');
    expect(note).toContain('Its warranty runs until 1 December 2026.');
  });

  it('reads the day from the string, so no time zone moves it', () => {
    expect(claimNote({ name: 'X', bought: '2026-12-31' }, '2027-01-01')).toMatch(/31 December 2026[\s\S]*1 January 2027/);
  });
});
