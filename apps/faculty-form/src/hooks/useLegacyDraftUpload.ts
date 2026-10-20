import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { buildSubmissionPayload } from '@/handlers/submissionPayload';
import { createDraft, getDraft } from '@/services/api/facultyDraftApi';
import { useDraftStore } from '@/store/draftStore';
import type { CourseReserve } from '@/store/courseReservesStore';
import { useReserveStore } from '@/store/useReserveStore';

const migrationJobs = new Map<string, Promise<string | undefined>>();
const migratedReserveIds = new Set<string>();
const notifiedExistingDrafts = new Set<string>();

export function useLegacyDraftUpload(enabled: boolean, onServerDraftFound?: (uuid: string) => void) {
  const onServerDraftFoundRef = useRef(onServerDraftFound);
  onServerDraftFoundRef.current = onServerDraftFound;

  useEffect(() => {
    if (!enabled) return;
    void Promise.resolve(useReserveStore.getState().fetchSubmissions()).then(() => migrateLocalDrafts((uuid) => {
      onServerDraftFoundRef.current?.(uuid);
    }));
  }, [enabled]);
}

async function migrateLocalDrafts(onServerDraftFound?: (uuid: string) => void) {
  const reserves = useReserveStore.getState().reserves;
  const localDrafts = reserves.filter((reserve) => (
    reserve.id.startsWith('reserve-') && reserve.items.length > 0 && !reserve.submissionUuid
  ));
  const resolvedDrafts = await Promise.all(localDrafts.map(migrateOneDraft));
  resolvedDrafts.forEach((uuid) => {
    if (uuid) onServerDraftFound?.(uuid);
  });
}

function migrateOneDraft(reserve: CourseReserve): Promise<string | undefined> {
  if (migratedReserveIds.has(reserve.id)) return Promise.resolve(undefined);
  const pending = migrationJobs.get(reserve.id);
  if (pending) return pending;

  const job = uploadOrUseServerCopy(reserve).finally(() => migrationJobs.delete(reserve.id));
  migrationJobs.set(reserve.id, job);
  return job;
}

async function uploadOrUseServerCopy(localDraft: CourseReserve): Promise<string | undefined> {
  const current = useReserveStore.getState().getReserveById(localDraft.id);
  if (!current || current.submissionUuid || current.items.length === 0) return undefined;

  const serverSubmission = useReserveStore.getState().reserves.find((reserve) => (
    reserve.id !== current.id &&
    reserve.courseAssignmentId === current.courseAssignmentId &&
    reserve.academicPeriod === current.academicPeriod
  ));
  if (serverSubmission) {
    dropLocalDraft(current.id);
    notifyExistingDraft(current.id);
    return serverSubmission.id;
  }

  try {
    const response = await createDraft(buildSubmissionPayload(current));
    if (response.existing) {
      const latest = await getDraft(response.submission_uuid);
      useReserveStore.setState((state) => ({
        reserves: [latest, ...state.reserves.filter((reserve) => (
          reserve.id !== latest.id && reserve.id !== current.id
        ))],
      }));
      useDraftStore.getState().deleteDraft(current.id);
      notifyExistingDraft(current.id);
      migratedReserveIds.add(current.id);
      return latest.id;
    }

    useReserveStore.getState().updateReserve(current.id, {
      submissionUuid: response.submission_uuid,
      draftVersion: response.draft_version,
    });
    useDraftStore.getState().markAsSaved(current.id);
    migratedReserveIds.add(current.id);
    return undefined;
  } catch (error) {
    console.error('Failed to upload a local faculty draft:', error);
    return undefined;
  }
}

function dropLocalDraft(reserveId: string) {
  useReserveStore.getState().deleteReserve(reserveId);
  useDraftStore.getState().deleteDraft(reserveId);
  migratedReserveIds.add(reserveId);
}

function notifyExistingDraft(reserveId: string) {
  if (notifiedExistingDrafts.has(reserveId)) return;
  notifiedExistingDrafts.add(reserveId);
  toast.info('The existing server list was kept for this course.');
}
