// A small RFC 4180 CSV reader: quoted cells, doubled quotes, embedded commas and line breaks,
// CRLF, LF or CR line endings and a leading byte-order mark. Lenient about stray quotes inside a cell.
import { type StoreResult, fail, invalid } from './errors';

export const MAX_CSV_BYTES = 5 * 1024 * 1024;
/** Rows after the header row. */
export const MAX_CSV_ROWS = 10_000;

const tooManyBytes = (): StoreResult<string[][]> =>
  fail({ code: 'too_large', message: 'This file is over 5 MB. Split it into smaller files and import each one.' });
const tooManyRows = (): StoreResult<string[][]> =>
  fail({ code: 'too_large', message: 'This file has more than 10,000 rows. Split it into smaller files and import each one.' });

/** Reads CSV text into rows of cells. The size limit is checked before any row is read. Never throws. */
export function parseCsv(text: string): StoreResult<string[][]> {
  if (typeof text !== 'string') return invalid([{ path: '', message: 'Expected CSV text.' }]);
  if (text.length > MAX_CSV_BYTES || new TextEncoder().encode(text).length > MAX_CSV_BYTES) return tooManyBytes();

  const rows: string[][] = [];
  const n = text.length;
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  if (i >= n) return { ok: true, value: rows };
  let row: string[] = [];

  for (;;) {
    let cell = '';
    if (text[i] === '"') {
      i++;
      for (;;) {
        const q = text.indexOf('"', i);
        if (q === -1) return invalid([{ path: `row ${rows.length + 1}`, message: 'A quoted cell is not closed.' }]);
        cell += text.slice(i, q);
        i = q + 1;
        if (text[i] !== '"') break;
        cell += '"';
        i++;
      }
    }
    let j = i;
    while (j < n && text[j] !== ',' && text[j] !== '\n' && text[j] !== '\r') j++;
    cell += text.slice(i, j);
    i = j;
    row.push(cell);

    if (text[i] === ',') {
      i++;
      continue;
    }
    rows.push(row);
    row = [];
    if (rows.length > MAX_CSV_ROWS + 1) return tooManyRows();
    if (i >= n) break;
    i += text[i] === '\r' && text[i + 1] === '\n' ? 2 : 1;
    if (i >= n) break;
  }
  return { ok: true, value: rows };
}
