import { describe, expect, test, vi } from 'vitest';

vi.mock('markedit-api', () => ({ MarkEdit: { userSettings: {} } }));

import { defaultSettings, parseSettings, settingsKey } from '../src/settings';

describe('version browser settings', () => {
  test('uses defaults without the extension namespace', () => {
    expect(parseSettings({})).toEqual(defaultSettings);
    expect(parseSettings(null)).toEqual(defaultSettings);
  });

  test('parses all supported settings', () => {
    expect(parseSettings({
      [settingsKey]: {
        wrapLines: false,
        showLineNumbers: false,
        lineDiff: 'char',
        expandUnchanged: true,
        expansionLineCount: 40,
        diffIndicators: 'bars',
        hunkSeparators: 'metadata',
      },
    })).toEqual({
      wrapLines: false,
      showLineNumbers: false,
      lineDiff: 'char',
      expandUnchanged: true,
      expansionLineCount: 40,
      diffIndicators: 'bars',
      hunkSeparators: 'metadata',
    });
  });

  test('defaults invalid fields and clamps the expansion count', () => {
    const parsed = parseSettings({
      [settingsKey]: {
        wrapLines: 'yes',
        showLineNumbers: null,
        lineDiff: 'line',
        expandUnchanged: 1,
        expansionLineCount: 500,
        diffIndicators: 'arrows',
        hunkSeparators: 'custom',
      },
    });

    expect(parsed).toEqual({ ...defaultSettings, expansionLineCount: 100 });
    expect(parseSettings({ [settingsKey]: { expansionLineCount: 0 } }).expansionLineCount).toBe(1);
    expect(parseSettings({ [settingsKey]: { expansionLineCount: 2.5 } }).expansionLineCount).toBe(20);
  });
});
