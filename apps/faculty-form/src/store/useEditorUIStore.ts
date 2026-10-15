import { create } from 'zustand';
import type { SortOption, FilterOption } from '@/components/ItemSortingToolbar';
import type { ItemData } from '@/components/ItemModal';
import type { CorrectionRequiredDetail } from '@/services/submissionUpdateErrors';

interface EditorUIState {
  modalOpen: boolean;
  editingItem: (ItemData & { id: string }) | undefined;
  showSubmitDialog: boolean;
  emailConfirmation: boolean;
  courseModalOpen: boolean;
  showInstructions: boolean;
  correctionRequiredDialogOpen: boolean;
  correctionRequiredDetail: CorrectionRequiredDetail | null;
  sortBy: SortOption;
  searchQuery: string;
  filters: FilterOption;

  setModalOpen: (open: boolean) => void;
  setEditingItem: (item: (ItemData & { id: string }) | undefined) => void;
  setShowSubmitDialog: (open: boolean) => void;
  setEmailConfirmation: (v: boolean) => void;
  setCourseModalOpen: (open: boolean) => void;
  setShowInstructions: (v: boolean) => void;
  openCorrectionRequiredDialog: (detail: CorrectionRequiredDetail) => void;
  closeCorrectionRequiredDialog: () => void;
  setSortBy: (sort: SortOption) => void;
  setSearchQuery: (q: string) => void;
  setFilters: (filters: FilterOption) => void;
  resetFilters: () => void;
  hasActiveFiltersOrSort: () => boolean;
}

export const useEditorUIStore = create<EditorUIState>()((set, get) => ({
  modalOpen: false,
  editingItem: undefined,
  showSubmitDialog: false,
  emailConfirmation: false,
  courseModalOpen: false,
  showInstructions: false,
  correctionRequiredDialogOpen: false,
  correctionRequiredDetail: null,
  sortBy: 'position' as SortOption,
  searchQuery: '',
  filters: { materialTypes: [], statuses: [] },

  setModalOpen: (open) => set({ modalOpen: open }),
  setEditingItem: (item) => set({ editingItem: item }),
  setShowSubmitDialog: (open) => set({ showSubmitDialog: open }),
  setEmailConfirmation: (v) => set({ emailConfirmation: v }),
  setCourseModalOpen: (open) => set({ courseModalOpen: open }),
  setShowInstructions: (v) => set({ showInstructions: v }),
  openCorrectionRequiredDialog: (detail) => set({ correctionRequiredDialogOpen: true, correctionRequiredDetail: detail }),
  closeCorrectionRequiredDialog: () => set({ correctionRequiredDialogOpen: false, correctionRequiredDetail: null }),
  setSortBy: (sort) => set({ sortBy: sort }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setFilters: (filters) => set({ filters }),
  resetFilters: () =>
    set({ sortBy: 'position' as SortOption, searchQuery: '', filters: { materialTypes: [], statuses: [] } }),
  hasActiveFiltersOrSort: () => {
    const { sortBy, searchQuery, filters } = get();
    return (
      sortBy !== 'position' ||
      searchQuery.trim() !== '' ||
      filters.materialTypes.length > 0 ||
      filters.statuses.length > 0
    );
  },
}));
