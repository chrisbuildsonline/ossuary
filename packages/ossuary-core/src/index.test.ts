import { describe, expect, it } from 'vitest';
import { coreName } from './index';

describe('ossuary-core', () => {
  it('exports its name', () => {
    expect(coreName).toBe('ossuary-core');
  });
});
