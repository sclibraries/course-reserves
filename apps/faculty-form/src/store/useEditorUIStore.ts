import { create } from 'zustand';
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

  setModalOpen: (open: boolean) => void;
  setEditingItem: (item: (ItemData & { id: string }) | undefined) => void;
  setShowSubmitDialog: (open: boolean) => void;
  setEmailConfirmation: (v: boolean) => void;
  setCourseModalOpen: (open: boolean) => void;
  setShowInstructions: (v: boolean) => void;
  openCorrectionRequiredDialog: (detail: CorrectionRequiredDetail) => void;
  closeCorrectionRequiredDialog: () => void;
}

export const useEditorUIStore = create<EditorUIState>()((set) => ({
  modalOpen: false,
  editingItem: undefined,
  showSubmitDialog: false,
  emailConfirmation: false,
  courseModalOpen: false,
  showInstructions: false,
  correctionRequiredDialogOpen: false,
  correctionRequiredDetail: null,

  setModalOpen: (open) => set({ modalOpen: open }),
  setEditingItem: (item) => set({ editingItem: item }),
  setShowSubmitDialog: (open) => set({ showSubmitDialog: open }),
  setEmailConfirmation: (v) => set({ emailConfirmation: v }),
  setCourseModalOpen: (open) => set({ courseModalOpen: open }),
  setShowInstructions: (v) => set({ showInstructions: v }),
  openCorrectionRequiredDialog: (detail) => set({ correctionRequiredDialogOpen: true, correctionRequiredDetail: detail }),
  closeCorrectionRequiredDialog: () => set({ correctionRequiredDialogOpen: false, correctionRequiredDetail: null }),
}));
