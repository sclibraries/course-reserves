import { useEffect, useRef, useCallback } from 'react';
import { useDraftStore, DraftPayload, DraftItemPayload, DraftFolderPayload } from '@/store/draftStore';
import { CourseReserve, CourseItem, CourseFolder } from '@/store/courseReservesStore';

/**
 * Configuration for draft auto-save behavior
 */
interface DraftSavingConfig {
  // Time in ms to wait after last change before auto-saving (default: 3000ms / 3 seconds)
  autoSaveDelay?: number;
  
  // Whether auto-save is enabled (default: true)
  autoSaveEnabled?: boolean;
  
  // Callback function to actually save the draft to the backend
  // Should return true on success, false on failure
  onSave?: (payload: DraftPayload) => Promise<boolean>;
  
  // Callback when save succeeds
  onSaveSuccess?: () => void;
  
  // Callback when save fails
  onSaveError?: (error: string) => void;
}

/**
 * Convert a CourseReserve to a DraftPayload
 */
function convertReserveToDraft(reserve: CourseReserve, currentVersion: number = 0): DraftPayload {
  // Convert items
  const items: DraftItemPayload[] = reserve.items.map((item) => ({
    id: item.id,
    backendItemId: item.backendItemId || null,
    title: item.title,
    materialType: item.materialType,
    status: item.status,
    authors: item.authors || null,
    isbn: item.isbn || null,
    publisher: item.publisher || null,
    publicationYear: item.publicationYear || null,
    edition: item.edition || null,
    pages: item.pages || null,
    chapterTitle: item.chapterTitle || null,
    journalTitle: item.journalTitle || null,
    volume: item.volume || null,
    issue: item.issue || null,
    doi: item.doi || null,
    url: item.url || null,
    notes: item.notes || null,
    libraryNotes: item.libraryNotes || null,
    folderId: item.folderId || null,
    displayOrder: item.displayOrder || null,
    displayStartDate: item.displayStartDate || null,
    displayEndDate: item.displayEndDate || null,
    hasAttachment: item.hasAttachment || false,
    attachmentName: item.attachmentName || null,
    attachmentSize: item.attachmentSize || null,
    attachmentType: item.attachmentType || null,
    barcode: item.barcode || null,
    callNumber: item.callNumber || null,
    copy: item.copy || null,
    instanceId: item.instanceId || null,
    holdingsId: item.holdingsId || null,
    instanceHrid: item.instanceHrid || null,
    temporaryLocationId: item.temporaryLocationId || null,
    permanentLocationId: item.permanentLocationId || null,
    copiedItem: item.copiedItem || null,
  }));

  // Convert folders
  const folders: DraftFolderPayload[] = reserve.folders.map((folder) => ({
    id: folder.id,
    backendFolderId: folder.backendFolderId || null,
    title: folder.title,
    description: folder.description || null,
    position: folder.position || null,
    isOpen: folder.isOpen,
  }));

  return {
    uuid: reserve.id,
    courseCode: reserve.courseCode,
    courseTitle: reserve.courseTitle,
    section: reserve.section,
    instructors: reserve.instructors,
    term: reserve.term,
    submissionNotes: reserve.submissionNotes || null,
    neededByDate: reserve.neededByDate || null,
    courseAssignmentId: reserve.courseAssignmentId || null,
    items,
    folders,
    isDraft: true,
    lastSavedAt: new Date().toISOString(),
    draftVersion: currentVersion + 1,
  };
}

/**
 * Hook for managing draft saving with both manual and auto-save functionality
 * 
 * @param reserveId - The ID of the reserve being edited
 * @param reserve - The current reserve data
 * @param config - Configuration for auto-save behavior
 * 
 * @returns Object with save functions and status information
 */
