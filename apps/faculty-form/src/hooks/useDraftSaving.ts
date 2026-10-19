import { useEffect, useRef, useCallback } from 'react';
import { useDraftStore } from '@/store/draftStore';
import type { DraftPayload } from '@/store/draftStore';
import type { CourseReserve } from '@/store/courseReservesStore';
import { convertReserveToDraft } from '@/utils/reserveToDraft';

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
