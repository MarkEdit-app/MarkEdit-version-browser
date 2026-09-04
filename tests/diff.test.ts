// @vitest-environment jsdom

import { beforeEach, describe, expect, test, vi } from 'vitest';

const pierre = vi.hoisted(() => ({
  fileOptions: undefined as unknown,
  fileDiffOptions: undefined as unknown,
  fileRender: vi.fn(),
  fileDiffRender: vi.fn(),
}));

const settings = vi.hoisted(() => ({
  wrapLines: false,
  showLineNumbers: false,
  lineDiff: 'char' as const,
  expandUnchanged: true,
  expansionLineCount: 40,
  diffIndicators: 'bars' as const,
  hunkSeparators: 'metadata' as const,
}));

vi.mock('@pierre/diffs', () => ({
  File: vi.fn(function FileMock(this: { render: typeof pierre.fileRender }, options: unknown) {
    pierre.fileOptions = options;
    this.render = pierre.fileRender;
  }),
  FileDiff: vi.fn(function FileDiffMock(this: { render: typeof pierre.fileDiffRender }, options: unknown) {
    pierre.fileDiffOptions = options;
    this.render = pierre.fileDiffRender;
  }),
}));

vi.mock('../src/settings', () => ({ settings }));

import { createDiff, getStoredDiffStyle } from '../src/diff';

describe('diff rendering settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    pierre.fileOptions = undefined;
    pierre.fileDiffOptions = undefined;
  });

  test('uses unified only when no toolbar choice is stored', () => {
    expect(getStoredDiffStyle()).toBe('unified');

    localStorage.setItem('markedit-version-browser.diff-style', 'split');
    expect(getStoredDiffStyle()).toBe('split');
  });

  test('applies shared settings to identical content', () => {
    const container = document.createElement('div');
    createDiff(container, 'same', 'same', 'unified');

    expect(pierre.fileOptions).toMatchObject({
      theme: { dark: 'github-dark-default', light: 'github-light-default' },
      disableFileHeader: true,
      disableLineNumbers: true,
      overflow: 'scroll',
    });

    expect(pierre.fileRender).toHaveBeenCalledWith({
      file: { name: 'document.md', contents: 'same', lang: 'markdown' },
      containerWrapper: container,
    });
  });

  test('applies all settings to changed content', () => {
    const container = document.createElement('div');
    createDiff(container, 'old', 'new', 'unified');

    expect(pierre.fileDiffOptions).toMatchObject({
      theme: { dark: 'github-dark-default', light: 'github-light-default' },
      diffStyle: 'unified',
      diffIndicators: 'bars',
      disableFileHeader: true,
      disableLineNumbers: true,
      overflow: 'scroll',
      hunkSeparators: 'metadata',
      lineDiffType: 'char',
      expandUnchanged: true,
      expansionLineCount: 40,
    });

    expect(pierre.fileDiffRender).toHaveBeenCalledWith({
      oldFile: { name: 'document.md', contents: 'old', lang: 'markdown' },
      newFile: { name: 'document.md', contents: 'new', lang: 'markdown' },
      containerWrapper: container,
    });
  });
});
