import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByRole } from '@testing-library/dom';
import { afterEach, describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '@/test/expectNoAxeViolations';
import { SortableFolderTitle } from './SortableFolderTitle';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function FolderHarness() {
  const [isOpen, setIsOpen] = useState(false);
  const folder = { id: 'folder-1', title: 'Week 1', isOpen, itemIds: [], items: [] };
  return <SortableFolderTitle folder={folder} onToggle={() => setIsOpen((open) => !open)} />;
}

describe('SortableFolderTitle accessibility', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('names the toggle button and reports its expanded state', async () => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root?.render(<main><FolderHarness /></main>));

    const toggle = getByRole(container, 'button', { name: 'Week 1 (0 items)' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await expectNoAxeViolations(container);

    act(() => fireEvent.click(toggle));
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});
