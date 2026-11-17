// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OssShell } from './oss-shell';
import type { OssToast } from './oss-toast';
import './oss-toast';

const space = () => document.documentElement.style.getPropertyValue('--oss-toast-space');

let height = 48;
const observers: FakeObserver[] = [];
class FakeObserver {
  target?: Element;
  disconnected = false;
  constructor(readonly callback: () => void) {
    observers.push(this);
  }
  observe(el: Element) {
    this.target = el;
  }
  disconnect() {
    this.disconnected = true;
  }
}

beforeEach(() => {
  height = 48;
  observers.length = 0;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return { height: this.classList.contains('toast') ? height : 0, width: 0, x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) } as DOMRect;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  document.body.replaceChildren();
  document.documentElement.style.removeProperty('--oss-toast-space');
});

function toast(): OssToast {
  const el = document.createElement('oss-toast') as OssToast;
  document.body.append(el);
  return el;
}

describe('oss-toast space', () => {
  it('sets --oss-toast-space to the measured box height plus --s-3 while a message shows', () => {
    const el = toast();
    expect(space()).toBe('');
    el.show('Saved', { undoLabel: 'Undo' });
    expect(space()).toBe('calc(48px + var(--s-3))');
  });

  it('follows the box when it changes size', () => {
    vi.stubGlobal('ResizeObserver', FakeObserver);
    const el = toast();
    el.show('A message that wraps onto a second line', { undoLabel: 'Undo' });
    const observer = observers.at(-1);
    expect(observer?.target?.classList.contains('toast')).toBe(true);
    height = 68;
    observer?.callback();
    expect(space()).toBe('calc(68px + var(--s-3))');
  });

  it('removes it on hide and when the timer runs out', () => {
    vi.useFakeTimers();
    vi.stubGlobal('ResizeObserver', FakeObserver);
    const el = toast();
    el.show('Saved');
    el.hide();
    expect(space()).toBe('');
    expect(observers.at(-1)?.disconnected).toBe(true);
    el.show('Saved again', { duration: 1000 });
    expect(space()).not.toBe('');
    vi.advanceTimersByTime(1000);
    expect(space()).toBe('');
  });

  it('replaces the old value and observer when a new message shows', () => {
    vi.stubGlobal('ResizeObserver', FakeObserver);
    const el = toast();
    el.show('First');
    const first = observers.at(-1);
    height = 60;
    el.show('Second, a little longer', { undoLabel: 'Undo' });
    expect(first?.disconnected).toBe(true);
    expect(observers.at(-1)).not.toBe(first);
    expect(space()).toBe('calc(60px + var(--s-3))');
  });

  it('removes it when disconnected', () => {
    vi.stubGlobal('ResizeObserver', FakeObserver);
    const el = toast();
    el.show('Saved');
    el.remove();
    expect(space()).toBe('');
    expect(observers.at(-1)?.disconnected).toBe(true);
  });
});

describe('oss-shell toast space', () => {
  it('adds the toast space to the content bottom padding at both widths', () => {
    const rules = OssShell.styles.match(/main\s*\{[^}]*\}/g) ?? [];
    expect(rules).toHaveLength(2);
    for (const rule of rules) expect(rule).toMatch(/padding:[^;]*\+ var\(--oss-toast-space, 0px\)\)/);
  });
});
