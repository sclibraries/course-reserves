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
import { searchDiscovery } from '@/services/discoverySearchService';

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

  it('keeps the typed query visible when search is unavailable', async () => {
    vi.mocked(searchDiscovery).mockRejectedValueOnce(new Error(
      'Library search is temporarily unavailable. Please try again later, or add the item by citation.\nReference: 7F3K2Q'
    ));
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

    const input = document.querySelector('input[placeholder^="Search by title"]') as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    const form = input.closest('form');

    await act(async () => {
      valueSetter?.call(input, 'typed query');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    expect(input.value).toBe('typed query');
    expect(container.textContent).toContain('Library search is temporarily unavailable.');
    expect(container.textContent).toContain('Reference: 7F3K2Q');
    expect(container.querySelector('[class*="bg-destructive/10"]')?.className).toContain('whitespace-pre-line');
    expect(container.textContent).not.toContain('HTTP 503');
  });

  it('maps EDS identity and citation fields without generating faculty notes', async () => {
    vi.mocked(searchDiscovery).mockResolvedValueOnce({
      results: [{
        id: 'synthetic-an',
        dbId: 'synthetic-database',
        title: 'Synthetic Article',
        authors: ['Test Author'],
        publicationType: 'Academic Journal',
        database: 'Synthetic Database',
        pLink: 'https://search.ebscohost.com/record/synthetic',
        doi: '10.1000/synthetic',
        issn: '1234-5678',
        journalTitle: 'Synthetic Journal',
        volumeNumber: '12',
        issueNumber: '3',
        hasFullText: false,
        abstract: 'A synthetic abstract.',
      }],
      totalHits: 1,
      searchTime: 3,
      queryString: 'climate change',
      appliedLimiters: [],
    });
    const onItemsSelected = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root?.render(
        <DiscoverySearchDialog
          open={true}
          onOpenChange={() => undefined}
          onItemsSelected={onItemsSelected}
        />
      );
    });

    const input = document.querySelector('input[placeholder^="Search by title"]') as HTMLInputElement;
    const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    const form = input.closest('form');

    await act(async () => {
      valueSetter?.call(input, 'climate change');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await Promise.resolve();
    });

    const resultTitle = Array.from(container.querySelectorAll('h3')).find((title) =>
      title.textContent === 'Synthetic Article'
    );
    const resultCard = resultTitle?.closest('div.border');
    act(() => {
      resultCard?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const addButton = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Add 1 Item')
    );
    act(() => {
      addButton?.click();
    });

    expect(onItemsSelected).toHaveBeenCalledWith([expect.objectContaining({
      doi: '10.1000/synthetic',
      issn: '1234-5678',
      journalTitle: 'Synthetic Journal',
      volume: '12',
      issue: '3',
      eds: {
        dbId: 'synthetic-database',
        an: 'synthetic-an',
        plink: 'https://search.ebscohost.com/record/synthetic',
      },
    })]);
    expect(onItemsSelected.mock.calls[0][0][0]).not.toHaveProperty('notes');
  });
});
