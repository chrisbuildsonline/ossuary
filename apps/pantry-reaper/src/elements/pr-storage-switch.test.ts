// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { specForFood } from '../spec';
import './pr-storage-switch';

const spec = specForFood({ id: 't1', name: 'Test yogurt', days: { fridge: 14, freezer: 60 } });

function mount(value: string) {
  const el = document.createElement('pr-storage-switch');
  document.body.append(el);
  el.show(spec, value);
  const events: string[] = [];
  el.addEventListener('pr-storage', (e) => events.push((e as CustomEvent<{ value: string }>).detail.value));
  const radios = () => Array.from(el.shadowRoot?.querySelectorAll<HTMLElement>('[role="radio"]') ?? []);
  const checked = () => radios().filter((r) => r.getAttribute('aria-checked') === 'true').map((r) => r.textContent);
  return { el, events, radios, checked };
}

afterEach(() => document.body.replaceChildren());

describe('pr-storage-switch', () => {
  it('is a radiogroup with one segment per method and exactly one selected', () => {
    const s = mount('fridge');
    expect(s.el.shadowRoot?.querySelector('[role="radiogroup"]')).not.toBeNull();
    expect(s.radios().map((r) => r.textContent)).toEqual(['Fridge', 'Freezer']);
    expect(s.checked()).toEqual(['Fridge']);
  });

  it('keeps exactly one segment selected after every change and emits the new value', () => {
    const s = mount('fridge');
    s.radios()[1]?.click();
    expect(s.checked()).toEqual(['Freezer']);
    s.radios()[1]?.click();
    expect(s.checked()).toEqual(['Freezer']);
    s.radios()[1]?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(s.checked()).toEqual(['Fridge']);
    expect(s.events).toEqual(['freezer', 'fridge']);
  });

  it('always has a value, even when the stored one is not offered', () => {
    expect(mount('pantry').checked()).toEqual(['Fridge']);
  });

  it('shows no required hint or validation message', () => {
    const text = mount('fridge').el.shadowRoot?.textContent ?? '';
    expect(text).not.toMatch(/Required|Optional/);
    expect(mount('fridge').el.shadowRoot?.querySelector('[aria-invalid], [aria-required], .help')).toBeNull();
  });
});
