import assert from 'node:assert/strict';
import type { FileVersion } from 'markedit-api';
import { afterEach, test } from 'vitest';
import { createRequestGate, keepFocusWithinBrowser, updateBrowserActions } from '../src/interaction.ts';
import type { BrowserElements } from '../src/view.ts';

const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');

afterEach(() => {
  if (originalDocument === undefined) {
    Reflect.deleteProperty(globalThis, 'document');
  } else {
    Object.defineProperty(globalThis, 'document', originalDocument);
  }
});

test('request gate rejects superseded and invalidated requests', () => {
  const requests = createRequestGate();
  const firstRequest = requests.begin();
  const secondRequest = requests.begin();

  assert.equal(requests.isCurrent(firstRequest), false);
  assert.equal(requests.isCurrent(secondRequest), true);

  requests.invalidate();
  assert.equal(requests.isCurrent(secondRequest), false);
});

test('iCloud versions cannot be deleted and reflect download state', () => {
  const context = createActionContext();
  const version = createVersion(false);

  updateBrowserActions(context.elements, {
    busy: false,
    hasVersions: true,
    selectedVersion: version,
    isDownloaded: false,
    hasDifferences: true,
  });

  assert.equal(context.nonlocalIndicator.classList.contains('is-visible'), true);
  assert.equal(context.nonlocalIndicator.getAttribute('aria-hidden'), 'false');
  assert.equal(context.nonlocalIndicator.title, 'Stored in iCloud');
  assert.equal(context.nonlocalIndicator.classList.contains('is-downloaded'), false);
  assert.equal(context.deleteButton.disabled, false);
  assert.equal(context.deleteButton.getAttribute('aria-disabled'), 'true');
  assert.equal(context.deleteButton.getAttribute('aria-describedby'), context.deleteDescription.id);
  assert.equal(context.deleteWrapper.title, 'Versions stored in iCloud cannot be deleted.');

  updateBrowserActions(context.elements, {
    busy: false,
    hasVersions: true,
    selectedVersion: version,
    isDownloaded: true,
    hasDifferences: true,
  });

  assert.equal(context.nonlocalIndicator.title, 'Downloaded from iCloud');
  assert.equal(context.nonlocalIndicator.classList.contains('is-downloaded'), true);
});

test('local versions enable actions unless the browser is busy', () => {
  const context = createActionContext();
  const state = {
    busy: false,
    hasVersions: true,
    selectedVersion: createVersion(true),
    isDownloaded: false,
    hasDifferences: true,
  };

  updateBrowserActions(context.elements, state);
  assert.equal(context.nonlocalIndicator.classList.contains('is-visible'), false);
  assert.equal(context.nonlocalIndicator.getAttribute('aria-hidden'), 'true');
  assert.equal(context.restoreButton.disabled, false);
  assert.equal(context.deleteButton.disabled, false);
  assert.equal(context.deleteButton.getAttribute('aria-disabled'), null);
  assert.equal(context.deleteButton.getAttribute('aria-describedby'), null);
  assert.equal(context.versionSelect.disabled, false);
  assert.equal(context.layoutButton.disabled, false);

  updateBrowserActions(context.elements, { ...state, busy: true });
  assert.equal(context.restoreButton.disabled, true);
  assert.equal(context.deleteButton.disabled, true);
  assert.equal(context.versionSelect.disabled, true);
  assert.equal(context.layoutButton.disabled, true);
});

test('identical content keeps Restore focusable and explains why it is unavailable', () => {
  const context = createActionContext();
  const state = {
    busy: false,
    hasVersions: true,
    selectedVersion: createVersion(true),
    isDownloaded: false,
    hasDifferences: false,
  };

  updateBrowserActions(context.elements, state);
  assert.equal(context.restoreButton.disabled, false);
  assert.equal(context.restoreButton.getAttribute('aria-disabled'), 'true');
  assert.equal(context.restoreButton.getAttribute('aria-describedby'), context.restoreDescription.id);
  assert.equal(context.restoreWrapper.title, 'The selected version is identical to the current document.');

  updateBrowserActions(context.elements, { ...state, hasDifferences: true });
  assert.equal(context.restoreButton.getAttribute('aria-disabled'), null);
  assert.equal(context.restoreButton.getAttribute('aria-describedby'), null);
  assert.equal(context.restoreWrapper.title, '');
});

test('focus wraps forward from the final control', () => {
  const context = createFocusContext();
  context.last.focus();

  keepFocusWithinBrowser(context.overlay, context.createEvent(false));
  assert.equal(context.activeElement(), context.first);
  assert.equal(context.defaultPrevented(), true);
});

