import { afterEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const axeRun = vi.fn(async () => ({ violations: [] }));
  return {
    axeRun,
    axeCore: { default: { run: axeRun } },
    browserContext: { page: { viewport: vi.fn() } },
  };
});

vi.mock('axe-core', () => mocks.axeCore);
vi.mock('@vitest/browser/context', () => mocks.browserContext);

import { expectNoAxeViolations } from './browser';

const originalGetAnimations = Object.getOwnPropertyDescriptor(document, 'getAnimations');

afterEach(() => {
  if (originalGetAnimations) Object.defineProperty(document, 'getAnimations', originalGetAnimations);
  else Reflect.deleteProperty(document, 'getAnimations');
  mocks.axeRun.mockClear();
});

it('waits for animations and ignores cancelled animations before running axe', async () => {
  let finishRunning!: () => void;
  let cancelAnimation!: (reason: DOMException) => void;
  const running = {
    playState: 'running',
    finished: new Promise<void>((resolve) => { finishRunning = resolve; }),
  };
  const cancelledFinished = new Promise<never>((_, reject) => {
    cancelAnimation = (reason) => reject(reason);
  });
  cancelledFinished.catch(() => {});
  const cancelled = { playState: 'running', finished: cancelledFinished };
  Object.defineProperty(document, 'getAnimations', {
    configurable: true,
    value: () => [running, cancelled],
  });

  const check = expectNoAxeViolations(document.body);
  cancelled.playState = 'idle';
  cancelAnimation(new DOMException('Animation was cancelled', 'AbortError'));
  await Promise.resolve();
  expect(mocks.axeRun).not.toHaveBeenCalled();

  running.playState = 'finished';
  finishRunning();
  await expect(check).resolves.toBeUndefined();
  expect(mocks.axeRun).toHaveBeenCalledOnce();
});
