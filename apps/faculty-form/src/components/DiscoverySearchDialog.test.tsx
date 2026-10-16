import { act, forwardRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/services/discoverySearchService', () => ({ searchDiscovery: vi.fn() }));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: forwardRef<HTMLDivElement, { children: ReactNode; className?: string }>(({ children, className }, ref) => <div ref={ref} className={className}>{children}</div>),
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: forwardRef<HTMLDivElement, { children: ReactNode; className?: string }>(({ children, className }, ref) => <div ref={ref} className={className}>{children}</div>),
}));

import { DiscoverySearchDialog } from './DiscoverySearchDialog';

describe('DiscoverySearchDialog citation flow', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
    document.body.innerHTML = '';
  });

  it('keeps citation matching while the library search moves to its full page', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<DiscoverySearchDialog open onOpenChange={() => undefined} onItemsSelected={() => undefined} />));

    expect(container.querySelector('textarea')).not.toBeNull();
    expect(container.textContent).toContain('Parse & Search Citations');
    expect(container.textContent).not.toContain('Simple Search');
    expect(container.querySelector('input[placeholder^="Search by title"]')).toBeNull();
  });
});
