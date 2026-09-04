import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createBrowserStatus } from '../src/status.ts';

test('loading status delay, cancellation, and minimum duration', async() => {
  const clock = new FakeClock();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalPerformance = Object.getOwnPropertyDescriptor(globalThis, 'performance');

  Object.defineProperties(globalThis, {
    window: { configurable: true, value: clock.window },
    document: {
      configurable: true,
      value: { createElement: () => ({ className: '' }) },
    },
    performance: {
      configurable: true,
      value: { now: () => clock.now },
    },
  });

  try {
    const statusElement = new StatusElement();
    const diffContainer = { hidden: false } as HTMLElement;
    const status = createBrowserStatus(
      statusElement as unknown as HTMLElement,
      diffContainer,
      () => false,
    );

    const loadingID = status.show('Fetching contents...', true);
    assert.equal(statusElement.hidden, true);
    assert.equal(statusElement.text, 'Fetching contents...');
    assert.equal(diffContainer.hidden, true);

    clock.advance(299);
    assert.equal(statusElement.hidden, true);
    assert.equal(statusElement.spinnerCount, 0);

    clock.advance(1);
    assert.equal(statusElement.hidden, false);
    assert.equal(statusElement.spinnerCount, 1);

    let settled = false;
    const settling = status.settle(loadingID).then(() => settled = true);

    clock.advance(199);
    await Promise.resolve();
    assert.equal(settled, false);

    clock.advance(1);
    await settling;
    assert.equal(settled, true);

    status.show('Loading versions...', true);
    status.hide();
    clock.advance(300);
    assert.equal(statusElement.hidden, true);
    assert.equal(statusElement.spinnerCount, 1);

    const staleID = status.show('Fetching contents...', true);
    status.show('The version could not be loaded.');
    await status.settle(staleID);
    clock.advance(300);
    assert.equal(statusElement.hidden, false);
    assert.equal(statusElement.text, 'The version could not be loaded.');
    assert.equal(statusElement.spinnerCount, 1);
  } finally {
    restoreProperty('window', originalWindow);
    restoreProperty('document', originalDocument);
    restoreProperty('performance', originalPerformance);
  }
});

class StatusElement {
  hidden = false;
  text = '';
  spinnerCount = 0;

  replaceChildren(): void {
    this.text = '';
  }

  append(message: string): void {
    this.text += message;
  }

  prepend(): void {
    this.spinnerCount += 1;
  }
}

class FakeClock {
  now = 0;
  private nextTimerID = 1;
  private timers = new Map<number, { time: number; callback: () => void }>();

  readonly window = {
    setTimeout: (callback: () => void, delay = 0) => {
      const timerID = this.nextTimerID++;
      this.timers.set(timerID, { time: this.now + delay, callback });
      return timerID;
    },
    clearTimeout: (timerID?: number) => {
      if (timerID !== undefined) {
        this.timers.delete(timerID);
      }
    },
  };

  advance(duration: number): void {
    const targetTime = this.now + duration;

    while (true) {
      const nextTimer = [...this.timers.entries()]
        .filter(([, timer]) => timer.time <= targetTime)
        .sort((left, right) => left[1].time - right[1].time)[0];

      if (nextTimer === undefined) {
        break;
      }

      const [timerID, timer] = nextTimer;
      this.timers.delete(timerID);
      this.now = timer.time;
      timer.callback();
    }

    this.now = targetTime;
  }
}

function restoreProperty(name: 'window' | 'document' | 'performance', descriptor?: PropertyDescriptor): void {
  if (descriptor === undefined) {
    delete (globalThis as Record<string, unknown>)[name];
  } else {
    Object.defineProperty(globalThis, name, descriptor);
  }
}
