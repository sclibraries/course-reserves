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
        hasItems={false}
        hasFolders={false}
        hasPreviousCourse
        onAddItem={vi.fn()}
        onCreateFolder={vi.fn()}
        onClearFilters={vi.fn()}
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
});
