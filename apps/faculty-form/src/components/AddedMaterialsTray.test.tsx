import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AddedMaterialsTray from './AddedMaterialsTray';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('AddedMaterialsTray', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('shows the visit count, expandable titles, undo actions, and Done action', () => {
    const onUndo = vi.fn();
    const onDone = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(
      <AddedMaterialsTray
        items={[{ id: 'item-1', title: 'Synthetic Book' }, { id: 'item-2', title: 'Synthetic Article' }]}
        onUndo={onUndo}
        onDone={onDone}
      />
    ));

    expect(container.textContent).toContain('Added (2)');
    const expandButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Review added items'));
    act(() => expandButton?.click());
    expect(container.textContent).toContain('Synthetic Book');
    expect(container.textContent).toContain('Synthetic Article');

    const undo = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Undo');
    act(() => undo?.click());
    expect(onUndo).toHaveBeenCalledWith('item-1');

    const done = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Done — back to my list'));
    act(() => done?.click());
    expect(onDone).toHaveBeenCalledOnce();
  });
});
