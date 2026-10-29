import 'bootstrap/dist/css/bootstrap.min.css';
import '../../index.css';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { page } from '@vitest/browser/context';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '../../test/browser';
import { notify } from '../../services/notify';
import { Toaster } from './sonner';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('Sonner notifications in Chromium', () => {
  let container;
  let root;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('announces visible notifications, reflows, and supports keyboard dismissal', async () => {
    container = document.createElement('main');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => root.render(<Toaster />));
    const region = document.querySelector('section[aria-live="polite"]');
    expect(region).toBeTruthy();

    await act(async () => {
      notify.success('Item claimed');
      notify.error("Couldn't save the access path", { reference: 'SYNTH-42' });
      await vi.waitFor(() => {
        expect(region.textContent).toContain('Item claimed');
        expect(region.textContent).toContain("Couldn't save the access path. Reference: SYNTH-42");
      });
    });

    const toast = document.querySelector('[data-sonner-toast][data-type="error"]');
    const closeButton = page.getByRole('button', { name: 'Dismiss notification' });
    expect(region?.getAttribute('aria-label')).toContain('Notifications');
    expect(region?.textContent).toContain('Item claimed');
    expect(region?.textContent).toContain("Couldn't save the access path. Reference: SYNTH-42");
    expect(toast?.classList.contains('toast')).toBe(false);
    expect(window.getComputedStyle(toast).display).not.toBe('none');
    expect(toast.getBoundingClientRect().width).toBeGreaterThan(0);
    expect(closeButton).toBeTruthy();
    expect(closeButton.element().getBoundingClientRect().width).toBeGreaterThanOrEqual(24);
    expect(closeButton.element().getBoundingClientRect().height).toBeGreaterThanOrEqual(24);
    await expectNoAxeViolations(document.body);
    await expectNoHorizontalOverflow([320, 768, 1280]);

    await closeButton.focus();
    await page.keyboard.press('Enter');
    await page.getByText("Couldn't save the access path. Reference: SYNTH-42").waitFor({ state: 'detached' });
  });
});
