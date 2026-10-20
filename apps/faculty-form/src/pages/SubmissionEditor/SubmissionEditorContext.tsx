import { createContext, useContext } from 'react';
import type { CourseReserve, CourseItem } from '@/store/courseReservesStore';
import type { LockInfo } from '@/hooks/useSubmissionLock';
import type { AddedMaterialVisitItem } from '@/store/addedMaterialsVisitStore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandlers = Record<string, (...args: any[]) => any>;

export interface SubmissionEditorContextValue {
  id: string;
  reserve: CourseReserve;
  isEditingSubmission: boolean;
  hasPreviousOffering: boolean;
  // Lock / read-only state
  isReadOnly: boolean;
  lockInfo: LockInfo | null;
  // Draft saving
  saveDraft: () => void;
  isSaving: boolean;
  saveStatus?: 'idle' | 'saving' | 'saved' | 'retrying' | 'conflict';
  hasUnsavedChanges: boolean;
  lastSaveTime: Date | null;
  saveError: string | null;
  // Handlers
  itemHandlers: AnyHandlers;
  folderHandlers: AnyHandlers;
  courseHandlers: AnyHandlers;
  dragHandlers: AnyHandlers;
  submissionHandlers: AnyHandlers;
  // Wrapped actions that trigger markChanged
  markChanged: () => void;
  removeItemFromFolder: (reserveId: string, itemId: string) => void;
  moveItemInFolder: (reserveId: string, folderId: string, itemId: string, direction: 'up' | 'down') => void;
  addItemToFolder: (reserveId: string, folderId: string, itemId: string) => void;
  moveFolderPosition: (reserveId: string, folderId: string, direction: 'up' | 'down') => void;
  user: { full_name?: string } | null;
  addItem: (reserveId: string, item: Partial<CourseItem>) => boolean;
  createFolder: (reserveId: string, title: string) => string;
  addedMaterials: AddedMaterialVisitItem[];
  undoAddedMaterial: (itemId: string) => void;
}

const SubmissionEditorContext = createContext<SubmissionEditorContextValue | null>(null);

export function useSubmissionEditorContext() {
  const ctx = useContext(SubmissionEditorContext);
  if (!ctx) throw new Error('useSubmissionEditorContext must be used inside SubmissionEditor');
  return ctx;
}

export default SubmissionEditorContext;
