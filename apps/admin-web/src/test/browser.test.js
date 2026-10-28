import { afterEach, expect, it, vi } from 'vitest';

const { axeRun } = vi.hoisted(() => ({ axeRun: vi.fn() }));

vi.mock('axe-core', () => ({ default: { run: axeRun } }));
vi.mock('@vitest/browser/context', () => ({ page: { viewport: vi.fn() } }));

import { expectNoAxeViolations } from './browser';

const originalGetAnimations = Object.getOwnPropertyDescriptor(document, 'getAnimations');

afterEach(() => {
  if (originalGetAnimations) Object.defineProperty(document, 'getAnimations', originalGetAnimations);
  else delete document.getAnimations;
  axeRun.mockReset();
});

it('waits for running animations and ignores cancellations before running axe', async () => {
  let finishRunning;
  let cancelAnimation;
  const running = {
    playState: 'running',
    finished: new Promise((resolve) => { finishRunning = resolve; }),
  };
  const cancelledFinished = new Promise((resolve, reject) => { cancelAnimation = reject; });
  cancelledFinished.catch(() => {});
  const cancelled = { playState: 'running', finished: cancelledFinished };
  Object.defineProperty(document, 'getAnimations', { configurable: true, value: () => [running, cancelled] });
  axeRun.mockResolvedValue({ violations: [] });

  const check = expectNoAxeViolations(document.body);
  cancelled.playState = 'idle';
  cancelAnimation(new DOMException('Animation was cancelled', 'AbortError'));
  await Promise.resolve();
  expect(axeRun).not.toHaveBeenCalled();

  running.playState = 'finished';
  finishRunning();
  await expect(check).resolves.toBeUndefined();
  expect(axeRun).toHaveBeenCalledOnce();
});
