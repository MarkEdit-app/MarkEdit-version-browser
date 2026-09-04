import { File, FileDiff } from '@pierre/diffs';
import { settings } from './settings';
import type { DiffStyle } from './settings';

export type { DiffStyle } from './settings';
export type RenderedDiff = File | FileDiff;

const diffStyleStorageKey = 'markedit-version-browser.diff-style';
const theme = { dark: 'github-dark-default', light: 'github-light-default' } as const;
const unsafeCSS = '[data-gutter] { -webkit-user-select: none; user-select: none; }';

export function getStoredDiffStyle(): DiffStyle {
  try {
    const value = localStorage.getItem(diffStyleStorageKey);
    if (value === 'unified' || value === 'split') {
      return value;
    }
  } catch {}

  return 'unified';
}

export function storeDiffStyle(diffStyle: DiffStyle): void {
  try {
    localStorage.setItem(diffStyleStorageKey, diffStyle);
  } catch {}
}

export function createDiff(
  container: HTMLElement,
  currentContent: string,
  selectedContent: string,
  diffStyle: DiffStyle,
): RenderedDiff {
  const sharedOptions = {
    theme,
    disableFileHeader: true,
    disableLineNumbers: !settings.showLineNumbers,
    overflow: settings.wrapLines ? 'wrap' as const : 'scroll' as const,
    unsafeCSS,
  };

  if (selectedContent === currentContent) {
    const file = new File({
      ...sharedOptions,
    });

    file.render({
      file: { name: 'document.md', contents: selectedContent, lang: 'markdown' },
      containerWrapper: container,
    });

    return file;
  }

  const fileDiff = new FileDiff({
    ...sharedOptions,
    diffStyle,
    diffIndicators: settings.diffIndicators,
    hunkSeparators: settings.hunkSeparators,
    lineDiffType: settings.lineDiff,
    expandUnchanged: settings.expandUnchanged,
    expansionLineCount: settings.expansionLineCount,
  });

  fileDiff.render({
    oldFile: { name: 'document.md', contents: currentContent, lang: 'markdown' },
    newFile: { name: 'document.md', contents: selectedContent, lang: 'markdown' },
    containerWrapper: container,
  });

  return fileDiff;
}
