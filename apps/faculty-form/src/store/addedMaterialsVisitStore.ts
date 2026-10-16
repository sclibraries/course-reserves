import { create } from 'zustand';

export interface AddedMaterialVisitItem {
  id: string;
  title: string;
}

export const EMPTY_ADDED_MATERIALS: AddedMaterialVisitItem[] = [];

interface AddedMaterialsVisitState {
  itemsByReserve: Record<string, AddedMaterialVisitItem[]>;
  add: (reserveId: string, item: AddedMaterialVisitItem) => void;
  remove: (reserveId: string, itemId: string) => void;
}

export const useAddedMaterialsVisitStore = create<AddedMaterialsVisitState>((set) => ({
  itemsByReserve: {},
  add: (reserveId, item) => set((state) => ({
    itemsByReserve: {
      ...state.itemsByReserve,
      [reserveId]: [...(state.itemsByReserve[reserveId] || []).filter((existing) => existing.id !== item.id), item],
    },
  })),
  remove: (reserveId, itemId) => set((state) => ({
    itemsByReserve: {
      ...state.itemsByReserve,
      [reserveId]: (state.itemsByReserve[reserveId] || []).filter((item) => item.id !== itemId),
    },
  })),
}));
