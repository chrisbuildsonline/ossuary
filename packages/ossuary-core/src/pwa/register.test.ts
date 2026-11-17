// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerSw } from './register.ts';

const fakeWorkers = (register: () => Promise<unknown>) => {
  const fn = vi.fn(register);
  Object.defineProperty(navigator, 'serviceWorker', { value: { register: fn }, configurable: true });
  return fn;
};

const added = vi.spyOn(window, 'addEventListener');

afterEach(() => {
  for (const [type, fn] of added.mock.calls) window.removeEventListener(type, fn);
  added.mockClear();
  vi.unstubAllEnvs();
  Reflect.deleteProperty(navigator, 'serviceWorker');
});

describe('registerSw', () => {
  it('registers ./sw.js after the load event in a production build', () => {
    vi.stubEnv('PROD', true);
    const register = fakeWorkers(async () => ({}));
    registerSw();
    expect(register).not.toHaveBeenCalled();
    window.dispatchEvent(new Event('load'));
    expect(register).toHaveBeenCalledWith('./sw.js');
  });

  it('does nothing outside a production build', () => {
    vi.stubEnv('PROD', false);
    const register = fakeWorkers(async () => ({}));
    registerSw();
    window.dispatchEvent(new Event('load'));
    expect(register).not.toHaveBeenCalled();
  });

  it('swallows a rejected registration, so the app still works online', async () => {
    vi.stubEnv('PROD', true);
    const failed = Promise.reject(new Error('no worker'));
    const register = fakeWorkers(() => failed);
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    registerSw();
    window.dispatchEvent(new Event('load'));
    await failed.catch(() => undefined);
    await new Promise((r) => setTimeout(r, 0));
    process.off('unhandledRejection', unhandled);
    expect(register).toHaveBeenCalledTimes(1);
    expect(unhandled).not.toHaveBeenCalled();
  });
});
