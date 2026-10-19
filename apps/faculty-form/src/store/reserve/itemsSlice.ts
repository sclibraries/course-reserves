import type { ReserveSlice, CourseItem } from './types';
import { findDuplicateCourseItem } from '@/utils/courseItemDuplicates';
import { addItem, moveDown, moveTo, moveUp, removeItem, type MoveTarget } from '@/utils/listLayout';
import { updateReserveLayout } from './layoutState';

export const createItemsSlice: ReserveSlice<
  'addItem' | 'updateItem' | 'deleteItem' | 'moveItemInList' | 'moveTo'
> = (set, get) => ({
  addItem: (reserveId, item) => {
    const reserve = get().getReserveById(reserveId);
    if (!reserve) return false;

    const newItem: CourseItem = {
      ...item,
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    if (findDuplicateCourseItem(reserve.items || [], newItem)) return false;

    set((state) => updateReserveLayout(state, reserveId, (current) => addItem(current, newItem)));
    return true;
  },

  updateItem: (reserveId, itemId, updates) => {
    set((state) => updateReserveLayout(state, reserveId, (current) => ({
      ...current,
      items: current.items.map((item) => item.id === itemId ? { ...item, ...updates } : item),
    })));
  },

  deleteItem: (reserveId, itemId) => {
    set((state) => updateReserveLayout(state, reserveId, (current) => removeItem(current, itemId)));
  },

  moveItemInList: (reserveId, itemId, direction) => {
    let didMove = false;
    set((state) => updateReserveLayout(state, reserveId, (current) => {
      const updated = direction === 'up' ? moveUp(current, itemId) : moveDown(current, itemId);
      didMove = updated !== current;
      return updated;
    }));
    return didMove;
  },

  moveTo: (reserveId, id, target: MoveTarget) => {
    set((state) => updateReserveLayout(state, reserveId, (current) => moveTo(current, id, target)));
  },
});
