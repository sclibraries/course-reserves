import { useCallback } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import type { CourseReserve } from '@/store/courseReservesStore';
import { useLegacyDraftUpload } from './useLegacyDraftUpload';
import { useServerDraftSync } from './useServerDraftSync';

export function useSubmissionEditorDrafts(
  reserveId: string | undefined,
  reserve: CourseReserve | null | undefined,
  isAuthenticated: boolean,
  isReadOnly: boolean,
  navigate: NavigateFunction,
) {
  const draftSync = useServerDraftSync(reserveId, reserve, {
    autoSaveEnabled: !isReadOnly && reserve?.status === 'draft',
    autoSaveDelay: 3000,
  });
  const redirectToServerDraft = useCallback((uuid: string) => {
    navigate(`/submission/${uuid}/edit`, { replace: true });
  }, [navigate]);

  useLegacyDraftUpload(
    isAuthenticated && !!reserve?.id.startsWith('reserve-') && !reserve.submissionUuid && reserve.items.length > 0,
    redirectToServerDraft,
  );

  return {
    ...draftSync,
    submitDraft: draftSync.submitCurrentDraft,
  };
}
