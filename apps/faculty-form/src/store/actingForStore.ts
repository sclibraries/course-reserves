import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mergeUserScopedState, readSessionUsername, stampUserScopedState } from '@/services/session';

const currentUsername = () => readSessionUsername(document.cookie, Math.floor(Date.now() / 1000));

export interface SelectedFaculty {
  username: string;
  displayName: string;
}

interface ActingForState {
  selectedFaculty: SelectedFaculty | null;
  ownerUsername: string | null;
  selectFaculty: (faculty: SelectedFaculty) => void;
  clearSelection: () => void;
}

export const useActingForStore = create<ActingForState>()(
  persist(
    (set) => ({
      selectedFaculty: null,
      ownerUsername: null,
      selectFaculty: (selectedFaculty) => set({ selectedFaculty }),
      clearSelection: () => set({ selectedFaculty: null }),
    }),
    {
      name: 'acting-for-selection',
      partialize: ({ selectedFaculty }) => stampUserScopedState({ selectedFaculty }, currentUsername()),
      merge: (persistedState, currentState) => {
        const merged = mergeUserScopedState(
          persistedState as Partial<ActingForState> & { ownerUsername?: string | null },
          currentState,
          currentUsername() ?? null,
        );
        if (merged) return merged;
        localStorage.removeItem('acting-for-selection');
        return currentState;
      },
    },
  ),
);