export function useDraftSaving(
  reserveId: string | undefined,
  reserve: CourseReserve | null | undefined,
  config: DraftSavingConfig = {}
) {
  const {
    autoSaveDelay = 3000,
    autoSaveEnabled = true,
    onSave,
    onSaveSuccess,
    onSaveError,
  } = config;

  const draftStore = useDraftStore();
  
  // Refs for debouncing
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastChangeRef = useRef<Date>(new Date());
  const isSavingRef = useRef<boolean>(false);

  /**
   * Perform the actual save operation
   */
  const performSave = useCallback(
    async (isManual: boolean = false): Promise<boolean> => {
      if (!reserveId || !reserve) {
        console.warn('Cannot save: reserveId or reserve is missing');
        return false;
      }

      // Prevent concurrent saves
      if (isSavingRef.current) {
        console.log('Save already in progress, skipping...');
        return false;
      }

      try {
        isSavingRef.current = true;
        draftStore.setSavingStatus(reserveId, 'saving');
        draftStore.clearSaveError(reserveId);

        // Get current draft version
        const currentDraft = draftStore.getDraft(reserveId);
        const currentVersion = currentDraft?.draftVersion || 0;

        // Convert reserve to draft payload
        const draftPayload = convertReserveToDraft(reserve, currentVersion);

        // Save to store
        draftStore.setDraft(reserveId, draftPayload);

        // If onSave callback is provided, call it to save to backend
        if (onSave) {
          const success = await onSave(draftPayload);
          
          if (success) {
            draftStore.setSavingStatus(reserveId, 'saved');
            draftStore.setLastSaveTime(reserveId, new Date());
            draftStore.markAsSaved(reserveId);
            
            if (onSaveSuccess) {
              onSaveSuccess();
            }
            
            console.log(`Draft ${isManual ? 'manually' : 'auto-'} saved successfully:`, reserveId);
            return true;
          } else {
            throw new Error('Save operation returned false');
          }
        } else {
          // No backend save configured, just update local store
          draftStore.setSavingStatus(reserveId, 'saved');
          draftStore.setLastSaveTime(reserveId, new Date());
          draftStore.markAsSaved(reserveId);
          return true;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Failed to save draft:', errorMessage);
        
        draftStore.setSavingStatus(reserveId, 'error');
        draftStore.setSaveError(reserveId, errorMessage);
        
        if (onSaveError) {
          onSaveError(errorMessage);
        }
        
        return false;
      } finally {
        isSavingRef.current = false;
      }
    },
    [reserveId, reserve, onSave, onSaveSuccess, onSaveError, draftStore]
  );

  /**
   * Manually trigger a save
   */
  const saveDraft = useCallback(async (): Promise<boolean> => {
    // Cancel any pending auto-save
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    return performSave(true);
  }, [performSave]);

  /**
   * Mark that changes have been made (triggers auto-save timer)
   */
  const markChanged = useCallback(() => {
    if (!reserveId || !autoSaveEnabled) {
      return;
    }

    // Update last change time
    lastChangeRef.current = new Date();
    
    // Mark as changed in store
    draftStore.markAsChanged(reserveId);

    // Clear existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // Set new timer for auto-save
    autoSaveTimerRef.current = setTimeout(() => {
      console.log('Auto-save triggered after', autoSaveDelay, 'ms');
      performSave(false);
    }, autoSaveDelay);
  }, [reserveId, autoSaveEnabled, autoSaveDelay, performSave, draftStore]);

  /**
   * Load a draft from the store
   */
  const loadDraft = useCallback(
    (id: string): DraftPayload | undefined => {
      return draftStore.getDraft(id);
    },
    [draftStore]
  );

  /**
   * Delete a draft
   */
  const deleteDraft = useCallback(
    (id: string) => {
      draftStore.deleteDraft(id);
    },
    [draftStore]
  );

  useEffect(() => {
    if (autoSaveEnabled || !autoSaveTimerRef.current) {
      return;
    }

    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = null;
  }, [autoSaveEnabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Get current status
  const savingStatus = reserveId ? draftStore.getSavingStatus(reserveId) : 'idle';
  const lastSaveTime = reserveId ? draftStore.getLastSaveTime(reserveId) : undefined;
  const saveError = reserveId ? draftStore.getSaveError(reserveId) : undefined;
  const hasUnsavedChanges = reserveId ? draftStore.hasChanges(reserveId) : false;

  return {
    // Actions
    saveDraft,
    markChanged,
    loadDraft,
    deleteDraft,
    
    // Status
    savingStatus,
    lastSaveTime,
    saveError,
    hasUnsavedChanges,
    isSaving: savingStatus === 'saving',
    
    // Helpers
    convertReserveToDraft: (reserve: CourseReserve) => convertReserveToDraft(reserve),
  };
}
