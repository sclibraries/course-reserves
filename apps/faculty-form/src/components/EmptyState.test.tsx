import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('EmptyState start choices', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('offers the three add-materials tabs and a small manual-entry link', () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(
      <EmptyState
        searchQuery=""
        hasPreviousCourse
        onAddItem={vi.fn()}
        onClearSearch={vi.fn()}
        onSearchLibrary={vi.fn()}
        onPasteCitations={vi.fn()}
        onUsePrevious={vi.fn()}
      />
    ));

    expect(container.textContent).toContain('Search the library');
    expect(container.textContent).toContain('Paste a list from your syllabus');
    expect(container.textContent).toContain('Reuse what you used last time');
    expect(container.textContent).toContain('or type an item in');
  });

  it('shows the exact no-match message and clears the search', () => {
    const onClearSearch = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(
      <EmptyState
        searchQuery="ocean"
        onAddItem={vi.fn()}
        onClearSearch={onClearSearch}
      />
    ));

    expect(container.textContent).toContain('No materials match "ocean".');
    const clearButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Clear search');
    expect(clearButton).toBeDefined();
    act(() => clearButton?.click());
    expect(onClearSearch).toHaveBeenCalledOnce();
  });
});
