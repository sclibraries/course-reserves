import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SelectedFaculty {
  username: string;
  displayName: string;
}

interface ActingForState {
  selectedFaculty: SelectedFaculty | null;
  selectFaculty: (faculty: SelectedFaculty) => void;
  clearSelection: () => void;
}

export const useActingForStore = create<ActingForState>()(
  persist(
    (set) => ({
      selectedFaculty: null,
      selectFaculty: (selectedFaculty) => set({ selectedFaculty }),
      clearSelection: () => set({ selectedFaculty: null }),
    }),
    {
      name: 'acting-for-selection',
      partialize: ({ selectedFaculty }) => ({ selectedFaculty }),
    },
  ),
);
