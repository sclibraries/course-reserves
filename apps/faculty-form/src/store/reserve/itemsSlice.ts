import type { ReserveSlice, CourseItem } from './types';
import { findDuplicateCourseItem } from '@/utils/courseItemDuplicates';

export const createItemsSlice: ReserveSlice<'addItem' | 'updateItem' | 'deleteItem' | 'reorderItems' | 'moveItemToPosition'> = (set, get, store) => ({
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
              items: [newItem, ...(reserve.items || [])],
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

  moveItemToPosition: (reserveId, itemId, position) => {
    set((state) => ({
      reserves: state.reserves.map((reserve) => {
        if (reserve.id === reserveId) {
          const items = [...(reserve.items || [])];
          const itemIndex = items.findIndex((item) => item.id === itemId);
          if (itemIndex !== -1) {
            const [item] = items.splice(itemIndex, 1);
            items.splice(position, 0, item);
          }
          return {
            ...reserve,
            items,
            lastUpdated: new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric"
            })
          };
        }
        return reserve;
      })
    }));
  }
});
