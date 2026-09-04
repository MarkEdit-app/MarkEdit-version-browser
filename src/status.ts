export interface BrowserStatus {
  show(message: string, loading?: boolean): number;
  hide(): void;
  settle(id: number): Promise<void>;
  dispose(): void;
}

const spinnerDelay = 300;
const spinnerMinimumDuration = 200;

export function createBrowserStatus(
  status: HTMLElement,
  diffContainer: HTMLElement,
  isClosing: () => boolean,
): BrowserStatus {
  let statusID = 0;
  let spinnerTimer: number | undefined;
  let spinnerShownAt: number | undefined;

  const dispose = () => {
    statusID += 1;
    window.clearTimeout(spinnerTimer);
    spinnerTimer = undefined;
    spinnerShownAt = undefined;
  };

  return {
    show(message: string, loading = false) {
      dispose();
      const currentStatusID = statusID;

      status.replaceChildren();
      status.append(message);

      if (loading) {
        status.hidden = true;
        spinnerTimer = window.setTimeout(() => {
          spinnerTimer = undefined;

          if (!isClosing() && currentStatusID === statusID) {
            const spinner = document.createElement('span');
            spinner.className = 'version-browser-spinner';
            status.prepend(spinner);
            status.hidden = false;
            spinnerShownAt = performance.now();
          }
        }, spinnerDelay);
      } else {
        status.hidden = false;
      }

      diffContainer.hidden = true;
      return currentStatusID;
    },

    hide() {
      dispose();
      status.hidden = true;
    },

    async settle(currentStatusID: number) {
      if (currentStatusID !== statusID) {
        return;
      }

      window.clearTimeout(spinnerTimer);
      spinnerTimer = undefined;
      const shownAt = spinnerShownAt;

      if (shownAt === undefined) {
        return;
      }

      const remaining = spinnerMinimumDuration - (performance.now() - shownAt);
      if (remaining > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, remaining));
      }

      if (currentStatusID === statusID && spinnerShownAt === shownAt) {
        spinnerShownAt = undefined;
      }
    },

    dispose,
  };
}
