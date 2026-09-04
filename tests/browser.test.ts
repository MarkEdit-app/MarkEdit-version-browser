// @vitest-environment jsdom

import type { FileVersion } from 'markedit-api';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const markEdit = vi.hoisted(() => ({
  getFileVersions: vi.fn(),
  getFileVersionContent: vi.fn(),
  restoreFileVersion: vi.fn(),
  deleteLocalFileVersions: vi.fn(),
  showAlert: vi.fn(),
  editorAPI: { getText: vi.fn() },
  editorView: undefined as unknown as {
    dom: HTMLElement;
    contentDOM: { blur(): void };
    focus(): void;
  },
}));

const diff = vi.hoisted(() => ({
  create: vi.fn((_container: HTMLElement, _currentContent: string, _selectedContent: string, _diffStyle: string) => ({ cleanUp: vi.fn() })),
  getStyle: vi.fn(() => 'unified'),
  storeStyle: vi.fn(),
}));

vi.mock('markedit-api', () => ({ MarkEdit: markEdit }));
vi.mock('../src/diff', () => ({
  createDiff: diff.create,
  getStoredDiffStyle: diff.getStyle,
  storeDiffStyle: diff.storeStyle,
}));

import { showVersionBrowser } from '../src/browser';

describe('version browser workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.replaceChildren();
    document.head.querySelectorAll('style').forEach((style) => style.remove());

    const editorElement = document.createElement('div');
    markEdit.editorView = {
      dom: editorElement,
      contentDOM: { blur: vi.fn() },
      focus: vi.fn(),
    };

    markEdit.editorAPI.getText.mockReturnValue('current');
    markEdit.showAlert.mockResolvedValue(1);
    markEdit.restoreFileVersion.mockResolvedValue(false);
    markEdit.deleteLocalFileVersions.mockResolvedValue(false);

    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });
  });

  afterEach(async() => {
    const overlay = document.querySelector<HTMLElement>('.markedit-version-browser');
    overlay?.querySelector<HTMLButtonElement>('[data-action="close"]')?.click();
    overlay?.dispatchEvent(new Event('transitionend'));
    await Promise.resolve();
    vi.unstubAllGlobals();
  });

  test('offers the latest release when file version history is unsupported', async() => {
    const getFileVersions = markEdit.getFileVersions;
    markEdit.getFileVersions = undefined as never;
    markEdit.showAlert.mockResolvedValueOnce(1);
    const open = vi.fn();
    vi.stubGlobal('open', open);

    showVersionBrowser();
    markEdit.getFileVersions = getFileVersions;
    await flushPromises();

    expect(markEdit.showAlert).toHaveBeenCalledWith({
      title: 'Version Browser Unavailable',
      message: 'This version of MarkEdit does not support file version history.',
      buttons: ['OK', 'Get Latest Version'],
    });
    expect(open).toHaveBeenCalledWith('https://github.com/MarkEdit-app/MarkEdit/releases/latest');
    expect(markEdit.editorAPI.getText).not.toHaveBeenCalled();
    expect(document.querySelector('.markedit-version-browser')).toBeNull();
  });

  test('reopened browsers use unique description IDs while overlays overlap', () => {
    markEdit.getFileVersions.mockReturnValue(new Promise(() => {}));

    showVersionBrowser();
    showVersionBrowser();

    const overlays = Array.from(document.querySelectorAll<HTMLElement>('.markedit-version-browser'));
    const descriptionIDs = overlays.flatMap((overlay) => Array.from(
      overlay.querySelectorAll<HTMLElement>('.version-browser-restore-description, .version-browser-delete-description'),
      (description) => description.id,
    ));

    expect(overlays).toHaveLength(2);
    expect(descriptionIDs).toHaveLength(4);
    expect(new Set(descriptionIDs)).toHaveLength(4);
    overlays[0].dispatchEvent(new Event('transitionend'));
  });

  test('a slower selection cannot replace a newer selection', async() => {
    const firstVersion = createVersion('first');
    const secondVersion = createVersion('second');
    const secondContent = deferred<string>();

    markEdit.getFileVersions.mockResolvedValue([firstVersion, secondVersion]);
    markEdit.getFileVersionContent.mockImplementation((id: string) => (
      id === secondVersion.id ? secondContent.promise : Promise.resolve('first content')
    ));

    showVersionBrowser();
    await waitForRenderedContent('first content');

    selectVersion(secondVersion.id);
    await vi.waitFor(() => expect(markEdit.getFileVersionContent).toHaveBeenCalledWith(secondVersion.id));
    selectVersion(firstVersion.id);
    await vi.waitFor(() => expect(diff.create).toHaveBeenCalledTimes(2));

    secondContent.resolve('second content');
    await flushPromises();

    expect(diff.create).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'second content',
      expect.anything(),
    );

    expect(diff.create.mock.calls.at(-1)?.[2]).toBe('first content');
  });

  test('an uncached local version hides the previous diff while loading', async() => {
    const firstVersion = createVersion('first');
    const secondVersion = createVersion('second');
    const secondContent = deferred<string>();

    markEdit.getFileVersions.mockResolvedValue([firstVersion, secondVersion]);
    markEdit.getFileVersionContent.mockImplementation((id: string) => (
      id === secondVersion.id ? secondContent.promise : Promise.resolve('first content')
    ));

    showVersionBrowser();
    await waitForRenderedContent('first content');
    const diffContainer = document.querySelector<HTMLElement>('.version-browser-diff')!;
    expect(diffContainer.hidden).toBe(false);

    selectVersion(secondVersion.id);
    await vi.waitFor(() => expect(markEdit.getFileVersionContent).toHaveBeenCalledWith(secondVersion.id));
    expect(diffContainer.hidden).toBe(true);

    secondContent.resolve('second content');
    await waitForRenderedContent('second content');
    expect(diffContainer.hidden).toBe(false);
  });

  test('a failed newest-version probe keeps the version list available', async() => {
    const version = createVersion('first');

    markEdit.getFileVersions.mockResolvedValue([version]);
    markEdit.getFileVersionContent
      .mockRejectedValueOnce(new Error('probe failed'))
      .mockResolvedValueOnce('first content');

    showVersionBrowser();
    await waitForRenderedContent('first content');

    expect(markEdit.getFileVersionContent).toHaveBeenCalledTimes(2);
    expect(getVersionSelect().disabled).toBe(false);
  });

  test('successful version contents are reused within the browser session', async() => {
    const firstVersion = createVersion('first');
    const secondVersion = createVersion('second', false);

    markEdit.getFileVersions.mockResolvedValue([firstVersion, secondVersion]);
    markEdit.getFileVersionContent.mockImplementation((id: string) => Promise.resolve(`${id} content`));

    showVersionBrowser();
    await waitForRenderedContent('first content');
    selectVersion(secondVersion.id);
    await waitForRenderedContent('second content');
    selectVersion(firstVersion.id);
    await vi.waitFor(() => expect(diff.create.mock.calls.at(-1)?.[2]).toBe('first content'));
    selectVersion(secondVersion.id);
    await vi.waitFor(() => expect(diff.create.mock.calls.at(-1)?.[2]).toBe('second content'));

    expect(markEdit.getFileVersionContent).toHaveBeenCalledTimes(2);
    expect(markEdit.getFileVersionContent).toHaveBeenCalledWith(firstVersion.id);
    expect(markEdit.getFileVersionContent).toHaveBeenCalledWith(secondVersion.id);
  });

  test('deleting during a fetch prevents stale content from rendering', async() => {
    const firstVersion = createVersion('first');
    const secondVersion = createVersion('second');
    const secondContent = deferred<string>();
    const deletion = deferred<boolean>();

    markEdit.getFileVersions.mockResolvedValue([firstVersion, secondVersion]);
    markEdit.getFileVersionContent.mockImplementation((id: string) => (
      id === secondVersion.id ? secondContent.promise : Promise.resolve('first content')
    ));

    markEdit.showAlert.mockResolvedValue(0);
    markEdit.deleteLocalFileVersions.mockReturnValue(deletion.promise);

    showVersionBrowser();
    await waitForRenderedContent('first content');
    selectVersion(secondVersion.id);
    getButton('delete').click();

    await vi.waitFor(() => expect(markEdit.deleteLocalFileVersions).toHaveBeenCalledWith([secondVersion.id]));
    secondContent.resolve('second content');
    await flushPromises();

    expect(getStatus().textContent).toBe('Deleting version...');
    expect(diff.create).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'second content',
      expect.anything(),
    );

    deletion.resolve(false);
    await vi.waitFor(() => expect(getStatus().textContent).toBe('The version could not be deleted.'));
  });

  test('a failed reload leaves the empty selector disabled', async() => {
    const version = createVersion('first');

    markEdit.getFileVersions
      .mockResolvedValueOnce([version])
      .mockRejectedValueOnce(new Error('reload failed'));
    markEdit.getFileVersionContent.mockResolvedValue('first content');
    markEdit.showAlert.mockResolvedValue(0);
    markEdit.deleteLocalFileVersions.mockResolvedValue(true);

    showVersionBrowser();
    await waitForRenderedContent('first content');
    getButton('delete').click();

    await vi.waitFor(() => expect(getStatus().textContent).toBe('Version history could not be loaded.'));
    const select = getVersionSelect();

    expect(select.disabled).toBe(true);
    expect(select.options).toHaveLength(1);
    expect(select.options[0].text).toBe('');
    expect(getButton('restore').disabled).toBe(true);
  });

  test('restore starts immediately without confirmation', async() => {
    const version = createVersion('first');

    markEdit.getFileVersions.mockResolvedValue([version]);
    markEdit.getFileVersionContent.mockResolvedValue('first content');

    showVersionBrowser();
    await waitForRenderedContent('first content');
    getButton('restore').click();

    await vi.waitFor(() => expect(markEdit.restoreFileVersion).toHaveBeenCalledWith(version.id));
    expect(markEdit.showAlert).not.toHaveBeenCalled();
  });

  test('identical content explains why Restore is unavailable', async() => {
    const differentVersion = createVersion('different');
    const identicalVersion = createVersion('identical');

    markEdit.getFileVersions.mockResolvedValue([differentVersion, identicalVersion]);
    markEdit.getFileVersionContent.mockImplementation((id: string) => Promise.resolve(
      id === identicalVersion.id ? 'current' : 'different content',
    ));

    showVersionBrowser();
    await waitForRenderedContent('different content');
    selectVersion(identicalVersion.id);
    await waitForRenderedContent('current');

    const restoreButton = getButton('restore');
    expect(restoreButton.disabled).toBe(false);
    expect(restoreButton.getAttribute('aria-disabled')).toBe('true');
    expect(document.getElementById(restoreButton.getAttribute('aria-describedby') ?? '')?.textContent).toBe('The selected version is identical to the current document.');
    expect(restoreButton.parentElement?.title).toBe('The selected version is identical to the current document.');

    restoreButton.click();
    expect(markEdit.restoreFileVersion).not.toHaveBeenCalled();
  });

  test('an iCloud version becomes downloaded after its content arrives', async() => {
    const localVersion = createVersion('local');
    const version = createVersion('icloud', false);
    const content = deferred<string>();

    markEdit.getFileVersions.mockResolvedValue([localVersion, version]);
    markEdit.getFileVersionContent.mockImplementation((id: string) => (
      id === version.id ? content.promise : Promise.resolve('local content')
    ));

    showVersionBrowser();
    await waitForRenderedContent('local content');
    selectVersion(version.id);

    const indicator = await vi.waitFor(() => {
      const element = document.querySelector<HTMLElement>('.version-browser-nonlocal');
      expect(element?.classList.contains('is-visible')).toBe(true);
      return element!;
    });
    expect(indicator.title).toBe('Stored in iCloud');
    expect(indicator.getAttribute('role')).toBe('img');
    expect(getButton('delete').disabled).toBe(false);
    expect(getButton('delete').getAttribute('aria-disabled')).toBe('true');
    expect(document.getElementById(getButton('delete').getAttribute('aria-describedby') ?? '')?.textContent).toBe('Versions stored in iCloud cannot be deleted.');
    getButton('delete').click();
    expect(markEdit.showAlert).not.toHaveBeenCalled();

    content.resolve('icloud content');
    await vi.waitFor(() => expect(indicator.title).toBe('Downloaded from iCloud'));
    expect(indicator.classList.contains('is-downloaded')).toBe(true);
    expect(diff.create.mock.calls.at(-1)?.[2]).toBe('icloud content');
  });

  test('version picker focus styling follows keyboard input', async() => {
    const version = createVersion('first');

    markEdit.getFileVersions.mockResolvedValue([version]);
    markEdit.getFileVersionContent.mockResolvedValue('first content');

    showVersionBrowser();
    await waitForRenderedContent('first content');

    const overlay = document.querySelector<HTMLElement>('.markedit-version-browser')!;
    const select = getVersionSelect();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(overlay.classList.contains('is-keyboard-navigation')).toBe(true);

    select.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(overlay.classList.contains('is-keyboard-navigation')).toBe(false);
  });
});

class ResizeObserverStub {
  observe(): void {}
  disconnect(): void {}
}

function createVersion(id: string, isLocal = true): FileVersion {
  return {
    id,
    modificationDate: new Date(0),
    isLocal,
  };
}

function getVersionSelect(): HTMLSelectElement {
  return document.querySelector<HTMLSelectElement>('.version-browser-select')!;
}

function selectVersion(id: string): void {
  const select = getVersionSelect();
  select.value = id;
  select.dispatchEvent(new Event('change', { bubbles: true }));
}

function getButton(action: 'restore' | 'delete'): HTMLButtonElement {
  return document.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!;
}

function getStatus(): HTMLElement {
  return document.querySelector<HTMLElement>('.version-browser-status')!;
}

async function waitForRenderedContent(content: string): Promise<void> {
  await vi.waitFor(() => expect(diff.create).toHaveBeenCalledWith(
    expect.anything(),
    'current',
    content,
    'unified',
  ));
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}
