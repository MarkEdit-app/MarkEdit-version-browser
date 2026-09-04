import { MarkEdit } from 'markedit-api';

export const settingsKey = 'extension.markeditVersionBrowser';

export type DiffStyle = 'unified' | 'split';
export type LineDiff = 'word-alt' | 'word' | 'char' | 'none';
export type DiffIndicators = 'classic' | 'bars' | 'none';
export type HunkSeparators = 'simple' | 'metadata' | 'line-info' | 'line-info-basic';

export interface VersionBrowserSettings {
  wrapLines: boolean;
  showLineNumbers: boolean;
  lineDiff: LineDiff;
  expandUnchanged: boolean;
  expansionLineCount: number;
  diffIndicators: DiffIndicators;
  hunkSeparators: HunkSeparators;
}

export const defaultSettings: VersionBrowserSettings = {
  wrapLines: true,
  showLineNumbers: true,
  lineDiff: 'word-alt',
  expandUnchanged: false,
  expansionLineCount: 20,
  diffIndicators: 'classic',
  hunkSeparators: 'line-info',
};

const lineDiffs = ['word-alt', 'word', 'char', 'none'] as const;
const diffIndicators = ['classic', 'bars', 'none'] as const;
const hunkSeparators = ['simple', 'metadata', 'line-info', 'line-info-basic'] as const;

export function parseSettings(userSettings: unknown): VersionBrowserSettings {
  const rootValue = toObject(toObject(userSettings)[settingsKey]);

  return {
    wrapLines: toBoolean(rootValue.wrapLines, defaultSettings.wrapLines),
    showLineNumbers: toBoolean(rootValue.showLineNumbers, defaultSettings.showLineNumbers),
    lineDiff: toOption(rootValue.lineDiff, lineDiffs, defaultSettings.lineDiff),
    expandUnchanged: toBoolean(rootValue.expandUnchanged, defaultSettings.expandUnchanged),
    expansionLineCount: toInteger(rootValue.expansionLineCount, defaultSettings.expansionLineCount, 1, 100),
    diffIndicators: toOption(rootValue.diffIndicators, diffIndicators, defaultSettings.diffIndicators),
    hunkSeparators: toOption(rootValue.hunkSeparators, hunkSeparators, defaultSettings.hunkSeparators),
  };
}

export const settings = parseSettings(MarkEdit.userSettings);

function toObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function toBoolean(value: unknown, defaultValue: boolean): boolean {
  return typeof value === 'boolean' ? value : defaultValue;
}

function toInteger(value: unknown, defaultValue: number, minimum: number, maximum: number): number {
  return typeof value === 'number' && Number.isInteger(value)
    ? Math.min(Math.max(value, minimum), maximum)
    : defaultValue;
}

function toOption<const Options extends readonly string[]>(
  value: unknown,
  options: Options,
  defaultValue: Options[number],
): Options[number] {
  return typeof value === 'string' && options.includes(value)
    ? value
    : defaultValue;
}
