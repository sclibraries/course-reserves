import { describe, expect, it, vi } from 'vitest';
import type { CourseItem } from '@/store/courseReservesStore';
import { createAddMaterialHandler } from './addMaterialHandler';

describe('createAddMaterialHandler', () => {
  it('uses the selected folder, marks the reserve changed, and reports the added item', () => {
    const addedItem = {
      id: 'item-added', title: 'Synthetic Article', materialType: 'article', status: 'draft', folderId: 'folder-1',
    } as CourseItem;
    const addItem = vi.fn(() => true);
    const markChanged = vi.fn();
    const onAdded = vi.fn();
    const addMaterial = createAddMaterialHandler({
      reserveId: 'reserve-1',
      defaultFolderId: 'folder-1',
      addItem,
      markChanged,
      getLastAddedItem: () => addedItem,
      onAdded,
    });

    expect(addMaterial('reserve-1', {
      title: 'Synthetic Article', materialType: 'article', folderId: 'source-folder',
    })).toBe(true);
    expect(addItem).toHaveBeenCalledWith('reserve-1', {
      title: 'Synthetic Article', materialType: 'article', status: 'draft', folderId: 'folder-1',
    });
    expect(markChanged).toHaveBeenCalledOnce();
    expect(onAdded).toHaveBeenCalledWith(addedItem);
  });

  it('does not mark the reserve changed or record an item when the store rejects a duplicate', () => {
    const addItem = vi.fn(() => false);
    const markChanged = vi.fn();
    const onAdded = vi.fn();
    const addMaterial = createAddMaterialHandler({
      reserveId: 'reserve-1', addItem, markChanged, getLastAddedItem: () => undefined, onAdded,
    });

    expect(addMaterial('reserve-1', { title: 'Duplicate' })).toBe(false);
    expect(markChanged).not.toHaveBeenCalled();
    expect(onAdded).not.toHaveBeenCalled();
  });
});
