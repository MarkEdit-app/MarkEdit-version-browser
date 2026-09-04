import type { FileVersion } from 'markedit-api';
import type { BrowserElements } from './view';

export interface RequestGate {
  begin(): number;
  invalidate(): void;
  isCurrent(request: number): boolean;
}

export interface BrowserActionState {
  busy: boolean;
  hasVersions: boolean;
  selectedVersion?: FileVersion;
  isDownloaded: boolean;
  hasDifferences: boolean | undefined;
}

export function createRequestGate(): RequestGate {
  let currentRequest = 0;

  return {
    begin() {
      currentRequest += 1;
      return currentRequest;
    },

    invalidate() {
      currentRequest += 1;
    },

    isCurrent(request: number) {
      return request === currentRequest;
    },
  };
}

export function updateBrowserActions(elements: BrowserElements, state: BrowserActionState): void {
  const {
    versionSelect,
    nonlocalIndicator,
    restoreWrapper,
    deleteWrapper,
    restoreDescription,
    deleteDescription,
    restoreButton,
    deleteButton,
    layoutButtons,
  } = elements;

  const disabled = state.busy || state.selectedVersion === undefined;
  const isNonlocal = state.selectedVersion?.isLocal === false;
  const restoreHasNoDifferences = !disabled && state.hasDifferences === false;

  nonlocalIndicator.classList.toggle('is-visible', isNonlocal);
  nonlocalIndicator.setAttribute('aria-hidden', String(!isNonlocal));
  nonlocalIndicator.classList.toggle('is-downloaded', state.isDownloaded);
  nonlocalIndicator.title = state.isDownloaded ? 'Downloaded from iCloud' : 'Stored in iCloud';
  nonlocalIndicator.setAttribute('aria-label', nonlocalIndicator.title);

  restoreButton.disabled = disabled || state.hasDifferences === undefined;
  if (restoreHasNoDifferences) {
    restoreButton.setAttribute('aria-disabled', 'true');
    restoreButton.setAttribute('aria-describedby', restoreDescription.id);
  } else {
    restoreButton.removeAttribute('aria-disabled');
    restoreButton.removeAttribute('aria-describedby');
  }

  restoreWrapper.title = restoreHasNoDifferences ? 'The selected version is identical to the current document.' : '';
  deleteButton.disabled = disabled;
  if (isNonlocal) {
    deleteButton.setAttribute('aria-disabled', 'true');
    deleteButton.setAttribute('aria-describedby', deleteDescription.id);
  } else {
    deleteButton.removeAttribute('aria-disabled');
    deleteButton.removeAttribute('aria-describedby');
  }

  deleteWrapper.title = isNonlocal ? 'Versions stored in iCloud cannot be deleted.' : '';
  layoutButtons.forEach((button) => button.disabled = disabled);
  versionSelect.disabled = state.busy || !state.hasVersions;
}

export function keepFocusWithinBrowser(overlay: HTMLElement, event: KeyboardEvent): void {
  const focusableElements = Array.from(overlay.querySelectorAll<HTMLElement>(
    'button:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
  ));

  const firstElement = focusableElements[0];
  const lastElement = focusableElements.at(-1);

  if (firstElement === undefined || lastElement === undefined) {
    event.preventDefault();
    overlay.focus();
    return;
  }

  const activeElement = document.activeElement;
  const focusIsOutsideControls = activeElement === overlay || !overlay.contains(activeElement);
  if (event.shiftKey && (activeElement === firstElement || focusIsOutsideControls)) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && (activeElement === lastElement || focusIsOutsideControls)) {
    event.preventDefault();
    firstElement.focus();
  }
}
