import type { FileVersion } from 'markedit-api';
import { MarkEdit } from 'markedit-api';
import { createRequestGate, keepFocusWithinBrowser, updateBrowserActions } from './interaction';
import { createBrowserStatus } from './status';
import { createBrowserElements, installBrowserStyle, populateVersionSelect, setLayoutButtonState } from './view';
import { createDiff, getStoredDiffStyle, storeDiffStyle, type RenderedDiff } from './diff';

let closeBrowserHandler: (() => void) | undefined;

async function getBrowsableVersions(
  currentContent: string,
  contentCache: Map<string, string>,
): Promise<FileVersion[]> {
  const versions = await MarkEdit.getFileVersions();
  const latestVersion = versions[0];
  if (latestVersion === undefined) {
    return versions;
  }

  let latestContent: string | undefined;
  try {
    latestContent = await MarkEdit.getFileVersionContent(latestVersion.id);
  } catch {
    return versions;
  }

  if (latestContent === undefined) {
    return versions;
  }

  contentCache.set(latestVersion.id, latestContent);
  return latestContent === currentContent ? versions.slice(1) : versions;
}

export function showVersionBrowser(): void {
  if (typeof MarkEdit.getFileVersions !== 'function') {
    void MarkEdit.showAlert({
      title: 'Version Browser Unavailable',
      message: 'This version of MarkEdit does not support file version history.',
      buttons: ['OK', 'Get Latest Version'],
    }).then((choice) => {
      if (choice > 0) {
        open('https://github.com/MarkEdit-app/MarkEdit/releases/latest');
      }
    });

    return;
  }

  closeBrowserHandler?.();
  const editorView = MarkEdit.editorView;
  const currentContent = MarkEdit.editorAPI.getText();
  let diffStyle = getStoredDiffStyle();
  const elements = createBrowserElements(diffStyle);
  if (elements === undefined) {
    return;
  }

  const {
    overlay,
    versionSelect,
    status,
    diffContainer,
    restoreButton,
    deleteButton,
    closeButton,
    layoutButtons,
  } = elements;

  const style = installBrowserStyle();
  const editorElement = editorView.dom;
  const positionOverlay = () => {
    const bounds = editorElement.getBoundingClientRect();
    Object.assign(overlay.style, {
      top: `${bounds.top}px`,
      left: `${bounds.left}px`,
      width: `${bounds.width}px`,
      height: `${bounds.height}px`,
    });
  };

  document.body.appendChild(overlay);
  positionOverlay();
  requestAnimationFrame(() => overlay.classList.add('is-visible'));
  editorView.contentDOM.blur();

  let versions: FileVersion[] = [];
  let selectedVersion: FileVersion | undefined;
  let selectedContent: string | undefined;
  let diff: RenderedDiff | undefined;
  let busy = false;
  let closing = false;
  let cleanedUp = false;

  const contentCache = new Map<string, string>();
  const requestGate = createRequestGate();
  const resizeObserver = new ResizeObserver(positionOverlay);
  resizeObserver.observe(editorElement);

  const isCurrentContext = () => MarkEdit.editorView === editorView;
  const browserStatus = createBrowserStatus(status, diffContainer, () => closing);

  const updateActions = () => {
    const isNonlocal = selectedVersion?.isLocal === false;
    const isDownloaded = selectedVersion !== undefined && isNonlocal && contentCache.has(selectedVersion.id);

    updateBrowserActions(elements, {
      busy,
      hasVersions: versions.length > 0,
      selectedVersion,
      isDownloaded,
      hasDifferences: selectedContent === undefined ? undefined : selectedContent !== currentContent,
    });
  };

  const setBusy = (value: boolean, message?: string) => {
    if (value) {
      requestGate.invalidate();
    }

    busy = value;
    overlay.setAttribute('aria-busy', String(value));
    if (message !== undefined) {
      browserStatus.show(message, true);
    }

    updateActions();
  };

  const renderDiff = () => {
    if (selectedVersion === undefined || selectedContent === undefined) {
      return;
    }

    diff?.cleanUp();
    diffContainer.replaceChildren();
    diff = createDiff(diffContainer, currentContent, selectedContent, diffStyle);
    browserStatus.hide();
    diffContainer.hidden = false;
  };

  const selectVersion = async(version: FileVersion) => {
    selectedVersion = version;
    selectedContent = undefined;
    versionSelect.value = version.id;
    const currentRequest = requestGate.begin();
    const hasCachedContent = contentCache.has(version.id);
    overlay.setAttribute('aria-busy', 'true');
    const loadingStatusID = hasCachedContent ? undefined : browserStatus.show('Fetching contents...', true);
    if (loadingStatusID === undefined) {
      browserStatus.hide();
    }

    updateActions();
    if (closing || !requestGate.isCurrent(currentRequest)) {
      return;
    }

    let content = contentCache.get(version.id);
    if (!hasCachedContent) {
      try {
        content = await MarkEdit.getFileVersionContent(version.id);
      } catch {
        if (!closing && requestGate.isCurrent(currentRequest)) {
          overlay.setAttribute('aria-busy', 'false');
          browserStatus.show('The version could not be loaded.');
        }

        return;
      }

      if (content !== undefined) {
        contentCache.set(version.id, content);
      }
    }

    if (closing || !requestGate.isCurrent(currentRequest)) {
      return;
    }

    if (!isCurrentContext()) {
      close();
      return;
    }

    overlay.setAttribute('aria-busy', 'false');
    if (content === undefined) {
      browserStatus.show('This version is no longer available.');
      return;
    }

    if (loadingStatusID !== undefined) {
      await browserStatus.settle(loadingStatusID);
    }

    if (closing || !requestGate.isCurrent(currentRequest)) {
      return;
    }

    selectedContent = content;
    updateActions();
    renderDiff();
  };

  const renderVersions = () => {
    versionSelect.setAttribute('aria-busy', 'false');
    if (versions.length === 0) {
      versionSelect.replaceChildren(new Option('No saved versions'));
      versionSelect.disabled = true;
      browserStatus.show('No saved versions are available for this document.');
      return;
    }

    populateVersionSelect(versionSelect, versions);
    versionSelect.disabled = false;
    void selectVersion(versions[0]);
  };

  const reloadVersions = async() => {
    versions = [];
    selectedVersion = undefined;
    selectedContent = undefined;
    setBusy(true, 'Loading versions...');
    versionSelect.disabled = true;
    versionSelect.replaceChildren(new Option());
    versionSelect.setAttribute('aria-busy', 'true');

    if (closing) {
      return;
    }

    try {
      versions = await getBrowsableVersions(currentContent, contentCache);
    } catch {
      if (!closing) {
        versionSelect.setAttribute('aria-busy', 'false');
        setBusy(false);
        browserStatus.show('Version history could not be loaded.');
      }

      return;
    }

    if (closing || !isCurrentContext()) {
      close();
      return;
    }

    setBusy(false);
    renderVersions();
  };

  const restoreVersion = async() => {
    if (selectedVersion === undefined || selectedContent === undefined || selectedContent === currentContent || busy) {
      return;
    }

    const versionToRestore = selectedVersion;
    if (!isCurrentContext()) {
      return;
    }

    setBusy(true, 'Restoring version...');
    if (closing) {
      return;
    }

    let restored = false;
    try {
      restored = await MarkEdit.restoreFileVersion(versionToRestore.id);
    } catch {
      restored = false;
    }

    if (closing) {
      return;
    }

    if (restored) {
      close();
    } else {
      setBusy(false);
      browserStatus.show('The version could not be restored.');
    }
  };

  const deleteVersion = async() => {
    if (selectedVersion === undefined || !selectedVersion.isLocal || busy) {
      return;
    }

    const versionToDelete = selectedVersion;
    const choice = await MarkEdit.showAlert({
      title: 'Delete This Version?',
      message: 'This action cannot be undone.',
      buttons: ['Delete', 'Cancel'],
    });

    if (choice !== 0 || !isCurrentContext()) {
      return;
    }

    setBusy(true, 'Deleting version...');
    if (closing) {
      return;
    }

    let deleted = false;
    try {
      deleted = await MarkEdit.deleteLocalFileVersions([versionToDelete.id]);
    } catch {
      deleted = false;
    }

    if (closing) {
      return;
    }

    if (deleted) {
      contentCache.delete(versionToDelete.id);
      diff?.cleanUp();
      diff = undefined;
      await reloadVersions();
    } else {
      setBusy(false);
      browserStatus.show('The version could not be deleted.');
    }
  };

  const close = () => {
    if (closing) {
      return;
    }

    closing = true;
    requestGate.invalidate();
    browserStatus.dispose();
    window.removeEventListener('keydown', handleKeyDown, true);
    overlay.classList.remove('is-visible');
    overlay.style.pointerEvents = 'none';

    const cleanUp = () => {
      if (cleanedUp) {
        return;
      }

      cleanedUp = true;
      diff?.cleanUp();
      resizeObserver.disconnect();
      overlay.remove();
      style.remove();

      if (closeBrowserHandler === close) {
        closeBrowserHandler = undefined;
        if (isCurrentContext()) {
          editorView.focus();
        }
      }
    };

    overlay.addEventListener('transitionend', cleanUp, { once: true });
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
    window.setTimeout(cleanUp, delay);
  };

  layoutButtons.forEach((button) => {
    button.addEventListener('click', () => {
      diffStyle = button.dataset.style === 'split' ? 'split' : 'unified';
      storeDiffStyle(diffStyle);
      setLayoutButtonState(layoutButtons, diffStyle);
      renderDiff();
    });
  });

  restoreButton.addEventListener('click', () => void restoreVersion());
  deleteButton.addEventListener('click', () => void deleteVersion());
  closeButton.addEventListener('click', close);
  versionSelect.addEventListener('change', () => {
    const version = versions.find((candidate) => candidate.id === versionSelect.value);
    if (version !== undefined) {
      void selectVersion(version);
    }
  });

  overlay.addEventListener('pointerdown', () => overlay.classList.remove('is-keyboard-navigation'));
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Tab') {
      overlay.classList.add('is-keyboard-navigation');
      keepFocusWithinBrowser(overlay, event);
      return;
    }

    if (event.key === 'Escape' && !busy) {
      event.preventDefault();
      event.stopPropagation();
      close();
      return;
    }

    if ((event.key !== 'ArrowUp' && event.key !== 'ArrowDown') || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || busy || versions.length === 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    const offset = event.key === 'ArrowUp' ? -1 : 1;
    const currentIndex = versions.findIndex((version) => version.id === selectedVersion?.id);
    const nextIndex = Math.min(Math.max(currentIndex + offset, 0), versions.length - 1);
    if (nextIndex !== currentIndex) {
      void selectVersion(versions[nextIndex]);
    }
  };

  window.addEventListener('keydown', handleKeyDown, true);
  closeBrowserHandler = close;
  overlay.focus();
  void reloadVersions();
}
