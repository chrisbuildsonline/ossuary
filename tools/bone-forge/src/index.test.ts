import { describe, expect, it } from 'vitest';
import { toolName } from './index';

describe('bone-forge', () => {
  it('exports its name', () => {
    expect(toolName).toBe('bone-forge');
  });
});