test('focus wraps backward from the first control', () => {
  const context = createFocusContext();
  context.first.focus();

  keepFocusWithinBrowser(context.overlay, context.createEvent(true));
  assert.equal(context.activeElement(), context.last);
  assert.equal(context.defaultPrevented(), true);
});

test('focus enters the controls from the browser overlay', () => {
  const context = createFocusContext();
  context.overlay.focus();

  keepFocusWithinBrowser(context.overlay, context.createEvent(false));
  assert.equal(context.activeElement(), context.first);

  context.overlay.focus();
  keepFocusWithinBrowser(context.overlay, context.createEvent(true));
  assert.equal(context.activeElement(), context.last);
  assert.equal(context.defaultPrevented(), true);
});

test('focus stays within an empty browser', () => {
  const context = createFocusContext([]);
  keepFocusWithinBrowser(context.overlay, context.createEvent(false));
  assert.equal(context.activeElement(), context.overlay);
  assert.equal(context.defaultPrevented(), true);
});

function createFocusContext(elements?: HTMLElement[]) {
  let activeElement: HTMLElement | null = null;
  let prevented = false;
  const documentStub = { get activeElement() { return activeElement; } };

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: documentStub,
  });

  const createElement = () => ({
    focus() {
      activeElement = this as unknown as HTMLElement;
    },
  }) as unknown as HTMLElement;

  const first = createElement();
  const last = createElement();
  const focusableElements = elements ?? [first, last];
  const overlay = {
    contains(element: HTMLElement) {
      return element === overlay || focusableElements.includes(element);
    },
    focus() {
      activeElement = this as unknown as HTMLElement;
    },
    querySelectorAll() {
      return focusableElements;
    },
  } as unknown as HTMLElement;

  return {
    first,
    last,
    overlay,
    activeElement: () => activeElement,
    defaultPrevented: () => prevented,
    createEvent: (shiftKey: boolean) => ({
      shiftKey,
      preventDefault() {
        prevented = true;
      },
    }) as KeyboardEvent,
  };
}

function createVersion(isLocal: boolean): FileVersion {
  return {
    id: isLocal ? 'local' : 'icloud',
    modificationDate: new Date(0),
    isLocal,
  };
}

function createActionContext() {
  const classes = new Set<string>();
  const attributes = new Map<string, string>();
  const nonlocalIndicator = {
    title: '',
    classList: {
      toggle(name: string, enabled: boolean) {
        if (enabled) {
          classes.add(name);
        } else {
          classes.delete(name);
        }
      },
      contains(name: string) {
        return classes.has(name);
      },
    },
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
    getAttribute(name: string) {
      return attributes.get(name) ?? null;
    },
  } as unknown as HTMLElement;

  const versionSelect = { disabled: true } as HTMLSelectElement;
  const restoreWrapper = { title: '' } as HTMLElement;
  const deleteWrapper = { title: '' } as HTMLElement;
  const restoreDescription = { id: 'restore-description' } as HTMLElement;
  const deleteDescription = { id: 'delete-description' } as HTMLElement;
  const restoreButtonAttributes = new Map<string, string>();

  const restoreButton = {
    disabled: true,
    setAttribute(name: string, value: string) {
      restoreButtonAttributes.set(name, value);
    },
    removeAttribute(name: string) {
      restoreButtonAttributes.delete(name);
    },
    getAttribute(name: string) {
      return restoreButtonAttributes.get(name) ?? null;
    },
  } as HTMLButtonElement;

  const deleteButtonAttributes = new Map<string, string>();
  const deleteButton = {
    disabled: true,
    setAttribute(name: string, value: string) {
      deleteButtonAttributes.set(name, value);
    },
    removeAttribute(name: string) {
      deleteButtonAttributes.delete(name);
    },
    getAttribute(name: string) {
      return deleteButtonAttributes.get(name) ?? null;
    },
  } as HTMLButtonElement;

  const layoutButton = { disabled: true } as HTMLButtonElement;
  const elements = {
    versionSelect,
    nonlocalIndicator,
    restoreWrapper,
    deleteWrapper,
    restoreDescription,
    deleteDescription,
    restoreButton,
    deleteButton,
    layoutButtons: [layoutButton],
  } as BrowserElements;

  return {
    elements,
    versionSelect,
    nonlocalIndicator,
    restoreWrapper,
    deleteWrapper,
    restoreDescription,
    deleteDescription,
    restoreButton,
    deleteButton,
    layoutButton,
  };
}
