import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { DndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { CourseItem } from '@/store/courseReservesStore';
import { SortableItem } from './SortableItem';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('SortableItem visit marker', () => {
  it('shows New for an item added during this visit', () => {
    const item: CourseItem = { id: 'item-new', title: 'New synthetic article', materialType: 'article', status: 'draft' };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root: Root = createRoot(container);
    act(() => root.render(
      <DndContext>
        <SortableContext items={[item.id]} strategy={verticalListSortingStrategy}>
          <SortableItem item={item} isNew index={0} totalItems={1} onEdit={vi.fn()} />
        </SortableContext>
      </DndContext>
    ));

    expect(container.textContent).toContain('New');
    act(() => root.unmount());
    container.remove();
  });
});
