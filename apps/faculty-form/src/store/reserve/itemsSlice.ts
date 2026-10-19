import type { ReserveSlice, CourseItem } from './types';
import { findDuplicateCourseItem } from '@/utils/courseItemDuplicates';
import { moveItemInList as reorderItemInList } from '@/utils/moveItemInList';

export const createItemsSlice: ReserveSlice<'addItem' | 'updateItem' | 'deleteItem' | 'reorderItems' | 'moveItemInList'> = (set, get, store) => ({
  addItem: (reserveId, item) => {
    const reserve = get().getReserveById(reserveId);
    if (!reserve) {
      return false;
    }

    const itemId = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newItem: CourseItem = { ...item, id: itemId };

    if (findDuplicateCourseItem(reserve.items || [], newItem)) {
      return false;
    }

    set((state) => ({
      reserves: state.reserves.map((reserve) =>
        reserve.id === reserveId
          ? {
              ...reserve,
              items: [...(reserve.items || []), newItem],
              lastUpdated: new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
              })
            }
          : reserve
      )
    }));

    return true;
  },

  updateItem: (reserveId, itemId, updates) => {
    set((state) => ({
      reserves: state.reserves.map((reserve) =>
        reserve.id === reserveId
          ? {
              ...reserve,
              items: (reserve.items || []).map((item) =>
                item.id === itemId ? { ...item, ...updates } : item
              ),
              lastUpdated: new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
              })
            }
          : reserve
      )
    }));
  },

  deleteItem: (reserveId, itemId) => {
    set((state) => ({
      reserves: state.reserves.map((reserve) =>
        reserve.id === reserveId
          ? {
              ...reserve,
              items: (reserve.items || []).filter((item) => item.id !== itemId),
              lastUpdated: new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
              })
            }
          : reserve
      )
    }));
  },

  reorderItems: (reserveId, itemIds) => {
    set((state) => ({
      reserves: state.reserves.map((reserve) =>
        reserve.id === reserveId
          ? {
              ...reserve,
              items: itemIds.map((id) => (reserve.items || []).find((item) => item.id === id)!),
              lastUpdated: new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
              })
            }
          : reserve
      )
    }));
  },

  moveItemInList: (reserveId, itemId, direction) => {
    let didMove = false;
    set((state) => {
      const reserve = state.reserves.find((entry) => entry.id === reserveId);
      const items = reserve?.items || [];
      if (!reserve) return state;

      const reorderedItems = reorderItemInList(items, itemId, direction);
      if (reorderedItems === items) return state;
      didMove = true;

      return {
        reserves: state.reserves.map((entry) => entry.id === reserveId
          ? {
              ...entry,
              items: reorderedItems,
              lastUpdated: new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
              })
            }
          : entry
        )
      };
    });
    return didMove;
  }
});
