import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { CourseFolder, CourseItem } from '@/store/courseReservesStore';
import { SortableFolderContent } from './SortableFolderContent';
import { SortableItem } from './SortableItem';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mountedCleanups = new Set<() => void>();

afterEach(() => {
  mountedCleanups.forEach((cleanup) => cleanup());
  mountedCleanups.clear();
});

describe('SortableItem ordering controls', () => {
  it('keeps the position label while disabling the up arrow at its container edge', () => {
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();
    const rendered = renderItem({
      id: 'item-last',
      title: 'Synthetic article',
      materialType: 'article',
      status: 'draft',
    }, { onMoveUp, onMoveDown, canMoveUp: false, canMoveDown: true });

    expect(findButton(rendered.container, 'Move up')?.disabled).toBe(true);
    expect(findButton(rendered.container, 'Move down')?.disabled).toBe(false);
    expect(positionLabel(rendered.container)).toBe('5');

    rendered.cleanup();
  });

  it('disables the down arrow at the end of its container', () => {
    const rendered = renderItem({
      id: 'item-last',
      title: 'Synthetic article',
      materialType: 'article',
      status: 'draft',
    }, { onMoveUp: vi.fn(), onMoveDown: vi.fn(), canMoveDown: false });

    expect(findButton(rendered.container, 'Move down')?.disabled).toBe(true);
    rendered.cleanup();
  });

  it('shows a folder title and item position for nested items', () => {
    const rendered = renderFolderContent({
      id: 'week-1',
      title: 'Week 1',
      isOpen: true,
      itemIds: ['item-first', 'item-second'],
      items: [
        { id: 'item-first', title: 'First reading', materialType: 'article', status: 'draft' },
        { id: 'item-second', title: 'Second reading', materialType: 'article', status: 'draft' },
      ],
    });

    expect(positionLabels(rendered.container)).toEqual(['Week 1 · 1', 'Week 1 · 2']);
    rendered.cleanup();
  });
});

function renderItem(
  item: CourseItem,
  props: {
    onMoveUp: () => void;
    onMoveDown: () => void;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
  }
) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => root.render(
    <DndContext>
      <SortableContext items={[item.id]} strategy={verticalListSortingStrategy}>
        <SortableItem
          item={item}
          index={4}
          totalItems={5}
          onEdit={vi.fn()}
          {...props}
        />
      </SortableContext>
    </DndContext>
  ));

  const cleanup = () => {
    act(() => root.unmount());
    container.remove();
  };
  mountedCleanups.add(cleanup);
  return {
    container,
    cleanup: () => {
      mountedCleanups.delete(cleanup);
      cleanup();
    },
  };
}

function renderFolderContent(folder: CourseFolder & { items: CourseItem[] }) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => root.render(
    <DndContext>
      <SortableFolderContent
        folder={folder}
        newItemIds={[]}
        onEditItem={vi.fn()}
        onDeleteItem={vi.fn()}
        onRemoveItemFromFolder={vi.fn()}
        onMoveItemInFolder={vi.fn()}
        canMoveItemUp={() => true}
        canMoveItemDown={() => true}
      />
    </DndContext>
  ));

  const cleanup = () => {
    act(() => root.unmount());
    container.remove();
  };
  mountedCleanups.add(cleanup);
  return {
    container,
    cleanup: () => {
      mountedCleanups.delete(cleanup);
      cleanup();
    },
  };
}

function findButton(container: HTMLElement, title: string) {
  return container.querySelector<HTMLButtonElement>(`button[title="${title}"]`);
}

function positionLabel(container: HTMLElement) {
  return positionLabels(container)[0];
}

function positionLabels(container: HTMLElement) {
  return Array.from(container.querySelectorAll('div'))
    .filter((element) => element.className.includes('rounded-full') && element.className.includes('h-8'))
    .map((element) => element.textContent?.trim());
}
