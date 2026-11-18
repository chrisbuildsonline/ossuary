import { describe, expect, it } from 'vitest';
import { AXE_TAGS, WIDTHS, formatViolations } from './a11y';

describe('a11y test helpers', () => {
  it('checks the desktop and the phone width', () => {
    expect(WIDTHS).toEqual([1280, 390]);
  });

  it('asks axe for WCAG 2.0 and 2.1, A and AA, and nothing less', () => {
    expect([...AXE_TAGS].sort()).toEqual(['wcag21a', 'wcag21aa', 'wcag2a', 'wcag2aa']);
  });

  it('prints each violation with its rule id, impact, selector and message', () => {
    const text = formatViolations([
      {
        id: 'color-contrast',
        impact: 'serious',
        help: 'Elements must meet minimum color contrast ratio thresholds',
        nodes: [
          {
            // One entry per frame; an array inside is a path through shadow roots.
            target: [['oss-list', 'oss-item', 'a.card .date']],
            any: [{ message: 'Element has insufficient color contrast of 4.38 (foreground color: #646a78, background color: #f2efea)' }],
            all: [],
            none: [],
          },
        ],
      },
      { id: 'aria-dialog-name', impact: 'serious', help: 'ARIA dialog nodes should have an accessible name', nodes: [{ target: ['dialog'], any: [], all: [], none: [{ message: 'No name' }] }] },
    ]);
    expect(text).toBe(
      [
        '2 axe violations:',
        'color-contrast (serious): Elements must meet minimum color contrast ratio thresholds',
        '  oss-list >> oss-item >> a.card .date: Element has insufficient color contrast of 4.38 (foreground color: #646a78, background color: #f2efea)',
        'aria-dialog-name (serious): ARIA dialog nodes should have an accessible name',
        '  dialog: No name',
      ].join('\n'),
    );
  });

  it('says nothing is wrong when there is no violation', () => {
    expect(formatViolations([])).toBe('0 axe violations');
  });
});
