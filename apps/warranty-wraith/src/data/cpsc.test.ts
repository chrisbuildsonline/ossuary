import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { mapCpscRecalls } from './cpsc';

// Shaped like a real row of data/cpsc-recalls.raw.json (recall 27054), with the keys the mapper ignores kept.
const row = (over: Record<string, unknown> = {}) => ({
  RecallID: 11038,
  RecallNumber: '27054',
  RecallDate: '2026-10-29T00:00:00',
  Description: 'This recall involves DREO space heaters.',
  URL: 'https://cpsc.gov/Recalls/2027/DREO-Recalls-DR-HSH015-Space-Heaters-Due-to-Fire-and-Burn-Hazards',
  Title: 'DREO Recalls DR-HSH015 Space Heaters Due to Fire and Burn Hazards',
  ConsumerContact: 'DREO toll-free',
  LastPublishDate: '2026-10-29T00:00:00',
  Products: [{ Name: 'DREO Space Heaters, model DR-HSH015', Description: '', Model: '', Type: 'Electric Space Heaters', CategoryID: '1', NumberOfUnits: 'About 1,000' }],
  Inconjunctions: [],
  Images: [],
  Injuries: [],
  Manufacturers: [],
  Retailers: [{ Name: 'Sold At: Amazon', CompanyID: '' }],
  Importers: [{ Name: 'Hesung Innovation Corp, dba DREO, of Clifton, New Jerse', CompanyID: '' }],
  Distributors: [],
  SoldAtLabel: null,
  ManufacturerCountries: [{ Country: 'China' }],
  ProductUPCs: [],
  Hazards: [{ Name: 'The recalled space heaters can overheat and ignite, posing fire and burn hazards.', HazardType: '', HazardTypeID: '' }],
  Remedies: [],
  RemedyOptions: [],
  ...over,
});

describe('mapCpscRecalls', () => {
  it('maps a full row', () => {
    expect(mapCpscRecalls([row()])).toEqual({
      recalls: [
        {
          id: '27054',
          date: '2026-10-29',
          title: 'DREO Recalls DR-HSH015 Space Heaters Due to Fire and Burn Hazards',
          hazard: 'The recalled space heaters can overheat and ignite, posing fire and burn hazards.',
          url: 'https://www.cpsc.gov/Recalls/2027/DREO-Recalls-DR-HSH015-Space-Heaters-Due-to-Fire-and-Burn-Hazards',
          names: ['DREO Space Heaters, model DR-HSH015'],
          brands: ['Hesung Innovation Corp', 'DREO'],
          models: [],
        },
      ],
      skipped: [],
    });
  });

  it('keeps a www.cpsc.gov URL as it is', () => {
    const url = 'https://www.cpsc.gov/Recalls/2027/Allstar-Recalls-Fire-Pits';
    expect(mapCpscRecalls([row({ URL: url })]).recalls[0]?.url).toBe(url);
  });

  it('takes brands from manufacturers, importers and distributors, without places, brackets or duplicates', () => {
    const r = mapCpscRecalls([
      row({
        Manufacturers: [{ Name: 'Ariston Canada Inc. (Formerly NTI Boilers Inc.), of Canada' }],
        Importers: [{ Name: 'Papablic, Inc., doing business as Papablic, of USA, of Chicago, Illinois' }],
        Distributors: [{ Name: '  Cummins Inc., of Columbus, Indiana' }, { Name: '' }, { Name: 'Cummins Inc., of Columbus, Indiana' }],
      }),
    ]);
    expect(r.recalls[0]?.brands).toEqual(['Ariston Canada Inc.', 'Papablic', 'Cummins Inc.']);
  });

  it('splits models on commas, semicolons and "and", trimmed and de-duplicated', () => {
    const r = mapCpscRecalls([
      row({ Products: [{ Name: 'Kettle', Model: 'K2100, K2200; K2300 and K2400' }, { Name: 'Kettle', Model: ' K2100 ' }, { Name: 'Lid', Model: '' }] }),
    ]);
    expect(r.recalls[0]?.models).toEqual(['K2100', 'K2200', 'K2300', 'K2400']);
    expect(r.recalls[0]?.names).toEqual(['Kettle', 'Lid']);
  });

  it('cuts a long title and a long hazard to 160 characters', () => {
    const long = `Recall ${'x'.repeat(300)}`;
    const r = mapCpscRecalls([row({ Title: long, Hazards: [{ Name: long }] })]);
    expect(r.recalls[0]?.title).toHaveLength(160);
    expect(r.recalls[0]?.title).toBe(long.slice(0, 160));
    expect(r.recalls[0]?.hazard).toHaveLength(160);
  });

  it('uses "" when there is no hazard', () => {
    expect(mapCpscRecalls([row({ Hazards: [] })]).recalls[0]?.hazard).toBe('');
  });

  it('skips rows it cannot use, with the row number and a reason', () => {
    const r = mapCpscRecalls([
      row({ RecallNumber: '' }),
      row({ RecallNumber: '1', RecallDate: '2026-02-30T00:00:00' }),
      row({ RecallNumber: '2', URL: 'https://example.com/Recalls/2027/x' }),
      row({ RecallNumber: '3', URL: 'http://www.cpsc.gov/Recalls/2027/x' }),
      row({ RecallNumber: '4', Products: [{ Name: '  ', Model: '' }] }),
      row({ RecallNumber: '5', Title: ' ' }),
      row({ RecallNumber: '6', Products: 'not a list' }),
      'not a row',
      row({ RecallNumber: '7' }),
      row({ RecallNumber: '7' }),
    ]);
    expect(r.recalls.map((x) => x.id)).toEqual(['7']);
    expect(r.skipped.map((s) => s.row)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 9]);
    const reason = (n: number) => r.skipped.find((s) => s.row === n)?.reason ?? '';
    expect(reason(0)).toMatch(/recall number/i);
    expect(reason(1)).toMatch(/day/i);
    expect(reason(2)).toMatch(/cpsc/i);
    expect(reason(3)).toMatch(/cpsc/i);
    expect(reason(4)).toMatch(/product name/i);
    expect(reason(5)).toMatch(/title/i);
    expect(reason(6)).toMatch(/Products/);
    expect(reason(9)).toMatch(/duplicate/i);
  });

  it('returns nothing and one reason for input that is not a list', () => {
    expect(mapCpscRecalls({ recalls: [] })).toEqual({ recalls: [], skipped: [{ row: -1, reason: expect.stringMatching(/array/i) }] });
  });

  it('never throws (fast-check)', () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        const r = mapCpscRecalls(input);
        expect(Array.isArray(r.recalls)).toBe(true);
      }),
      { seed: 20261117, numRuns: 500 },
    );
    fc.assert(
      fc.property(fc.array(fc.dictionary(fc.constantFrom(...Object.keys(row())), fc.anything())), (rows) => {
        mapCpscRecalls(rows);
      }),
      { seed: 20261118, numRuns: 300 },
    );
  });
});
