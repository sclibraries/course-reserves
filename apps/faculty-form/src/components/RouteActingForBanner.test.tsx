import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouteActingForBanner } from './RouteActingForBanner';

vi.mock('@/components/ActingForBanner', () => ({
  ActingForBanner: () => <div role="status" data-testid="acting-for-banner">Acting for Test Faculty</div>,
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const stickyHeaderRoutes = [
  '/',
  '/new-submission',
  '/submission/reserve-test/edit',
  '/submission/reserve-test/edit/add',
  '/submission/reserve-test/edit/add/record/synthetic-db/synthetic-an',
  '/submission/reserve-test',
  '/clone-editor',
  '/clone-matching-test',
];

describe('RouteActingForBanner', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it.each(stickyHeaderRoutes)('does not duplicate the sticky-page banner on %s', (pathname) => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<MemoryRouter initialEntries={[pathname]}><RouteActingForBanner /></MemoryRouter>));

    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('shows a normal-flow banner on a page without a sticky header', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<MemoryRouter initialEntries={['/clone-previous']}><RouteActingForBanner /></MemoryRouter>));

    const banner = container.querySelector('[data-testid="acting-for-banner"]');
    expect(banner).not.toBeNull();
    expect(banner?.classList.contains('sticky')).toBe(false);
  });
});
