import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StickyTop from './StickyTop';

const bannerMock = vi.hoisted(() => ({ visible: true }));

vi.mock('@/components/ActingForBanner', () => ({
  ActingForBanner: () => bannerMock.visible
    ? <div role="status" data-testid="acting-for-banner">Acting for Test Faculty</div>
    : null,
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('StickyTop', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    bannerMock.visible = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('orders the page header, acting-for banner, then optional toolbar in one natural-height sticky region', () => {
    act(() => root?.render(
      <StickyTop
        header={<header data-testid="page-header">Header</header>}
        toolbar={<div data-testid="page-toolbar">Toolbar</div>}
      />,
    ));

    const region = container?.querySelector('[data-testid="page-sticky-top"]');
    const header = region?.querySelector('[data-testid="page-header"]');
    const banner = region?.querySelector('[data-testid="acting-for-banner"]');
    const toolbar = region?.querySelector('[data-testid="page-toolbar"]');

    expect(region?.classList.contains('sticky')).toBe(true);
    expect(region?.classList.contains('top-0')).toBe(true);
    expect(region?.className).not.toMatch(/h-16|top-16/);
    expect(header).not.toBeNull();
    expect(banner).not.toBeNull();
    expect(toolbar).not.toBeNull();
    expect(Boolean(header!.compareDocumentPosition(banner!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(banner!.compareDocumentPosition(toolbar!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
  });

  it('omits the banner when no faculty member is selected', () => {
    bannerMock.visible = false;
    act(() => root?.render(
      <StickyTop header={<header data-testid="page-header">Header</header>} />,
    ));

    const region = container?.querySelector('[data-testid="page-sticky-top"]');
    expect(region?.querySelector('[data-testid="page-header"]')).not.toBeNull();
    expect(region?.querySelector('[data-testid="acting-for-banner"]')).toBeNull();
    expect(region?.querySelector('[data-testid="page-toolbar"]')).toBeNull();
  });
});
