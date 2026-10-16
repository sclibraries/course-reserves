import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

/**
 * Draft Payload Structure for Backend
 * 
 * This represents the complete state of a course reserve draft
 * that will be sent to and retrieved from the backend.
 */
export interface DraftPayload {
  // Submission UUID (matches the reserve ID)
  uuid: string;
  
  // Course Information
  courseCode: string;
  courseTitle: string;
  section: string;
  instructors: string;
  term: string;
  
  // Submission metadata
  submissionNotes?: string | null;
  neededByDate?: string | null; // ISO date string
  
  // Course assignment link (if created from assignment)
  courseAssignmentId?: string | null;
  
  // Items data - complete list of all items
  items: DraftItemPayload[];
  
  // Folders data - complete list of all folders
  folders: DraftFolderPayload[];
  
  // Draft metadata
  isDraft: boolean; // Always true for draft saves
  lastSavedAt: string; // ISO timestamp of last save
  draftVersion: number; // Incrementing version number for conflict resolution
}

/**
 * Item data structure for draft payload
 */
export interface DraftItemPayload {
  // Frontend ID (used for UI tracking)
  id: string;
  
  // Backend ID (if item exists in database)
  backendItemId?: string | null;
  
  // Basic item info
  title: string;
  materialType: 'book' | 'article' | 'chapter' | 'video' | 'website' | 'other';
  status: 'draft' | 'pending' | 'in-progress' | 'complete' | 'needs-review';
  
  // Bibliographic data
  authors?: string | null;
  isbn?: string | null;
  publisher?: string | null;
  publicationYear?: string | null;
  edition?: string | null;
  pages?: string | null;
  chapterTitle?: string | null;
  journalTitle?: string | null;
  volume?: string | null;
  issue?: string | null;
  doi?: string | null;
  issn?: string | null;
  eds?: {
    dbId: string;
    an: string;
    plink: string;
  } | null;
  url?: string | null;
  
  // Notes
  notes?: string | null;
  libraryNotes?: string | null;
  
  // Organization
  folderId?: string | null; // ID of folder this item belongs to
  displayOrder?: number | null; // Position in list
  
  // Display window
  displayStartDate?: string | null; // ISO date
  displayEndDate?: string | null; // ISO date
  
  // Attachment metadata
  hasAttachment?: boolean;
  attachmentName?: string | null;
  attachmentSize?: number | null;
  attachmentType?: string | null;
  
  // Physical item metadata (for reuse from FOLIO)
  barcode?: string | null;
  callNumber?: string | null;
  copy?: string | null;
  instanceId?: string | null;
  holdingsId?: string | null;
  instanceHrid?: string | null;
  
  // Location information
  temporaryLocationId?: string | null;
  permanentLocationId?: string | null;
  
  // Full FOLIO copied item data (preserved as JSON)
  copiedItem?: Record<string, unknown> | null;
}

/**
 * Folder data structure for draft payload
 */
export interface DraftFolderPayload {
  // Frontend ID (used for UI tracking)
  id: string;
  
  // Backend ID (if folder exists in database)
  backendFolderId?: string | null;
  
  // Folder info
  title: string;
  description?: string | null;
  
  // Position in overall list
  position?: number | null;
  
  // UI state (not persisted to backend, but useful for draft restoration)
  isOpen?: boolean;
}

/**
 * Draft Store State
 */
interface DraftState {
  // Current draft being edited (by reserve ID)
  drafts: Record<string, DraftPayload>;
  
  // Save status tracking
  savingStatus: Record<string, 'idle' | 'saving' | 'saved' | 'error'>;
  lastSaveTime: Record<string, string>; // ISO date strings for serialization
  saveErrors: Record<string, string>;
  
  // Unsaved changes tracking
  hasUnsavedChanges: Record<string, boolean>;
  
  // Actions
  setDraft: (reserveId: string, draft: DraftPayload) => void;
  getDraft: (reserveId: string) => DraftPayload | undefined;
  deleteDraft: (reserveId: string) => void;
  clearAllDrafts: () => void;
  
