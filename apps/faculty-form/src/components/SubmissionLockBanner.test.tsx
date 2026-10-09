import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SubmissionLockBanner } from './SubmissionLockBanner';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('SubmissionLockBanner', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    document.body.innerHTML = '';
  });

  const render = (ui: React.ReactNode) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(ui));
  };

  const findButton = (label: string) =>
    Array.from(container!.querySelectorAll('button')).find((b) => b.textContent?.includes(label));

  it('shows who locked it and the reason', () => {
    render(
      <SubmissionLockBanner
        lockInfo={{ lockedBy: 'Jane Staff', lockedAt: '2026-06-20T10:00:00Z', lockReason: 'Processing' }}
        onRefresh={() => {}}
        onBack={() => {}}
      />
    );
    expect(container!.textContent).toContain('Jane Staff');
    expect(container!.textContent).toContain('Processing');
  });

  it('calls onRefresh when Refresh is clicked', () => {
    const onRefresh = vi.fn();
    render(
      <SubmissionLockBanner
        lockInfo={{ lockedBy: null, lockedAt: null, lockReason: null }}
        onRefresh={onRefresh}
        onBack={() => {}}
      />
    );
    act(() => {
      findButton('Refresh')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
