import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { notify } from '@/services/notify';
import { Toaster } from './sonner';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Sonner toaster', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('matchMedia', vi.fn((media: string) => ({
      matches: false,
      media,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<Toaster />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    toast.dismiss();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('renders an announced error with a keyboard-focusable close button', async () => {
    await act(async () => {
      notify.error("Couldn't save the access path", { reference: '7F3K2Q' });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(document.body.textContent).toContain("Couldn't save the access path");
    expect(document.body.textContent).toContain('Reference: 7F3K2Q');
    expect(document.querySelector('[aria-live="polite"], [aria-live="assertive"]')).not.toBeNull();
    const closeButton = document.querySelector<HTMLButtonElement>('button[aria-label="Close toast"]');
    expect(closeButton).not.toBeNull();
    expect(closeButton?.tabIndex).toBeGreaterThanOrEqual(0);
  });
});
