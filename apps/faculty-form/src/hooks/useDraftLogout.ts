import { useCallback, useState } from 'react';
import { getSafeErrorFeedback, notify } from '@/services/notify';
import { buildSubmissionPayload } from '@/handlers/submissionPayload';
import { syncDraft } from '@/services/api/facultyDraftApi';
import { useDraftStore } from '@/store/draftStore';
import { useReserveStore } from '@/store/useReserveStore';

export function useDraftLogout(onLogout: () => void) {
  const [isSaving, setIsSaving] = useState(false);

  const saveAndLogout = useCallback(async () => {
    setIsSaving(true);
    try {
      const draftStore = useDraftStore.getState();
      const reserveIds = Object.keys(draftStore.hasUnsavedChanges)
        .filter((id) => draftStore.hasUnsavedChanges[id]);

      for (const reserveId of reserveIds) {
        const reserve = useReserveStore.getState().getReserveById(reserveId);
        if (!reserve) continue;
        const result = await syncDraft(reserve, buildSubmissionPayload(reserve));
        if (result.existing) throw new Error('A server draft already exists for this course');
        useReserveStore.getState().updateReserve(reserveId, {
          submissionUuid: result.submission_uuid,
          draftVersion: result.draft_version,
        });
        draftStore.setLastSaveTime(reserveId, new Date());
        draftStore.markAsSaved(reserveId);
      }

      notify.success('All changes saved');
      onLogout();
    } catch (error) {
      console.error('Failed to save drafts before logout:', error);
      const feedback = getSafeErrorFeedback(error, "Couldn't save your drafts");
      notify.error(feedback.message, { reference: feedback.reference });
    } finally {
      setIsSaving(false);
    }
  }, [onLogout]);

  return { isSaving, handleSaveAndLogout: saveAndLogout };
}
