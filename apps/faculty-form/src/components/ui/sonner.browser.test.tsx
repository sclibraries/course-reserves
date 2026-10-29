import '../../index.css';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { page } from '@vitest/browser/context';
import { afterEach, describe, expect, it } from 'vitest';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '@/test/browser';
import { notify } from '@/services/notify';
import { Toaster } from './sonner';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Sonner notifications in Chromium', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('renders each toast type, keeps errors dismissible, and stays accessible without overflow', async () => {
    let undone = false;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(<Toaster />);
      notify.success('Item added', {
        action: { label: 'Undo', onClick: () => { undone = true; } },
      });
      notify.info('Existing course list kept', { duration: Infinity });
      notify.error("Couldn't save the access path", { reference: '7F3K2Q' });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });

    expect(document.body.textContent).toContain('Item added');
    expect(document.body.textContent).toContain('Existing course list kept');
    expect(document.body.textContent).toContain("Couldn't save the access path");
    expect(document.body.textContent).toContain('Reference: 7F3K2Q');
    await page.getByRole('button', { name: 'Undo' }).click();
    expect(undone).toBe(true);

    const errorToast = document.querySelector('[data-sonner-toast][data-type="error"]');
    const closeButton = errorToast?.querySelector<HTMLButtonElement>('[data-close-button]');
    expect(closeButton).not.toBeNull();
    expect(closeButton?.getBoundingClientRect().width).toBeGreaterThanOrEqual(24);
    expect(closeButton?.getBoundingClientRect().height).toBeGreaterThanOrEqual(24);
    closeButton?.focus();
    await page.keyboard.press('Enter');
    await expect.poll(() => document.querySelector('[data-sonner-toast][data-type="error"]')).toBeNull();

    await expectNoAxeViolations(document.body);
    await expectNoHorizontalOverflow([320, 768, 1280]);
  });
});
