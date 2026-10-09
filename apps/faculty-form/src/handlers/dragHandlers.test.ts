import { describe, expect, it, vi } from 'vitest';

import { createDragHandlers } from './dragHandlers';

describe('createDragHandlers', () => {
  it('adds an item to a folder when dropped on an explicit folder dropzone', () => {
    const reorderItems = vi.fn();
    const addItemToFolder = vi.fn();

    const { handleDragEnd } = createDragHandlers(
      'reserve-1',
      [{ id: 'item-1' }, { id: 'item-2' }] as never,
      reorderItems,
      addItemToFolder,
      false
    );

    handleDragEnd({
      active: {
        id: 'item-1',
        data: { current: { type: 'Item', item: { id: 'item-1' } } },
      },
      over: {
        id: 'folder-dropzone-folder-1-top',
        data: { current: { type: 'FolderDropzone', folder: { id: 'folder-1' } } },
      },
    } as never);

    expect(addItemToFolder).toHaveBeenCalledWith('reserve-1', 'folder-1', 'item-1');
    expect(reorderItems).not.toHaveBeenCalled();
  });

  it('adds an item to the containing folder when dropped on an item already inside that folder', () => {
    const reorderItems = vi.fn();
    const addItemToFolder = vi.fn();

    const { handleDragEnd } = createDragHandlers(
      'reserve-1',
      [{ id: 'item-1' }, { id: 'item-2' }] as never,
      reorderItems,
      addItemToFolder,
      false
    );

    handleDragEnd({
      active: {
        id: 'item-1',
        data: { current: { type: 'Item', item: { id: 'item-1' } } },
      },
      over: {
        id: 'folder-item-1',
        data: { current: { type: 'Item', item: { id: 'folder-item-1', folderId: 'folder-1' } } },
      },
    } as never);

    expect(addItemToFolder).toHaveBeenCalledWith('reserve-1', 'folder-1', 'item-1');
    expect(reorderItems).not.toHaveBeenCalled();
  });
});