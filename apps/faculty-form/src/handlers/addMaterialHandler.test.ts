import { describe, expect, it, vi } from 'vitest';
import type { CourseItem } from '@/store/courseReservesStore';
import { createAddMaterialHandler } from './addMaterialHandler';

describe('createAddMaterialHandler', () => {
  it('uses the selected folder, marks the reserve changed, and reports the added item', () => {
    const addedItem = {
      id: 'item-added', title: 'Synthetic Article', materialType: 'article', status: 'draft', folderId: 'folder-1',
    } as CourseItem;
    const addItem = vi.fn(() => addedItem);
    const markChanged = vi.fn();
    const onAdded = vi.fn();
    const addMaterial = createAddMaterialHandler({
      reserveId: 'reserve-1',
      defaultFolderId: 'folder-1',
      addItem,
      markChanged,
      onAdded,
    });

    expect(addMaterial('reserve-1', {
      title: 'Synthetic Article', materialType: 'article', folderId: 'source-folder',
    })).toBe(addedItem);
    expect(addItem).toHaveBeenCalledWith('reserve-1', {
      title: 'Synthetic Article', materialType: 'article', status: 'draft', folderId: 'folder-1',
    });
    expect(markChanged).toHaveBeenCalledOnce();
    expect(onAdded).toHaveBeenCalledWith(addedItem);
  });

  it('preserves explicit folder and root placement when the caller requests it', () => {
    const addItem = vi.fn((_, item) => ({ ...item, id: 'item-added' } as CourseItem));
    const addMaterial = createAddMaterialHandler({
      reserveId: 'reserve-1', defaultFolderId: 'folder-selected', addItem, markChanged: vi.fn(),
    });

    addMaterial('reserve-1', { title: 'Heading citation', folderId: 'folder-heading' }, { preserveFolder: true });
    addMaterial('reserve-1', { title: 'Unheaded citation', folderId: undefined }, { preserveFolder: true });

    expect(addItem.mock.calls.map(([, item]) => item.folderId)).toEqual(['folder-heading', undefined]);
  });

  it('does not mark the reserve changed or record an item when the store rejects a duplicate', () => {
    const addItem = vi.fn(() => null);
    const markChanged = vi.fn();
    const onAdded = vi.fn();
    const addMaterial = createAddMaterialHandler({
      reserveId: 'reserve-1', addItem, markChanged, onAdded,
    });

    expect(addMaterial('reserve-1', { title: 'Duplicate' })).toBe(false);
    expect(markChanged).not.toHaveBeenCalled();
    expect(onAdded).not.toHaveBeenCalled();
  });
});
