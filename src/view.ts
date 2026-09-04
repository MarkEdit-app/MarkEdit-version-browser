import type { FileVersion } from 'markedit-api';
import type { DiffStyle } from './diff';
import browserCSS from '../assets/browser.css?inline';
import browserHTML from '../assets/browser.html?raw';
import cloudSVG from '../assets/cloud.svg?raw';
import downloadedSVG from '../assets/downloaded.svg?raw';

export interface BrowserElements {
  overlay: HTMLElement;
  versionSelect: HTMLSelectElement;
  status: HTMLElement;
  diffContainer: HTMLElement;
  nonlocalIndicator: HTMLElement;
  restoreWrapper: HTMLElement;
  deleteWrapper: HTMLElement;
  restoreDescription: HTMLElement;
  deleteDescription: HTMLElement;
  restoreButton: HTMLButtonElement;
  deleteButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
  layoutButtons: HTMLButtonElement[];
}

const versionDateFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
});

// Unique identifier for each instance to ensure unique element IDs
let browserInstanceID = 0;

export function createBrowserElements(diffStyle: DiffStyle): BrowserElements | undefined {
  const overlay = document.createElement('section');
  overlay.className = 'markedit-version-browser';
  overlay.tabIndex = -1;
  overlay.setAttribute('aria-label', 'Version browser');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('role', 'dialog');
  overlay.innerHTML = browserHTML;

  const versionSelect = overlay.querySelector<HTMLSelectElement>('.version-browser-select');
  const status = overlay.querySelector<HTMLElement>('.version-browser-status');
  const diffContainer = overlay.querySelector<HTMLElement>('.version-browser-diff');
  const nonlocalIndicator = overlay.querySelector<HTMLElement>('.version-browser-nonlocal');
  const restoreWrapper = overlay.querySelector<HTMLElement>('.version-browser-restore-wrapper');
  const deleteWrapper = overlay.querySelector<HTMLElement>('.version-browser-delete-wrapper');
  const restoreDescription = overlay.querySelector<HTMLElement>('.version-browser-restore-description');
  const deleteDescription = overlay.querySelector<HTMLElement>('.version-browser-delete-description');
  const restoreButton = overlay.querySelector<HTMLButtonElement>('[data-action="restore"]');
  const deleteButton = overlay.querySelector<HTMLButtonElement>('[data-action="delete"]');
  const closeButton = overlay.querySelector<HTMLButtonElement>('[data-action="close"]');

  if (versionSelect === null || status === null || diffContainer === null || nonlocalIndicator === null || restoreWrapper === null || deleteWrapper === null || restoreDescription === null || deleteDescription === null || restoreButton === null || deleteButton === null || closeButton === null) {
    return undefined;
  }

  browserInstanceID += 1;
  restoreDescription.id = `version-browser-restore-description-${browserInstanceID}`;
  deleteDescription.id = `version-browser-delete-description-${browserInstanceID}`;

  const layoutButtons = Array.from(overlay.querySelectorAll<HTMLButtonElement>('[data-style]'));
  setLayoutButtonState(layoutButtons, diffStyle);
  nonlocalIndicator.innerHTML = `
    <span class="version-browser-cloud version-browser-cloud-download">${cloudSVG}</span>
    <span class="version-browser-cloud version-browser-cloud-downloaded">${downloadedSVG}</span>
  `;

  return {
    overlay,
    versionSelect,
    status,
    diffContainer,
    nonlocalIndicator,
    restoreWrapper,
    deleteWrapper,
    restoreDescription,
    deleteDescription,
    restoreButton,
    deleteButton,
    closeButton,
    layoutButtons,
  };
}

export function populateVersionSelect(select: HTMLSelectElement, versions: FileVersion[]): void {
  const options = versions.map((version) => new Option(
    versionDateFormatter.format(new Date(version.modificationDate)),
    version.id,
  ));

  select.replaceChildren(...options);
}

export function setLayoutButtonState(buttons: HTMLButtonElement[], diffStyle: DiffStyle): void {
  buttons.forEach((button) => {
    const selected = button.dataset.style === diffStyle;
    button.classList.toggle('active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

export function installBrowserStyle(): HTMLStyleElement {
  const style = document.createElement('style');
  style.textContent = browserCSS;
  document.head.appendChild(style);
  return style;
}
