import { describe, expect, it } from 'vitest';
import { MAX_CSV_BYTES, MAX_CSV_ROWS, parseCsv } from './csv';

const rows = (text: string) => {
  const r = parseCsv(text);
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.value;
};

describe('parseCsv', () => {
  it.each([
    ['plain cells', 'a,b\n1,2', [['a', 'b'], ['1', '2']]],
    ['a trailing LF', 'a,b\n1,2\n', [['a', 'b'], ['1', '2']]],
    ['CRLF line endings', 'a,b\r\n1,2\r\n', [['a', 'b'], ['1', '2']]],
    ['lone CR line endings', 'a,b\r1,2', [['a', 'b'], ['1', '2']]],
    ['a leading byte-order mark', '﻿name,made\nx,2026-01-01', [['name', 'made'], ['x', '2026-01-01']]],
    ['empty cells', 'a,,c\n,\n', [['a', '', 'c'], ['', '']]],
    ['a blank line in the middle', 'a\n\nb', [['a'], [''], ['b']]],
    ['spaces kept as they are', ' a , b ', [[' a ', ' b ']]],
    ['an embedded comma', '"a,b",c', [['a,b', 'c']]],
    ['escaped quotes', '"say ""hi""",x', [['say "hi"', 'x']]],
    ['an embedded LF', '"line 1\nline 2",x\ny,z', [['line 1\nline 2', 'x'], ['y', 'z']]],
    ['an embedded CRLF', '"line 1\r\nline 2",x\r\ny,z', [['line 1\r\nline 2', 'x'], ['y', 'z']]],
    ['an empty quoted cell', '"",x', [['', 'x']]],
    ['a quoted last cell with a trailing newline', 'a,"b"\n', [['a', 'b']]],
    ['a quote inside an unquoted cell', 'a"b,c', [['a"b', 'c']]],
    ['text after a closing quote', '"ab"c,d', [['abc', 'd']]],
    ['empty text', '', []],
    ['only a byte-order mark', '﻿', []],
    ['only a newline', '\n', [['']]],
  ])('reads %s', (_, text, expected) => {
    expect(rows(text)).toEqual(expected);
  });

  it('reports a quote that is never closed at its row', () => {
    expect(parseCsv('a,b\n"open,x\ny')).toEqual({
      ok: false,
      error: { code: 'invalid', issues: [{ path: 'row 2', message: 'A quoted cell is not closed.' }] },
    });
  });

  it('allows 5 MB and rejects one byte more as too_large', () => {
    expect(MAX_CSV_BYTES).toBe(5 * 1024 * 1024);
    expect(parseCsv('a'.repeat(MAX_CSV_BYTES)).ok).toBe(true);
    expect(parseCsv('a'.repeat(MAX_CSV_BYTES + 1))).toEqual({
      ok: false,
      error: { code: 'too_large', message: expect.stringMatching(/5 MB/) },
    });
  });

  it('measures the size in UTF-8 bytes', () => {
    expect(parseCsv('é'.repeat(MAX_CSV_BYTES / 2)).ok).toBe(true);
    expect(parseCsv(`${'é'.repeat(MAX_CSV_BYTES / 2)}a`).ok).toBe(false);
  });

  it('allows a header and 10,000 rows and rejects one row more as too_large', () => {
    expect(MAX_CSV_ROWS).toBe(10_000);
    const ok = ['h', ...Array.from({ length: MAX_CSV_ROWS }, (_, i) => String(i))].join('\n');
    expect(rows(ok)).toHaveLength(MAX_CSV_ROWS + 1);
    expect(parseCsv(`${ok}\nx`)).toEqual({
      ok: false,
      error: { code: 'too_large', message: expect.stringMatching(/10,000 rows/) },
    });
  });

  it('counts a trailing newline after the last row as no extra row', () => {
    const text = `${['h', ...Array.from({ length: MAX_CSV_ROWS }, () => 'x')].join('\r\n')}\r\n`;
    expect(rows(text)).toHaveLength(MAX_CSV_ROWS + 1);
  });
});
