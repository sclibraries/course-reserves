import { act, forwardRef, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/services/discoverySearchService', () => ({
  searchDiscovery: vi.fn(),
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: forwardRef<HTMLDivElement, { children: ReactNode; className?: string }>(
    ({ children, className }, ref) => <div ref={ref} className={className}>{children}</div>
  ),
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: forwardRef<HTMLDivElement, { children: ReactNode; className?: string }>(
    ({ children, className }, ref) => <div ref={ref} className={className}>{children}</div>
  ),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({
    children,
    className,
  }: {
    children: ReactNode;
    className?: string;
  }) => <div className={className}>{children}</div>,
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
  SelectContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { DiscoverySearchDialog } from './DiscoverySearchDialog';

describe('DiscoverySearchDialog', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });

    container?.remove();
    container = null;
    root = null;
    document.body.innerHTML = '';
  });

  it('keeps the citation submit button outside the scrollable editor content', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <DiscoverySearchDialog
          open={true}
          onOpenChange={() => undefined}
          onItemsSelected={() => undefined}
        />
      );
    });

    const citationModeButton = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Citation Search')
    );

    expect(citationModeButton).toBeTruthy();

    act(() => {
      citationModeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const submitButton = Array.from(document.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Parse & Search Citations')
    ) as HTMLButtonElement | undefined;

    expect(submitButton).toBeTruthy();

    const form = submitButton?.closest('form') as HTMLFormElement | null;
    expect(form).toBeTruthy();

    const scrollableEditorContent = form?.firstElementChild as HTMLElement | null;

    expect(scrollableEditorContent?.className).toContain('overflow-y-auto');
    expect(submitButton?.className).toContain('shrink-0');
  });
});