  // Save status management
  setSavingStatus: (reserveId: string, status: 'idle' | 'saving' | 'saved' | 'error') => void;
  getSavingStatus: (reserveId: string) => 'idle' | 'saving' | 'saved' | 'error';
  setLastSaveTime: (reserveId: string, time: Date) => void;
  getLastSaveTime: (reserveId: string) => Date | undefined;
  setSaveError: (reserveId: string, error: string) => void;
  getSaveError: (reserveId: string) => string | undefined;
  clearSaveError: (reserveId: string) => void;
  
  // Unsaved changes tracking
  markAsChanged: (reserveId: string) => void;
  markAsSaved: (reserveId: string) => void;
  hasChanges: (reserveId: string) => boolean;
}

/**
 * Draft Store
 * 
 * Manages draft state for course reserves, including:
 * - Storing draft payloads
 * - Tracking save status
 * - Managing unsaved changes
 */
export const useDraftStore = create<DraftState>()(
  devtools(
    persist(
      (set, get) => ({
        drafts: {},
        savingStatus: {},
        lastSaveTime: {},
        saveErrors: {},
        hasUnsavedChanges: {},

        setDraft: (reserveId: string, draft: DraftPayload) => {
          set((state) => ({
            drafts: { ...state.drafts, [reserveId]: draft },
          }));
        },

        getDraft: (reserveId: string) => {
          return get().drafts[reserveId];
        },

        deleteDraft: (reserveId: string) => {
          set((state) => {
            const { [reserveId]: _, ...restDrafts } = state.drafts;
            const { [reserveId]: __, ...restSavingStatus } = state.savingStatus;
            const { [reserveId]: ___, ...restLastSaveTime } = state.lastSaveTime;
            const { [reserveId]: ____, ...restSaveErrors } = state.saveErrors;
            const { [reserveId]: _____, ...restHasUnsavedChanges } = state.hasUnsavedChanges;
            
            return {
              drafts: restDrafts,
              savingStatus: restSavingStatus,
              lastSaveTime: restLastSaveTime,
              saveErrors: restSaveErrors,
              hasUnsavedChanges: restHasUnsavedChanges,
            };
          });
        },

        clearAllDrafts: () => {
          set({
            drafts: {},
            savingStatus: {},
            lastSaveTime: {},
            saveErrors: {},
            hasUnsavedChanges: {},
          });
        },

        setSavingStatus: (reserveId: string, status: 'idle' | 'saving' | 'saved' | 'error') => {
          set((state) => ({
            savingStatus: { ...state.savingStatus, [reserveId]: status },
          }));
        },

        getSavingStatus: (reserveId: string) => {
          return get().savingStatus[reserveId] || 'idle';
        },

        setLastSaveTime: (reserveId: string, time: Date) => {
          set((state) => ({
            lastSaveTime: { ...state.lastSaveTime, [reserveId]: time.toISOString() },
          }));
        },

        getLastSaveTime: (reserveId: string) => {
          const isoString = get().lastSaveTime[reserveId];
          return isoString ? new Date(isoString) : undefined;
        },

        setSaveError: (reserveId: string, error: string) => {
          set((state) => ({
            saveErrors: { ...state.saveErrors, [reserveId]: error },
          }));
        },

        getSaveError: (reserveId: string) => {
          return get().saveErrors[reserveId];
        },

        clearSaveError: (reserveId: string) => {
          set((state) => {
            const { [reserveId]: _, ...restSaveErrors } = state.saveErrors;
            return { saveErrors: restSaveErrors };
          });
        },

        markAsChanged: (reserveId: string) => {
          set((state) => ({
            hasUnsavedChanges: { ...state.hasUnsavedChanges, [reserveId]: true },
          }));
        },

        markAsSaved: (reserveId: string) => {
          set((state) => ({
            hasUnsavedChanges: { ...state.hasUnsavedChanges, [reserveId]: false },
          }));
        },

        hasChanges: (reserveId: string) => {
          return get().hasUnsavedChanges[reserveId] || false;
        },
      }),
      {
        name: 'draft-storage',
      }
    ),
    { name: 'DraftStore' }
  )
);
