// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { MODE_KEY } from '../mode';
import './oss-mode-toggle';
import './oss-shell';
import type { OssShell } from './oss-shell';
import { widget } from '../../testing/ui-fixtures';

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.dataset.mode = 'crypt';
  localStorage.clear();
});

const button = (el: Element) => el.shadowRoot?.querySelector('button') as HTMLButtonElement;

describe('oss-mode-toggle', () => {
  it('is one named toggle button that switches crypt and light and remembers the choice', () => {
    document.documentElement.dataset.mode = 'crypt';
    const el = document.createElement('oss-mode-toggle');
    document.body.append(el);
    const b = button(el);
    expect(b.getAttribute('aria-label')).toBe('Light theme');
    expect(b.getAttribute('aria-pressed')).toBe('false');
    expect(b.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    b.click();
    expect(document.documentElement.dataset.mode).toBe('light');
    expect(localStorage.getItem(MODE_KEY)).toBe('light');
    expect(button(el).getAttribute('aria-pressed')).toBe('true');
    button(el).click();
    expect(document.documentElement.dataset.mode).toBe('crypt');
    expect(button(el).getAttribute('aria-pressed')).toBe('false');
  });

  it('sits in the shell top bar, outside the primary slot', () => {
    const shell = document.createElement('oss-shell') as OssShell;
    shell.spec = widget;
    document.body.append(shell);
    const toggle = shell.shadowRoot?.querySelector('.top oss-mode-toggle');
    expect(toggle).toBeTruthy();
    expect(toggle?.closest('.primary')).toBeNull();
  });
});
