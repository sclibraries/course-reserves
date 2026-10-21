import { DndContext } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { fireEvent, getByRole } from '@testing-library/dom';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '@/test/expectNoAxeViolations';
import { SortableFolder } from './SortableFolder';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('SortableFolder accessibility', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    container = null;
    root = null;
  });

  it('focuses the folder-name field and returns focus to Edit on Escape and Save', async () => {
    const onUpdateFolder = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => root?.render(
      <main>
        <DndContext>
          <SortableContext items={['folder-1']} strategy={verticalListSortingStrategy}>
            <SortableFolder
              folder={{ id: 'folder-1', title: 'Week 1', isOpen: true, itemIds: [], items: [] }}
              index={0}
              onEditItem={() => undefined}
              onDeleteItem={() => undefined}
              onUpdateFolder={onUpdateFolder}
              onDeleteFolder={() => undefined}
              onToggleFolder={() => undefined}
              onRemoveItemFromFolder={() => undefined}
              onMoveItemInFolder={() => undefined}
              onMoveFolderUp={() => undefined}
              onMoveFolderDown={() => undefined}
              canMoveFolderUp={false}
              canMoveFolderDown={false}
              canMoveItemUp={() => false}
              canMoveItemDown={() => false}
              isDragDisabled
            />
          </SortableContext>
        </DndContext>
      </main>,
    ));

    expect(getByRole(container, 'button', { name: 'Week 1 (0 items)' }).getAttribute('aria-expanded')).toBe('true');
    const editButton = getByRole(container, 'button', { name: 'Edit folder name' });
    act(() => fireEvent.click(editButton));
    const title = getByRole(container, 'textbox', { name: 'Folder name' });
    expect(document.activeElement).toBe(title);
    await expectNoAxeViolations(container);
    act(() => fireEvent.keyDown(title, { key: 'Escape' }));
    expect(document.activeElement).toBe(editButton);

    act(() => fireEvent.click(editButton));
    const reopenedTitle = getByRole(container, 'textbox', { name: 'Folder name' });
    expect(document.activeElement).toBe(reopenedTitle);
    act(() => fireEvent.change(reopenedTitle, { target: { value: 'Week 2' } }));
    act(() => fireEvent.click(getByRole(container, 'button', { name: 'Save folder name' })));

    expect(onUpdateFolder).toHaveBeenCalledWith('folder-1', { title: 'Week 2' });
    expect(document.activeElement).toBe(editButton);

    act(() => fireEvent.click(editButton));
    const cancelledTitle = getByRole(container, 'textbox', { name: 'Folder name' });
    act(() => fireEvent.change(cancelledTitle, { target: { value: 'Week 3' } }));
    act(() => fireEvent.click(getByRole(container, 'button', { name: 'Cancel folder name edit' })));
    expect(onUpdateFolder).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(editButton);
  });
});
