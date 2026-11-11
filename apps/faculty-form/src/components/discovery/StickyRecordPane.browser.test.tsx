import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { getByRole } from '@testing-library/dom';
import { page } from '@vitest/browser/context';
import { afterEach, describe, expect, it } from 'vitest';
import StickyRecordPane from './StickyRecordPane';
import { expectNoAxeViolations, expectNoHorizontalOverflow } from '@/test/browser';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('StickyRecordPane in Chromium', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('keeps a tall record below the sticky header and above the tray while scrolling', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <div className="min-h-[1800px]">
          <div data-testid="page-sticky-top" style={{ position: 'sticky', top: 0, height: 72, zIndex: 10 }}>
            Page header
          </div>
          <main className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(20rem,38%)]">
            <ol className="min-w-0 space-y-3">
              {Array.from({ length: 50 }, (_, index) => <li key={index} className="h-8">Synthetic result {index + 1}</li>)}
            </ol>
            <StickyRecordPane tabIndex={0}>
              <ol className="space-y-3">
                {Array.from({ length: 80 }, (_, index) => (
                  <li key={index} data-testid={index === 79 ? 'last-record-line' : undefined}>
                    Synthetic record detail {index + 1}: {'longword'.repeat(20)}
                  </li>
                ))}
              </ol>
            </StickyRecordPane>
          </main>
          <aside
            aria-label="Added materials"
            style={{ position: 'sticky', bottom: 0, height: 60, zIndex: 10, background: 'white' }}
          >
            Added materials
          </aside>
        </div>,
      );
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });

    const pane = getByRole(container, 'region', { name: 'Full record' }) as HTMLDivElement;
    for (const width of [768, 1280]) {
      await page.viewport(width, 900);
      window.scrollTo(0, 500);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const bounds = {
        pane: pane.getBoundingClientRect(),
        header: container.querySelector('[data-testid="page-sticky-top"]')!.getBoundingClientRect(),
        tray: container.querySelector('aside[aria-label="Added materials"]')!.getBoundingClientRect(),
      };

      expect(bounds.pane.top).toBeGreaterThanOrEqual(bounds.header.bottom - 1);
      expect(bounds.pane.top).toBeLessThanOrEqual(window.innerHeight + 1);
      expect(bounds.pane.bottom).toBeLessThanOrEqual(bounds.tray.top + 1);
      expect(pane.scrollHeight).toBeGreaterThan(pane.clientHeight);
      pane.scrollTop = pane.scrollHeight;
      await new Promise((resolve) => requestAnimationFrame(resolve));
      expect(container.querySelector('[data-testid="last-record-line"]')!.getBoundingClientRect().bottom)
        .toBeLessThanOrEqual(pane.getBoundingClientRect().bottom + 1);
    }

    await expectNoHorizontalOverflow([320, 768, 1280]);
    await expectNoAxeViolations(container);
  });
});
