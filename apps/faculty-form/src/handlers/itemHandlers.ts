import { notify } from "@/services/notify";
import type { ItemData } from "@/components/ItemModal";
import { transformItemForEditing, transformItemForSaving } from "@/utils/itemTransformers";
import type { CourseItem, CourseReserve } from "../store/courseReservesStore";

/**
 * Handlers for item-related operations
 */
export const createItemHandlers = (
  reserveId: string,
  addItem: (id: string, item: Partial<CourseItem>) => CourseItem | false,
  updateItem: (id: string, itemId: string, updates: Partial<CourseItem>) => void,
  deleteItem: (id: string, itemId: string) => void,
  moveItemInList: (id: string, itemId: string, direction: 'up' | 'down') => boolean,
  updateReserve: (id: string, updates: Partial<CourseReserve>) => void,
  isSearching: boolean,
  setEditingItem: (item: (ItemData & { id: string }) | undefined) => void,
  setModalOpen: (open: boolean) => void
) => {
  const handleAddItem = () => {
    setEditingItem(undefined);
    setModalOpen(true);
  };

  const handleEditItem = (courseItem: CourseItem & { id: string }) => {
    const itemData = transformItemForEditing(courseItem);
    setEditingItem(itemData);
    setModalOpen(true);
  };

  const handleSaveItem = (itemData: ItemData, editingItem?: ItemData & { id: string }): boolean => {
    const courseItemData = transformItemForSaving(itemData);

    if (editingItem) {
      updateItem(reserveId, editingItem.id, courseItemData);
    } else if (!addItem(reserveId, courseItemData)) {
      notify.error('This item is already in your reserve list.');
      return false;
    }
    setModalOpen(false);
    setEditingItem(undefined);
    return true;
  };

  const handleMoveUp = (itemId: string) => {
    if (isSearching) {
      notify.error('Clear the search to reorder.');
      return;
    }

    if (moveItemInList(reserveId, itemId, 'up')) {
      notify.success('Item moved up');
    }
  };

  const handleMoveDown = (itemId: string) => {
    if (isSearching) {
      notify.error('Clear the search to reorder.');
      return;
    }

    if (moveItemInList(reserveId, itemId, 'down')) {
      notify.success('Item moved down');
    }
  };

  const handleDeleteItem = (itemId: string) => {
    deleteItem(reserveId, itemId);
    notify.success('Item removed');
  };

  const handleClearAll = (itemsCount: number, foldersCount: number) => {
    if (itemsCount === 0 && foldersCount === 0) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to remove all ${itemsCount} item${itemsCount !== 1 ? 's' : ''}${foldersCount > 0 ? ` and ${foldersCount} folder${foldersCount !== 1 ? 's' : ''}` : ''}? This action cannot be undone.`
    );
    
    if (confirmed) {
      // One atomic update: clear both items and folders
      updateReserve(reserveId, { items: [], folders: [], layout: [] });
      notify.success(
        foldersCount > 0 
          ? `Cleared ${itemsCount} item${itemsCount !== 1 ? 's' : ''} and ${foldersCount} folder${foldersCount !== 1 ? 's' : ''}`
          : `Removed all ${itemsCount} item${itemsCount !== 1 ? 's' : ''}`
      );
    }
  };

  return {
    handleAddItem,
    handleEditItem,
    handleSaveItem,
    handleMoveUp,
    handleMoveDown,
    handleDeleteItem,
    handleClearAll,
  };
};
