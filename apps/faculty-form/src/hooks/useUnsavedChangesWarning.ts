import { useEffect, useCallback } from 'react';
import { useDraftStore } from '@/store/draftStore';

/**
 * Hook to warn users about unsaved changes before leaving the page
 * 
 * @param enabled - Whether the warning is enabled
 * @param hasUnsavedChanges - Whether there are unsaved changes
 */
export function useUnsavedChangesWarning(
  enabled: boolean = true,
  hasUnsavedChanges: boolean = false
) {
  // Warn before page unload (refresh, close tab, navigate away)
  useEffect(() => {
    if (!enabled || !hasUnsavedChanges) {
      return;
    }

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Modern browsers require returnValue to be set
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, hasUnsavedChanges]);
}

/**
 * Hook to check if any reserves have unsaved changes across the entire app
 */
export function useHasAnyUnsavedChanges(): boolean {
  const draftStore = useDraftStore();
  
  // Check if any reserve has unsaved changes
  return Object.values(draftStore.hasUnsavedChanges).some(changed => changed === true);
}
