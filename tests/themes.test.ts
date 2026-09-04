import { describe, expect, test, vi } from 'vitest';

import { createTheme, pierreThemes } from '../src/pierre-themes';

describe('Pierre theme shim', () => {
  test('exports the custom theme factory required by Pierre', () => {
    const load = vi.fn(async() => ({ default: {} as never }));
    const descriptor = createTheme({ name: 'custom', load });

    expect(descriptor.name).toBe('custom');
    expect(descriptor.load).not.toBe(load);
    expect(pierreThemes.getThemes()).not.toHaveLength(0);
  });
});
