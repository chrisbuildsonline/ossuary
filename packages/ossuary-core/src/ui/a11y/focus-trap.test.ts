// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adopt, ensureDocumentTokens, sheet, tokensCss } from '../styles';
import { deepActiveElement, tabbables, trapFocus } from './focus-trap';

afterEach(() => {
  document.body.replaceChildren();
});

const tab = (target: Element, shift = false) => {
  const e = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, composed: true, cancelable: true });
  target.dispatchEvent(e);
  return e;
};

function setup() {
  const opener = document.createElement('button');
  opener.textContent = 'open';
  const box = document.createElement('div');
  box.innerHTML = `
    <button id="a">a</button>
    <button disabled>off</button>
    <span tabindex="-1">skip</span>
    <div hidden><button>hidden</button></div>
    <x-field id="host"></x-field>
    <a href="#z" id="z">z</a>`;
  const host = box.querySelector('#host') as HTMLElement;
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<label for="i">Name</label><input id="i"><button tabindex="-1">r2</button><button id="r1">r1</button>';
  document.body.append(opener, box);
  return { opener, box, input: root.querySelector('#i') as HTMLElement, r1: root.querySelector('#r1') as HTMLElement };
}

describe('tabbables', () => {
  it('finds focusable elements in order, inside shadow roots, skipping disabled, hidden and tabindex -1', () => {
    const { box, input, r1 } = setup();
    expect(tabbables(box).map((el) => el.id)).toEqual(['a', input.id, r1.id, 'z']);
  });
});

describe('trapFocus', () => {
  it('moves focus in, wraps Tab and Shift+Tab, and returns focus on release', () => {
    const { opener, box } = setup();
    opener.focus();
    const release = trapFocus(box);
    const a = box.querySelector('#a') as HTMLElement;
    const z = box.querySelector('#z') as HTMLElement;
    expect(document.activeElement).toBe(a);

    z.focus();
    const forward = tab(z);
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(a);

    const back = tab(a, true);
    expect(back.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(z);

    release();
    expect(document.activeElement).toBe(opener);
    z.focus();
    expect(tab(z).defaultPrevented).toBe(false);
  });

  it('leaves Tab alone in the middle and wraps from inside a shadow root', () => {
    const { box, input, r1 } = setup();
    trapFocus(box, { initial: input });
    expect(deepActiveElement()).toBe(input);
    expect(tab(input).defaultPrevented).toBe(false);
    r1.focus();
    expect(deepActiveElement()).toBe(r1);
  });

  it('calls onEscape for the Escape key', () => {
    const { box } = setup();
    const onEscape = vi.fn();
    trapFocus(box, { onEscape });
    box.querySelector('#a')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(onEscape).toHaveBeenCalledTimes(1);
  });
});

describe('styles', () => {
  it('shares one constructable sheet per css text', () => {
    expect(sheet(':host{color:red}')).toBe(sheet(':host{color:red}'));
    expect(sheet(':host{color:red}')).not.toBe(sheet(':host{color:blue}'));
  });

  it('adopts the tokens, base and own sheets into a shadow root', () => {
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    adopt(root, '.x{display:flex}');
    expect(root.adoptedStyleSheets).toHaveLength(3);
    expect(root.adoptedStyleSheets[0]).toBe(sheet(tokensCss));
    expect(tokensCss).toContain('--canvas: #eef0f4');
  });

  it('adds the tokens to the document once', () => {
    ensureDocumentTokens(document);
    ensureDocumentTokens(document);
    expect(document.adoptedStyleSheets).toHaveLength(1);
  });
});
