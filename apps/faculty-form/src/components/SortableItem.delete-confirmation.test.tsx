import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { CourseItem } from '@/store/courseReservesStore';
import { SortableItem } from './SortableItem';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mountedCleanupCallbacks = new Set<() => void>();

afterEach(() => {
  mountedCleanupCallbacks.forEach((cleanup) => cleanup());
  mountedCleanupCallbacks.clear();
});

describe('SortableItem delete confirmation', () => {
  it('asks before deleting an ungrouped item', () => {
    const onDelete = vi.fn();
    const rendered = renderItem({
      id: 'item-ungrouped',
      title: 'Synthetic article',
      materialType: 'article',
      status: 'draft',
    }, onDelete);

    act(() => rendered.container.querySelector<HTMLButtonElement>('[title="Delete item"]')?.click());

    expect(onDelete).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain("Delete 'Synthetic article' from your list?");
    expect(findButton('Delete')).toBeTruthy();
    expect(findButton('Cancel')).toBeTruthy();
    expect(findButton('Move out of folder')).toBeFalsy();

    act(() => findButton('Delete')?.click());
    expect(onDelete).toHaveBeenCalledWith('item-ungrouped');
    rendered.cleanup();
  });

  it('leaves an item in the list when deletion is cancelled', () => {
    const onDelete = vi.fn();
    const rendered = renderItem({
      id: 'item-cancelled',
      title: 'Synthetic chapter',
      materialType: 'article',
      status: 'draft',
    }, onDelete);

    act(() => rendered.container.querySelector<HTMLButtonElement>('[title="Delete item"]')?.click());
    act(() => findButton('Cancel')?.click());

    expect(onDelete).not.toHaveBeenCalled();
    rendered.cleanup();
  });

  it('offers to move a foldered item out of its folder', () => {
    const onDelete = vi.fn();
    const onRemoveFromFolder = vi.fn();
    const rendered = renderItem({
      id: 'item-foldered',
      title: 'Synthetic chapter',
      materialType: 'article',
      status: 'draft',
      folderId: 'folder-1',
    }, onDelete, onRemoveFromFolder);

    act(() => rendered.container.querySelector<HTMLButtonElement>('[title="Delete item"]')?.click());

    expect(document.body.textContent).toContain("Delete 'Synthetic chapter' from your list?");
    expect(findButton('Move out of folder')).toBeTruthy();
    expect(onDelete).not.toHaveBeenCalled();

    act(() => findButton('Move out of folder')?.click());
    expect(onRemoveFromFolder).toHaveBeenCalledWith('item-foldered');
    expect(onDelete).not.toHaveBeenCalled();
    rendered.cleanup();
  });
});

function renderItem(
  item: CourseItem,
  onDelete: (itemId: string) => void,
  onRemoveFromFolder?: (itemId: string) => void
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => root.render(
    <DndContext>
      <SortableContext items={[item.id]} strategy={verticalListSortingStrategy}>
        <SortableItem
          item={item}
          index={0}
          totalItems={1}
          onEdit={vi.fn()}
          onDelete={onDelete}
          onRemoveFromFolder={onRemoveFromFolder}
        />
      </SortableContext>
    </DndContext>
  ));
  mountedCleanupCallbacks.add(cleanup);

  return {
    container,
    cleanup: () => {
      mountedCleanupCallbacks.delete(cleanup);
      cleanup();
    },
  };

  function cleanup() {
    act(() => root.unmount());
    container.remove();
  }
}

function findButton(label: string) {
  return Array.from(document.body.querySelectorAll('button'))
    .find((button) => button.textContent?.trim() === label);
}
